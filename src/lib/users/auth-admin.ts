import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PER_PAGE = 200;
const MAX_PAGES = 20;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function generateTemporaryPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  let password = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    password += alphabet[randomIndex];
  }
  return password;
}

export async function listAllAuthUsers() {
  const admin = createAdminClient();
  const users: User[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: DEFAULT_PER_PAGE });
    if (error) {
      throw new Error("Não foi possível consultar usuários do Auth.");
    }

    const currentUsers = data?.users ?? [];
    users.push(...currentUsers);

    if (currentUsers.length < DEFAULT_PER_PAGE) {
      break;
    }
  }

  return users;
}

export async function findAuthUserByEmail(email: string) {
  const targetEmail = normalizeEmail(email);
  const users = await listAllAuthUsers();
  return users.find((user) => normalizeEmail(user.email ?? "") === targetEmail) ?? null;
}

export async function createAuthUserByEmail(
  email: string,
  options?: {
    source?: string;
  }
): Promise<{ user: User; temporaryPassword: string }> {
  const admin = createAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const temporaryPassword = generateTemporaryPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      source: options?.source ?? "users_ui",
    },
  });

  if (error || !data.user) {
    throw new Error("Não foi possível criar o usuário no Auth.");
  }

  return {
    user: data.user,
    temporaryPassword,
  };
}
