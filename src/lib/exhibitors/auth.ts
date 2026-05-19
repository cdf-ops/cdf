import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/exhibitors/helpers";

function generateTemporaryPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  let password = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    password += alphabet[randomIndex];
  }
  return password;
}

export async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  const targetEmail = normalizeEmail(email);
  const perPage = 200;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error("Não foi possível consultar usuários do Auth.");
    }

    const users = data?.users ?? [];
    const foundUser = users.find((user) => normalizeEmail(user.email ?? "") === targetEmail);
    if (foundUser) {
      return foundUser;
    }

    if (users.length < perPage) {
      break;
    }
  }

  return null;
}

export async function createAuthExhibitorUserByEmail(email: string): Promise<{ user: User; temporaryPassword: string }> {
  const admin = createAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const temporaryPassword = generateTemporaryPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      source: "expositor_ui",
    },
  });

  if (error || !data.user) {
    throw new Error("Não foi possível criar o usuário automaticamente no Auth.");
  }

  return {
    user: data.user,
    temporaryPassword,
  };
}
