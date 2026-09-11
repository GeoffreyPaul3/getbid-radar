import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const workspaceIdSchema = z.object({
  workspaceId: z.string().uuid(),
});

const initiateCheckoutSchema = z.object({
  workspaceId: z.string().uuid(),
  plan: z.enum(["starter", "growth", "pro"]),
  currency: z.enum(["MWK", "USD"]),
  returnUrl: z.string().url().optional(),
});

const verifyPaymentSchema = z.object({
  workspaceId: z.string().uuid(),
  txRef: z.string().min(1),
});

export const getWorkspaceBillingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => workspaceIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { getWorkspaceBillingContext } = await import("./entitlements.server");
    return getWorkspaceBillingContext(context.supabase, data.workspaceId);
  });

export const initiateCheckoutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => initiateCheckoutSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Authorization: only workspace owners and admins may initiate billing checkout.
    // Uses the session-scoped supabase client (RLS applies) to verify role.
    const { data: membership, error: roleError } = await context.supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (roleError || !membership) {
      throw new Error("BILLING_UNAUTHORIZED: You are not a member of this workspace.");
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error(
        "BILLING_UNAUTHORIZED: Only workspace owners and administrators may initiate billing checkout."
      );
    }

    // Get user details for PayChangu receipt
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const userEmail = profile?.email || context.claims.email || "billing@getbidradar.com";
    const userName = profile?.full_name || undefined;

    const { initiatePayChanguCheckout } = await import("./paychangu.server");
    return initiatePayChanguCheckout({
      supabase: context.supabase,
      workspaceId: data.workspaceId,
      userId: context.userId,
      plan: data.plan,
      currency: data.currency,
      userEmail,
      userName,
      returnUrlOverride: data.returnUrl,
    });
  });

export const verifyPaymentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => verifyPaymentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { verifyAndActivatePayChanguPayment } = await import("./paychangu.server");
    return verifyAndActivatePayChanguPayment({
      supabase: context.supabase,
      workspaceId: data.workspaceId,
      txRef: data.txRef,
      recipientEmail: profile?.email || context.claims.email,
      recipientName: profile?.full_name || undefined,
    });
  });

export const getBillingHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => workspaceIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: transactions, error } = await context.supabase
      .from("billing_transactions")
      .select(
        "id, tx_ref, plan, currency, amount, status, provider_status, activated_at, created_at",
      )
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[Billing] Error fetching transaction history:", error.message);
      return [];
    }

    return transactions || [];
  });
