import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { formatSaoPauloDateTime } from "@/lib/date-time";
import { getAccessibleExhibitorCompanyIds } from "@/lib/exhibitors/access";
import { createAdminClient } from "@/lib/supabase/admin";

type SponsorCredentialPageProps = { params: Promise<{ eventId: string }>; searchParams: Promise<{ empresa?: string }> };

export default async function SponsorCredentialPage({ params, searchParams }: SponsorCredentialPageProps) {
  const session = await requireSession(["super_adm", "organizador", "expositor"]);
  const { eventId } = await params;
  const { empresa } = await searchParams;
  const admin = createAdminClient();
  const accessibleCompanyIds = await getAccessibleExhibitorCompanyIds(session);
  const { data: linksData } = accessibleCompanyIds.length
    ? await admin.from("event_exhibitors").select("id, exhibitor_company_id").eq("event_id", eventId).in("exhibitor_company_id", accessibleCompanyIds)
    : { data: [] };
  const links = linksData ?? [];
  const selectedLink = links.find((item) => item.exhibitor_company_id === empresa) ?? links[0] ?? null;

  if (!selectedLink) return <div className="surface-card rounded-2xl p-6"><h2 className="font-headline text-2xl font-extrabold">Credencial do patrocinador</h2><p className="mt-2 text-sm text-muted">Nenhum patrocinador acessível está vinculado a este evento.</p></div>;

  const companyIds = links.map((item) => item.exhibitor_company_id);
  const [{ data: companiesData }, { data: membersData }, { data: credentialsData }] = await Promise.all([
    admin.from("exhibitor_companies").select("id, name, trade_name").in("id", companyIds),
    admin.from("exhibitor_team_members").select("id, full_name, job_title, status").eq("exhibitor_company_id", selectedLink.exhibitor_company_id).order("status").order("full_name"),
    admin.from("exhibitor_credentials").select("id, team_member_id, status, last_printed_at, print_count").eq("event_exhibitor_id", selectedLink.id),
  ]);
  const companies = companiesData ?? [];
  const selectedCompany = companies.find((item) => item.id === selectedLink.exhibitor_company_id);
  const companyById = new Map(companies.map((item) => [item.id, item]));
  const members = membersData ?? [];
  const activeMembers = members.filter((item) => item.status === "active");
  const credentialByMember = new Map((credentialsData ?? []).map((item) => [item.team_member_id, item]));

  return <section className="space-y-6">
    <div className="surface-card rounded-2xl p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--outline)]">Identificação do evento</p>
      <h2 className="mt-1 font-headline text-3xl font-extrabold tracking-tight">Credencial do patrocinador</h2>
      <p className="mt-2 text-sm text-muted">Usa o mesmo modelo A4 dos participantes, com rótulo e QR individual de patrocinador.</p>
      {session.role !== "expositor" ? <Link href={`/events/${eventId}/credentials`} className="mt-3 inline-flex text-sm font-bold text-[var(--primary)]">Editar modelo compartilhado</Link> : null}
      {companies.length > 1 ? <div className="mt-4 flex flex-wrap gap-2">{links.map((link) => { const company = companyById.get(link.exhibitor_company_id); return <Link key={link.id} href={`/events/${eventId}/credencial-patrocinador?empresa=${link.exhibitor_company_id}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${link.id === selectedLink.id ? "bg-[var(--primary)] text-white" : "ghost-border bg-white"}`}>{company?.trade_name ?? company?.name ?? "Patrocinador"}</Link>; })}</div> : null}
    </div>
    <div className="surface-card rounded-2xl p-5">
      <form method="post" action={`/api/events/${eventId}/sponsor-credentials`}>
        <input type="hidden" name="company_id" value={selectedLink.exhibitor_company_id} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h3 className="font-headline text-xl font-extrabold">{selectedCompany?.trade_name ?? selectedCompany?.name ?? "Empresa patrocinadora"}</h3><p className="mt-1 text-sm text-muted">{activeMembers.length} pessoas ativas disponíveis</p></div>
          <SubmitButton disabled={!activeMembers.length} pendingLabel="Gerando PDF..." className="gradient-primary min-h-11 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Baixar selecionadas em PDF</SubmitButton>
        </div>
        <div className="mt-5 grid gap-3">{members.map((member) => {
          const credential = credentialByMember.get(member.id); const active = member.status === "active";
          return <label key={member.id} className={`flex items-start gap-3 rounded-xl border p-4 ${active ? "border-[var(--outline-variant)]/45 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}`}>
            <input type="checkbox" name="member_ids" value={member.id} disabled={!active} className="mt-1 h-5 w-5" />
            <span className="min-w-0 flex-1"><span className="block font-bold">{member.full_name}</span><span className="mt-1 block text-sm text-muted">{member.job_title || "Cargo não informado"}</span>{credential?.last_printed_at ? <span className="mt-2 block text-xs text-muted">Impressa {credential.print_count} vez(es) · última em {formatSaoPauloDateTime(credential.last_printed_at)}</span> : null}</span>
            {active ? <a href={`/api/events/${eventId}/sponsor-credentials/${member.id}?empresa=${selectedLink.exhibitor_company_id}`} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Baixar individual</a> : <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold">Inativo</span>}
          </label>;
        })}{!members.length ? <p className="rounded-xl bg-[var(--surface-container-low)] px-4 py-6 text-center text-sm text-muted">A equipe deste patrocinador está vazia. <Link href={`/equipe?empresa=${selectedLink.exhibitor_company_id}`} className="font-bold text-[var(--primary)]">Cadastrar pessoas</Link></p> : null}</div>
      </form>
    </div>
  </section>;
}
