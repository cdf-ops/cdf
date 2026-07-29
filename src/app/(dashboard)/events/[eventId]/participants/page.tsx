import Form from "next/form";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { formatDateOnly } from "@/lib/date-time";
import { parseParticipantNumberSearch } from "@/lib/participants/number";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateParticipantForm } from "@/app/(dashboard)/events/[eventId]/participants/create-participant-form";
import {
  discloseParticipantData,
  getExhibitorDataSettings,
} from "@/lib/exhibitors/data-sharing";

type ParticipantsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string }>;
};

type ParticipantRow = {
  participantId: string;
  participantNumber: number;
  fullName: string;
  document: string;
  email: string;
  phone: string;
  profession: string;
  city: string;
  state: string;
  days: string[];
  consentGranted: boolean | null;
};

export default async function ParticipantsPage({ params, searchParams }: ParticipantsPageProps) {
  const session = await requireSession(["super_adm", "organizador", "recepcao", "expositor"]);
  const { eventId } = await params;
  const { q = "" } = await searchParams;
  const searchedParticipantNumber = parseParticipantNumberSearch(q);
  const participantNumberFilter = searchedParticipantNumber
    ? `participant_number.eq.${searchedParticipantNumber},`
    : "";
  const isExhibitor = session.role === "expositor";
  const canViewConsent = session.role === "super_adm" || session.role === "organizador";

  const admin = createAdminClient();
  const { data: rawEventDays } = await admin
    .from("event_days")
    .select("id, date")
    .eq("event_id", eventId)
    .order("date", { ascending: true });
  const eventDays = rawEventDays ?? [];
  const dayById = new Map(eventDays.map((day) => [day.id, day.date]));
  const participantBaseQuery =
    "id, participant_number, full_name, document_type, document_number, email, phone, profession, city, state";
  const exhibitorParticipantQuery =
    "id, participant_number, full_name, email, phone, profession, city, state";
  let rows: ParticipantRow[] = [];
  let relationCount = 0;
  let relationLabel = "Vínculos inscrição";
  let dayColumnLabel = "Dias Selecionados";

  if (isExhibitor) {
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
      participant_number: number;
      full_name: string;
      email: string;
      phone: string;
      profession: string;
      city: string;
      state: string;
    }[] = [];

    if (participantIds.length) {
      const { data } = await admin
        .from("participants")
        .select(exhibitorParticipantQuery)
        .in("id", participantIds);
      participants = data ?? [];
    }
    const [{ data: consentRows }, exhibitorSettings] = await Promise.all([
      participantIds.length
        ? admin
            .from("participant_event_consents")
            .select("participant_id, exhibitor_data_sharing")
            .eq("event_id", eventId)
            .in("participant_id", participantIds)
        : Promise.resolve({ data: [] }),
      getExhibitorDataSettings(admin, eventId),
    ]);
    const consentMap = new Map(
      (consentRows ?? []).map((item) => [item.participant_id, item.exhibitor_data_sharing])
    );

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
      .map((participant) => {
        const shared = discloseParticipantData(
          participant,
          exhibitorSettings,
          consentMap.get(participant.id) === true
        );
        return {
          participantId: participant.id,
          participantNumber: shared.participant_number,
          fullName: shared.full_name,
          document: "",
          email: shared?.email ?? "",
          phone: shared?.phone ?? "",
          profession: shared?.profession ?? "",
          city: shared?.city ?? "",
          state: shared?.state ?? "",
          days: participantDayMap.get(participant.id) ?? [],
          consentGranted: consentMap.get(participant.id) === true,
        };
      })
      .filter((participant) => {
        const search = q.trim().toLocaleLowerCase("pt-BR");
        if (!search) return true;
        return (
          (participant.participantNumber > 0 && String(participant.participantNumber) === search) ||
          participant.fullName.toLocaleLowerCase("pt-BR").includes(search)
        );
      })
      .sort((a, b) => {
        if (searchedParticipantNumber) {
          const aExact = a.participantNumber === searchedParticipantNumber ? 1 : 0;
          const bExact = b.participantNumber === searchedParticipantNumber ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
        }
        return a.fullName.localeCompare(b.fullName, "pt-BR");
      });
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
      participant_number: number;
      full_name: string;
      document_type: string;
      document_number: string;
      email: string;
      phone: string;
      profession: string;
      city: string;
      state: string;
    }[] = [];

    if (participantIds.length) {
      const { data } = await admin
        .from("participants")
        .select(participantBaseQuery)
        .in("id", participantIds)
        .or(
          q
            ? `${participantNumberFilter}full_name.ilike.%${q}%,document_number.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
            : "id.not.is.null"
        );
      participants = data ?? [];
    }
    const { data: consentRows } =
      canViewConsent && participantIds.length > 0
        ? await admin
            .from("participant_event_consents")
            .select("participant_id, exhibitor_data_sharing")
            .eq("event_id", eventId)
            .in("participant_id", participantIds)
        : { data: [] };
    const consentMap = new Map(
      (consentRows ?? []).map((item) => [item.participant_id, item.exhibitor_data_sharing])
    );

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
        participantNumber: participant.participant_number,
        fullName: participant.full_name,
        document: `${participant.document_type} ${participant.document_number}`,
        email: participant.email,
        phone: participant.phone,
        profession: participant.profession,
        city: participant.city,
        state: participant.state,
        days: participantDayMap.get(participant.id) ?? [],
        consentGranted: consentMap.get(participant.id) ?? false,
      }))
      .sort((a, b) => {
        if (searchedParticipantNumber) {
          const aExact = a.participantNumber === searchedParticipantNumber ? 1 : 0;
          const bExact = b.participantNumber === searchedParticipantNumber ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
        }
        return a.fullName.localeCompare(b.fullName, "pt-BR");
      });
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
          <Form action={`/events/${eventId}/participants`} scroll={false} className="flex w-full max-w-md gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder={isExhibitor ? "Pesquisar por número ou nome autorizado" : "Pesquisar por número, nome, doc, e-mail ou telefone"}
              className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
            <SubmitButton pendingLabel="Buscando..." className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">
              Buscar
            </SubmitButton>
          </Form>
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
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Participante</th>
                {!isExhibitor ? <th className="px-4 py-3">Documento</th> : null}
                <th className="px-4 py-3">{isExhibitor ? "Dados adicionais" : "Contato"}</th>
                {canViewConsent ? <th className="px-4 py-3">Dados adicionais no expositor</th> : null}
                <th className="px-4 py-3">{dayColumnLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {rows.map((row) => (
                <tr key={row.participantId} className="hover:bg-[var(--surface-container-low)]/70">
                  <td className="px-4 py-3 font-mono text-lg font-black text-[var(--primary)]">
                    {row.participantNumber || "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold">{row.fullName}</td>
                  {!isExhibitor ? <td className="px-4 py-3">{row.document}</td> : null}
                  <td className="px-4 py-3">
                    {isExhibitor ? (
                      row.consentGranted ? (
                        <div className="space-y-0.5">
                          {row.email ? <p>{row.email}</p> : null}
                          {row.phone ? <p>{row.phone}</p> : null}
                          {row.profession ? <p>{row.profession}</p> : null}
                          {row.city || row.state ? <p>{[row.city, row.state].filter(Boolean).join(" / ")}</p> : null}
                          {!row.email && !row.phone && !row.profession && !row.city && !row.state ? (
                            <p className="text-xs text-muted">Somente nome e número liberados</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-muted">Não autorizados; nome e número mantidos</span>
                      )
                    ) : (
                      <>
                        <p>{row.email}</p>
                        <p className="text-xs text-muted">{row.phone}</p>
                      </>
                    )}
                  </td>
                  {canViewConsent ? (
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          row.consentGranted
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {row.consentGranted ? "Autorizados" : "Não autorizados"}
                      </span>
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.days.map((day) => (
                        <span key={day} className="rounded-full bg-[var(--primary-soft)]/45 px-2 py-1 text-xs font-semibold text-[var(--primary)]">
                          {formatDateOnly(day)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={isExhibitor ? 4 : canViewConsent ? 6 : 5}
                    className="px-4 py-6 text-center text-sm text-muted"
                  >
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
