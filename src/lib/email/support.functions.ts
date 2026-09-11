import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendSupportTicketEmail } from "./resend.server";

// Simple in-memory rate limiting for support tickets
const supportRateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = supportRateLimitMap.get(key) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  validTimestamps.push(now);
  supportRateLimitMap.set(key, validTimestamps);
  return true;
}

export const supportTicketSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name cannot be empty")
    .max(100, "Name must be 100 characters or fewer"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Please provide a valid work email address")
    .max(255, "Email must be 255 characters or fewer")
    .toLowerCase(),
  category: z.enum([
    "Billing & Invoices",
    "Technical Issue",
    "Tender Ingestion / Analysis",
    "Account & Team Access",
    "Feature Request",
    "Other",
  ]),
  priority: z.enum(["Low", "Normal", "High", "Critical"]).optional(),
  subject: z
    .string({ required_error: "Subject is required" })
    .trim()
    .min(1, "Subject cannot be empty")
    .max(200, "Subject must be 200 characters or fewer"),
  message: z
    .string({ required_error: "Description is required" })
    .trim()
    .min(20, "Please describe the issue in at least 20 characters")
    .max(4000, "Description must be 4,000 characters or fewer"),
  honeypot: z.string().optional(),
});

export type SupportTicketData = z.infer<typeof supportTicketSchema>;

export const sendSupportTicketFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => supportTicketSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; ticketId?: string; error?: string }> => {
      // 1. Silent honeypot check
      if (data.honeypot && data.honeypot.trim().length > 0) {
        console.warn("[Support] Honeypot triggered, dropping submission silently");
        return { success: true, ticketId: "TKT-HPOT" };
      }

      // 2. Abuse protection
      const rateLimitKey = data.email.trim().toLowerCase();
      if (!checkRateLimit(rateLimitKey)) {
        return {
          success: false,
          error: "Too many requests. Please wait a few minutes before submitting another ticket.",
        };
      }

      // 3. Generate reference ID
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const ticketId = `GBR-${randomSuffix}`;

      try {
        const result = await sendSupportTicketEmail({
          name: data.name,
          email: data.email,
          category: data.category,
          priority: data.priority || "Normal",
          subject: data.subject,
          message: data.message,
          ticketId,
        });

        if (!result.success) {
          return {
            success: false,
            error:
              result.reason === "API_KEY_NOT_CONFIGURED"
                ? "Support dispatch is temporarily offline. Please email designing90@gmail.com directly."
                : "Failed to dispatch support ticket. Please try again.",
          };
        }

        return { success: true, ticketId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Support] Unexpected error delivering ticket:", msg);
        return {
          success: false,
          error: "An unexpected error occurred. Please reach out to designing90@gmail.com.",
        };
      }
    }
  );
