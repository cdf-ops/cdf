import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const EVENT_ASSETS_BUCKET = "event-assets";
const MAX_ASSET_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);

export function getAssetExtension(file: File) {
  if (file.type === "image/png") {
    return "png";
  }
  if (file.type === "image/jpeg") {
    return "jpg";
  }
  return "bin";
}

export function isUploadableImage(file: File) {
  return file.size > 0 && file.size <= MAX_ASSET_SIZE && ALLOWED_IMAGE_TYPES.has(file.type);
}

export async function uploadEventImage(
  admin: SupabaseClient<Database>,
  eventId: string,
  file: File,
  name: "logo" | "certificate-background" | "certificate-sponsor"
) {
  if (!isUploadableImage(file)) {
    throw new Error("Envie uma imagem PNG ou JPG com no máximo 10 MB.");
  }

  const path = `events/${eventId}/${name}.${getAssetExtension(file)}`;
  const { error } = await admin.storage.from(EVENT_ASSETS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    throw new Error("Não foi possível salvar a imagem enviada.");
  }

  return path;
}

export async function createAssetSignedUrl(admin: SupabaseClient<Database>, path: string | null | undefined) {
  if (!path) {
    return null;
  }

  const { data, error } = await admin.storage.from(EVENT_ASSETS_BUCKET).createSignedUrl(path, 60 * 30);
  if (error) {
    return null;
  }

  return data.signedUrl;
}
