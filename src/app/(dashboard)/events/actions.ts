"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const eventFormSchema = z.object({
  name: z.string().trim().min(3, "Nome do evento é obrigatório."),
  location: z.string().trim().min(3, "Localização é obrigatória."),
  status: z.enum(["rascunho", "ativo", "encerrado"]),
  details: z.string().trim().optional(),
  dates: z.array(z.string().date()).min(1, "Selecione ao menos uma data."),
});

function getNormalizedDateList(dateList: string[]) {
  return [...new Set(dateList)].sort((a, b) => (a < b ? -1 : 1));
}

function parseEventFormData(formData: FormData) {
  const rawDates = String(formData.get("dates_json") ?? "[]");
  const parsedDates = JSON.parse(rawDates) as string[];

  return eventFormSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    status: formData.get("status"),
    details: formData.get("details"),
    dates: parsedDates,
  });
}

async function replaceEventDays(eventId: string, dates: string[]) {
  const supabase = createAdminClient();
  await supabase.from("event_days").delete().eq("event_id", eventId);

  const normalizedDates = getNormalizedDateList(dates);
  const payload = normalizedDates.map((date) => ({
    event_id: eventId,
    date,
  }));

  const { error } = await supabase.from("event_days").insert(payload);
  if (error) {
    throw new Error("Falha ao salvar as datas do evento.");
  }
}

export async function createEventAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const parsed = parseEventFormData(formData);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos para criar evento.");
  }

  const supabase = createAdminClient();
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      name: parsed.data.name,
      location: parsed.data.location,
      details: parsed.data.details || null,
      status: parsed.data.status,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !event) {
    throw new Error("Não foi possível criar o evento.");
  }

  await replaceEventDays(event.id, parsed.data.dates);

  await supabase.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_CREATED",
    context: {
      event_id: event.id,
      event_name: parsed.data.name,
    },
  });

  revalidatePath("/events");
  redirect(`/events/${event.id}/settings`);
}

export async function updateEventAction(formData: FormData) {
  const session = await requireSession(["super_adm", "organizador"]);
  const eventId = String(formData.get("event_id") ?? "");
  const parsed = parseEventFormData(formData);

  if (!eventId) {
    throw new Error("Evento não informado.");
  }
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos para atualizar evento.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update({
      name: parsed.data.name,
      location: parsed.data.location,
      details: parsed.data.details || null,
      status: parsed.data.status,
    })
    .eq("id", eventId);

  if (error) {
    throw new Error("Não foi possível atualizar o evento.");
  }

  await replaceEventDays(eventId, parsed.data.dates);

  await supabase.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_UPDATED",
    context: {
      event_id: eventId,
      event_name: parsed.data.name,
    },
  });

  revalidatePath("/events");
  revalidatePath(`/events/${eventId}/settings`);
}
