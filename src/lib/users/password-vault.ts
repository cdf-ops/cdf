import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  decryptPassword,
  encryptPassword,
  isEncryptedPassword,
} from "@/lib/security/password-vault";

type AdminClient = SupabaseClient<Database>;

export async function storeUserPassword(
  admin: AdminClient,
  input: { userId: string; password: string; updatedBy: string }
) {
  const { error } = await admin.from("user_password_vault").upsert({
    user_id: input.userId,
    encrypted_password: encryptPassword(input.password),
    updated_by: input.updatedBy,
  });
  if (error) throw new Error("Não foi possível guardar a senha no cofre administrativo.");
}

export async function readUserPassword(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("user_password_vault")
    .select("encrypted_password")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar o cofre de senhas.");
  if (!data || !isEncryptedPassword(data.encrypted_password)) return null;
  return decryptPassword(data.encrypted_password);
}
