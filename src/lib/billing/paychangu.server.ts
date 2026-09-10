import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ensureServerEnv } from "../server-env";
import {
  type PlanTier,
  type BillingCurrency,
  type VerifyPaymentResult,
  getPlanConfig,
  getPlanPrice,
  isPurchasablePlan,
  isBillingCurrency,
} from "./plans";

export type Client = SupabaseClient<Database>;
export type { VerifyPaymentResult };

const PAYCHANGU_API_URL = "https://api.paychangu.com";

export interface InitiateCheckoutParams {
  supabase: Client;
  workspaceId: string;
  userId: string;
  plan: PlanTier;
  currency: BillingCurrency;
  userEmail: string;
  userName?: string | undefined;
  returnUrlOverride?: string | undefined;
}

export interface InitiateCheckoutResult {
  checkoutUrl: string;
  txRef: string;
  plan: PlanTier;
  amount: number;
  currency: BillingCurrency;
}

function getPayChanguSecretKey(): string {
  ensureServerEnv();
  const key = process.env["PAYCHANGU_SECRET_KEY"];
  if (!key || key.trim() === "") {
    throw new Error("PAYCHANGU_SECRET_KEY is not configured on the server");
  }
  return key.trim();
}

function getAppUrl(): string {
  return process.env["APP_URL"] || "https://getbidradar.com";
}

/**
 * Server-authoritative checkout initiation with PayChangu.
 * Generates an unguessable tx_ref, calculates price, records transaction, and gets checkout link.
 */
