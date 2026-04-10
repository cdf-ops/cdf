export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar configuradas."
    );
  }
  if (url.includes("your-project-ref") || anonKey.includes("your_anon_key")) {
    throw new Error(
      "As variáveis do Supabase ainda estão com valores de exemplo. Atualize .env.local com as chaves reais do seu projeto."
    );
  }

  return { url, anonKey };
}
