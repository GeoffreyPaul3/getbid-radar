import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PLAN_CONFIGS,
  getPlanConfig,
  getPlanPrice,
  isPlanTier,
  isPurchasablePlan,
  isBillingCurrency,
  formatBillingAmount,
  type PlanTier,
  type BillingCurrency,
} from "./plans";
import {
  getWorkspaceBillingContext,
  canAnalyzeTender,
  recordAnalysisUsage,
} from "./entitlements.server";
import { verifyAndActivatePayChanguPayment } from "./paychangu.server";

describe("Plan Configuration & Pricing Architecture", () => {
  it("defines exact plans with no perpetual free plan", () => {
    expect(PLAN_CONFIGS.trial).toBeDefined();
    expect(PLAN_CONFIGS.starter).toBeDefined();
    expect(PLAN_CONFIGS.growth).toBeDefined();
    expect(PLAN_CONFIGS.pro).toBeDefined();

    expect(PLAN_CONFIGS.trial.isPurchasable).toBe(false);
    expect(PLAN_CONFIGS.starter.isPurchasable).toBe(true);
    expect(PLAN_CONFIGS.growth.isPurchasable).toBe(true);
    expect(PLAN_CONFIGS.pro.isPurchasable).toBe(true);
  });

  it("returns correct prices for Starter (MWK 75,000 / USD 45)", () => {
    expect(getPlanPrice("starter", "MWK")).toBe(75_000);
    expect(getPlanPrice("starter", "USD")).toBe(45);
  });

  it("returns correct prices for Growth (MWK 150,000 / USD 90)", () => {
    expect(getPlanPrice("growth", "MWK")).toBe(150_000);
    expect(getPlanPrice("growth", "USD")).toBe(90);
  });

  it("returns correct prices for Pro (MWK 280,000 / USD 165)", () => {
    expect(getPlanPrice("pro", "MWK")).toBe(280_000);
    expect(getPlanPrice("pro", "USD")).toBe(165);
  });

  it("enforces analysis allowances per plan tier", () => {
    expect(getPlanConfig("trial").analysisAllowance).toBe(3);
    expect(getPlanConfig("starter").analysisAllowance).toBe(5);
    expect(getPlanConfig("growth").analysisAllowance).toBe(25);
    expect(getPlanConfig("pro").analysisAllowance).toBe(-1); // Unlimited
  });

  it("validates plan tiers and currencies", () => {
    expect(isPlanTier("trial")).toBe(true);
    expect(isPlanTier("starter")).toBe(true);
    expect(isPlanTier("enterprise_custom")).toBe(false);

    expect(isPurchasablePlan("starter")).toBe(true);
    expect(isPurchasablePlan("trial")).toBe(false);

    expect(isBillingCurrency("MWK")).toBe(true);
    expect(isBillingCurrency("USD")).toBe(true);
    expect(isBillingCurrency("EUR")).toBe(false);
  });

  it("formats currency strings correctly", () => {
    expect(formatBillingAmount(75000, "MWK")).toBe("MWK 75,000");
    expect(formatBillingAmount(45, "USD")).toBe("$45");
  });
});

