import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractDocument } from "./extract.server";

const uploadKnowledgeSchema = z.object({
  workspaceId: z.string().uuid(),
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  title: z.string().min(1),
  category: z.string().optional(),
});

export const processKnowledgeDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => uploadKnowledgeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Download file from private documents bucket
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("documents")
      .download(data.storagePath);

    if (dlErr || !fileData) {
      throw new Error(`Failed to read uploaded document: ${dlErr?.message}`);
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());

    // 2. Extract text using server-side extractDocument
    const extraction = await extractDocument(data.fileName, bytes);
    const extractedText = extraction.ok ? extraction.text : "";

    // 3. Insert knowledge_documents record
    const { data: doc, error: insertErr } = await supabase
      .from("knowledge_documents")
      .insert({
        workspace_id: data.workspaceId,
        uploaded_by: userId,
        title: data.title,
        category: data.category || "general",
        file_size: data.fileSize,
        mime_type: data.mimeType,
        storage_path: data.storagePath,
        extracted_text: extractedText,
        page_count: extraction.pageCount ?? null,
        status: extraction.ok ? "completed" : "failed",
        error_message: extraction.ok ? null : (extraction.reason ?? null),
      })
      .select()
      .single();

    if (insertErr || !doc) {
      throw new Error(`Failed to save knowledge document record: ${insertErr?.message}`);
    }

    return { documentId: doc.id };
  });