export async function initiatePayChanguCheckout(
  params: InitiateCheckoutParams,
): Promise<InitiateCheckoutResult> {
  const { supabase, workspaceId, userId, plan, currency, userEmail, userName } = params;

  if (!isPurchasablePlan(plan)) {
    throw new Error(`Plan "${plan}" is not a purchasable commercial tier.`);
  }

  if (!isBillingCurrency(currency)) {
    throw new Error(`Currency "${currency}" is not supported.`);
  }

  const secretKey = getPayChanguSecretKey();
  const planConfig = getPlanConfig(plan);
  const amount = getPlanPrice(plan, currency);
  const appUrl = getAppUrl();

  // Generate unguessable, unique transaction reference
  const uniqueToken = randomUUID().replace(/-/g, "").substring(0, 18);
  const txRef = `gbr_${workspaceId.substring(0, 8)}_${uniqueToken}`;

  // Persist pending transaction row in database
  const { error: insertErr } = await supabase.from("billing_transactions").insert({
    workspace_id: workspaceId,
    user_id: userId,
    tx_ref: txRef,
    plan,
    currency,
    amount,
    status: "pending",
  });

  if (insertErr) {
    console.error("[PayChangu] Failed to insert transaction:", insertErr.message);
    throw new Error(`Failed to create billing transaction: ${insertErr.message}`);
  }

  // Determine user name parts
  const names = (userName || "Contract Professional").trim().split(/\s+/);
  const firstName = names[0] || "Contract";
  const lastName = names.slice(1).join(" ") || "Professional";

  const callbackUrl =
    params.returnUrlOverride || `${appUrl}/billing/confirm?tx_ref=${encodeURIComponent(txRef)}`;

  const payload = {
    amount,
    currency,
    email: userEmail,
    first_name: firstName,
    last_name: lastName,
    callback_url: callbackUrl,
    return_url: callbackUrl,
    tx_ref: txRef,
    customization: {
      title: `GetBidRadar ${planConfig.name}`,
      description: `${planConfig.opportunityAllowance} opportunities/month & ${planConfig.memberAllowance} team seats subscription`,
    },
  };

  let response: Response;
  try {
    response = await fetch(`${PAYCHANGU_API_URL}/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[PayChangu] Checkout network request failed:", errorMsg);
    await supabase
      .from("billing_transactions")
      .update({
        status: "failed",
        failure_reason: `Network error reaching payment provider: ${errorMsg}`,
        updated_at: new Date().toISOString(),
      })
      .eq("tx_ref", txRef);

    throw new Error("We couldn't reach the payment gateway. Please try again in a few moments.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[PayChangu] Payment creation returned HTTP", response.status, errorText);

    await supabase
      .from("billing_transactions")
      .update({
        status: "failed",
        failure_reason: `Provider HTTP ${response.status}: ${errorText.substring(0, 300)}`,
        updated_at: new Date().toISOString(),
      })
      .eq("tx_ref", txRef);

    throw new Error("Payment gateway declined initiation. Please try again or contact support.");
  }

  const json = (await response.json()) as {
    status?: string;
    message?: string;
    data?: {
      checkout_url?: string;
    };
  };

  const checkoutUrl = json.data?.checkout_url;
  if (!checkoutUrl || typeof checkoutUrl !== "string") {
    console.error("[PayChangu] No checkout_url in provider response:", json);
    await supabase
      .from("billing_transactions")
      .update({
        status: "failed",
        failure_reason: `No checkout_url in response: ${JSON.stringify(json).substring(0, 300)}`,
        updated_at: new Date().toISOString(),
      })
      .eq("tx_ref", txRef);

    throw new Error("Payment gateway returned an invalid checkout URL. Please try again.");
  }

  return {
    checkoutUrl,
    txRef,
    plan,
    amount,
    currency,
  };
}

/**
 * Server-authoritative payment verification and subscription activation.
 * Never trusts client parameters. Calls PayChangu verify-payment endpoint directly,
 * validates matching amount, currency, and tx_ref, and idempotently activates the workspace plan.
 */
export async function verifyAndActivatePayChanguPayment(params: {
  supabase: Client;
  workspaceId: string;
  txRef: string;
  recipientEmail?: string | undefined;
  recipientName?: string | undefined;
}): Promise<VerifyPaymentResult> {
  const { supabase, workspaceId, txRef } = params;

  if (!txRef || typeof txRef !== "string" || txRef.trim() === "") {
    throw new Error("Missing transaction reference (tx_ref).");
  }

  // 1. Locate internal transaction
  const { data: transaction, error: txErr } = await supabase
    .from("billing_transactions")
    .select("id, workspace_id, plan, currency, amount, status, activated_at, tx_ref")
    .eq("tx_ref", txRef.trim())
    .single();

  if (txErr || !transaction) {
    throw new Error("Transaction record not found for this reference.");
  }

  // 2. Enforce workspace isolation
  if (transaction.workspace_id !== workspaceId) {
    throw new Error("Transaction does not belong to the active workspace.");
  }

  // 3. Idempotent check: If already activated, return success immediately
  if (transaction.status === "successful" && transaction.activated_at) {
    return {
      status: "successful",
      plan: transaction.plan as PlanTier,
      amount: Number(transaction.amount),
      currency: transaction.currency as BillingCurrency,
      txRef,
      message: "Subscription is already active.",
      activatedAt: transaction.activated_at,
      alreadyActivated: true,
    };
  }

  // 4. Authoritative call to PayChangu verify-payment
  const secretKey = getPayChanguSecretKey();

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch(
      `${PAYCHANGU_API_URL}/verify-payment/${encodeURIComponent(txRef.trim())}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );
  } catch (netErr: unknown) {
    const errorMsg = netErr instanceof Error ? netErr.message : String(netErr);
    console.error("[PayChangu] Verification network error:", errorMsg);
    return {
      status: "pending",
      plan: transaction.plan as PlanTier,
      amount: Number(transaction.amount),
      currency: transaction.currency as BillingCurrency,
      txRef,
      message: "Verification is temporarily unreachable. Please refresh in a moment.",
    };
  }

  const rawJson = (await verifyResponse.json()) as {
    status?: string;
    message?: string;
    data?: {
      status?: string;
      amount?: number | string;
      currency?: string;
      tx_ref?: string;
      trans_id?: string;
      reference?: string;
    } | null;
  };

  // Check provider status
  const providerOverallStatus = rawJson.status?.toLowerCase();
  const innerData = rawJson.data;
  const innerStatus = innerData?.status?.toLowerCase();

  const isSuccess =
    (providerOverallStatus === "success" || providerOverallStatus === "successful") &&
    (innerStatus === "success" || innerStatus === "successful");

  if (!isSuccess) {
    // If provider indicates pending or not yet completed
    if (
      innerStatus === "pending" ||
      rawJson.message?.includes("not created") ||
      rawJson.message?.includes("pending")
    ) {
      return {
        status: "pending",
        plan: transaction.plan as PlanTier,
        amount: Number(transaction.amount),
        currency: transaction.currency as BillingCurrency,
        txRef,
        message: "Payment is still being processed by the provider. Please wait a moment.",
      };
    }

    // Payment failed or was cancelled
    const failureReason = rawJson.message || innerStatus || "Payment was declined or cancelled.";
    await supabase
      .from("billing_transactions")
      .update({
        status: "failed",
        provider_status: innerStatus || providerOverallStatus || "failed",
        failure_reason: failureReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    return {
      status: "failed",
      plan: transaction.plan as PlanTier,
      amount: Number(transaction.amount),
      currency: transaction.currency as BillingCurrency,
      txRef,
      message: failureReason,
    };
  }

  // 5. Strict verification of amount, currency, and tx_ref match
  const providerAmount = Number(innerData?.amount);
  const expectedAmount = Number(transaction.amount);
  const providerCurrency = (innerData?.currency || "").toUpperCase();
  const expectedCurrency = transaction.currency.toUpperCase();
  const providerTxRef = innerData?.tx_ref;

  if (Math.abs(providerAmount - expectedAmount) > 0.01) {
    const errorMsg = `Amount mismatch: expected ${expectedAmount} but provider recorded ${providerAmount}`;
    console.error(`[PayChangu] Security check failed: ${errorMsg}`);
    await supabase
      .from("billing_transactions")
      .update({
        status: "verification_failed",
        provider_status: innerStatus,
        failure_reason: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    return {
      status: "verification_failed",
      plan: transaction.plan as PlanTier,
      amount: expectedAmount,
      currency: transaction.currency as BillingCurrency,
      txRef,
      message: "Payment verification failed: Amount mismatch detected. Please contact support.",
    };
  }

  if (providerCurrency !== expectedCurrency) {
    const errorMsg = `Currency mismatch: expected ${expectedCurrency} but provider recorded ${providerCurrency}`;
    console.error(`[PayChangu] Security check failed: ${errorMsg}`);
    await supabase
      .from("billing_transactions")
      .update({
        status: "verification_failed",
        provider_status: innerStatus,
        failure_reason: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    return {
      status: "verification_failed",
      plan: transaction.plan as PlanTier,
      amount: expectedAmount,
      currency: transaction.currency as BillingCurrency,
      txRef,
      message: "Payment verification failed: Currency mismatch detected. Please contact support.",
    };
  }

  if (providerTxRef && providerTxRef !== txRef.trim()) {
    const errorMsg = `Transaction reference mismatch: expected ${txRef} but got ${providerTxRef}`;
    console.error(`[PayChangu] Security check failed: ${errorMsg}`);
    await supabase
      .from("billing_transactions")
      .update({
        status: "verification_failed",
        provider_status: innerStatus,
        failure_reason: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    return {
      status: "verification_failed",
      plan: transaction.plan as PlanTier,
      amount: expectedAmount,
      currency: transaction.currency as BillingCurrency,
      txRef,
      message: "Payment verification failed: Reference mismatch detected.",
    };
  }

  // 6. Idempotent activation
  const activationTime = new Date().toISOString();
  const providerTxId = innerData?.trans_id || innerData?.reference || null;

  const { error: updateTxErr } = await supabase
    .from("billing_transactions")
    .update({
      status: "successful",
      provider_status: innerStatus || "successful",
      provider_tx_id: providerTxId,
      activated_at: activationTime,
      updated_at: activationTime,
    })
    .eq("id", transaction.id);

  if (updateTxErr) {
    console.error("[PayChangu] Failed to update transaction status:", updateTxErr.message);
  }

  // Update workspace plan, subscription status, and authoritative billing period
  const periodEnd = new Date(
    new Date(activationTime).getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error: updateWsErr } = await supabase
    .from("workspaces")
    .update({
      plan: transaction.plan,
      subscription_status: "active",
      subscription_started_at: activationTime,
      current_period_start: activationTime,
      current_period_end: periodEnd,
      renewal_date: periodEnd,
      updated_at: activationTime,
    })
    .eq("id", workspaceId);

  if (updateWsErr) {
    console.error("[PayChangu] Critical error updating workspace plan:", updateWsErr.message);
    throw new Error(`Failed to activate workspace subscription: ${updateWsErr.message}`);
  }

  // Tag all prior usage records (created before activation) as 'trial' so they
  // are never counted in the paid subscription allowance
  try {
    await supabase
      .from("usage_records")
      .update({ plan: "trial" })
      .eq("workspace_id", workspaceId)
      .lt("created_at", activationTime)
      .is("plan", null);
  } catch (tagErr) {
    console.warn("[PayChangu] Could not tag pre-activation usage records as trial:", tagErr);
  }

  // Record audit log
  try {
    await supabase.from("activity_logs").insert({
      workspace_id: workspaceId,
      action: "subscription_activated",
      resource_type: "workspace",
      metadata: {
        plan: transaction.plan,
        amount: expectedAmount,
        currency: expectedCurrency,
        tx_ref: txRef,
        activated_at: activationTime,
      },
    });
  } catch (logErr) {
    console.warn("[PayChangu] Could not write activity log:", logErr);
  }

  // Send Resend confirmation email if recipient email is available
  if (params.recipientEmail) {
    try {
      const { sendPaymentConfirmedEmail } = await import("../email/resend.server");
      await sendPaymentConfirmedEmail({
        to: params.recipientEmail,
        name: params.recipientName || "Contract Lead",
        plan: transaction.plan as PlanTier,
        amount: expectedAmount,
        currency: transaction.currency as BillingCurrency,
        txRef,
      });
    } catch (emailErr) {
      console.warn("[PayChangu] Transactional email dispatch failed (non-blocking):", emailErr);
    }
  }

  return {
    status: "successful",
    plan: transaction.plan as PlanTier,
    amount: expectedAmount,
    currency: transaction.currency as BillingCurrency,
    txRef,
    activatedAt: activationTime,
    message: `Payment verified. Your ${getPlanConfig(transaction.plan as PlanTier).name} plan is now active.`,
  };
}
