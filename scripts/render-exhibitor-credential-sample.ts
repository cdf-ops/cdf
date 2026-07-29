import { mkdir, writeFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { generateExhibitorCredentialPdf } from "../src/lib/exhibitor-credentials/pdf";

async function main() {
  const outputDirectory = new URL("../output/pdf/", import.meta.url);
  await mkdir(outputDirectory, { recursive: true });

  const bytes = await generateExhibitorCredentialPdf({} as SupabaseClient<Database>, {
  event: {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Clube do Frio - Encontro Recife 2026",
    location: "Recife - PE",
    details: "Relacionamento, inovação e negócios para o setor de refrigeração.",
    eventLogoPath: null,
    dates: ["2026-10-01", "2026-10-02", "2026-10-03"],
  },
  company: {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Refrigeração Exemplo",
    logoPath: null,
  },
  members: [
    {
      id: "00000000-0000-0000-0000-000000000003",
      fullName: "Daniel Ferreira de Albuquerque",
      jobTitle: "Gerente Comercial",
    },
  ],
  settings: {
    city_label: "RECIFE - PE",
    primary_color: "#173f5f",
    secondary_color: "#dbeaf2",
    institutional_text: "Conectando profissionais e empresas do mercado de refrigeração.",
    schedule_text: "Programação das 18h às 22h30. Consulte a organização para informações adicionais.",
    social_url: "https://clubedofrio.com.br",
    facebook_label: "Clube do Frio",
    instagram_label: "@clubedofrio",
    youtube_label: "Clube do Frio",
  },
  });

  await writeFile(new URL("credencial-expositor-amostra.pdf", outputDirectory), bytes);
}

void main();
