export const ROLES = ["SUPER_ADMIN", "PUBLISHER", "EDITOR"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "content:read",
  "content:write",
  "content:publish",
  "content:delete",
  "results:write",
  "results:publish",
  "media:upload",
  "media:delete",
  "users:manage",
  "settings:write",
  "audit:read",
  "sessions:revoke",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Deny by default: a permission not listed for a role is not granted. */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  PUBLISHER: [
    "content:read",
    "content:write",
    "content:publish",
    "content:delete",
    "results:write",
    "results:publish",
    "media:upload",
    "media:delete",
  ],
  EDITOR: ["content:read", "content:write", "results:write", "media:upload"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function permissionsFor(role: unknown): readonly Permission[] {
  return isRole(role) ? ROLE_PERMISSIONS[role] : [];
}

export function can(role: unknown, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}
