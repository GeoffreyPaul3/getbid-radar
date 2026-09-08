import {
  type PlanTier,
  type BillingCurrency,
  getPlanConfig,
  formatBillingAmount,
} from "../billing/plans";

const RESEND_API_URL = "https://api.resend.com/emails";

interface SendEmailResult {
  success: boolean;
  messageId?: string | undefined;
  reason?: string | undefined;
}

function getResendApiKey(): string | null {
  const key = process.env["RESEND_API_KEY"];
  return key && key.trim() !== "" ? key.trim() : null;
}

function getFromAddress(): string {
  return process.env["RESEND_FROM_EMAIL"] || "GetBidRadar <onboarding@resend.dev>";
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    console.warn(`[Resend] RESEND_API_KEY is not configured. Email to <${params.to}> suppressed: "${params.subject}"`);
    return { success: false, reason: "API_KEY_NOT_CONFIGURED" };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Resend] Failed to send email HTTP ${response.status}: ${errorText}`);
      return { success: false, reason: `HTTP_${response.status}` };
    }

    const json = (await response.json()) as { id?: string };
    return { success: true, messageId: json.id };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Resend] Network error sending email:", errorMsg);
    return { success: false, reason: errorMsg };
  }
}

/**
 * Sends a welcome & trial evaluation email upon workspace onboarding.
 */
export async function sendWelcomeTrialEmail(params: {
  to: string;
  name: string;
  trialEndsAt: string;
}): Promise<SendEmailResult> {
  const formattedDate = new Date(params.trialEndsAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const subject = "Welcome to GetBidRadar — Your 14-Day Bid Intelligence Pilot";
  const text = `Hello ${params.name},\n\nWelcome to GetBidRadar. Your workspace evaluation is active through ${formattedDate}.\n\nYou have 3 complimentary tender qualifications to test our deterministic scoring engine against your company's actual past performance evidence.\n\nSign in to analyze your first tender:\nhttps://getbidradar.com/tenders/new\n\nThe GetBidRadar Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #101828;">
      <div style="padding-bottom: 20px; border-bottom: 1px solid #E4E7EC;">
        <h2 style="margin: 0; color: #0B1220; font-size: 22px;">GetBidRadar</h2>
        <p style="margin: 4px 0 0; color: #667085; font-size: 13px;">Contract Intelligence & Bid Execution</p>
      </div>
      <div style="padding: 24px 0;">
        <h3 style="margin: 0 0 12px; color: #101828; font-size: 18px;">Welcome, ${params.name}</h3>
        <p style="color: #475467; font-size: 15px; line-height: 1.5;">
          Your 14-day commercial evaluation is now active through <strong>${formattedDate}</strong>.
        </p>
        <p style="color: #475467; font-size: 15px; line-height: 1.5;">
          GetBidRadar uses deterministic scoring to ensure you only commit resources to tenders where your technical capability and past evidence give you an unfair advantage.
        </p>
        <div style="margin: 28px 0;">
          <a href="https://getbidradar.com/tenders/new" style="background-color: #2563EB; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            Analyze Your First Tender →
          </a>
        </div>
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #E4E7EC; font-size: 12px; color: #98A2B3;">
        © ${new Date().getFullYear()} GetBidRadar. Enterprise procurement intelligence.
      </div>
    </div>
  `;

  return sendViaResend({ to: params.to, subject, text, html });
}

/**
 * Sends payment confirmation and subscription activation receipt.
 */
export async function sendPaymentConfirmedEmail(params: {
  to: string;
  name: string;
  plan: PlanTier;
  amount: number;
  currency: BillingCurrency;
  txRef: string;
}): Promise<SendEmailResult> {
  const planConfig = getPlanConfig(params.plan);
  const formattedAmount = formatBillingAmount(params.amount, params.currency);

  const subject = `Payment Confirmed: Your GetBidRadar ${planConfig.name} Plan is Active`;
  const text = `Hello ${params.name},\n\nThank you for your payment of ${formattedAmount}. Your ${planConfig.name} plan is now active on GetBidRadar.\n\nTransaction Reference: ${params.txRef}\nCapacity: ${planConfig.analysisAllowance === -1 ? "Unlimited" : planConfig.analysisAllowance} analyses per month\n\nAccess your dashboard: https://getbidradar.com/dashboard\n\nThe GetBidRadar Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #101828;">
      <div style="padding-bottom: 20px; border-bottom: 1px solid #E4E7EC;">
        <h2 style="margin: 0; color: #0B1220; font-size: 22px;">GetBidRadar</h2>
        <p style="margin: 4px 0 0; color: #667085; font-size: 13px;">Commercial Receipt & Plan Activation</p>
      </div>
      <div style="padding: 24px 0;">
        <div style="background-color: #E9F8F0; border: 1px solid #16A36A; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h4 style="margin: 0; color: #16A36A; font-size: 15px;">Payment Verified & Activated</h4>
          <p style="margin: 4px 0 0; color: #15803D; font-size: 13px;">Your workspace has been upgraded to <strong>${planConfig.name}</strong>.</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #667085;">Plan:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${planConfig.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #667085;">Amount Paid:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${formattedAmount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #667085;">Transaction Ref:</td>
            <td style="padding: 8px 0; font-family: monospace; text-align: right;">${params.txRef}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #667085;">Monthly Capacity:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${planConfig.analysisAllowance === -1 ? "Unlimited" : `${planConfig.analysisAllowance} analyses/mo`}</td>
          </tr>
        </table>
        <div style="margin: 28px 0;">
          <a href="https://getbidradar.com/dashboard" style="background-color: #2563EB; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            Open Executive Dashboard →
          </a>
        </div>
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #E4E7EC; font-size: 12px; color: #98A2B3;">
        © ${new Date().getFullYear()} GetBidRadar. Enterprise procurement intelligence.
      </div>
    </div>
  `;

  return sendViaResend({ to: params.to, subject, text, html });
}
