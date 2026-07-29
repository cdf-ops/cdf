import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { EVENT_ASSETS_BUCKET } from "@/lib/certificates/assets";
import { getApplicationBaseUrl } from "@/lib/badges/tokens";
import {
  resolveExhibitorBadgeSettings,
  type ExhibitorBadgeSettings,
} from "@/lib/exhibitor-credentials/settings";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PANEL_WIDTH = A4_WIDTH / 2;
const PANEL_HEIGHT = A4_HEIGHT / 2;

type ExhibitorCredentialPdfInput = {
  event: {
    id: string;
    name: string;
    location: string;
    details: string | null;
    eventLogoPath: string | null;
    dates: string[];
  };
  company: {
    id: string;
    name: string;
    logoPath: string | null;
  };
  members: {
    id: string;
    fullName: string;
    jobTitle: string | null;
  }[];
  settings?: Partial<ExhibitorBadgeSettings> | null;
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
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
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
  wrapText(font, value, size, width).slice(0, maxLines).forEach((line, index) => {
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

async function downloadImage(admin: SupabaseClient<Database>, path: string | null) {
  if (!path) return null;
  const { data, error } = await admin.storage.from(EVENT_ASSETS_BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: await data.arrayBuffer(), path };
}

async function embedImage(pdf: PDFDocument, asset: Awaited<ReturnType<typeof downloadImage>>) {
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
  return [...dates]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }))
    .join(", ");
}

function drawFoldGuides(page: PDFPage) {
  const guide = rgb(0.68, 0.68, 0.7);
  page.drawLine({ start: { x: PANEL_WIDTH, y: 0 }, end: { x: PANEL_WIDTH, y: A4_HEIGHT }, thickness: 0.5, color: guide });
  page.drawLine({ start: { x: 0, y: PANEL_HEIGHT }, end: { x: A4_WIDTH, y: PANEL_HEIGHT }, thickness: 0.5, color: guide });
}

