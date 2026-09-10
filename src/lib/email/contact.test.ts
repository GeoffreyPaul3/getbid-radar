import { describe, it, expect, vi } from "vitest";
import { contactFormSchema } from "./contact.functions";

describe("Contact Form & Resend Integration", () => {
  describe("contactFormSchema validation", () => {
    it("accepts valid visitor submissions", () => {
      const valid = {
        name: "Jane Doe",
        email: "jane.doe@enterprise.com",
        subject: "Enterprise Pilot Inquiries",
        message: "We would like to test GetBidRadar on our current public healthcare tenders.",
      };

      const result = contactFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("jane.doe@enterprise.com");
        expect(result.data.name).toBe("Jane Doe");
      }
    });

    it("rejects invalid email formats", () => {
      const invalidEmails = ["notanemail", "user@", "@domain.com", "user@.com"];
      for (const email of invalidEmails) {
        const result = contactFormSchema.safeParse({
          name: "Alice",
          email,
          subject: "Testing",
          message: "A valid message with at least 10 chars.",
        });
        expect(result.success).toBe(false);
      }
    });

    it("rejects messages shorter than 10 characters", () => {
      const result = contactFormSchema.safeParse({
        name: "Alice",
        email: "alice@company.com",
        subject: "Hello",
        message: "Too short",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at least 10 characters");
      }
    });

    it("rejects messages exceeding 5000 characters", () => {
      const result = contactFormSchema.safeParse({
        name: "Alice",
        email: "alice@company.com",
        subject: "Hello",
        message: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("5,000 characters or fewer");
      }
    });

    it("rejects empty names and subjects", () => {
      const emptyName = contactFormSchema.safeParse({
        name: "   ",
        email: "alice@company.com",
        subject: "Hello",
        message: "Valid message content with enough length.",
      });
      expect(emptyName.success).toBe(false);

      const emptySubject = contactFormSchema.safeParse({
        name: "Alice",
        email: "alice@company.com",
        subject: "   ",
        message: "Valid message content with enough length.",
      });
      expect(emptySubject.success).toBe(false);
    });

    it("normalizes and trims inputs properly", () => {
      const result = contactFormSchema.safeParse({
        name: "  Bob Smith  ",
        email: "  BOB.SMITH@DOMAIN.COM  ",
        subject: "  Tender Question  ",
        message: "  This is a properly formatted inquiry message.  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Bob Smith");
        expect(result.data.email).toBe("bob.smith@domain.com");
        expect(result.data.subject).toBe("Tender Question");
        expect(result.data.message).toBe("This is a properly formatted inquiry message.");
      }
    });
  });
});
