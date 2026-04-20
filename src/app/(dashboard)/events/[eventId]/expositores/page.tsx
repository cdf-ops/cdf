import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExhibitorForms } from "@/app/(dashboard)/events/[eventId]/expositores/forms";

type ExhibitorsPageProps = {
  params: Promise<{ eventId: string }>;
};

async function getUserEmailMap(userIds: string[]) {
  const admin = createAdminClient();
  const emailMap = new Map<string, string>();
  const remaining = new Set(userIds);
  const perPage = 200;

  for (let page = 1; page <= 20 && remaining.size > 0; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      break;
    }

    const users = data?.users ?? [];
    users.forEach((user) => {
      if (remaining.has(user.id)) {
        emailMap.set(user.id, user.email ?? "sem-email");
        remaining.delete(user.id);
      }
    });

    if (users.length < perPage) {
      break;
    }
  }

  return emailMap;
}

export default async function ExhibitorsPage({ params }: ExhibitorsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const admin = createAdminClient();

  const { data: event } = await admin.from("events").select("id, name").eq("id", eventId).maybeSingle();
  if (!event) {
    notFound();
  }

  const { data: allCompaniesData } = await admin
    .from("exhibitor_companies")
    .select("id, name")
    .order("name", { ascending: true });
  const allCompanies = allCompaniesData ?? [];

  const { data: eventExhibitorsData } = await admin
    .from("event_exhibitors")
    .select("id, exhibitor_company_id, stand_name")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  const eventExhibitors = eventExhibitorsData ?? [];

  const eventCompanyIds = [...new Set(eventExhibitors.map((item) => item.exhibitor_company_id))];
  const eventCompaniesData =
    eventCompanyIds.length > 0
      ? (
          await admin
            .from("exhibitor_companies")
            .select("id, name")
            .in("id", eventCompanyIds)
            .order("name", { ascending: true })
        ).data ?? []
      : [];
  const eventCompanyNameById = new Map(eventCompaniesData.map((item) => [item.id, item.name]));

  const exhibitorUsersData =
    eventCompanyIds.length > 0
      ? (
          await admin
            .from("exhibitor_users")
            .select("user_id, exhibitor_company_id")
            .in("exhibitor_company_id", eventCompanyIds)
        ).data ?? []
      : [];

  const linkedUserIds = [...new Set(exhibitorUsersData.map((item) => item.user_id))];
  const userEmailById = await getUserEmailMap(linkedUserIds);

  const userLinksByCompanyId = new Map<
    string,
    Array<{
      userId: string;
      email: string;
    }>
  >();
  exhibitorUsersData.forEach((item) => {
    const email = userEmailById.get(item.user_id) ?? item.user_id;

    const currentLinks = userLinksByCompanyId.get(item.exhibitor_company_id) ?? [];
    if (!currentLinks.some((link) => link.userId === item.user_id)) {
      userLinksByCompanyId.set(item.exhibitor_company_id, [...currentLinks, { userId: item.user_id, email }]);
    }
  });

  const eventCompanyOptions = eventExhibitors
    .map((item) => ({
      id: item.exhibitor_company_id,
      name: eventCompanyNameById.get(item.exhibitor_company_id) ?? "Expositor",
      standName: item.stand_name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const eventCompanyRows = eventCompanyOptions.map((item) => ({
    id: item.id,
    name: item.name,
    standName: item.standName,
    users: userLinksByCompanyId.get(item.id) ?? [],
  }));

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">Gestão de Expositores</p>
        <h2 className="mt-1 font-headline text-2xl font-extrabold tracking-tight text-[var(--foreground)]">{event.name}</h2>
        <p className="mt-1 text-sm text-muted">
          Cadastre empresas, vincule ao evento com stand e associe os usuários expositores.
        </p>
      </div>

      <ExhibitorForms
        eventId={eventId}
        allCompanies={allCompanies}
        eventCompanies={eventCompanyOptions}
        eventCompanyRows={eventCompanyRows}
      />

      <div className="surface-card rounded-xl p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Empresas cadastradas</p>
            <p className="font-headline text-2xl font-bold">{allCompanies.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Expositores no evento</p>
            <p className="font-headline text-2xl font-bold">{eventExhibitors.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Usuários expositores vinculados</p>
            <p className="font-headline text-2xl font-bold">{linkedUserIds.length}</p>
          </div>
        </div>

        <p className="text-sm text-muted">
          Os vínculos detalhados e ações de remoção estão disponíveis no bloco &quot;Vínculos Atuais no Evento&quot;
          acima.
        </p>
      </div>
    </section>
  );
}