export async function generateExhibitorCredentialPdf(
  admin: SupabaseClient<Database>,
  input: ExhibitorCredentialPdfInput
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [eventLogo, companyLogo] = await Promise.all([
    embedImage(pdf, await downloadImage(admin, input.event.eventLogoPath)),
    embedImage(pdf, await downloadImage(admin, input.company.logoPath)),
  ]);
  const settings = resolveExhibitorBadgeSettings(input.settings);
  const primary = colorFromHex(settings.primary_color);
  const secondary = colorFromHex(settings.secondary_color);
  const socialQr = settings.show_social_qr
    ? await pdf.embedPng(
        await QRCode.toBuffer(settings.social_url || getApplicationBaseUrl(), {
          type: "png",
          errorCorrectionLevel: "M",
          margin: 2,
          width: 360,
        })
      )
    : null;

  for (const member of input.members) {
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT, color: rgb(1, 1, 1) });

    // Frente da credencial - quadrante superior esquerdo.
    page.drawRectangle({ x: 0, y: PANEL_HEIGHT, width: PANEL_WIDTH, height: PANEL_HEIGHT, color: rgb(0.985, 0.985, 0.985) });
    for (let x = 18; x < PANEL_WIDTH; x += 18) {
      page.drawLine({ start: { x, y: PANEL_HEIGHT }, end: { x, y: A4_HEIGHT }, thickness: 0.2, color: rgb(0.9, 0.9, 0.91) });
    }
    for (let y = PANEL_HEIGHT + 18; y < A4_HEIGHT; y += 18) {
      page.drawLine({ start: { x: 0, y }, end: { x: PANEL_WIDTH, y }, thickness: 0.2, color: rgb(0.9, 0.9, 0.91) });
    }
    if (eventLogo && settings.show_event_logo) drawContainedImage(page, eventLogo, 52, 770, 194, 48);
    else drawCenteredText(page, bold, input.event.name, 24, 789, PANEL_WIDTH - 48, 20, primary);
    page.drawRectangle({ x: 34, y: 722, width: PANEL_WIDTH - 68, height: 32, color: primary });
    drawCenteredText(page, bold, settings.front_label, 36, 731, PANEL_WIDTH - 72, 18, rgb(1, 1, 1));
    drawCenteredText(page, bold, member.fullName, 26, 670, PANEL_WIDTH - 52, 25, primary);
    if (member.jobTitle && settings.show_job_title) {
      drawCenteredText(page, regular, member.jobTitle, 34, 646, PANEL_WIDTH - 68, 12, rgb(0.25, 0.25, 0.28));
    }
    const frontLogoBox =
      settings.company_logo_size === "small"
        ? { x: 114, y: 530, width: 70, height: 70 }
        : settings.company_logo_size === "large"
          ? { x: 74, y: 500, width: 150, height: 130 }
          : { x: 94, y: 510, width: 110, height: 110 };
    if (companyLogo) {
      drawContainedImage(
        page,
        companyLogo,
        frontLogoBox.x,
        frontLogoBox.y,
        frontLogoBox.width,
        frontLogoBox.height
      );
    }
    else {
      page.drawRectangle({ ...frontLogoBox, color: secondary });
      drawCenteredText(
        page,
        bold,
        input.company.name,
        frontLogoBox.x + 8,
        frontLogoBox.y + frontLogoBox.height / 2 - 6,
        frontLogoBox.width - 16,
        17,
        primary
      );
    }
    drawCenteredText(page, bold, input.company.name, 28, 475, PANEL_WIDTH - 56, 15, primary);
    drawCenteredText(
      page,
      regular,
      `${settings.city_label || input.event.location} | ${formatDates(input.event.dates)}`,
      26,
      449,
      PANEL_WIDTH - 52,
      10,
      rgb(0.25, 0.25, 0.28)
    );

    // Redes sociais - quadrante superior direito. QR é institucional, igual para toda a equipe.
    page.drawRectangle({ x: PANEL_WIDTH, y: PANEL_HEIGHT, width: PANEL_WIDTH, height: PANEL_HEIGHT, color: secondary });
    page.drawRectangle({ x: 326, y: 670, width: 240, height: 120, color: rgb(1, 1, 1) });
    drawParagraph(page, bold, settings.social_heading, 341, 750, socialQr ? 106 : 210, 17, 3, primary);
    if (socialQr) page.drawImage(socialQr, { x: 463, y: 690, width: 82, height: 82 });
    const socialRows = [settings.facebook_label, settings.instagram_label, settings.youtube_label].filter(Boolean) as string[];
    socialRows.forEach((label, index) => {
      const rowY = 610 - index * 60;
      page.drawRectangle({ x: 326, y: rowY, width: 240, height: 48, color: primary });
      drawCenteredText(page, bold, label, 342, rowY + 16, 208, 16, rgb(1, 1, 1));
    });

    // Identidade da empresa - quadrante inferior esquerdo.
    page.drawRectangle({ x: 0, y: 0, width: PANEL_WIDTH, height: PANEL_HEIGHT, color: secondary });
    page.drawRectangle({ x: 28, y: 78, width: 242, height: 310, color: rgb(1, 1, 1) });
    drawCenteredText(page, bold, settings.company_heading, 48, 354, 202, 16, primary);
    if (companyLogo) drawContainedImage(page, companyLogo, 74, 205, 150, 125);
    else drawCenteredText(page, bold, input.company.name, 48, 270, 202, 23, primary);
    drawCenteredText(page, bold, input.company.name, 48, 175, 202, 18, primary);
    drawParagraph(
      page,
      regular,
      settings.institutional_text || input.event.details || "Clube do Frio",
      51,
      140,
      196,
      11,
      6,
      primary
    );

    // Programação - quadrante inferior direito.
    page.drawRectangle({ x: PANEL_WIDTH, y: 0, width: PANEL_WIDTH, height: PANEL_HEIGHT, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: PANEL_WIDTH, y: 330, width: PANEL_WIDTH, height: 91, color: primary });
    drawCenteredText(
      page,
      bold,
      settings.schedule_heading,
      PANEL_WIDTH + 20,
      368,
      PANEL_WIDTH - 40,
      23,
      rgb(1, 1, 1)
    );
    drawCenteredText(page, bold, formatDates(input.event.dates), PANEL_WIDTH + 24, 278, PANEL_WIDTH - 48, 25, primary);
    drawParagraph(page, regular, settings.schedule_text || "Consulte a programação oficial do evento.", PANEL_WIDTH + 42, 230, PANEL_WIDTH - 84, 14, 6, primary);
    drawCenteredText(page, bold, input.event.location, PANEL_WIDTH + 28, 86, PANEL_WIDTH - 56, 18, primary);
    drawCenteredText(page, regular, input.event.name, PANEL_WIDTH + 28, 60, PANEL_WIDTH - 56, 10, primary);

    drawFoldGuides(page);
  }

  pdf.setTitle(`Credenciais de expositores - ${safeText(input.event.name)}`);
  pdf.setCreator("Clube do Frio");
  return pdf.save();
}
