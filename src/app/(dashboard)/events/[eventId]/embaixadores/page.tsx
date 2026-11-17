import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { ambassadorCode } from "@/lib/ambassadors/credentials";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createAmbassadorAction,
  updateAmbassadorAction,
} from "@/app/(dashboard)/events/[eventId]/embaixadores/actions";

type AmbassadorsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ filtro?: string; notice?: string; notice_type?: "success" | "error" }>;
};

export default async function AmbassadorsPage({ params, searchParams }: AmbassadorsPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const { filtro, notice, notice_type } = await searchParams;
  const showInactive = filtro === "todos";
  const admin = createAdminClient();

  const { data: ambassadorsData } = await admin
    .from("event_ambassadors")
    .select("id, ambassador_number, full_name, status")
    .eq("event_id", eventId)
    .order("status")
    .order("full_name");
  const ambassadors = ambassadorsData ?? [];
  const activeAmbassadors = ambassadors.filter((item) => item.status === "active");
  const visibleAmbassadors = showInactive ? ambassadors : activeAmbassadors;

  return (
    <section className="space-y-6">
      <header className="surface-card rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Pré-evento</p>
        <h2 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Embaixadores</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Cadastre os representantes locais deste evento e gere credenciais identificadas como EMBAIXADOR. Eles permanecem separados de participantes e patrocinadores.
        </p>
      </header>

      {notice ? (
        <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {notice}
        </p>
      ) : null}

      <div className="surface-card rounded-2xl p-5">
        <h3 className="font-headline text-xl font-bold">Novo embaixador</h3>
        <p className="mt-1 text-sm text-muted">O QR Code e o código da credencial serão criados automaticamente.</p>
        <form action={createAmbassadorAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="event_id" value={eventId} />
          <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Nome completo
            <input
              name="full_name"
              required
              minLength={2}
              maxLength={160}
              autoComplete="off"
              className="mt-2 block min-h-11 w-full rounded-xl border border-[var(--outline-variant)]/55 bg-white px-4 text-base font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
          </label>
          <SubmitButton pendingLabel="Cadastrando..." className="gradient-primary min-h-11 rounded-xl px-5 text-sm font-bold text-white">
            Cadastrar embaixador
          </SubmitButton>
        </form>
      </div>

      <div className="surface-card rounded-2xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-headline text-xl font-bold">Credenciais dos embaixadores</h3>
            <p className="mt-1 text-sm text-muted">A impressão usa a configuração de credencial deste evento.</p>
          </div>
          <Link href={`/events/${eventId}/embaixadores${showInactive ? "" : "?filtro=todos"}`} className="text-sm font-bold text-[var(--primary)]">
            {showInactive ? "Mostrar somente ativos" : "Mostrar inativos"}
          </Link>
        </div>

        <form id="ambassador-batch-print" method="post" action={`/api/events/${eventId}/ambassador-credentials`} target="_blank" />

        <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--outline-variant)]/40">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-container-high)] text-xs uppercase tracking-wide text-[var(--outline)]">
              <tr>
                <th className="w-12 px-4 py-3">Sel.</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {visibleAmbassadors.map((ambassador) => (
                <tr key={ambassador.id} className="align-top hover:bg-[var(--surface-container-low)]/70">
                  <td className="px-4 py-4">
                    <input
                      form="ambassador-batch-print"
                      type="checkbox"
                      name="ambassador_ids"
                      value={ambassador.id}
                      defaultChecked={ambassador.status === "active"}
                      disabled={ambassador.status !== "active"}
                      className="size-5 accent-[var(--primary)]"
                      aria-label={`Selecionar ${ambassador.full_name}`}
                    />
                  </td>
                  <td className="px-4 py-4 font-mono font-bold text-[var(--primary)]">{ambassadorCode(ambassador.ambassador_number)}</td>
                  <td className="px-4 py-3">
                    <form action={updateAmbassadorAction} className="flex min-w-[260px] gap-2">
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="ambassador_id" value={ambassador.id} />
                      <input type="hidden" name="status" value={ambassador.status} />
                      <input name="full_name" required minLength={2} maxLength={160} defaultValue={ambassador.full_name} className="min-h-10 min-w-0 flex-1 rounded-lg border bg-white px-3" />
                      <SubmitButton pendingLabel="..." className="min-h-10 rounded-lg border bg-white px-3 text-xs font-bold text-[var(--primary)]">Salvar</SubmitButton>
                    </form>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ambassador.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {ambassador.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {ambassador.status === "active" ? (
                        <a href={`/api/events/${eventId}/ambassador-credentials/${ambassador.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-bold text-white">
                          Gerar credencial
                        </a>
                      ) : null}
                      <form action={updateAmbassadorAction}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="ambassador_id" value={ambassador.id} />
                        <input type="hidden" name="full_name" value={ambassador.full_name} />
                        <input type="hidden" name="status" value={ambassador.status === "active" ? "inactive" : "active"} />
                        <SubmitButton pendingLabel="Atualizando..." className="min-h-10 rounded-lg border bg-white px-3 text-xs font-bold">
                          {ambassador.status === "active" ? "Inativar" : "Reativar"}
                        </SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleAmbassadors.length ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">Nenhum embaixador neste filtro.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <button
          form="ambassador-batch-print"
          disabled={!activeAmbassadors.length}
          className="gradient-primary mt-4 min-h-11 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          Gerar credenciais selecionadas
        </button>
      </div>
    </section>
  );
}
