export function normalizeDocumentNumber(value: string) {
  return value.replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "").toUpperCase();
}

export function isValidCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const calculateDigit = (base: string, initialWeight: number) => {
    const sum = base
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (initialWeight - index), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 9), 10);
  const secondDigit = calculateDigit(`${digits.slice(0, 9)}${firstDigit}`, 11);

  return digits.endsWith(`${firstDigit}${secondDigit}`);
}

export function validateDocumentNumber(documentType: string, documentNumber: string) {
  if (documentType.trim().toUpperCase() !== "CPF") {
    return true;
  }

  return isValidCpf(documentNumber);
}
