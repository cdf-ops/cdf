import Link from "next/link";
import Form from "next/form";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCnpj, normalizeCnpj } from "@/lib/exhibitors/helpers";
import { CreateExhibitorForm } from "@/app/(dashboard)/expositores/create-exhibitor-form";

type ExhibitorsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

type ExhibitorRow = {
  id: string;
  name: string;
  trade_name: string | null;
  legal_name: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
};

export default async function ExhibitorsPage({ searchParams }: ExhibitorsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { q = "" } = await searchParams;
  const queryText = q.trim();
  const queryCnpj = normalizeCnpj(queryText);

  const admin = createAdminClient();
  let query = admin
    .from("exhibitor_companies")
    .select("id, name, trade_name, legal_name, cnpj, phone, email, contact_name")
    .order("updated_at", { ascending: false });

  if (queryText.length > 0) {
    query = query.or(
      `trade_name.ilike.%${queryText}%,legal_name.ilike.%${queryText}%,name.ilike.%${queryText}%,cnpj.ilike.%${queryCnpj || queryText}%`
    );
  }

  const { data: exhibitorsData } = await query;
  const exhibitors = (exhibitorsData ?? []) as ExhibitorRow[];
  const exhibitorIds = exhibitors.map((item) => item.id);

  const exhibitorUsers =
    exhibitorIds.length > 0
      ? (
          await admin
            .from("exhibitor_users")
            .select("exhibitor_company_id, user_id")
            .in("exhibitor_company_id", exhibitorIds)
        ).data ?? []
      : [];

  const eventLinks =
    exhibitorIds.length > 0
      ? (
          await admin
            .from("event_exhibitors")
            .select("exhibitor_company_id")
            .in("exhibitor_company_id", exhibitorIds)
        ).data ?? []
      : [];

  const userCountByCompany = new Map<string, number>();
  exhibitorUsers.forEach((item) => {
    userCountByCompany.set(item.exhibitor_company_id, (userCountByCompany.get(item.exhibitor_company_id) ?? 0) + 1);
  });

  const eventCountByCompany = new Map<string, number>();
  eventLinks.forEach((item) => {
    eventCountByCompany.set(item.exhibitor_company_id, (eventCountByCompany.get(item.exhibitor_company_id) ?? 0) + 1);
  });

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-xl p-5">
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Expositores</h1>
        <p className="mt-1 text-sm text-muted">
          Gerencie dados cadastrais dos expositores, seus usuários e vínculo com eventos.
        </p>
      </div>

      <CreateExhibitorForm />

      <div className="surface-card rounded-xl p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">Lista de Expositores</h2>
          <Form action="/expositores" scroll={false} className="flex w-full max-w-md gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nome ou CNPJ"
              className="w-full rounded-xl border border-[var(--outline-variant)]/50 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
            <SubmitButton pendingLabel="Buscando..." className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">
              Buscar
            </SubmitButton>
          </Form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="px-4 py-3">Expositor</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Usuários</th>
                <th className="px-4 py-3">Eventos</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {exhibitors.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{item.trade_name ?? item.name}</p>
                    <p className="text-xs text-muted">{item.legal_name ?? "-"}</p>
                  </td>
                  <td className="px-4 py-3">{formatCnpj(item.cnpj)}</td>
                  <td className="px-4 py-3">
                    <p>{item.phone ?? "-"}</p>
                    <p className="text-xs text-muted">{item.email ?? item.contact_name ?? "-"}</p>
                  </td>
                  <td className="px-4 py-3">{userCountByCompany.get(item.id) ?? 0}</td>
                  <td className="px-4 py-3">{eventCountByCompany.get(item.id) ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/expositores/${item.id}`}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/5"
                    >
                      Ver Detalhes
                    </Link>
                  </td>
                </tr>
              ))}
              {!exhibitors.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                    Nenhum expositor encontrado.
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
