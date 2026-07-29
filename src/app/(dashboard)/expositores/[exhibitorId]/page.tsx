import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExhibitorDetailForms } from "@/app/(dashboard)/expositores/[exhibitorId]/detail-forms";
import { TeamManagementSection } from "@/app/(dashboard)/equipe/team-management-section";
import { createAssetSignedUrl } from "@/lib/certificates/assets";
import { formatCnpj } from "@/lib/exhibitors/helpers";

type ExhibitorDetailPageProps = {
  params: Promise<{ exhibitorId: string }>;
  searchParams: Promise<{
    notice?: string;
    notice_type?: "success" | "error";
  }>;
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

export default async function ExhibitorDetailPage({ params, searchParams }: ExhibitorDetailPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { exhibitorId } = await params;
  const query = await searchParams;
  const admin = createAdminClient();

  const { data: exhibitor } = await admin
    .from("exhibitor_companies")
    .select("id, name, trade_name, legal_name, cnpj, phone, email, contact_name, notes, logo_path")
    .eq("id", exhibitorId)
    .maybeSingle();

  if (!exhibitor) {
    notFound();
  }

  const { data: exhibitorUsers } = await admin
    .from("exhibitor_users")
    .select("user_id")
    .eq("exhibitor_company_id", exhibitor.id);
  const linkedUserIds = [...new Set((exhibitorUsers ?? []).map((item) => item.user_id))];
  const userEmailMap = await getUserEmailMap(linkedUserIds);
  const users = linkedUserIds
    .map((userId) => ({
      userId,
      email: userEmailMap.get(userId) ?? userId,
    }))
    .sort((a, b) => a.email.localeCompare(b.email, "pt-BR"));

  const [{ data: teamMembersData }, logoUrl] = await Promise.all([
    admin
      .from("exhibitor_team_members")
      .select("id, full_name, job_title, linked_user_id, status")
      .eq("exhibitor_company_id", exhibitor.id)
      .order("status", { ascending: true })
      .order("full_name", { ascending: true }),
    createAssetSignedUrl(admin, exhibitor.logo_path),
  ]);
  const teamMembers = teamMembersData ?? [];

  const { data: eventLinks } = await admin
    .from("event_exhibitors")
    .select("event_id, stand_name")
    .eq("exhibitor_company_id", exhibitor.id);
  const linkedEventIds = [...new Set((eventLinks ?? []).map((item) => item.event_id))];
  const allEventsData =
    (
      await admin
        .from("events")
        .select("id, name, status")
        .order("created_at", { ascending: false })
    ).data ?? [];

  const eventById = new Map(allEventsData.map((event) => [event.id, event]));
  const linkedEvents = (eventLinks ?? [])
    .map((item) => {
      const event = eventById.get(item.event_id);
      return {
        eventId: item.event_id,
        eventName: event?.name ?? "Evento",
        eventStatus: event?.status ?? "-",
        standName: item.stand_name,
      };
    })
    .sort((a, b) => a.eventName.localeCompare(b.eventName, "pt-BR"));

  const allEvents = allEventsData.map((event) => ({
    id: event.id,
    name: event.name,
    status: event.status,
  }));

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <Link href="/expositores" className="text-sm font-semibold text-[var(--primary)]">
          ← Voltar para Expositores
        </Link>
        <h1 className="mt-2 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {exhibitor.trade_name ?? exhibitor.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {exhibitor.legal_name ?? "-"} • CNPJ {formatCnpj(exhibitor.cnpj)}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Usuários vinculados</p>
            <p className="font-headline text-2xl font-bold">{users.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Eventos vinculados</p>
            <p className="font-headline text-2xl font-bold">{linkedEvents.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Equipe ativa</p>
            <p className="font-headline text-2xl font-bold">
              {teamMembers.filter((member) => member.status === "active").length}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--outline-variant)]/40 bg-white p-3">
            <p className="text-xs text-muted">Eventos disponíveis</p>
            <p className="font-headline text-2xl font-bold">{allEvents.length - linkedEventIds.length}</p>
          </div>
        </div>
      </div>

      <TeamManagementSection
        company={{
          id: exhibitor.id,
          name: exhibitor.trade_name ?? exhibitor.name,
          hasLogo: Boolean(exhibitor.logo_path),
        }}
        logoUrl={logoUrl}
        members={teamMembers.map((member) => ({
          id: member.id,
          fullName: member.full_name,
          jobTitle: member.job_title,
          linkedUserId: member.linked_user_id,
          status: member.status,
        }))}
        users={users}
        returnTo={`/expositores/${exhibitor.id}#equipe-geral`}
        notice={query.notice}
        noticeType={query.notice_type}
        showEventsLink={false}
      />

      <ExhibitorDetailForms
        exhibitor={{
          id: exhibitor.id,
          tradeName: exhibitor.trade_name ?? exhibitor.name,
          legalName: exhibitor.legal_name ?? exhibitor.name,
          cnpj: exhibitor.cnpj ?? "",
          phone: exhibitor.phone ?? "",
          email: exhibitor.email ?? "",
          contactName: exhibitor.contact_name ?? "",
          notes: exhibitor.notes ?? "",
        }}
        users={users}
        linkedEvents={linkedEvents}
        allEvents={allEvents}
      />
    </section>
  );
}
