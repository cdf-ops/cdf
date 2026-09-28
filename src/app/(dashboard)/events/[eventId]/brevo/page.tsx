import { notFound } from "next/navigation";
import {
  saveEventBrevoSettingsAction,
  syncBrevoTemplatesAction,
} from "@/app/(dashboard)/events/[eventId]/brevo/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth/session";
import { BREVO_REGISTRATION_CONTACT_ATTRIBUTES } from "@/lib/brevo/email-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

type EventBrevoPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    notice?: string;
    notice_type?: "success" | "error";
  }>;
};

const ATTRIBUTE_LABELS: Record<(typeof BREVO_REGISTRATION_CONTACT_ATTRIBUTES)[number], string> = {
  NOME_COMPLETO: "Nome completo",
  NUMERO_PARTICIPANTE: "Número permanente do participante",
  CIDADE: "Cidade",
  ESTADO: "Estado",
  PROFISSAO: "Profissão",
};

const DELIVERY_STATUS = {
  pending: { label: "Na fila", className: "bg-amber-100 text-amber-800" },
  processing: { label: "Processando", className: "bg-sky-100 text-sky-800" },
  accepted: { label: "Aceito pela Brevo", className: "bg-blue-100 text-blue-800" },
  delivered: { label: "Entregue", className: "bg-emerald-100 text-emerald-800" },
  retryable_failed: { label: "Nova tentativa", className: "bg-orange-100 text-orange-800" },
  permanent_failed: { label: "Falha permanente", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelado", className: "bg-slate-100 text-slate-700" },
} as const;

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function EventBrevoPage({ params, searchParams }: EventBrevoPageProps) {
  await requireSession(["super_adm", "organizador"]);
  const { eventId } = await params;
  const { notice, notice_type } = await searchParams;
  const admin = createAdminClient();

  const [eventResult, settingsResult, templatesResult, jobsResult] = await Promise.all([
    admin.from("events").select("id, name").eq("id", eventId).maybeSingle(),
    admin
      .from("event_brevo_settings")
      .select("registration_confirmation_enabled, registration_template_id, updated_at")
      .eq("event_id", eventId)
      .maybeSingle(),
    admin
      .from("brevo_templates")
      .select("template_id, name, subject, sender_name, sender_email, tag, is_active, synced_at")
      .order("name"),
    admin
      .from("email_delivery_jobs")
      .select(
        "id, recipient_email, template_id, status, attempt_count, last_error_code, last_error_message, created_at, accepted_at, delivered_at"
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!eventResult.data) notFound();

  const settings = settingsResult.data;
  const templates = templatesResult.data ?? [];
  const jobs = jobsResult.data ?? [];
  const selectedTemplate = templates.find(
    (template) => template.template_id === settings?.registration_template_id
  );
  const databaseReady = !settingsResult.error && !templatesResult.error && !jobsResult.error;
  const latestSync = templates.reduce<string | null>(
    (latest, template) => (!latest || template.synced_at > latest ? template.synced_at : latest),
    null
  );

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">Integração do evento</p>
        <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Brevo</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Escolha o modelo transacional usado após a inscrição. Datas, imagens e informações do evento permanecem
          configuradas diretamente no modelo da Brevo.
        </p>
      </div>

      {notice ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            notice_type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[var(--danger)]"
          }`}
        >
          {notice}
        </p>
      ) : null}

      {!databaseReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          A estrutura da Brevo ainda não foi aplicada ao banco deste ambiente. A configuração ficará disponível após
          a migration ser instalada.
        </div>
      ) : null}

      <div className="surface-card rounded-2xl p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">Confirmação de inscrição</p>
            <h2 className="mt-1 font-headline text-2xl font-extrabold text-[var(--foreground)]">
              Modelo associado a {eventResult.data.name}
            </h2>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase ${
                settings?.registration_confirmation_enabled
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-[var(--surface-container-lowest)] text-[var(--outline)]"
              }`}
            >
              {settings?.registration_confirmation_enabled ? "Ativado" : "Desativado"}
            </span>
            <form action={syncBrevoTemplatesAction}>
              <input type="hidden" name="event_id" value={eventId} />
              <SubmitButton
                pendingLabel="Atualizando..."
                disabled={!databaseReady}
                className="rounded-xl border border-[var(--outline-variant)]/65 bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                Atualizar modelos
              </SubmitButton>
            </form>
            <p className="text-xs text-muted">
              {latestSync
                ? `Última sincronização: ${new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Sao_Paulo",
                  }).format(new Date(latestSync))}`
                : "Catálogo ainda não sincronizado"}
            </p>
          </div>
        </div>

        <form action={saveEventBrevoSettingsAction} className="mt-6 space-y-5">
          <input type="hidden" name="event_id" value={eventId} />

          <label className="flex items-start gap-3 rounded-xl border border-[var(--outline-variant)]/55 bg-white p-4">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={settings?.registration_confirmation_enabled ?? false}
              disabled={!databaseReady}
              className="mt-0.5 h-5 w-5 accent-[var(--primary)]"
            />
            <span>
              <span className="block text-sm font-bold text-[var(--foreground)]">Enviar após a inscrição</span>
              <span className="mt-1 block text-xs leading-5 text-muted">
                A inscrição cria uma tarefa na fila; o n8n processará o envio quando estiver disponível.
              </span>
            </span>
          </label>

          <label className="block text-sm font-semibold text-[var(--foreground)]">
            Modelo transacional
            <select
              name="template_id"
              defaultValue={settings?.registration_template_id?.toString() ?? ""}
              disabled={!databaseReady}
              className="mt-2 w-full rounded-xl border border-[var(--outline-variant)]/65 bg-white px-4 py-3 font-normal"
            >
              <option value="">Selecione um modelo</option>
              {templates.map((template) => (
                <option key={template.template_id} value={template.template_id} disabled={!template.is_active}>
                  {template.name} — {template.subject} — #{template.template_id}
                  {template.is_active ? "" : " (inativo)"}
                </option>
              ))}
            </select>
          </label>

          {!templates.length && databaseReady ? (
            <p className="rounded-xl bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-muted">
              Nenhum modelo foi sincronizado ainda. Use “Atualizar modelos” após configurar a conexão segura com o n8n.
            </p>
          ) : null}

          {selectedTemplate ? (
            <dl className="grid gap-4 rounded-xl border border-[var(--outline-variant)]/45 bg-white p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Modelo</dt>
                <dd className="mt-1 font-semibold">{selectedTemplate.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">ID Brevo</dt>
                <dd className="mt-1 font-semibold">#{selectedTemplate.template_id}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Assunto</dt>
                <dd className="mt-1 font-semibold">{selectedTemplate.subject}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--outline)]">Remetente</dt>
                <dd className="mt-1 font-semibold">
                  {[selectedTemplate.sender_name, selectedTemplate.sender_email].filter(Boolean).join(" — ") || "Não informado"}
                </dd>
              </div>
            </dl>
          ) : null}

          <SubmitButton
            pendingLabel="Salvando..."
            disabled={!databaseReady}
            className="gradient-primary rounded-xl px-5 py-3 text-sm font-semibold text-white"
          >
            Salvar configuração
          </SubmitButton>
        </form>
      </div>

      <div className="surface-card rounded-2xl p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">Operação</p>
        <h2 className="mt-1 font-headline text-2xl font-extrabold text-[var(--foreground)]">
          Últimos envios de confirmação
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          A plataforma mantém o histórico mesmo quando o n8n fica indisponível. “Aceito” significa que a Brevo
          recebeu a mensagem; “Entregue” é confirmado posteriormente pelo webhook transacional.
        </p>

        {jobs.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--outline-variant)]/50 text-xs uppercase tracking-wide text-[var(--outline)]">
                <tr>
                  <th className="px-3 py-3">Destinatário</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Modelo</th>
                  <th className="px-3 py-3">Tentativas</th>
                  <th className="px-3 py-3">Criado em</th>
                  <th className="px-3 py-3">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/35">
                {jobs.map((job) => {
                  const status = DELIVERY_STATUS[job.status];
                  return (
                    <tr key={job.id}>
                      <td className="px-3 py-4 font-medium text-[var(--foreground)]">{job.recipient_email}</td>
                      <td className="px-3 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-4">#{job.template_id}</td>
                      <td className="px-3 py-4">{job.attempt_count}</td>
                      <td className="px-3 py-4">{dateTimeFormatter.format(new Date(job.created_at))}</td>
                      <td className="max-w-xs px-3 py-4 text-xs text-muted">
                        {job.last_error_message || job.last_error_code ||
                          (job.delivered_at
                            ? `Entregue em ${dateTimeFormatter.format(new Date(job.delivered_at))}`
                            : job.accepted_at
                              ? `Aceito em ${dateTimeFormatter.format(new Date(job.accepted_at))}`
                              : "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 rounded-xl bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-muted">
            Ainda não há tarefas de e-mail para este evento.
          </p>
        )}
      </div>

      <div className="surface-card rounded-2xl p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">Contrato fixo</p>
        <h2 className="mt-1 font-headline text-2xl font-extrabold text-[var(--foreground)]">
          Atributos enviados ao contato
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          O Márcio pode usar estes atributos permanentes nos modelos. Dados específicos do evento não serão enviados
          como parâmetros dinâmicos.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--outline-variant)]/45 bg-white p-4">
            <p className="font-mono text-sm font-bold text-[var(--primary)]">EMAIL</p>
            <p className="mt-1 text-xs text-muted">Identificador nativo do contato na Brevo</p>
          </div>
          {BREVO_REGISTRATION_CONTACT_ATTRIBUTES.map((attribute) => (
            <div key={attribute} className="rounded-xl border border-[var(--outline-variant)]/45 bg-white p-4">
              <p className="font-mono text-sm font-bold text-[var(--primary)]">{attribute}</p>
              <p className="mt-1 text-xs text-muted">{ATTRIBUTE_LABELS[attribute]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
