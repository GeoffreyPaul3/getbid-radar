import {
  type PlanTier,
  type BillingCurrency,
  getPlanConfig,
  formatBillingAmount,
} from "../billing/plans";
import { ensureServerEnv } from "../server-env";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Canonical site origin, resolved once per process from APP_URL env var. */
function getAppUrl(): string {
  return process.env["APP_URL"] || "https://getbidradar.com";
}

interface SendEmailResult {
  success: boolean;
  messageId?: string | undefined;
  reason?: string | undefined;
}

function getResendApiKey(): string | null {
  ensureServerEnv();
  const key = process.env["RESEND_API_KEY"];
  return key && key.trim() !== "" ? key.trim() : null;
}

/** Canonical verified sender on the active production domain */
const RESEND_FALLBACK_FROM = "GetBidRadar <onboarding@getbidradar.com>";

/** RFC 5322 "Name <email>" or bare "email" validator */
function isValidFromAddress(value: string): boolean {
  const bareEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const namedEmail = /^[^<>]+<[^\s@]+@[^\s@]+\.[^\s@]+>$/;
  return bareEmail.test(value) || namedEmail.test(value);
}

function sanitizeFromAddress(raw: string): string {
  // Remove wrapping quotes e.g. "GetBidRadar <foo@bar.com>" -> GetBidRadar <foo@bar.com>
  let cleaned = raw.trim().replace(/^["']+|["']+$/g, "").trim();

  // If unclosed bracket at end e.g. "GetBidRadar <onboarding@getbidradar.com"
  if (cleaned.includes("<") && !cleaned.includes(">")) {
    cleaned = `${cleaned}>`;
  }

  // If bare email e.g. "onboarding@getbidradar.com", wrap in display name
  const bareEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (bareEmail.test(cleaned)) {
    return `GetBidRadar <${cleaned}>`;
  }

  if (isValidFromAddress(cleaned)) {
    return cleaned;
  }

  console.warn(
    `[Resend] RESEND_FROM_EMAIL="${raw}" is invalid. Defaulting to verified sender "${RESEND_FALLBACK_FROM}".`,
  );
  return RESEND_FALLBACK_FROM;
}

function getFromAddress(): string {
  ensureServerEnv();
  const configured = process.env["RESEND_FROM_EMAIL"];
  if (configured && configured.trim() !== "") {
    return sanitizeFromAddress(configured);
  }
  return RESEND_FALLBACK_FROM;
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | undefined;
}): Promise<SendEmailResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    console.warn(
      `[Resend] RESEND_API_KEY is not configured. Email to <${params.to}> suppressed: "${params.subject}"`,
    );
    return { success: false, reason: "API_KEY_NOT_CONFIGURED" };
  }

  try {
    const payload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text?: string;
      reply_to?: string;
    } = {
      from: getFromAddress(),
      to: [params.to],
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    };

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
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

  const appUrl = getAppUrl();
  const subject = "Welcome to GetBidRadar — Your 14-Day Bid Intelligence Pilot";
  const text = `Hello ${params.name},\n\nWelcome to GetBidRadar. Your workspace evaluation is active through ${formattedDate}.\n\nYou have 3 complimentary tender qualifications to test our deterministic scoring engine against your company's actual past performance evidence.\n\nSign in to analyze your first tender:\n${appUrl}/tenders/new\n\nThe GetBidRadar Team`;

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
          <a href="${appUrl}/tenders/new" style="background-color: #2563EB; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
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

  const appUrl = getAppUrl();
  const subject = `Payment Confirmed: Your GetBidRadar ${planConfig.name} Plan is Active`;
  const text = `Hello ${params.name},\n\nThank you for your payment of ${formattedAmount}. Your ${planConfig.name} plan is now active on GetBidRadar.\n\nTransaction Reference: ${params.txRef}\nCapacity: ${planConfig.opportunityAllowance} opportunities per month & ${planConfig.memberAllowance} team seats\n\nAccess your dashboard: ${appUrl}/tenders\n\nThe GetBidRadar Team`;

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
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${planConfig.opportunityAllowance} pursuits/mo (${planConfig.memberAllowance} seats)</td>
          </tr>
        </table>
        <div style="margin: 28px 0;">
          <a href="${appUrl}/tenders" style="background-color: #2563EB; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
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

/**
 * Send secure workspace member invitation email via Resend.
 * Does NOT send or require plaintext passwords.
 */
