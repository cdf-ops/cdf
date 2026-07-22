import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { EVENT_ASSETS_BUCKET } from "@/lib/certificates/assets";
import { getApplicationBaseUrl } from "@/lib/badges/tokens";
import { resolveBadgeSettings, type BadgeSettings } from "@/lib/badges/settings";

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
const PANEL_WIDTH = A4_WIDTH / 2;
const PANEL_HEIGHT = A4_HEIGHT / 2;

export type BadgePdfParticipant = {
  fullName: string;
  participantNumber: number;
  qrSlug: string;
};

export type BadgePdfEvent = {
  id: string;
  name: string;
  location: string;
  details: string | null;
  eventLogoPath: string | null;
  dates: string[];
};

type GenerateBadgePdfInput = {
  event: BadgePdfEvent;
  participants: BadgePdfParticipant[];
  settings?: Partial<BadgeSettings> | null;
};

function safeText(value: string) {
  return value.replace(/[–—]/g, "-").replace(/[^\u0020-\u007e\u00a0-\u00ff]/gi, " ").trim();
}

function colorFromHex(value: string) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : "#09050a";
  const parsed = Number.parseInt(safe.slice(1), 16);
  return rgb(((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255);
}

function fitFontSize(font: PDFFont, text: string, requested: number, maxWidth: number, minimum = 9) {
  const width = font.widthOfTextAtSize(text, requested);
  return width <= maxWidth ? requested : Math.max(minimum, (requested * maxWidth) / width);
}

function drawCenteredText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  y: number,
  width: number,
  requestedSize: number,
  color = rgb(0.04, 0.03, 0.04)
) {
  const text = safeText(value);
  const size = fitFontSize(font, text, requestedSize, width);
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x + (width - textWidth) / 2, y, size, font, color });
}

function wrapText(font: PDFFont, value: string, size: number, maxWidth: number) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  topY: number,
  width: number,
  size: number,
  maxLines: number,
  color = rgb(0.08, 0.07, 0.08)
) {
  const lines = wrapText(font, value, size, width).slice(0, maxLines);
  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, size);
    page.drawText(line, {
      x: x + (width - lineWidth) / 2,
      y: topY - index * size * 1.35,
      size,
      font,
      color,
    });
  });
}

async function createQrImage(pdf: PDFDocument, value: string) {
  const png = await QRCode.toBuffer(value, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 420,
    color: { dark: "#050505", light: "#ffffff" },
  });
  return pdf.embedPng(png);
}

async function downloadLogo(admin: SupabaseClient<Database>, path: string | null) {
  if (!path) return null;
  const { data, error } = await admin.storage.from(EVENT_ASSETS_BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: await data.arrayBuffer(), path };
}

async function embedLogo(pdf: PDFDocument, asset: Awaited<ReturnType<typeof downloadLogo>>) {
  if (!asset) return null;
  const lower = asset.path.toLowerCase();
  if (lower.endsWith(".png")) return pdf.embedPng(asset.bytes);
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return pdf.embedJpg(asset.bytes);
  return null;
}

function drawContainedImage(page: PDFPage, image: PDFImage, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.width, height / image.height);
  const finalWidth = image.width * scale;
  const finalHeight = image.height * scale;
  page.drawImage(image, {
    x: x + (width - finalWidth) / 2,
    y: y + (height - finalHeight) / 2,
    width: finalWidth,
    height: finalHeight,
  });
}

function formatDates(dates: string[]) {
  return dates
    .sort((a, b) => a.localeCompare(b))
    .map((date) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }))
    .join(", ");
}

function drawFoldGuides(page: PDFPage) {
  const guide = rgb(0.68, 0.68, 0.7);
  page.drawLine({ start: { x: PANEL_WIDTH, y: 0 }, end: { x: PANEL_WIDTH, y: A4_HEIGHT }, thickness: 0.5, color: guide });
  page.drawLine({ start: { x: 0, y: PANEL_HEIGHT }, end: { x: A4_WIDTH, y: PANEL_HEIGHT }, thickness: 0.5, color: guide });
}