describe("Server Entitlement Engine", () => {
  function createMockSupabase(params: {
    workspace: {
      id: string;
      plan: string;
      subscription_status: string;
      trial_ends_at: string;
      created_at: string;
    };
    usageRecords?: Array<{ units: number }>;
  }) {
    return {
      from: vi.fn((table: string) => {
        if (table === "workspaces") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: params.workspace,
              error: null,
            }),
          };
        }
        if (table === "usage_records") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({
              data: params.usageRecords ?? [],
              error: null,
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === "activity_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    } as any;
  }

  it("allows active trial with analyses remaining", async () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const mockSupabase = createMockSupabase({
      workspace: {
        id: "ws-1",
        plan: "trial",
        subscription_status: "trialing",
        trial_ends_at: futureDate,
        created_at: new Date().toISOString(),
      },
      usageRecords: [{ units: 1 }], // 1 out of 3 used
    });

    const context = await getWorkspaceBillingContext(mockSupabase, "ws-1");
    expect(context.canAnalyze).toBe(true);
    expect(context.analysesUsed).toBe(1);
    expect(context.remainingAnalyses).toBe(2);
    expect(context.isTrialExpired).toBe(false);
  });

  it("blocks expired trial even if usage allowance remains", async () => {
    const pastDate = new Date(Date.now() - 2 * 86400000).toISOString();
    const mockSupabase = createMockSupabase({
      workspace: {
        id: "ws-2",
        plan: "trial",
        subscription_status: "trialing",
        trial_ends_at: pastDate,
        created_at: new Date(Date.now() - 16 * 86400000).toISOString(),
      },
      usageRecords: [{ units: 1 }],
    });

    const check = await canAnalyzeTender(mockSupabase, "ws-2");
    expect(check.allowed).toBe(false);
    expect(check.context.blockReason).toBe("TRIAL_EXPIRED");
    expect(check.reason).toContain("expired");
  });

  it("blocks trial workspace when 3/3 analyses have been consumed", async () => {
    const futureDate = new Date(Date.now() + 5 * 86400000).toISOString();
    const mockSupabase = createMockSupabase({
      workspace: {
        id: "ws-3",
        plan: "trial",
        subscription_status: "trialing",
        trial_ends_at: futureDate,
        created_at: new Date().toISOString(),
      },
      usageRecords: [{ units: 1 }, { units: 1 }, { units: 1 }],
    });

    const check = await canAnalyzeTender(mockSupabase, "ws-3");
    expect(check.allowed).toBe(false);
    expect(check.context.blockReason).toBe("ALLOWANCE_EXCEEDED");
    expect(check.context.remainingAnalyses).toBe(0);
  });

  it("allows unlimited analyses on Pro tier regardless of usage count", async () => {
    const mockSupabase = createMockSupabase({
      workspace: {
        id: "ws-4",
        plan: "pro",
        subscription_status: "active",
        trial_ends_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      usageRecords: Array(50).fill({ units: 1 }), // 50 analyses already
    });

    const check = await canAnalyzeTender(mockSupabase, "ws-4");
    expect(check.allowed).toBe(true);
    expect(check.context.analysesAllowance).toBe(-1);
    expect(check.context.remainingAnalyses).toBeNull();
  });
});

describe("PayChangu Server-Authoritative Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env["PAYCHANGU_SECRET_KEY"] = "sec-test-mock-key";
  });

  it("idempotently handles already activated transactions without double-charging or error", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "billing_transactions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "tx-already-done",
                workspace_id: "ws-test",
                plan: "growth",
                currency: "MWK",
                amount: 150000,
                status: "successful",
                activated_at: "2026-09-08T20:00:00Z",
                tx_ref: "gbr_test_already_activated",
              },
              error: null,
            }),
          };
        }
        return {};
      }),
    } as any;

    const result = await verifyAndActivatePayChanguPayment({
      supabase: mockSupabase,
      workspaceId: "ws-test",
      txRef: "gbr_test_already_activated",
    });

    expect(result.status).toBe("successful");
    expect(result.alreadyActivated).toBe(true);
    expect(result.plan).toBe("growth");
    expect(result.amount).toBe(150000);
  });

  it("rejects verification if transaction belongs to another workspace (tenant isolation)", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "tx-victim",
            workspace_id: "ws-other-tenant",
            plan: "growth",
            currency: "USD",
            amount: 90,
            status: "pending",
            tx_ref: "gbr_victim_ref",
          },
          error: null,
        }),
      })),
    } as any;

    await expect(
      verifyAndActivatePayChanguPayment({
        supabase: mockSupabase,
        workspaceId: "ws-attacker",
        txRef: "gbr_victim_ref",
      }),
    ).rejects.toThrow("Transaction does not belong to the active workspace");
  });

  it("fails verification when provider reports an amount mismatch", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "tx-tamper",
            workspace_id: "ws-tamper",
            plan: "growth",
            currency: "USD",
            amount: 90, // Expected 90
            status: "pending",
            tx_ref: "gbr_tamper_ref",
          },
          error: null,
        }),
      })),
    } as any;

    // Mock PayChangu verify endpoint returning only $10
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "success",
        data: {
          status: "success",
          amount: 10, // Tampered amount!
          currency: "USD",
          tx_ref: "gbr_tamper_ref",
        },
      }),
    } as any);

    const result = await verifyAndActivatePayChanguPayment({
      supabase: mockSupabase,
      workspaceId: "ws-tamper",
      txRef: "gbr_tamper_ref",
    });

    expect(result.status).toBe("verification_failed");
    expect(result.message).toContain("Amount mismatch");
  });
});
