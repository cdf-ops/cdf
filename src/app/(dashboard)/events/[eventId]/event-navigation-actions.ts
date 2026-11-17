"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  EVENT_NAVIGATION_SECTION_IDS,
  type EventNavigationOrder,
  type EventNavigationSectionId,
} from "@/app/(dashboard)/events/[eventId]/event-navigation";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const eventIdSchema = z.string().uuid();
const itemIdSchema = z.string().regex(/^[a-z0-9-]{1,60}$/);

function sanitizeOrder(value: EventNavigationOrder): EventNavigationOrder {
  return Object.fromEntries(
    EVENT_NAVIGATION_SECTION_IDS.map((sectionId) => {
      const submitted = Array.isArray(value[sectionId]) ? value[sectionId] : [];
      const uniqueIds = [...new Set(submitted)].filter((id) => itemIdSchema.safeParse(id).success).slice(0, 30);
      return [sectionId, uniqueIds];
    })
  ) as Record<EventNavigationSectionId, string[]>;
}

export async function saveEventNavigationOrderAction(eventId: string, value: EventNavigationOrder) {
  const session = await requireSession(["super_adm", "organizador", "recepcao", "sorteador", "expositor"]);
  const parsedEventId = eventIdSchema.safeParse(eventId);
  if (!parsedEventId.success) throw new Error("Evento inválido.");

  const order = sanitizeOrder(value);
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({ event_navigation_order: order })
    .eq("id", session.userId);

  if (error) throw new Error("Não foi possível salvar a ordem dos módulos.");

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_NAVIGATION_ORDER_UPDATED",
    context: { event_id: parsedEventId.data, sections: order },
  });

  revalidatePath(`/events/${parsedEventId.data}`, "layout");
  return { ok: true };
}

export async function resetEventNavigationOrderAction(eventId: string) {
  const session = await requireSession(["super_adm", "organizador", "recepcao", "sorteador", "expositor"]);
  const parsedEventId = eventIdSchema.safeParse(eventId);
  if (!parsedEventId.success) throw new Error("Evento inválido.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({ event_navigation_order: {} })
    .eq("id", session.userId);

  if (error) throw new Error("Não foi possível restaurar a ordem padrão.");

  await admin.from("audit_logs").insert({
    actor_user_id: session.userId,
    action: "EVENT_NAVIGATION_ORDER_RESET",
    context: { event_id: parsedEventId.data },
  });

  revalidatePath(`/events/${parsedEventId.data}`, "layout");
  return { ok: true };
}
