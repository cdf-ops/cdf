export type ParticipantFilters = {
  q: string;
  eventId: string;
  city: string;
  profession: string;
  lastCheckinFrom: string;
  lastCheckinTo: string;
};

type SearchParamsSource = {
  q?: string;
  event?: string;
  city?: string;
  profession?: string;
  last_checkin_from?: string;
  last_checkin_to?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseParticipantFilters(params: SearchParamsSource): ParticipantFilters {
  const eventId = (params.event ?? "").trim();
  const lastCheckinFrom = (params.last_checkin_from ?? "").trim();
  const lastCheckinTo = (params.last_checkin_to ?? "").trim();

  return {
    q: (params.q ?? "").trim(),
    eventId: UUID_PATTERN.test(eventId) ? eventId : "",
    city: (params.city ?? "").trim(),
    profession: (params.profession ?? "").trim(),
    lastCheckinFrom: DATE_PATTERN.test(lastCheckinFrom) ? lastCheckinFrom : "",
    lastCheckinTo: DATE_PATTERN.test(lastCheckinTo) ? lastCheckinTo : "",
  };
}

export function participantRpcArgs(filters: ParticipantFilters, limit: number, offset: number) {
  return {
    p_search: filters.q || undefined,
    p_event_id: filters.eventId || undefined,
    p_city: filters.city || undefined,
    p_profession: filters.profession || undefined,
    p_last_checkin_from: filters.lastCheckinFrom || undefined,
    p_last_checkin_to: filters.lastCheckinTo || undefined,
    p_limit: limit,
    p_offset: offset,
  };
}

export function participantFiltersToSearchParams(filters: ParticipantFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.eventId) params.set("event", filters.eventId);
  if (filters.city) params.set("city", filters.city);
  if (filters.profession) params.set("profession", filters.profession);
  if (filters.lastCheckinFrom) params.set("last_checkin_from", filters.lastCheckinFrom);
  if (filters.lastCheckinTo) params.set("last_checkin_to", filters.lastCheckinTo);
  return params;
}
