import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const urlIntakeSchema = z.object({
  workspaceId: z.string().uuid(),
  url: z.string().url(),
  title: z.string().optional(),
  buyer: z.string().optional(),
});

const uploadIntakeSchema = z.object({
  workspaceId: z.string().uuid(),
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  title: z.string().optional(),
  buyer: z.string().optional(),
});

export const ingestTenderUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => urlIntakeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { ingestTenderFromUrl } = await import("./tender-intake.server");
    return ingestTenderFromUrl({
      supabase: context.supabase,
      userId: context.userId,
      workspaceId: data.workspaceId,
      url: data.url,
      customTitle: data.title,
      buyer: data.buyer,
    });
  });

export const ingestTenderUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => uploadIntakeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { ingestTenderFromUpload } = await import("./tender-intake.server");
    return ingestTenderFromUpload({
      supabase: context.supabase,
      userId: context.userId,
      workspaceId: data.workspaceId,
      storagePath: data.storagePath,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      customTitle: data.title,
      buyer: data.buyer,
    });
  });