export async function sendMemberInvitationEmail(params: {
  toEmail: string;
  fullName: string;
  invitedByName: string;
  workspaceName: string;
  role: string;
  setupUrl?: string | undefined;
}): Promise<SendEmailResult> {
  const appUrl = getAppUrl();
  const setupUrl = params.setupUrl || `${appUrl}/login`;

  const subject = `You've been invited to join ${params.workspaceName} on GetBidRadar`;
  const text = `Hello ${params.fullName},\n\n${params.invitedByName} has invited you to join ${params.workspaceName} on GetBidRadar as a ${params.role.toUpperCase()}.\n\nAccept your invitation and sign in: ${setupUrl}\n\nGetBidRadar helps organizations evaluate procurement opportunities, verify evidence, coordinate bid execution, and submit winning proposals with certainty.\n\nThe GetBidRadar Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #101828;">
      <div style="padding-bottom: 20px; border-bottom: 1px solid #E4E7EC;">
        <h2 style="margin: 0; color: #0B1220; font-size: 22px;">GetBidRadar</h2>
        <p style="margin: 4px 0 0; color: #667085; font-size: 13px;">Enterprise Workspace Invitation</p>
      </div>
      <div style="padding: 24px 0;">
        <p style="font-size: 15px; margin-top: 0;">Hello <strong>${params.fullName}</strong>,</p>
        <p style="font-size: 14px; color: #344054; line-height: 1.6;">
          <strong>${params.invitedByName}</strong> has invited you to join the <strong>${params.workspaceName}</strong> workspace on GetBidRadar with the role of <strong>${params.role.toUpperCase()}</strong>.
        </p>
        <div style="background-color: #F8F9FC; border: 1px solid #E4E7EC; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #667085; font-weight: 600;">Invitation Details</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Workspace:</strong> ${params.workspaceName}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Assigned Role:</strong> <span style="text-transform: uppercase; font-family: monospace; color: #2563EB; font-weight: 700;">${params.role}</span></p>
        </div>
        <div style="margin: 28px 0;">
          <a href="${setupUrl}" style="background-color: #2563EB; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            Accept Invitation & Access Workspace →
          </a>
        </div>
        <p style="color: #667085; font-size: 13px; line-height: 1.5;">
          For security, sign in with your email address (<strong>${params.toEmail}</strong>) or complete your secure account setup.
        </p>
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #E4E7EC; font-size: 12px; color: #98A2B3;">
        © ${new Date().getFullYear()} GetBidRadar. Enterprise procurement intelligence.
      </div>
    </div>
  `;

  return sendViaResend({ to: params.toEmail, subject, text, html });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sends a visitor contact form inquiry to the configured GetBidRadar support/contact recipient.
 * Sets replyTo to the visitor's verified email so support can reply directly.
 */
export async function sendContactMessageEmail(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<SendEmailResult> {
  const recipient =
    process.env["CONTACT_EMAIL"] ||
    process.env["RESEND_TO_EMAIL"] ||
    process.env["SUPPORT_EMAIL"] ||
    "support@getbidradar.com";

  const emailSubject = `[Contact Inquiry] ${params.subject.trim()}`;
  const text = `New Contact Form Inquiry from GetBidRadar\n\nName: ${params.name.trim()}\nEmail: ${params.email.trim()}\nSubject: ${params.subject.trim()}\n\nMessage:\n${params.message.trim()}\n\n---\nSent via GetBidRadar contact form. Reply directly to this email to respond.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #101828;">
      <div style="padding-bottom: 20px; border-bottom: 1px solid #E4E7EC;">
        <h2 style="margin: 0; color: #0B1220; font-size: 22px;">GetBidRadar</h2>
        <p style="margin: 4px 0 0; color: #667085; font-size: 13px;">Inbound Contact Inquiry</p>
      </div>
      <div style="padding: 24px 0;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #667085; width: 80px;">From:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #101828;">${escapeHtml(params.name)} &lt;${escapeHtml(params.email)}&gt;</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #667085;">Subject:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #101828;">${escapeHtml(params.subject)}</td>
          </tr>
        </table>
        <div style="background-color: #F8F9FC; border: 1px solid #E4E7EC; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #1F2937;">
${escapeHtml(params.message)}
        </div>
        <p style="font-size: 12px; color: #667085; margin-top: 16px;">
          Reply directly to this email to respond to <strong>${escapeHtml(params.email)}</strong>.
        </p>
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #E4E7EC; font-size: 12px; color: #98A2B3;">
        © ${new Date().getFullYear()} GetBidRadar Contact Infrastructure
      </div>
    </div>
  `;

  return sendViaResend({
    to: recipient,
    subject: emailSubject,
    text,
    html,
    replyTo: params.email.trim(),
  });
}

/**
 * Sends a customer support ticket inquiry to the configured support team.
 */
export async function sendSupportTicketEmail(params: {
  name: string;
  email: string;
  category: string;
  priority?: string;
  subject: string;
  message: string;
  ticketId: string;
}): Promise<SendEmailResult> {
  const recipient =
    process.env["SUPPORT_EMAIL"] ||
    process.env["CONTACT_EMAIL"] ||
    process.env["RESEND_TO_EMAIL"] ||
    "support@getbidradar.com";

  const priorityLabel = params.priority || "Normal";
  const emailSubject = `[Support Ticket #${params.ticketId}] [${params.category}] ${params.subject.trim()}`;
  const text = `New Support Ticket #${params.ticketId}\n\nCategory: ${params.category}\nPriority: ${priorityLabel}\nFrom: ${params.name} <${params.email}>\nSubject: ${params.subject}\n\nDescription:\n${params.message}\n\n---\nReply directly to this email to respond to the ticket creator.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #101828;">
      <div style="padding-bottom: 16px; border-bottom: 2px solid #0052CC;">
        <h2 style="margin: 0; color: #0B1220; font-size: 20px;">GetBidRadar Support Desk</h2>
        <p style="margin: 4px 0 0; color: #667085; font-size: 13px;">Ticket Reference: <strong>#${escapeHtml(params.ticketId)}</strong></p>
      </div>
      <div style="padding: 20px 0;">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <span style="background-color: #EFF8FF; color: #175CD3; border: 1px solid #B2DDFF; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">
            ${escapeHtml(params.category)}
          </span>
          <span style="background-color: #F8F9FA; color: #344054; border: 1px solid #D0D5DD; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">
            Priority: ${escapeHtml(priorityLabel)}
          </span>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #667085; width: 80px;">Submitter:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #101828;">${escapeHtml(params.name)} &lt;${escapeHtml(params.email)}&gt;</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #667085;">Subject:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #101828;">${escapeHtml(params.subject)}</td>
          </tr>
        </table>
        <div style="background-color: #F8F9FC; border: 1px solid #E4E7EC; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #1F2937;">
${escapeHtml(params.message)}
        </div>
        <p style="font-size: 12px; color: #667085; margin-top: 16px;">
          Reply directly to this email to communicate with <strong>${escapeHtml(params.email)}</strong>.
        </p>
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #E4E7EC; font-size: 12px; color: #98A2B3;">
        © ${new Date().getFullYear()} GetBidRadar Support Operations
      </div>
    </div>
  `;

  return sendViaResend({
    to: recipient,
    subject: emailSubject,
    text,
    html,
    replyTo: params.email.trim(),
  });
}

/**
 * Sends a notification when a tender analysis finishes.
 */
export async function sendAnalysisCompleteEmail(params: {
  to: string;
  tenderTitle: string;
  score: number;
  recommendation: string;
  url: string;
}): Promise<SendEmailResult> {
  const badgeColor =
    params.recommendation === "BID"
      ? "#12B76A"
      : params.recommendation === "REVIEW"
      ? "#F79009"
      : "#F04438";

  const subject = `[Tender Analysis Complete] ${params.recommendation}: ${params.tenderTitle}`;
  const text = `Tender Analysis Complete\n\nTender: ${params.tenderTitle}\nDeterministic Score: ${params.score}/100\nRecommendation: ${params.recommendation}\n\nReview the qualification report and requirement breakdown:\n${params.url}\n\nGetBidRadar Intelligence Engine`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #101828;">
      <div style="padding-bottom: 16px; border-bottom: 1px solid #E4E7EC;">
        <h2 style="margin: 0; color: #0B1220; font-size: 20px;">GetBidRadar</h2>
        <p style="margin: 4px 0 0; color: #667085; font-size: 13px;">Tender Analysis Notification</p>
      </div>
      <div style="padding: 24px 0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #101828;">
          ${escapeHtml(params.tenderTitle)}
        </h3>
        <div style="background-color: #F8F9FC; border: 1px solid #E4E7EC; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #667085; margin-bottom: 6px;">
            Deterministic Qualification Recommendation
          </div>
          <div style="display: inline-block; padding: 6px 16px; border-radius: 20px; background-color: ${badgeColor}15; color: ${badgeColor}; font-weight: 800; font-size: 18px; letter-spacing: 0.05em; margin-bottom: 12px;">
            ${escapeHtml(params.recommendation)}
          </div>
          <div style="font-size: 14px; color: #344054;">
            Calculated Compliance Score: <strong style="color: #101828; font-size: 16px;">${params.score}/100</strong>
          </div>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${escapeHtml(params.url)}" style="background-color: #0052CC; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            Open Qualification Workspace →
          </a>
        </div>
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #E4E7EC; font-size: 12px; color: #98A2B3;">
        © ${new Date().getFullYear()} GetBidRadar. Enterprise Tender Intelligence.
      </div>
    </div>
  `;

  return sendViaResend({ to: params.to, subject, text, html });
}

/**
 * Sends a confirmation email when a tender submission is recorded.
 */
export async function sendSubmissionConfirmationEmail(params: {
  to: string;
  tenderTitle: string;
  submissionDate: string;
  referenceNumber?: string;
  url: string;
}): Promise<SendEmailResult> {
  const subject = `[Submission Recorded] ${params.tenderTitle}`;
  const text = `Tender Submission Recorded\n\nTender: ${params.tenderTitle}\nDate: ${params.submissionDate}\n${params.referenceNumber ? `Reference: ${params.referenceNumber}\n` : ""}\nView submission record:\n${params.url}\n\nGetBidRadar Intelligence Engine`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #101828;">
      <div style="padding-bottom: 16px; border-bottom: 1px solid #E4E7EC;">
        <h2 style="margin: 0; color: #0B1220; font-size: 20px;">GetBidRadar</h2>
        <p style="margin: 4px 0 0; color: #667085; font-size: 13px;">Submission Confirmation</p>
      </div>
      <div style="padding: 24px 0;">
        <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #101828;">
          Submission Logged: ${escapeHtml(params.tenderTitle)}
        </h3>
        <p style="font-size: 14px; color: #344054; line-height: 1.6;">
          Your formal proposal submission has been recorded in the workspace audit log on <strong>${escapeHtml(params.submissionDate)}</strong>.
        </p>
        ${
          params.referenceNumber
            ? `<div style="background-color: #F8F9FC; border: 1px solid #E4E7EC; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; font-mono: monospace;">
                <strong>Receipt Reference:</strong> ${escapeHtml(params.referenceNumber)}
               </div>`
            : ""
        }
        <div style="text-align: center; margin: 28px 0;">
          <a href="${escapeHtml(params.url)}" style="background-color: #0052CC; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            View Bid Workspace →
          </a>
        </div>
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #E4E7EC; font-size: 12px; color: #98A2B3;">
        © ${new Date().getFullYear()} GetBidRadar. Enterprise Tender Intelligence.
      </div>
    </div>
  `;

  return sendViaResend({ to: params.to, subject, text, html });
}

/**
 * Sends a deadline reminder email (7-day, 3-day, or 24-hour).
 */
export async function sendDeadlineReminderEmail(params: {
  to: string;
  tenderTitle: string;
  daysRemaining: number;
  deadline: string;
  url: string;
}): Promise<SendEmailResult> {
  const urgencyLabel =
    params.daysRemaining <= 1
      ? "CRITICAL (24 Hours Remaining)"
      : `${params.daysRemaining} Days Remaining`;

  const subject = `[Tender Deadline Alert] ${urgencyLabel}: ${params.tenderTitle}`;
  const text = `Tender Deadline Reminder\n\nTender: ${params.tenderTitle}\nTime Remaining: ${urgencyLabel}\nSubmission Deadline: ${params.deadline}\n\nAccess your workspace to finalize submission:\n${params.url}\n\nGetBidRadar Intelligence Engine`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #101828;">
      <div style="padding-bottom: 16px; border-bottom: 2px solid #F04438;">
        <h2 style="margin: 0; color: #0B1220; font-size: 20px;">GetBidRadar</h2>
        <p style="margin: 4px 0 0; color: #D92D20; font-size: 13px; font-weight: 600;">Deadline Warning Alert</p>
      </div>
      <div style="padding: 24px 0;">
        <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #101828;">
          ${escapeHtml(params.tenderTitle)}
        </h3>
        <div style="background-color: #FEF3F2; border: 1px solid #FECDCA; border-radius: 8px; padding: 16px; margin: 16px 0; color: #B42318; font-size: 14px;">
          <strong>Urgency:</strong> ${escapeHtml(urgencyLabel)}<br/>
          <strong>Submission Deadline:</strong> ${escapeHtml(params.deadline)}
        </div>
        <p style="font-size: 14px; color: #344054; line-height: 1.6;">
          Please review your proposal completeness, compliance certificates, and mandatory bid forms before the submission window closes.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${escapeHtml(params.url)}" style="background-color: #D92D20; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            Open Proposal Workspace Now →
          </a>
        </div>
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #E4E7EC; font-size: 12px; color: #98A2B3;">
        © ${new Date().getFullYear()} GetBidRadar Deadline Intelligence
      </div>
    </div>
  `;

  return sendViaResend({ to: params.to, subject, text, html });
}
