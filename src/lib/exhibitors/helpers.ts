export function normalizeCnpj(value: string) {
  return value.replace(/\D/g, "");
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

  const digits = normalizeCnpj(value);
  if (digits.length !== 14) {
    return value;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}
