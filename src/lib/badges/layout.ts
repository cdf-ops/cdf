import type { Json } from "@/lib/supabase/database.types";

export const BADGE_PAGE_WIDTH = 595.28;
export const BADGE_PAGE_HEIGHT = 841.89;
export const BADGE_PANEL_WIDTH = BADGE_PAGE_WIDTH / 2;
export const BADGE_PANEL_HEIGHT = BADGE_PAGE_HEIGHT / 2;

export type BadgeQuadrant = "front" | "social" | "institutional" | "schedule";
export const BADGE_FONT_FAMILIES = ["Inter", "Manrope", "Montserrat", "Poppins", "Roboto"] as const;
export type BadgeFontFamily = (typeof BADGE_FONT_FAMILIES)[number];
export type BadgeElementId =
  | "category"
  | "personName"
  | "sponsorCompany"
  | "sponsorJobTitle"
  | "checkinQr"
  | "personNumber"
  | "eventLogo"
  | "eventName"
  | "eventLocation"
  | "eventDates"
  | "eventTime"
  | "certificateQr"
  | "socialQr"
  | "facebook"
  | "instagram"
  | "youtube";

export type BadgeLayoutElement = {
  id: BadgeElementId;
  label: string;
  quadrant: BadgeQuadrant;
  kind: "text" | "image" | "qr";
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: BadgeFontFamily;
  color?: string;
  visible: boolean;
};

export type BadgeLayout = { elements: BadgeLayoutElement[] };

export const DEFAULT_BADGE_LAYOUT: BadgeLayout = {
  elements: [
    { id: "eventLogo", label: "Logo do evento", quadrant: "front", kind: "image", x: 48, y: 24, width: 202, height: 70, visible: true },
    { id: "category", label: "Categoria", quadrant: "front", kind: "text", x: 38, y: 98, width: 222, height: 28, fontSize: 15, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "personName", label: "Nome", quadrant: "front", kind: "text", x: 28, y: 142, width: 242, height: 38, fontSize: 22, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "sponsorCompany", label: "Empresa do patrocinador", quadrant: "front", kind: "text", x: 38, y: 181, width: 222, height: 18, fontSize: 11, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "checkinQr", label: "QR de check-in", quadrant: "front", kind: "qr", x: 92, y: 202, width: 114, height: 114, visible: true },
    { id: "personNumber", label: "Número", quadrant: "front", kind: "text", x: 92, y: 326, width: 114, height: 34, fontSize: 20, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "sponsorJobTitle", label: "Cargo do patrocinador", quadrant: "front", kind: "text", x: 38, y: 382, width: 222, height: 18, fontSize: 10, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "socialQr", label: "QR das redes", quadrant: "social", kind: "qr", x: 456, y: 55, width: 82, height: 82, visible: true },
    { id: "facebook", label: "Facebook", quadrant: "social", kind: "text", x: 326, y: 182, width: 240, height: 42, fontSize: 16, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "instagram", label: "Instagram", quadrant: "social", kind: "text", x: 326, y: 242, width: 240, height: 42, fontSize: 16, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "youtube", label: "YouTube", quadrant: "social", kind: "text", x: 326, y: 302, width: 240, height: 42, fontSize: 16, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "certificateQr", label: "QR do certificado", quadrant: "institutional", kind: "qr", x: 48, y: 690, width: 76, height: 76, visible: true },
    { id: "eventName", label: "Nome do evento", quadrant: "institutional", kind: "text", x: 38, y: 492, width: 222, height: 55, fontSize: 22, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "eventDates", label: "Datas", quadrant: "schedule", kind: "text", x: 326, y: 570, width: 240, height: 54, fontSize: 24, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "eventTime", label: "Horário", quadrant: "schedule", kind: "text", x: 326, y: 645, width: 240, height: 45, fontSize: 22, fontFamily: "Inter", color: "#09050a", visible: true },
    { id: "eventLocation", label: "Local", quadrant: "schedule", kind: "text", x: 326, y: 715, width: 240, height: 76, fontSize: 18, fontFamily: "Inter", color: "#09050a", visible: true },
  ],
};

const quadrantBounds: Record<BadgeQuadrant, { x: number; y: number; width: number; height: number }> = {
  front: { x: 0, y: 0, width: BADGE_PANEL_WIDTH, height: BADGE_PANEL_HEIGHT },
  social: { x: BADGE_PANEL_WIDTH, y: 0, width: BADGE_PANEL_WIDTH, height: BADGE_PANEL_HEIGHT },
  institutional: { x: 0, y: BADGE_PANEL_HEIGHT, width: BADGE_PANEL_WIDTH, height: BADGE_PANEL_HEIGHT },
  schedule: { x: BADGE_PANEL_WIDTH, y: BADGE_PANEL_HEIGHT, width: BADGE_PANEL_WIDTH, height: BADGE_PANEL_HEIGHT },
};

export function getBadgeQuadrantBounds(quadrant: BadgeQuadrant) {
  return quadrantBounds[quadrant];
}

export const REQUIRED_BADGE_ELEMENTS = new Set<BadgeElementId>(["personName", "checkinQr", "personNumber"]);

function clamp(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function constrainBadgeElement(element: BadgeLayoutElement): BadgeLayoutElement {
  const bounds = quadrantBounds[element.quadrant];
  const width = clamp(element.width, 100, 20, bounds.width);
  const height = clamp(element.height, 30, 20, bounds.height);
  return {
    ...element,
    width,
    height,
    x: clamp(element.x, bounds.x, bounds.x, bounds.x + bounds.width - width),
    y: clamp(element.y, bounds.y, bounds.y, bounds.y + bounds.height - height),
  };
}

export function parseBadgeLayout(value: Json | string | null | undefined): BadgeLayout {
  let source: unknown = value;
  if (typeof value === "string") {
    try { source = JSON.parse(value); } catch { source = null; }
  }
  if (!source || typeof source !== "object" || !("elements" in source) || !Array.isArray(source.elements)) {
    return DEFAULT_BADGE_LAYOUT;
  }
  const submitted = new Map(source.elements.map((item) => [item && typeof item === "object" && "id" in item ? item.id : "", item]));
  return {
    elements: DEFAULT_BADGE_LAYOUT.elements.map((fallback) => {
      const value = submitted.get(fallback.id);
      if (!value || typeof value !== "object") return fallback;
      const candidate = value as Partial<BadgeLayoutElement>;
      return constrainBadgeElement({
        ...fallback,
        x: clamp(candidate.x, fallback.x, 0, BADGE_PAGE_WIDTH),
        y: clamp(candidate.y, fallback.y, 0, BADGE_PAGE_HEIGHT),
        width: clamp(candidate.width, fallback.width, 20, BADGE_PANEL_WIDTH),
        height: clamp(candidate.height, fallback.height, 20, BADGE_PANEL_HEIGHT),
        fontSize: fallback.kind === "text" ? clamp(candidate.fontSize, fallback.fontSize ?? 18, 8, 72) : undefined,
        fontFamily:
          fallback.kind === "text" && BADGE_FONT_FAMILIES.includes(candidate.fontFamily as BadgeFontFamily)
            ? (candidate.fontFamily as BadgeFontFamily)
            : fallback.fontFamily,
        color: typeof candidate.color === "string" && /^#[0-9a-f]{6}$/i.test(candidate.color) ? candidate.color : fallback.color,
        visible: REQUIRED_BADGE_ELEMENTS.has(fallback.id) ? true : candidate.visible !== false,
      });
    }),
  };
}
