"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { uploadEventImage } from "@/lib/certificates/assets";
import { createAdminClient } from "@/lib/supabase/admin";

const eventFormSchema = z.object({
  name: z.string().trim().min(3, "Nome do evento é obrigatório."),
  location: z.string().trim().min(3, "Localização é obrigatória."),
  status: z.enum(["rascunho", "ativo", "encerrado"]),
  details: z.string().trim().optional(),
  dates: z.array(z.string().date()).min(1, "Selecione ao menos uma data."),
});

const archiveEventSchema = z.object({
  eventId: z.string().uuid(),
  confirmationName: z.string().trim().min(1),
});

const restoreEventSchema = z.object({
  eventId: z.string().uuid(),
});

function withNotice(url: string, type: "success" | "error", message: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}notice_type=${type}&notice=${encodeURIComponent(message)}`;
}

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

function getOptionalImageFile(formData: FormData, fieldName: string) {
  const file = formData.get(fieldName);
  return file instanceof File && file.size > 0 ? file : null;
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

  const logoFile = getOptionalImageFile(formData, "event_logo");
  if (logoFile) {
    const logoPath = await uploadEventImage(supabase, event.id, logoFile, "logo");
    await supabase.from("events").update({ event_logo_path: logoPath }).eq("id", event.id);
  }

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
  const { data: currentEvent } = await supabase.from("events").select("status").eq("id", eventId).maybeSingle();
  if (!currentEvent || currentEvent.status === "arquivado") {
    throw new Error("Evento arquivado não pode ser alterado.");
  }

  const logoFile = getOptionalImageFile(formData, "event_logo");
  const eventUpdatePayload: {
    name: string;
    location: string;
    details: string | null;
    status: "rascunho" | "ativo" | "encerrado";
    event_logo_path?: string | null;
  } = {
    name: parsed.data.name,
    location: parsed.data.location,
    details: parsed.data.details || null,
    status: parsed.data.status,
  };

  if (logoFile) {
    eventUpdatePayload.event_logo_path = await uploadEventImage(supabase, eventId, logoFile, "logo");
  }

  const { error } = await supabase
    .from("events")
    .update(eventUpdatePayload)
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

export async function archiveEventAction(formData: FormData) {
  const session = await requireSession(["super_adm"]);
  const parsed = archiveEventSchema.safeParse({
    eventId: formData.get("event_id"),
    confirmationName: formData.get("confirmation_name"),
  });

  if (!parsed.success) {
    redirect(withNotice("/events", "error", "Dados inválidos para arquivar evento."));
  }

  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id, name, status").eq("id", parsed.data.eventId).maybeSingle();

  if (!event) {
    redirect(withNotice("/events", "error", "Evento não encontrado."));
  }

  if (event.name !== parsed.data.confirmationName) {
    redirect(withNotice(`/events/${event.id}/settings`, "error", "Digite o nome exato do evento para confirmar o arquivamento."));
  }

  if (event.status === "arquivado") {
    redirect(withNotice("/events?status=arquivado", "error", "Este evento já está arquivado."));
  }

  const archivedAt = new Date().toISOString();
  const { error } = await admin
    .from("events")
    .update({
      status: "arquivado",
      archived_at: archivedAt,
      archived_by: session.userId,
    })
    .eq("id", event.id);

  if (error) {
    redirect(withNotice(`/events/${event.id}/settings`, "error", "Não foi possível arquivar o evento."));
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_ARCHIVED",
    context: {
      event_id: event.id,
      event_name: event.name,
      archived_at: archivedAt,
    },
  });

  revalidatePath("/events");
  revalidatePath(`/events/${event.id}/settings`);
  redirect(withNotice("/events?status=arquivado", "success", "Evento arquivado com sucesso."));
}

export async function restoreEventAction(formData: FormData) {
  const session = await requireSession(["super_adm"]);
  const parsed = restoreEventSchema.safeParse({
    eventId: formData.get("event_id"),
  });

  if (!parsed.success) {
    redirect(withNotice("/events", "error", "Dados inválidos para restaurar evento."));
  }

  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id, name, status").eq("id", parsed.data.eventId).maybeSingle();

  if (!event || event.status !== "arquivado") {
    redirect(withNotice("/events", "error", "Evento arquivado não encontrado."));
  }

  const { error } = await admin
    .from("events")
    .update({
      status: "rascunho",
      archived_at: null,
      archived_by: null,
    })
    .eq("id", event.id);

  if (error) {
    redirect(withNotice("/events?status=arquivado", "error", "Não foi possível restaurar o evento."));
  }

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_RESTORED",
    context: {
      event_id: event.id,
      event_name: event.name,
      restored_status: "rascunho",
    },
  });

  revalidatePath("/events");
  revalidatePath(`/events/${event.id}/settings`);
  redirect(withNotice(`/events/${event.id}/settings`, "success", "Evento restaurado como rascunho."));
}
