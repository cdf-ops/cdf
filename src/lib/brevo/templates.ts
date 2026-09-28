import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

const nullableAddress = z.string().trim().max(320).nullable().optional();
const nullableDateTime = z.iso.datetime({ offset: true }).nullable().optional();

export const brevoTemplateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(500),
  subject: z.string().trim().max(1000),
  senderName: z.string().trim().max(500).nullable().optional(),
  senderEmail: nullableAddress,
  replyTo: nullableAddress,
  tag: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean(),
  createdAt: nullableDateTime,
  modifiedAt: nullableDateTime,
});

export const brevoTemplateCatalogSchema = z.object({
  templates: z.array(brevoTemplateSchema).max(1000),
});

export type BrevoTemplateCatalog = z.infer<typeof brevoTemplateCatalogSchema>;

export async function syncBrevoTemplateCatalog(catalog: BrevoTemplateCatalog) {
  const uniqueTemplates = Array.from(
    new Map(catalog.templates.map((template) => [template.id, template])).values()
  );
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("sync_brevo_templates", {
    p_templates: uniqueTemplates as Json,
    p_deactivate_missing: true,
  });

  if (error) throw new Error("Não foi possível sincronizar os modelos da Brevo.");
  return data ?? 0;
}
