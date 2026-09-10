import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  draftProposalSection,
  saveProposalSection,
  calculateProposalCompleteness,
  listProposalSections,
  exportProposal,
  PROPOSAL_SECTION_TYPES,
  type ProposalDocRecord,
} from "./proposal.server";

export const draftProposalSectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        opportunityId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        sectionType: z.enum(PROPOSAL_SECTION_TYPES),
        sectionTitle: z.string().min(1).max(200),
        additionalContext: z.string().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return draftProposalSection(
      context.supabase,
      data.workspaceId,
      data.opportunityId,
      data.sectionType,
      data.sectionTitle,
      data.additionalContext,
    );
  });

export const saveProposalSectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        opportunityId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
        content: z.string().max(30000),
        section_type: z.string(),
        requirement_ids: z.array(z.string().uuid()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return saveProposalSection(
      context.supabase,
      data.workspaceId,
      data.opportunityId,
      context.userId,
      {
        id: data.id,
        title: data.title,
        content: data.content,
        section_type: data.section_type,
        requirement_ids: data.requirement_ids,
      },
    );
  });

export const listProposalSectionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ opportunityId: z.string().uuid(), workspaceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ProposalDocRecord[]> => {
    return listProposalSections(context.supabase, data.workspaceId, data.opportunityId);
  });

export const exportProposalFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ opportunityId: z.string().uuid(), workspaceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ title: string; markdown: string }> => {
    return exportProposal(context.supabase, data.workspaceId, data.opportunityId);
  });

export const getProposalCompletenessFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ opportunityId: z.string().uuid(), workspaceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    return calculateProposalCompleteness(
      context.supabase,
      data.workspaceId,
      data.opportunityId,
    );
  });
