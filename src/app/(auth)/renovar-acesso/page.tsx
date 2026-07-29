import { redirect } from "next/navigation";
import { RenewAccessForm } from "@/app/(auth)/renovar-acesso/renew-access-form";
import { getAccountState } from "@/lib/auth/session";

export default async function RenewAccessPage() {
  const account = await getAccountState();
  if (!account || account.status !== "active") redirect("/login");
  if (account.passwordChangeRequired) redirect("/alterar-senha");
  if (account.role !== "expositor" || account.exhibitorAccessActive) redirect("/events");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <RenewAccessForm email={account.email ?? "e-mail não disponível"} />
    </main>
  );
}
