import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { EVENT_ASSETS_BUCKET } from "@/lib/certificates/assets";
import {
  CERTIFICATE_HEIGHT,
  CERTIFICATE_WIDTH,
  parseCertificateLayout,
  type CertificateLayoutElement,
} from "@/lib/certificates/layout";

type CertificatePdfInput = {
  eventName: string;
  eventDate: string;
  participantName: string;
  eventLogoPath: string | null;
  backgroundPath: string | null;
  sponsorImagePath: string | null;
  layout: Json | null;
};

function hexToRgb(color: string | undefined) {
  const safeColor = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#191c1e";
  const value = Number.parseInt(safeColor.slice(1), 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

function formatDate(date: string) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "";
}

async function downloadAsset(admin: SupabaseClient<Database>, path: string | null | undefined) {
  if (!path) {
    return null;
  }

  const { data, error } = await admin.storage.from(EVENT_ASSETS_BUCKET).download(path);
  if (error || !data) {
    return null;
  }

  return {
    bytes: await data.arrayBuffer(),
    path,
  };
}

async function embedImage(pdfDoc: PDFDocument, asset: Awaited<ReturnType<typeof downloadAsset>>) {
  if (!asset) {
    return null;
  }

  const lowerPath = asset.path.toLowerCase();
  if (lowerPath.endsWith(".png")) {
    return pdfDoc.embedPng(asset.bytes);
  }
  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
    return pdfDoc.embedJpg(asset.bytes);
  }
  return null;
}

function drawImage(page: ReturnType<PDFDocument["addPage"]>, image: PDFImage, element: CertificateLayoutElement) {
  page.drawImage(image, {
    x: element.x,
    y: CERTIFICATE_HEIGHT - element.y - element.height,
    width: element.width,
    height: element.height,
  });
}

function drawText(
  page: ReturnType<PDFDocument["addPage"]>,
  font: PDFFont,
  element: CertificateLayoutElement,
  value: string
) {
  const requestedSize = element.fontSize ?? 40;
  const textWidth = font.widthOfTextAtSize(value, requestedSize);
  const fontSize = textWidth > element.width ? Math.max(12, Math.floor((requestedSize * element.width) / textWidth)) : requestedSize;
  const finalWidth = font.widthOfTextAtSize(value, fontSize);
  const x =
    element.align === "right"
      ? element.x + element.width - finalWidth
      : element.align === "center"
        ? element.x + (element.width - finalWidth) / 2
        : element.x;

  page.drawText(value, {
    x,
    y: CERTIFICATE_HEIGHT - element.y - element.height / 2 - fontSize / 2,
    size: fontSize,
    font,
    color: hexToRgb(element.color),
  });
}

export async function generateCertificatePdf(admin: SupabaseClient<Database>, input: CertificatePdfInput) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([CERTIFICATE_WIDTH, CERTIFICATE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const [background, eventLogo, sponsorImage] = await Promise.all([
    embedImage(pdfDoc, await downloadAsset(admin, input.backgroundPath)),
    embedImage(pdfDoc, await downloadAsset(admin, input.eventLogoPath)),
    embedImage(pdfDoc, await downloadAsset(admin, input.sponsorImagePath)),
  ]);

  if (background) {
    page.drawImage(background, {
      x: 0,
      y: 0,
      width: CERTIFICATE_WIDTH,
      height: CERTIFICATE_HEIGHT,
    });
  } else {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: CERTIFICATE_WIDTH,
      height: CERTIFICATE_HEIGHT,
      color: rgb(1, 1, 1),
    });
  }

  const layout = parseCertificateLayout(input.layout);
  const values = {
    eventName: input.eventName,
    eventDate: formatDate(input.eventDate),
    participantName: input.participantName,
  };

  for (const element of layout.elements) {
    if (element.id === "eventLogo" && eventLogo) {
      drawImage(page, eventLogo, element);
    } else if (element.id === "sponsorImage" && sponsorImage) {
      drawImage(page, sponsorImage, element);
    } else if (element.id === "text1" || element.id === "text2" || element.id === "text3") {
      drawText(page, font, element, element.text ?? "");
    } else if (element.id === "eventName" || element.id === "eventDate" || element.id === "participantName") {
      drawText(page, font, element, values[element.id]);
    }
  }

  return pdfDoc.save();
}
