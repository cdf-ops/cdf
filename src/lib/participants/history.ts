import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export const PARTICIPANT_HISTORY_FIELD_LABELS = {
  full_name: "Nome completo",
  document_type: "Tipo de documento",
  document_number: "Documento",
  email: "E-mail",
  phone: "Telefone",
  company: "Empresa",
  job_title: "Cargo",
  state: "Estado",
  city: "Cidade",
  profession: "Profissão",
} as const;

export type ParticipantHistoryField = keyof typeof PARTICIPANT_HISTORY_FIELD_LABELS;
export type ParticipantSnapshot = Record<ParticipantHistoryField, string | null>;
export type ParticipantChange = {
  before: string | null;
  after: string | null;
};
export type ParticipantChanges = Partial<Record<ParticipantHistoryField, ParticipantChange>>;
export type ParticipantChangeSource =
  | "public_registration"
  | "reception"
  | "admin"
  | "participant_admin"
  | "import"
  | "system";

export function buildParticipantChanges(before: ParticipantSnapshot, after: ParticipantSnapshot): ParticipantChanges {
  return (Object.keys(PARTICIPANT_HISTORY_FIELD_LABELS) as ParticipantHistoryField[]).reduce<ParticipantChanges>(
    (changes, field) => {
      if (before[field] !== after[field]) {
        changes[field] = {
          before: before[field],
          after: after[field],
        };
      }
      return changes;
    },
    {}
  );
}

export function hasParticipantChanges(changes: ParticipantChanges) {
  return Object.keys(changes).length > 0;
}

export async function recordParticipantChanges(input: {
  participantId: string;
  actorUserId?: string | null;
  source: ParticipantChangeSource;
  changes: ParticipantChanges;
}) {
  if (!hasParticipantChanges(input.changes)) return;

  const admin = createAdminClient();
  const { error } = await admin.from("participant_change_history").insert({
    participant_id: input.participantId,
    actor_user_id: input.actorUserId ?? null,
    source: input.source,
    changes: input.changes as Json,
  });

  if (error) {
    throw new Error("Não foi possível registrar o histórico de alterações do participante.");
  }
}
