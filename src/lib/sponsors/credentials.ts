import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createCredentialSlug } from "@/lib/badges/tokens";
import { getSaoPauloDateKey } from "@/lib/date-time";
import type { Database } from "@/lib/supabase/database.types";

export function sponsorMemberCode(memberNumber: number) {
  return `PAT-${String(memberNumber).padStart(6, "0")}`;
}

export async function loadSponsorTeamCredentialPdfData(
  admin: SupabaseClient<Database>,
  input: { sponsorId: string; eventId: string; memberIds: string[] }
) {
  const memberIds = [...new Set(input.memberIds)];
  if (!memberIds.length) throw new Error("Selecione ao menos uma pessoa ativa da equipe.");

  const [{ data: sponsor }, { data: event }, { data: days }, { data: members }, { data: settings }] =
    await Promise.all([
      admin.from("sponsors").select("id, name, status").eq("id", input.sponsorId).maybeSingle(),
      admin
        .from("events")
        .select("id, name, location, details, event_logo_path, status")
        .eq("id", input.eventId)
        .maybeSingle(),
      admin.from("event_days").select("date").eq("event_id", input.eventId).order("date"),
      admin
        .from("sponsor_team_members")
        .select("id, member_number, full_name, job_title, status")
        .eq("sponsor_id", input.sponsorId)
        .in("id", memberIds),
      admin.from("event_badge_settings").select("*").eq("event_id", input.eventId).maybeSingle(),
    ]);

  if (!sponsor || sponsor.status !== "active") throw new Error("Patrocinador inativo ou não encontrado.");
  if (!event || event.status !== "ativo") throw new Error("Evento inativo ou não encontrado.");
  const eventDates = (days ?? []).map((day) => day.date).sort();
  if (!eventDates.length || eventDates[eventDates.length - 1] < getSaoPauloDateKey()) {
    throw new Error("As credenciais só podem ser preparadas para eventos ativos atuais ou futuros.");
  }
  if ((members ?? []).length !== memberIds.length || (members ?? []).some((member) => member.status !== "active")) {
    throw new Error("A seleção contém uma pessoa inativa ou de outro patrocinador.");
  }

  const { data: existing } = await admin
    .from("sponsor_team_credentials")
    .select("team_member_id, qr_slug")
    .eq("sponsor_id", input.sponsorId)
    .eq("event_id", input.eventId)
    .in("team_member_id", memberIds);
  const existingByMember = new Map((existing ?? []).map((credential) => [credential.team_member_id, credential]));
  const missing = (members ?? []).filter((member) => !existingByMember.has(member.id));
  if (missing.length) {
    const { error } = await admin.from("sponsor_team_credentials").insert(
      missing.map((member) => ({
        sponsor_id: input.sponsorId,
        team_member_id: member.id,
        event_id: input.eventId,
        qr_slug: createCredentialSlug(),
      }))
    );
    if (error && error.code !== "23505") throw new Error("Não foi possível gerar os QR Codes da equipe.");
  }

  const { data: credentials } = await admin
    .from("sponsor_team_credentials")
    .select("team_member_id, qr_slug")
    .eq("sponsor_id", input.sponsorId)
    .eq("event_id", input.eventId)
    .in("team_member_id", memberIds);
  const credentialByMember = new Map((credentials ?? []).map((credential) => [credential.team_member_id, credential]));
  if (credentialByMember.size !== memberIds.length) throw new Error("Não foi possível preparar todas as credenciais.");

  return {
    event: {
      id: event.id,
      name: event.name,
      location: event.location,
      details: event.details,
      eventLogoPath: event.event_logo_path,
      dates: eventDates,
    },
    participants: (members ?? [])
      .sort((left, right) => left.full_name.localeCompare(right.full_name, "pt-BR"))
      .map((member) => ({
        id: member.id,
        fullName: member.full_name,
        participantNumber: sponsorMemberCode(member.member_number),
        qrSlug: credentialByMember.get(member.id)?.qr_slug ?? "",
        categoryLabel: settings?.sponsor_label ?? "PATROCINADOR",
        sponsorCompany: sponsor.name,
        sponsorJobTitle: member.job_title,
      })),
    settings,
    sponsor,
  };
}
