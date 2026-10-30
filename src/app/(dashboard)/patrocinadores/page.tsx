import Link from "next/link";
import Form from "next/form";
import { CreateSponsorForm } from "@/app/(dashboard)/patrocinadores/create-sponsor-form";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type SponsorsPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function SponsorsPage({ searchParams }: SponsorsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const params = await searchParams;
  const query = params.q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const status = params.status === "inactive" || params.status === "all" ? params.status : "active";
  const admin = createAdminClient();

  let sponsorsQuery = admin
    .from("sponsors")
    .select("id, name, username, status, created_at")
    .order("name", { ascending: true });
  if (status !== "all") sponsorsQuery = sponsorsQuery.eq("status", status);

  const [{ data: sponsorRows, error }, { data: memberRows }, { data: recordRows }] = await Promise.all([
    sponsorsQuery,
    admin.from("sponsor_team_members").select("sponsor_id, status"),
    admin.from("sponsor_participant_records").select("sponsor_id").is("invalidated_at", null),
  ]);

  const memberCounts = new Map<string, number>();
  for (const member of memberRows ?? []) {
    if (member.status === "active") memberCounts.set(member.sponsor_id, (memberCounts.get(member.sponsor_id) ?? 0) + 1);
  }
  const recordCounts = new Map<string, number>();
  for (const record of recordRows ?? []) {
    recordCounts.set(record.sponsor_id, (recordCounts.get(record.sponsor_id) ?? 0) + 1);
  }

  const sponsors = (sponsorRows ?? []).filter((sponsor) => {
    if (!query) return true;
    return sponsor.name.toLocaleLowerCase("pt-BR").includes(query) || sponsor.username.toLocaleLowerCase("pt-BR").includes(query);
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Patrocinadores</h1>
        <p className="mt-1 text-sm text-muted">Cadastros globais, equipe permanente e acesso próprio, sem vínculo manual com eventos.</p>
      </header>

      <CreateSponsorForm />

      <div className="surface-card rounded-xl p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-headline text-xl font-bold">Lista de patrocinadores</h2>
            <p className="mt-1 text-sm text-muted">Ativos aparecem por padrão; nenhum cadastro é excluído.</p>
          </div>
          <Form action="/patrocinadores" scroll={false} className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_auto]">
            <input name="q" defaultValue={params.q ?? ""} placeholder="Buscar nome ou usuário" className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" />
            <select name="status" defaultValue={status} className="rounded-xl border border-[var(--outline-variant)]/55 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]">
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="all">Todos</option>
            </select>
            <SubmitButton pendingLabel="Filtrando..." className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">Aplicar</SubmitButton>
          </Form>
        </div>

        {error ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">A estrutura de patrocinadores ainda precisa ser aplicada ao banco para carregar esta lista.</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr><th className="px-4 py-3">Patrocinador</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Equipe ativa</th><th className="px-4 py-3">Registros</th><th className="px-4 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {sponsors.map((sponsor) => (
                <tr key={sponsor.id}>
                  <td className="px-4 py-3 font-semibold">{sponsor.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{sponsor.username}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sponsor.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{sponsor.status === "active" ? "Ativo" : "Inativo"}</span></td>
                  <td className="px-4 py-3">{memberCounts.get(sponsor.id) ?? 0}</td>
                  <td className="px-4 py-3">{recordCounts.get(sponsor.id) ?? 0}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/patrocinadores/${sponsor.id}`} className="rounded-lg px-3 py-2 font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/5">Gerenciar</Link></td>
                </tr>
              ))}
              {!error && sponsors.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Nenhum patrocinador encontrado.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

