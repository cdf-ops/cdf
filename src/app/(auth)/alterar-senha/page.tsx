import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/app/(auth)/alterar-senha/change-password-form";
import { getAccountState } from "@/lib/auth/session";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string }>;
}) {
  const account = await getAccountState();
  if (!account) redirect("/login");
  const { recovery } = await searchParams;
  const isRecovery = recovery === "1";
  if (!account.passwordChangeRequired && !isRecovery) redirect("/events");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <ChangePasswordForm recovery={isRecovery} />
    </main>
  );
}
