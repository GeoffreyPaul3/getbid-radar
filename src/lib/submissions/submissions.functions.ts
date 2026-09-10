import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  checkSubmissionReadiness,
  recordSubmission,
  getSubmission,
  type SubmissionRecord,
} from "./submissions.server";

export const checkSubmissionReadinessFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ opportunityId: z.string().uuid(), workspaceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    return checkSubmissionReadiness(context.supabase, data.workspaceId, data.opportunityId);
  });

export const recordSubmissionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        opportunityId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        submission_method: z.string().min(1),
        confirmation_number: z.string().optional(),
        notes: z.string().optional(),
        submitted_at: z.string().optional(),
        bid_price: z.number().optional(),
        currency: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload: {
      submission_method: string;
      confirmation_number?: string;
      notes?: string;
      submitted_at?: string;
      bid_price?: number;
      currency?: string;
    } = {
      submission_method: data.submission_method,
    };
    if (data.confirmation_number !== undefined) payload.confirmation_number = data.confirmation_number;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.submitted_at !== undefined) payload.submitted_at = data.submitted_at;
    if (data.bid_price !== undefined) payload.bid_price = data.bid_price;
    if (data.currency !== undefined) payload.currency = data.currency;

    return recordSubmission(
      context.supabase,
      data.workspaceId,
      data.opportunityId,
      context.userId,
      payload,
    );
  });

export const getSubmissionFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ opportunityId: z.string().uuid(), workspaceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SubmissionRecord | null> => {
    return getSubmission(context.supabase, data.workspaceId, data.opportunityId);
  });
