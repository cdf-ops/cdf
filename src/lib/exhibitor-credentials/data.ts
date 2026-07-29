import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export async function loadExhibitorCredentialPdfData(
  admin: SupabaseClient<Database>,
  eventExhibitorId: string,
  requestedMemberIds: string[]
) {
  const { data: eventExhibitor } = await admin
    .from("event_exhibitors")
    .select("id, event_id, exhibitor_company_id")
    .eq("id", eventExhibitorId)
    .maybeSingle();
  if (!eventExhibitor) throw new Error("Empresa não vinculada ao evento.");

  const [{ data: event }, { data: company }, { data: daysData }] = await Promise.all([
    admin
      .from("events")
      .select("id, name, location, details, event_logo_path")
      .eq("id", eventExhibitor.event_id)
      .maybeSingle(),
    admin
      .from("exhibitor_companies")
      .select("id, name, trade_name, logo_path")
      .eq("id", eventExhibitor.exhibitor_company_id)
      .maybeSingle(),
    admin
      .from("event_days")
      .select("date")
      .eq("event_id", eventExhibitor.event_id)
      .order("date", { ascending: true }),
  ]);
  if (!event || !company) throw new Error("Dados da credencial não encontrados.");

  const memberIds = [...new Set(requestedMemberIds)];
  if (!memberIds.length) throw new Error("Selecione ao menos uma pessoa da equipe.");

  const { data: membersData } = await admin
    .from("exhibitor_team_members")
    .select("id, full_name, job_title")
    .eq("exhibitor_company_id", company.id)
    .eq("status", "active")
    .in("id", memberIds);
  const members = membersData ?? [];
  if (!members.length) throw new Error("Nenhuma pessoa ativa foi selecionada.");
  if (members.length !== memberIds.length) {
    throw new Error("A seleção contém uma pessoa inativa ou de outra empresa.");
  }

  const { data: settings } = await admin
    .from("event_exhibitor_badge_settings")
    .select("*")
    .eq("event_id", event.id)
    .maybeSingle();

  return {
    eventExhibitorId: eventExhibitor.id,
    event: {
      id: event.id,
      name: event.name,
      location: event.location,
      details: event.details,
      eventLogoPath: event.event_logo_path,
      dates: (daysData ?? []).map((day) => day.date),
    },
    company: {
      id: company.id,
      name: company.trade_name ?? company.name,
      logoPath: company.logo_path,
    },
    members: members
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))
      .map((member) => ({
        id: member.id,
        fullName: member.full_name,
        jobTitle: member.job_title,
      })),
    settings,
  };
}

export async function recordExhibitorCredentialPrints(
  admin: SupabaseClient<Database>,
  input: {
    eventExhibitorId: string;
    memberIds: string[];
    userId: string;
  }
) {
  const now = new Date().toISOString();
  const { data: existingData } = await admin
    .from("exhibitor_credentials")
    .select("id, team_member_id, print_count")
    .eq("event_exhibitor_id", input.eventExhibitorId)
    .in("team_member_id", input.memberIds);
  const existingByMember = new Map((existingData ?? []).map((credential) => [credential.team_member_id, credential]));

  const results = await Promise.all(
    input.memberIds.map((memberId) => {
      const existing = existingByMember.get(memberId);
      if (existing) {
        return admin
          .from("exhibitor_credentials")
          .update({
            status: "active",
            category: "expositor",
            generated_at: now,
            generated_by: input.userId,
            last_printed_at: now,
            last_printed_by: input.userId,
            print_count: existing.print_count + 1,
          })
          .eq("id", existing.id);
      }
      return admin.from("exhibitor_credentials").insert({
        event_exhibitor_id: input.eventExhibitorId,
        team_member_id: memberId,
        category: "expositor",
        status: "active",
        generated_at: now,
        generated_by: input.userId,
        last_printed_at: now,
        last_printed_by: input.userId,
        print_count: 1,
      });
    })
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw new Error("O PDF foi gerado, mas não foi possível registrar o histórico de impressão.");
  }
}
