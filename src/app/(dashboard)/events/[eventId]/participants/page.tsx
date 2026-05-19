import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateParticipantForm } from "@/app/(dashboard)/events/[eventId]/participants/create-participant-form";

type ParticipantsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string }>;
};

type ParticipantRow = {
  participantId: string;
  fullName: string;
  document: string;
  email: string;
  phone: string;
  days: string[];
};

function maskEmail(value: string) {
  const [localPart = "", domainPart = ""] = value.split("@");
  if (!localPart || !domainPart) {
    return "dado oculto";
  }

  const localVisible = localPart.slice(0, 3);
  const localMask = "*".repeat(Math.max(localPart.length - localVisible.length, 2));

  const compactDomain = domainPart.replaceAll(".", "");
  const domainVisibleStart = compactDomain.slice(0, 3);
  const domainVisibleEnd = compactDomain.slice(-2);
  const domainMask = "*".repeat(Math.max(compactDomain.length - domainVisibleStart.length - domainVisibleEnd.length, 2));

  return `${localVisible}${localMask}@${domainVisibleStart}${domainMask}${domainVisibleEnd}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "dado oculto";
  }

  let current = 0;
  const total = digits.length;

  return value.replace(/\d/g, () => {
    current += 1;
    if (current <= 2 || current > total - 2) {
      return digits[current - 1];
    }
    return "*";
  });
}

export default async function ParticipantsPage({ params, searchParams }: ParticipantsPageProps) {
  const session = await requireSession(["super_adm", "organizador", "recepcao", "expositor"]);
  const { eventId } = await params;
  const { q = "" } = await searchParams;
  const shouldMaskSensitiveContact = session.role === "expositor";

  const admin = createAdminClient();
  const { data: rawEventDays } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", eventId)
    .order("date", { ascending: true });
  const eventDays = rawEventDays ?? [];
  const dayById = new Map(eventDays.map((day) => [day.id, day.date]));
  const participantBaseQuery = "id, full_name, document_type, document_number, email, phone";
  let rows: ParticipantRow[] = [];
  let relationCount = 0;
  let relationLabel = "Vínculos inscrição";
  let dayColumnLabel = "Dias Selecionados";

  if (session.role === "expositor") {
    relationLabel = "Check-ins no stand";
    dayColumnLabel = "Dias com check-in no stand";

    const { data: exhibitorUserRows } = await admin
      .from("exhibitor_users")
      .select("exhibitor_company_id")
      .eq("user_id", session.userId);
    const companyIds = [...new Set((exhibitorUserRows ?? []).map((item) => item.exhibitor_company_id))];

    const eventExhibitorIds =
      companyIds.length > 0
        ? (
            await admin
              .from("event_exhibitors")
              .select("id")
              .eq("event_id", eventId)
              .in("exhibitor_company_id", companyIds)
          ).data?.map((item) => item.id) ?? []
        : [];

    const standCheckins =
      eventExhibitorIds.length > 0 && eventDays.length > 0
        ? (
            await admin
              .from("stand_checkins")
              .select("participant_id, event_day_id")
              .in("event_exhibitor_id", eventExhibitorIds)
              .in(
                "event_day_id",
                eventDays.map((day) => day.id)
              )
              .is("deleted_at", null)
          ).data ?? []
        : [];

    relationCount = standCheckins.length;

    const participantIds = [...new Set(standCheckins.map((item) => item.participant_id))];
    let participants: {
      id: string;
      full_name: string;
      document_type: string;
      document_number: string;
      email: string;
      phone: string;
    }[] = [];

    if (participantIds.length) {
      const { data } = await admin
        .from("participants")
        .select(participantBaseQuery)
        .in("id", participantIds)
        .or(
          q
            ? `full_name.ilike.%${q}%,document_number.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
            : "id.not.is.null"
        );
      participants = data ?? [];
    }

    const participantDayMap = new Map<string, string[]>();
    standCheckins.forEach((checkin) => {
      const date = dayById.get(checkin.event_day_id);
      if (!date) {
        return;
      }
      const current = participantDayMap.get(checkin.participant_id) ?? [];
      current.push(date);
      participantDayMap.set(checkin.participant_id, [...new Set(current)].sort());
    });

    rows = participants
      .map((participant) => ({
        participantId: participant.id,
        fullName: participant.full_name,
        document: `${participant.document_type} ${participant.document_number}`,
        email: participant.email,
        phone: participant.phone,
        days: participantDayMap.get(participant.id) ?? [],
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  } else {
    const registrations =
      eventDays.length > 0
        ? (
            await admin
              .from("event_registrations")
              .select("participant_id, event_day_id")
              .in(
                "event_day_id",
                eventDays.map((day) => day.id)
              )
          ).data ?? []
        : [];
    relationCount = registrations.length;

    const participantIds = [...new Set(registrations.map((item) => item.participant_id))];
    let participants: {
      id: string;
      full_name: string;
      document_type: string;
      document_number: string;
      email: string;
      phone: string;
    }[] = [];

    if (participantIds.length) {
      const { data } = await admin
        .from("participants")
        .select(participantBaseQuery)
        .in("id", participantIds)
        .or(
          q
            ? `full_name.ilike.%${q}%,document_number.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
            : "id.not.is.null"
        );
      participants = data ?? [];
    }

    const participantDayMap = new Map<string, string[]>();
    registrations.forEach((registration) => {
      const date = dayById.get(registration.event_day_id);
      if (!date) {
        return;
      }
      const current = participantDayMap.get(registration.participant_id) ?? [];
      current.push(date);
      participantDayMap.set(registration.participant_id, [...new Set(current)].sort());
    });

    rows = participants
      .map((participant) => ({
        participantId: participant.id,
        fullName: participant.full_name,
        document: `${participant.document_type} ${participant.document_number}`,
        email: participant.email,
        phone: participant.phone,
        days: participantDayMap.get(participant.id) ?? [],
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  }

  return (
    <section>
      <CreateParticipantForm
        eventId={eventId}
        eventDays={eventDays}
        canCreate={["super_adm", "organizador", "recepcao"].includes(session.role)}
      />

      <div className="surface-card rounded-xl p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Lista de Participantes</h2>
          <form className="w-full max-w-sm">
            <input
              name="q"
              defaultValue={q}
              placeholder="Pesquisar por nome, doc, e-mail ou telefone"
              className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </form>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Total de participantes</p>
            <p className="font-headline text-2xl font-bold">{rows.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Dias do evento</p>
            <p className="font-headline text-2xl font-bold">{eventDays.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">{relationLabel}</p>
            <p className="font-headline text-2xl font-bold">{relationCount}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-4 py-3">Participante</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">{dayColumnLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {rows.map((row) => (
                <tr key={row.participantId} className="hover:bg-[var(--surface-container-low)]/70">
                  <td className="px-4 py-3 font-semibold">{row.fullName}</td>
                  <td className="px-4 py-3">{row.document}</td>
                  <td className="px-4 py-3">
                    <p>{shouldMaskSensitiveContact ? maskEmail(row.email) : row.email}</p>
                    <p className="text-xs text-muted">{shouldMaskSensitiveContact ? maskPhone(row.phone) : row.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.days.map((day) => (
                        <span key={day} className="rounded-full bg-[var(--primary-soft)]/45 px-2 py-1 text-xs font-semibold text-[var(--primary)]">
                          {new Date(day).toLocaleDateString("pt-BR")}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                    Nenhum participante encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
