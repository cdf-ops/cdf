export function normalizeCnpj(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hasValidCnpjFormat(value: string) {
  return /^[A-Z0-9]{12}[0-9]{2}$/.test(normalizeCnpj(value));
}

export function normalizePhone(value: string) {
  return value.trim();
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function formatCnpj(value: string | null) {
  if (!value) {
    return "-";
  }

  const normalized = normalizeCnpj(value);
  if (normalized.length !== 14) {
    return value;
  }

  return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}`;
}
