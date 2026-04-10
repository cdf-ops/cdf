export const APP_ROLES = ["super_adm", "organizador", "recepcao", "expositor"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function hasAnyRole(currentRole: AppRole | null, allowedRoles: AppRole[]) {
  if (!currentRole) {
    return false;
  }
  return allowedRoles.includes(currentRole);
}

