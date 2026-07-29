import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { EVENT_ASSETS_BUCKET } from "@/lib/certificates/assets";

const MAX_BANNER_SIZE = 5 * 1024 * 1024;
const BANNER_WIDTH = 1000;
const BANNER_HEIGHT = 300;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);

function getPngDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function getJpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const segmentLength = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (segmentLength < 2) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }
    offset += segmentLength + 2;
  }
  return null;
}

export async function uploadRaffleSponsorBanner(
  admin: SupabaseClient<Database>,
  eventId: string,
  file: File
) {
  if (!ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_BANNER_SIZE) {
    throw new Error("Envie uma imagem PNG ou JPG de 1000 x 300 pixels, com no máximo 5 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = file.type === "image/png" ? getPngDimensions(bytes) : getJpegDimensions(bytes);
  if (!dimensions || dimensions.width !== BANNER_WIDTH || dimensions.height !== BANNER_HEIGHT) {
    throw new Error("O banner precisa ter exatamente 1000 pixels de largura por 300 pixels de altura.");
  }

  const extension = file.type === "image/png" ? "png" : "jpg";
  const path = `events/${eventId}/raffle-sponsor-banner.${extension}`;
  const { error } = await admin.storage.from(EVENT_ASSETS_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (error) {
    throw new Error("Não foi possível salvar o banner dos patrocinadores.");
  }

  return path;
}
