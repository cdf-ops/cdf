"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExhibitorAccessLinkActive } from "@/lib/exhibitors/access-status";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
  next: z.string().optional(),
});

export type LoginState = {
  error: string | null;
};

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Não foi possível autenticar. Confira e-mail e senha." };
  }

  if (data.user) {
    const admin = createAdminClient();
    const [{ data: profile }] = await Promise.all([
      admin
        .from("user_profiles")
        .select("role, status, password_change_required")
        .eq("id", data.user.id)
        .maybeSingle(),
      admin.from("audit_logs").insert({
        actor_user_id: data.user.id,
        action: "AUTH_LOGIN",
        context: {
          email: data.user.email,
        },
      }),
    ]);

    if (!profile || profile.status !== "active") {
      await supabase.auth.signOut({ scope: "local" });
      return { error: "Este usuário está inativo. Procure a organização do evento." };
    }

    if (profile.password_change_required) {
      redirect("/alterar-senha");
    }

    if (profile.role === "expositor") {
      const { data: links } = await admin
        .from("exhibitor_users")
        .select("status, access_valid_until, emergency_access_until")
        .eq("user_id", data.user.id);
      if (!(links ?? []).some((link) => isExhibitorAccessLinkActive(link))) {
        redirect("/renovar-acesso");
      }
    }
  }

  const safeNext = parsed.data.next?.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/events";
  redirect(safeNext);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
