type DbErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function mapExhibitorDbErrorToUserMessage(error: DbErrorLike | null | undefined, fallback: string): string {
  if (!error) {
    return fallback;
  }

  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (code === "23505") {
    return "Já existe expositor cadastrado com este CNPJ.";
  }

  if (code === "23514") {
    return "CNPJ inválido. Informe 14 caracteres, com letras e números nas 12 primeiras posições e números nas 2 últimas.";
  }

  if (code === "23502") {
    return "Faltam dados obrigatórios para salvar o expositor. Revise os campos e tente novamente.";
  }

  if (
    code === "PGRST204" ||
    code === "42703" ||
    code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  ) {
    return "Seu banco está desatualizado para este módulo. Aplique a migration 20260420113000_exhibitor_profiles.sql e tente novamente.";
  }

  if (code === "42501") {
    return "Sem permissão para cadastrar expositor. Verifique a configuração da SUPABASE_SERVICE_ROLE_KEY no servidor.";
  }

  if (code === "22P02") {
    return "Algum dado está em formato inválido. Revise CNPJ, e-mail e telefone.";
  }

  if (hasText(error.hint)) {
    return `${fallback} ${error.hint}`;
  }

  return fallback;
}

export function mapUnexpectedExhibitorErrorToUserMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (
    error.message.includes("NEXT_PUBLIC_SUPABASE_URL") ||
    error.message.includes("SUPABASE_SERVICE_ROLE_KEY")
  ) {
    return "Configuração do Supabase incompleta no servidor. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.";
  }

  return fallback;
}
