export type PlanTier = "trial" | "starter" | "growth" | "pro";
export type BillingCurrency = "MWK" | "USD";

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  tagline: string;
  description: string;
  monthlyPrice: Record<BillingCurrency, number>;
  analysisAllowance: number; // -1 means unlimited
  memberAllowance: number; // -1 means unlimited
  isPurchasable: boolean;
  highlighted?: boolean;
  badge?: string;
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  trial: {
    tier: "trial",
    name: "14-Day Evaluation",
    tagline: "Commercial pilot evaluation",
    description: "Time-limited commercial evaluation for enterprise bid teams.",
    monthlyPrice: {
      MWK: 0,
      USD: 0,
    },
    analysisAllowance: 3,
    memberAllowance: 1,
    isPurchasable: false,
    features: [
      "3 full tender analyses",
      "1 workspace seat",
      "14-day evaluation window",
      "Deterministic scoring & recommendation",
      "Tender intelligence report",
      "Requirement gap analysis",
    ],
  },
  starter: {
    tier: "starter",
    name: "Starter",
    tagline: "For boutique consultancies & contractors",
    description: "Essential intelligence for small teams bidding on strategic tenders.",
    monthlyPrice: {
      MWK: 75_000,
      USD: 45,
    },
    analysisAllowance: 5,
    memberAllowance: 3,
    isPurchasable: true,
    features: [
      "5 tender analyses per month",
      "Up to 3 team members",
      "Deterministic qualification scoring",
      "Requirements matrix & evidence inspector",
      "Bid workspace & task board",
      "Company evidence knowledge base",
    ],
  },
  growth: {
    tier: "growth",
    name: "Growth",
    tagline: "For active bidding organizations",
    description: "Comprehensive qualification & execution for growing enterprise bidders.",
    monthlyPrice: {
      MWK: 150_000,
      USD: 90,
    },
    analysisAllowance: 25,
    memberAllowance: 10,
    isPurchasable: true,
    highlighted: true,
    badge: "Most Popular",
    features: [
      "25 tender analyses per month",
      "Up to 10 team members",
      "Priority AI analysis pipeline with multi-model fallback",
      "Bid Command Center with full traceability",
      "Proposal section tracking & readiness intelligence",
      "Activity audit logging",
      "Priority email support",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro Enterprise",
    tagline: "For dedicated proposal divisions",
    description:
      "Unlimited contract intelligence and multi-seat bid command for high-volume firms.",
    monthlyPrice: {
      MWK: 280_000,
      USD: 165,
    },
    analysisAllowance: -1, // Unlimited
    memberAllowance: -1, // Unlimited
    isPurchasable: true,
    badge: "Enterprise Scale",
    features: [
      "Unlimited tender analyses",
      "Unlimited team members & seats",
      "Full multi-tenant RLS data isolation",
      "Dedicated high-throughput AI gateway routing",
      "Advanced Bid Command Center with compliance tracking",
      "Full export & activity audit trail",
      "Executive decision briefings & priority onboarding",
    ],
  },
};

export const PURCHASABLE_PLANS: PlanTier[] = ["starter", "growth", "pro"];
export const SUPPORTED_CURRENCIES: BillingCurrency[] = ["MWK", "USD"];

export function isPlanTier(value: unknown): value is PlanTier {
  return (
    typeof value === "string" &&
    (value === "trial" || value === "starter" || value === "growth" || value === "pro")
  );
}

export function isPurchasablePlan(value: unknown): value is "starter" | "growth" | "pro" {
  return (
    typeof value === "string" && (value === "starter" || value === "growth" || value === "pro")
  );
}

export function isBillingCurrency(value: unknown): value is BillingCurrency {
  return value === "MWK" || value === "USD";
}

export function getPlanConfig(tier: PlanTier): PlanConfig {
  const config = PLAN_CONFIGS[tier];
  if (!config) {
    throw new Error(`Invalid plan tier: ${tier}`);
  }
  return config;
}

export function getPlanPrice(tier: PlanTier, currency: BillingCurrency): number {
  const config = getPlanConfig(tier);
  const price = config.monthlyPrice[currency];
  if (price === undefined) {
    throw new Error(`Unsupported currency ${currency} for plan ${tier}`);
  }
  return price;
}

export function formatBillingAmount(amount: number, currency: BillingCurrency): string {
  if (currency === "MWK") {
    return `MWK ${amount.toLocaleString("en-US")}`;
  }
  return `$${amount.toLocaleString("en-US")}`;
}

export interface VerifyPaymentResult {
  status: "successful" | "pending" | "failed" | "verification_failed";
  plan: PlanTier;
  amount: number;
  currency: BillingCurrency;
  txRef: string;
  message: string;
  activatedAt?: string;
  alreadyActivated?: boolean;
}

export interface WorkspaceBillingContext {
  workspaceId: string;
  plan: PlanTier;
  planConfig: PlanConfig;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  isTrialExpired: boolean;
  isTrial: boolean;
  analysesUsed: number;
  analysesAllowance: number; // -1 for unlimited
  remainingAnalyses: number | null; // null if unlimited
  canAnalyze: boolean;
  blockReason: "TRIAL_EXPIRED" | "ALLOWANCE_EXCEEDED" | "SUBSCRIPTION_INACTIVE" | null;
  periodStart: string;
  periodEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  renewalDate: string | null;
  /** Human-readable countdown, e.g. "Renews in 24 days" or "Trial ends in 3 days" */
  countdownText: string;
}
