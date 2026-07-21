const MIN_PARTICIPANT_NUMBER = 1000;
const MAX_PARTICIPANT_NUMBER = 99999;

export function parseParticipantNumberSearch(value: string) {
  const normalized = value.trim();
  if (!/^\d{4,5}$/.test(normalized)) {
    return null;
  }

  const participantNumber = Number(normalized);
  if (participantNumber < MIN_PARTICIPANT_NUMBER || participantNumber > MAX_PARTICIPANT_NUMBER) {
    return null;
  }

  return participantNumber;
}