export async function generateBadgePdf(admin: SupabaseClient<Database>, input: GenerateBadgePdfInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedLogo(pdf, await downloadLogo(admin, input.event.eventLogoPath));
  const settings = resolveBadgeSettings(input.settings);
  const primary = colorFromHex(settings.primary_color);
  const secondary = colorFromHex(settings.secondary_color);
  const baseUrl = getApplicationBaseUrl();
  const socialUrl = settings.social_url || baseUrl;
  const certificateUrl = settings.certificate_url || `${baseUrl}/certificado/${input.event.id}`;

  for (const participant of input.participants) {
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT, color: rgb(1, 1, 1) });

    const [checkinQr, socialQr, certificateQr] = await Promise.all([
      createQrImage(pdf, `${baseUrl}/q/${participant.qrSlug}`),
      createQrImage(pdf, socialUrl),
      createQrImage(pdf, certificateUrl),
    ]);

    // Frente - quadrante superior esquerdo.
    page.drawRectangle({ x: 0, y: PANEL_HEIGHT, width: PANEL_WIDTH, height: PANEL_HEIGHT, color: rgb(0.985, 0.985, 0.985) });
    for (let x = 18; x < PANEL_WIDTH; x += 18) {
      page.drawLine({ start: { x, y: PANEL_HEIGHT }, end: { x, y: A4_HEIGHT }, thickness: 0.2, color: rgb(0.9, 0.9, 0.91) });
    }
    for (let y = PANEL_HEIGHT + 18; y < A4_HEIGHT; y += 18) {
      page.drawLine({ start: { x: 0, y }, end: { x: PANEL_WIDTH, y }, thickness: 0.2, color: rgb(0.9, 0.9, 0.91) });
    }
    if (logo) drawContainedImage(page, logo, 48, 748, 202, 70);
    else drawCenteredText(page, bold, input.event.name, 24, 778, PANEL_WIDTH - 48, 24, primary);
    page.drawRectangle({ x: 37, y: 720, width: PANEL_WIDTH - 74, height: 22, color: primary });
    drawCenteredText(page, bold, settings.city_label || input.event.location, 39, 726, PANEL_WIDTH - 78, 12, rgb(1, 1, 1));
    drawCenteredText(page, regular, participant.fullName, 28, 666, PANEL_WIDTH - 56, 22, primary);
    page.drawImage(checkinQr, { x: 92, y: 525, width: 114, height: 114 });
    page.drawRectangle({ x: 92, y: 482, width: 114, height: 34, borderColor: rgb(0.58, 0.58, 0.6), borderWidth: 1.5, color: rgb(1, 1, 1) });
    drawCenteredText(page, regular, String(participant.participantNumber), 92, 492, 114, 20, primary);

    // Redes sociais - quadrante superior direito.
    page.drawRectangle({ x: PANEL_WIDTH, y: PANEL_HEIGHT, width: PANEL_WIDTH, height: PANEL_HEIGHT, color: secondary });
    page.drawRectangle({ x: 326, y: 670, width: 240, height: 120, color: rgb(1, 1, 1) });
    drawParagraph(page, bold, "Siga nossas redes sociais", 341, 750, 106, 17, 3, primary);
    page.drawImage(socialQr, { x: 463, y: 690, width: 82, height: 82 });
    const socialRows = [settings.facebook_label, settings.instagram_label, settings.youtube_label].filter(Boolean) as string[];
    socialRows.forEach((label, index) => {
      const rowY = 610 - index * 60;
      page.drawRectangle({ x: 326, y: rowY, width: 240, height: 48, color: primary });
      drawCenteredText(page, bold, label, 342, rowY + 16, 208, 16, rgb(1, 1, 1));
    });

    // Institucional e certificado - quadrante inferior esquerdo.
    page.drawRectangle({ x: 0, y: 0, width: PANEL_WIDTH, height: PANEL_HEIGHT, color: secondary });
    page.drawRectangle({ x: 28, y: 150, width: 242, height: 238, color: rgb(1, 1, 1) });
    if (logo) drawContainedImage(page, logo, 70, 285, 158, 80);
    else drawCenteredText(page, bold, input.event.name, 48, 330, 202, 23, primary);
    drawParagraph(
      page,
      regular,
      settings.institutional_text || input.event.details || "Clube do Frio",
      51,
      265,
      196,
      11,
      7,
      primary
    );
    page.drawRectangle({ x: 28, y: 28, width: 242, height: 102, color: rgb(1, 1, 1) });
    page.drawImage(certificateQr, { x: 50, y: 47, width: 66, height: 66 });
    drawParagraph(page, regular, "Escaneie o QR Code para acessar seu certificado", 132, 91, 112, 11, 4, primary);

    // Programação - quadrante inferior direito.
    page.drawRectangle({ x: PANEL_WIDTH, y: 0, width: PANEL_WIDTH, height: PANEL_HEIGHT, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: PANEL_WIDTH, y: 330, width: PANEL_WIDTH, height: 91, color: primary });
    drawCenteredText(page, bold, "PROGRAMAÇÃO", PANEL_WIDTH + 20, 368, PANEL_WIDTH - 40, 23, rgb(1, 1, 1));
    drawCenteredText(page, bold, formatDates([...input.event.dates]), PANEL_WIDTH + 24, 278, PANEL_WIDTH - 48, 25, primary);
    drawParagraph(page, regular, settings.schedule_text || "Consulte a programação oficial do evento.", PANEL_WIDTH + 42, 230, PANEL_WIDTH - 84, 14, 6, primary);
    drawCenteredText(page, bold, input.event.location, PANEL_WIDTH + 28, 86, PANEL_WIDTH - 56, 18, primary);
    drawCenteredText(page, regular, input.event.name, PANEL_WIDTH + 28, 60, PANEL_WIDTH - 56, 10, primary);

    drawFoldGuides(page);
  }

  pdf.setTitle(`Credenciais - ${safeText(input.event.name)}`);
  pdf.setCreator("Clube do Frio");
  return pdf.save();
}
