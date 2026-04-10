import { createEventAction } from "@/app/(dashboard)/events/actions";
import { EventForm } from "@/app/(dashboard)/events/_components/event-form";
import { requireSession } from "@/lib/auth/session";

export default async function NewEventPage() {
  await requireSession(["super_adm", "organizador"]);

  return (
    <section>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--outline)]">Configurações do Evento</p>
        <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          Novo Evento
        </h1>
      </div>

      <EventForm mode="create" action={createEventAction} />
    </section>
  );
}

