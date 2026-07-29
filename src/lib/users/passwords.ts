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
