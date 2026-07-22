import { saveWebhookSettingAction } from "@/app/(dashboard)/integracoes/actions";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from "@/lib/webhooks/dispatch";

const EVENT_LABELS: Record<WebhookEventType, { title: string; description: string }> = {
  "registration.completed": {
    title: "Inscrição concluída",
    description: "Enviado quando o participante termina uma inscrição pública.",
  },
  "credential.generated": {
    title: "Credencial gerada",
    description: "Enviado quando uma credencial é criada pela primeira vez.",
  },
  "checkin.completed": {
    title: "Check-in realizado",
    description: "Enviado após a leitura válida do QR Code na recepção.",
  },
};

export default async function IntegrationsPage() {
  await requireSession(["super_adm"]);
  const admin = createAdminClient();
  const { data } = await admin
    .from("webhook_settings")
    .select("event_type, webhook_url, enabled, signing_secret, updated_at")
    .order("event_type");
  const settingByType = new Map((data ?? []).map((setting) => [setting.event_type, setting]));

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">SuperAdm</p>
        <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Integrações e Webhooks</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Os Webhooks são opcionais. Enquanto estiverem desligados, o Clube do Frio continuará gerando inscrições,
          credenciais e check-ins normalmente, sem depender do n8n.
        </p>
      </div>

      <div className="grid gap-5">
        {WEBHOOK_EVENT_TYPES.map((eventType) => {
          const setting = settingByType.get(eventType);
          const label = EVENT_LABELS[eventType];
          return (
            <form key={eventType} action={saveWebhookSettingAction} className="surface-card rounded-2xl p-6">
              <input type="hidden" name="event_type" value={eventType} />
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="font-headline text-xl font-bold text-[var(--foreground)]">{label.title}</h2>
                  <p className="mt-1 text-sm text-muted">{label.description}</p>
                  <p className="mt-1 font-mono text-xs text-[var(--outline)]">{eventType}</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <input type="checkbox" name="enabled" defaultChecked={setting?.enabled ?? false} />
                  Integração ativa
                </label>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">URL do Webhook</label>
                  <input
                    name="webhook_url"
                    type="url"
                    required
                    defaultValue={setting?.webhook_url ?? "https://example.invalid/webhook"}
                    className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-[var(--primary)]"
                    placeholder="https://seu-n8n.com/webhook/..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Segredo de assinatura</label>
                  <input
                    name="signing_secret"
                    type="password"
                    className="w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--primary)]"
                    placeholder={setting?.signing_secret ? "Já configurado; deixe vazio para manter" : "Opcional, recomendado quando o n8n estiver ativo"}
                  />
                  <p className="mt-2 text-xs text-muted">
                    Quando configurado, cada envio recebe a assinatura <span className="font-mono">X-CDF-Signature</span>.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-xs text-muted">
                  {setting?.updated_at ? `Última alteração: ${new Date(setting.updated_at).toLocaleString("pt-BR")}` : "Ainda não configurado"}
                </p>
                <button type="submit" className="gradient-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
                  Salvar Webhook
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </section>
  );
}
