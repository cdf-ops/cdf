import { LoginForm } from "@/app/(auth)/login/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-10">
      <div className="pointer-events-none absolute -left-28 top-12 h-72 w-72 rounded-full bg-[var(--primary-soft)]/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-200/25 blur-3xl" />
      <LoginForm nextPath={next} />
    </main>
  );
}
