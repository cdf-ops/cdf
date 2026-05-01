import type { Json } from "@/lib/supabase/database.types";

export const CERTIFICATE_WIDTH = 1920;
export const CERTIFICATE_HEIGHT = 1080;

export type CertificateElementId =
  | "text1"
  | "text2"
  | "text3"
  | "eventName"
  | "eventDate"
  | "participantName"
  | "eventLogo"
  | "sponsorImage";

export type CertificateElementKind = "text" | "image";

export type CertificateLayoutElement = {
  id: CertificateElementId;
  kind: CertificateElementKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  text?: string;
};

export type CertificateLayout = {
  elements: CertificateLayoutElement[];
};

export const DEFAULT_CERTIFICATE_LAYOUT: CertificateLayout = {
  elements: [
    {
      id: "eventLogo",
      kind: "image",
      label: "Logo do Evento",
      x: 120,
      y: 90,
      width: 300,
      height: 160,
    },
    {
      id: "eventName",
      kind: "text",
      label: "Nome do Evento",
      x: 320,
      y: 290,
      width: 1280,
      height: 90,
      fontSize: 54,
      color: "#191c1e",
      align: "center",
    },
    {
      id: "text1",
      kind: "text",
      label: "Texto 1",
      x: 560,
      y: 120,
      width: 800,
      height: 80,
      fontSize: 58,
      color: "#005ea4",
      align: "center",
      text: "CERTIFICADO",
    },
    {
      id: "text2",
      kind: "text",
      label: "Texto 2",
      x: 560,
      y: 400,
      width: 800,
      height: 58,
      fontSize: 34,
      color: "#191c1e",
      align: "center",
      text: "Certificamos que",
    },
    {
      id: "participantName",
      kind: "text",
      label: "Nome do Participante",
      x: 260,
      y: 500,
      width: 1400,
      height: 110,
      fontSize: 78,
      color: "#005ea4",
      align: "center",
    },
    {
      id: "text3",
      kind: "text",
      label: "Texto 3",
      x: 460,
      y: 630,
      width: 1000,
      height: 58,
      fontSize: 34,
      color: "#191c1e",
      align: "center",
      text: "participou de forma presencial no",
    },
    {
      id: "eventDate",
      kind: "text",
      label: "Data do Evento",
      x: 560,
      y: 690,
      width: 800,
      height: 70,
      fontSize: 38,
      color: "#191c1e",
      align: "center",
    },
    {
      id: "sponsorImage",
      kind: "image",
      label: "Imagem do Patrocinador",
      x: 660,
      y: 850,
      width: 600,
      height: 130,
    },
  ],
};

const elementIds = new Set<CertificateElementId>([
  "text1",
  "text2",
  "text3",
  "eventName",
  "eventDate",
  "participantName",
  "eventLogo",
  "sponsorImage",
]);

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sanitizeColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function sanitizeText(value: unknown, fallback: string | undefined) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().slice(0, 180);
  return normalized || fallback;
}

export function parseCertificateLayout(value: Json | string | null | undefined): CertificateLayout {
  let source: Json | undefined | null = value;
  if (typeof value === "string") {
    try {
      source = JSON.parse(value) as Json;
    } catch {
      source = null;
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source) || !Array.isArray(source.elements)) {
    return DEFAULT_CERTIFICATE_LAYOUT;
  }

  const submittedElements = new Map(
    source.elements
      .filter((element): element is Partial<CertificateLayoutElement> => {
        return Boolean(element && typeof element === "object" && !Array.isArray(element) && elementIds.has(element.id as CertificateElementId));
      })
      .map((element) => [element.id, element])
  );

  return {
    elements: DEFAULT_CERTIFICATE_LAYOUT.elements.map((fallback) => {
      const submitted = submittedElements.get(fallback.id);
      if (!submitted) {
        return fallback;
      }

      return {
        ...fallback,
        x: sanitizeNumber(submitted.x, fallback.x, 0, CERTIFICATE_WIDTH),
        y: sanitizeNumber(submitted.y, fallback.y, 0, CERTIFICATE_HEIGHT),
        width: sanitizeNumber(submitted.width, fallback.width, 40, CERTIFICATE_WIDTH),
        height: sanitizeNumber(submitted.height, fallback.height, 30, CERTIFICATE_HEIGHT),
        fontSize:
          fallback.kind === "text" ? sanitizeNumber(submitted.fontSize, fallback.fontSize ?? 40, 12, 140) : undefined,
        color: fallback.kind === "text" ? sanitizeColor(submitted.color, fallback.color ?? "#191c1e") : undefined,
        align:
          submitted.align === "left" || submitted.align === "center" || submitted.align === "right"
            ? submitted.align
            : fallback.align,
        text: fallback.text ? sanitizeText(submitted.text, fallback.text) : undefined,
      };
    }),
  };
}
