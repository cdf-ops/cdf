export const APP_TIME_ZONE = "America/Sao_Paulo";

type DateValue = string | number | Date;

function format(value: DateValue, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

export function formatSaoPauloDate(value: DateValue, options: Intl.DateTimeFormatOptions = {}) {
  return format(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  });
}

export function formatDateOnly(value: string, options: Intl.DateTimeFormatOptions = {}) {
  const date = value.slice(0, 10);

  return formatSaoPauloDate(`${date}T12:00:00-03:00`, options);
}

export function formatSaoPauloTime(value: DateValue, options: Intl.DateTimeFormatOptions = {}) {
  return format(value, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...options,
  });
}

export function formatSaoPauloDateTime(value: DateValue, options: Intl.DateTimeFormatOptions = {}) {
  return format(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...options,
  });
}

export function getSaoPauloDateKey(value: DateValue = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function getSaoPauloHour(value: DateValue) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value))
  );
}
