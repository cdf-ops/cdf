import { randomInt } from "node:crypto";

const TEMPORARY_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";

export function generateTemporaryPassword(length = 14) {
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)];
  }
  return password;
}

export function validateManagedPassword(password: string, role: string) {
  if (["super_adm", "organizador"].includes(role)) {
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return "Perfis administrativos exigem ao menos 10 caracteres, com maiúscula, minúscula e número.";
    }
    return null;
  }
  return password.length >= 6 ? null : "A senha deve ter pelo menos 6 caracteres.";
}
