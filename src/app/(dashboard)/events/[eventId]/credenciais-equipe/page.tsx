import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { getAccessibleExhibitorCompanyIds } from "@/lib/exhibitors/access";
import { resolveExhibitorBadgeSettings } from "@/lib/exhibitor-credentials/settings";
import { formatSaoPauloDateTime } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveExhibitorBadgeSettingsAction } from "@/app/(dashboard)/events/[eventId]/credenciais-equipe/actions";

type ExhibitorCredentialsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ empresa?: string }>;
};

export default async function ExhibitorCredentialsPage({ params, searchParams }: ExhibitorCredentialsPageProps) {
  const session = await requireSession(["super_adm", "organizador", "expositor"]);
  const { eventId } = await params;
  const query = await searchParams;
  const admin = createAdminClient();
  const accessibleCompanyIds = await getAccessibleExhibitorCompanyIds(session);
  const canCustomize = session.role === "super_adm" || session.role === "organizador";

  const { data: eventExhibitorsData } = accessibleCompanyIds.length
    ? await admin
        .from("event_exhibitors")
        .select("id, exhibitor_company_id")
        .eq("event_id", eventId)
        .in("exhibitor_company_id", accessibleCompanyIds)
    : { data: [] };
  const eventExhibitors = eventExhibitorsData ?? [];
  const selectedLink =
    eventExhibitors.find((link) => link.exhibitor_company_id === query.empresa) ?? eventExhibitors[0] ?? null;

  if (!selectedLink) {
    return (
      <div className="surface-card rounded-2xl p-6">
        <h2 className="font-headline text-2xl font-extrabold">Credenciais da equipe</h2>
        <p className="mt-2 text-sm text-muted">Nenhuma empresa acessível está vinculada a este evento.</p>
      </div>
    );
  }

  const companyIds = eventExhibitors.map((link) => link.exhibitor_company_id);
  const [
    { data: companiesData },
    { data: membersData },
    { data: credentialsData },
    { data: storedSettings },
    { data: event },
  ] = await Promise.all([
    admin.from("exhibitor_companies").select("id, name, trade_name, logo_path").in("id", companyIds),
    admin
      .from("exhibitor_team_members")
      .select("id, full_name, job_title, status")
      .eq("exhibitor_company_id", selectedLink.exhibitor_company_id)
      .order("status", { ascending: true })
      .order("full_name", { ascending: true }),
    admin
      .from("exhibitor_credentials")
      .select("id, team_member_id, status, last_printed_at, print_count")
      .eq("event_exhibitor_id", selectedLink.id),
    admin.from("event_exhibitor_badge_settings").select("*").eq("event_id", eventId).maybeSingle(),
    admin.from("events").select("location").eq("id", eventId).maybeSingle(),
  ]);
  const companies = companiesData ?? [];
  const selectedCompany = companies.find((company) => company.id === selectedLink.exhibitor_company_id);
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const members = membersData ?? [];
  const credentialByMember = new Map((credentialsData ?? []).map((credential) => [credential.team_member_id, credential]));
  const activeMembers = members.filter((member) => member.status === "active");
  const settings = resolveExhibitorBadgeSettings(storedSettings);

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--outline)]">Identificação visual</p>
        <h2 className="mt-1 font-headline text-3xl font-extrabold tracking-tight">Credenciais da equipe</h2>
        <p className="mt-2 text-sm text-muted">
          Selecione as pessoas da Equipe Geral que trabalharão neste evento. Não há QR individual nem check-in.
        </p>
        {companies.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {eventExhibitors.map((link) => {
              const company = companyById.get(link.exhibitor_company_id);
              return (
                <Link
                  key={link.id}
                  href={`/events/${eventId}/credenciais-equipe?empresa=${link.exhibitor_company_id}`}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    link.id === selectedLink.id ? "bg-[var(--primary)] text-white" : "ghost-border bg-white"
                  }`}
                >
                  {company?.trade_name ?? company?.name ?? "Empresa"}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      {canCustomize ? (
        <details className="surface-card rounded-2xl p-5">
          <summary className="cursor-pointer font-headline text-xl font-extrabold tracking-tight text-[var(--foreground)]">
            Personalizar credencial da equipe
          </summary>
          <p className="mt-2 text-sm text-muted">
            Este modelo é exclusivo da equipe expositora e não altera a credencial dos participantes.
          </p>
          <form action={saveExhibitorBadgeSettingsAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="event_id" value={eventId} />

            <label className="text-sm font-semibold text-[var(--foreground)]">
              Identificação da frente
              <input
                name="front_label"
                defaultValue={settings.front_label}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
                placeholder="EXPOSITOR"
              />
            </label>
            <label className="text-sm font-semibold text-[var(--foreground)]">
              Cidade em destaque
              <input
                name="city_label"
                defaultValue={settings.city_label ?? event?.location ?? ""}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-[var(--foreground)]">
                Cor principal
                <input
                  name="primary_color"
                  type="color"
                  defaultValue={settings.primary_color}
                  className="mt-1.5 h-12 w-full rounded-xl border bg-white p-1"
                />
              </label>
              <label className="text-sm font-semibold text-[var(--foreground)]">
                Cor de fundo
                <input
                  name="secondary_color"
                  type="color"
                  defaultValue={settings.secondary_color}
                  className="mt-1.5 h-12 w-full rounded-xl border bg-white p-1"
                />
              </label>
            </div>
            <label className="text-sm font-semibold text-[var(--foreground)]">
              Destaque do logo da empresa
              <select
                name="company_logo_size"
                defaultValue={settings.company_logo_size}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
              >
                <option value="small">Pequeno</option>
                <option value="medium">Médio</option>
                <option value="large">Grande</option>
              </select>
            </label>

            <label className="text-sm font-semibold text-[var(--foreground)]">
              Título da área institucional
              <input
                name="company_heading"
                defaultValue={settings.company_heading}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[var(--foreground)]">
              Título da programação
              <input
                name="schedule_heading"
                defaultValue={settings.schedule_heading}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[var(--foreground)] md:col-span-2">
              Texto institucional
              <textarea
                name="institutional_text"
                rows={4}
                defaultValue={settings.institutional_text ?? ""}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[var(--foreground)] md:col-span-2">
              Programação resumida
              <textarea
                name="schedule_text"
                rows={5}
                defaultValue={settings.schedule_text ?? ""}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
                placeholder="19, 20 e 21 de agosto - 18h às 22h30"
              />
            </label>

            <label className="text-sm font-semibold text-[var(--foreground)] md:col-span-2">
              Chamada das redes sociais
              <input
                name="social_heading"
                defaultValue={settings.social_heading}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[var(--foreground)] md:col-span-2">
              Link do QR institucional
              <input
                name="social_url"
                type="url"
                defaultValue={settings.social_url ?? ""}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-mono font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[var(--foreground)]">
              Facebook
              <input
                name="facebook_label"
                defaultValue={settings.facebook_label ?? ""}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[var(--foreground)]">
              Instagram
              <input
                name="instagram_label"
                defaultValue={settings.instagram_label ?? ""}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-[var(--foreground)]">
              YouTube
              <input
                name="youtube_label"
                defaultValue={settings.youtube_label ?? ""}
                className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3 font-normal"
              />
            </label>

            <div className="grid gap-3 rounded-xl border bg-slate-50 p-4 md:col-span-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  name="show_job_title"
                  type="checkbox"
                  defaultChecked={settings.show_job_title}
                  className="h-5 w-5 accent-[var(--primary)]"
                />
                Mostrar cargo
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  name="show_event_logo"
                  type="checkbox"
                  defaultChecked={settings.show_event_logo}
                  className="h-5 w-5 accent-[var(--primary)]"
                />
                Mostrar logo do evento
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  name="show_social_qr"
                  type="checkbox"
                  defaultChecked={settings.show_social_qr}
                  className="h-5 w-5 accent-[var(--primary)]"
                />
                Mostrar QR institucional
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 md:col-span-2 sm:flex-row sm:justify-end">
              {activeMembers.length ? (
                <Link
                  href={`/api/events/${eventId}/exhibitor-credentials/preview?empresa=${selectedLink.exhibitor_company_id}`}
                  target="_blank"
                  className="rounded-xl border bg-white px-5 py-2.5 text-center text-sm font-semibold"
                >
                  Abrir prévia salva
                </Link>
              ) : null}
              <SubmitButton
                pendingLabel="Salvando..."
                className="gradient-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              >
                Salvar modelo da equipe
              </SubmitButton>
            </div>
          </form>
        </details>
      ) : null}

      {!selectedCompany?.logo_path ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esta empresa ainda não possui logo. A credencial usará o nome fantasia como alternativa.{" "}
          <Link href={`/equipe?empresa=${selectedLink.exhibitor_company_id}`} className="font-bold underline">
            Enviar logo
          </Link>
        </div>
      ) : null}

      <div className="surface-card rounded-2xl p-5">
        <form method="post" action={`/api/events/${eventId}/exhibitor-credentials`}>
          <input type="hidden" name="company_id" value={selectedLink.exhibitor_company_id} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-headline text-xl font-extrabold">
                {selectedCompany?.trade_name ?? selectedCompany?.name ?? "Empresa expositora"}
              </h3>
              <p className="mt-1 text-sm text-muted">{activeMembers.length} pessoas ativas disponíveis</p>
            </div>
            <SubmitButton
              disabled={!activeMembers.length}
              pendingLabel="Gerando PDF..."
              className="gradient-primary min-h-11 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Baixar selecionadas em PDF
            </SubmitButton>
          </div>

          <div className="mt-5 grid gap-3">
            {members.map((member) => {
              const credential = credentialByMember.get(member.id);
              const active = member.status === "active";
              return (
                <label
                  key={member.id}
                  className={`flex items-start gap-3 rounded-xl border p-4 ${
                    active ? "border-[var(--outline-variant)]/45 bg-white" : "border-slate-200 bg-slate-50 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="member_ids"
                    value={member.id}
                    defaultChecked={active}
                    disabled={!active}
                    className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-[var(--foreground)]">{member.full_name}</span>
                    <span className="block text-sm text-muted">{member.job_title || "Cargo não informado"}</span>
                    {credential?.last_printed_at ? (
                      <span className="mt-1 block text-xs text-muted">
                        Impressa {credential.print_count} vez(es) · última em {formatSaoPauloDateTime(credential.last_printed_at)}
                      </span>
                    ) : (
                      <span className="mt-1 block text-xs text-muted">{active ? "Ainda não impressa neste evento" : "Pessoa inativa"}</span>
                    )}
                  </span>
                  {active ? (
                    <Link
                      href={`/api/events/${eventId}/exhibitor-credentials/${member.id}?empresa=${selectedLink.exhibitor_company_id}`}
                      className="shrink-0 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-[var(--primary)]"
                    >
                      PDF individual
                    </Link>
                  ) : null}
                </label>
              );
            })}
            {!members.length ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted">
                A Equipe Geral desta empresa está vazia.{" "}
                <Link href={`/equipe?empresa=${selectedLink.exhibitor_company_id}`} className="font-bold text-[var(--primary)]">
                  Cadastrar pessoas
                </Link>
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
