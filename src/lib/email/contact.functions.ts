import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendContactMessageEmail } from "./resend.server";

// Rate limiting: map of key -> timestamp[]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(key, validTimestamps);
  return true;
}

export const contactFormSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name cannot be empty")
    .max(100, "Name must be 100 characters or fewer"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Please provide a valid email address")
    .max(255, "Email must be 255 characters or fewer")
    .toLowerCase(),
  subject: z
    .string({ required_error: "Subject is required" })
    .trim()
    .min(1, "Subject cannot be empty")
    .max(200, "Subject must be 200 characters or fewer"),
  message: z
    .string({ required_error: "Message is required" })
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message must be 5,000 characters or fewer"),
  honeypot: z.string().optional(),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

export const sendContactMessageFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => contactFormSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    // 1. Silent honeypot drop
    if (data.honeypot && data.honeypot.trim().length > 0) {
      console.warn("[Contact] Honeypot triggered, dropping submission silently");
      return { success: true };
    }

    // 2. Abuse protection / rate limiting
    const rateLimitKey = data.email.trim().toLowerCase();
    if (!checkRateLimit(rateLimitKey)) {
      return {
        success: false,
        error: "Too many messages sent. Please wait a few minutes before submitting again.",
      };
    }

    try {
      const result = await sendContactMessageEmail({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
      });

      if (!result.success) {
        return {
          success: false,
          error:
            result.reason === "API_KEY_NOT_CONFIGURED"
              ? "Email service is temporarily unavailable. Please try again later."
              : "Failed to deliver message. Please verify your details and try again.",
        };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Contact] Unexpected error delivering contact form:", msg);
      return {
        success: false,
        error: "An unexpected error occurred while sending your message. Please try again later.",
      };
    }
  });
