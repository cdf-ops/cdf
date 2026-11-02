export const ASSIGNABLE_APP_ROLES = ["super_adm", "organizador", "recepcao", "sorteador"] as const;

// "expositor" permanece apenas como compatibilidade temporária para rotas legadas.
// Novos usuários não podem receber esse perfil e a migração inativa os cadastros antigos.
export const APP_ROLES = [...ASSIGNABLE_APP_ROLES, "expositor"] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type AssignableAppRole = (typeof ASSIGNABLE_APP_ROLES)[number];

export function hasAnyRole(currentRole: AppRole | null, allowedRoles: AppRole[]) {
  if (!currentRole) {
    return false;
  }
  return allowedRoles.includes(currentRole);
}

