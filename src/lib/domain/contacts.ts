export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidBrazilianPhone(value: string) {
  const digits = normalizePhone(value);

  if (digits.length !== 10 && digits.length !== 11) {
    return false;
  }

  const areaCode = Number(digits.slice(0, 2));
  if (areaCode < 11 || areaCode > 99) {
    return false;
  }

  return !/^(\d)\1+$/.test(digits);
}
