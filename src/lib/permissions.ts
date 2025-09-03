import type { Role } from "./domain";

/**
 * Central RBAC permission matrix: the single source of truth for what each
 * role may do. Server guards enforce it; the UI reads it only to hide
 * controls a user cannot use (never as a security boundary).
 */
export const PERMISSIONS = [
  "ticket:read",
  "ticket:create",
  "ticket:update",
  "ticket:assign",
  "comment:create",
  "comment:internal",
  "ai:use",
  "audit:read",
  "member:read",
  "member:invite",
  "member:update_role",
  "member:remove",
  "billing:read",
  "billing:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Plain-language names for the team page. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "ticket:read": "View tickets",
  "ticket:create": "Create tickets",
  "ticket:update": "Change status, priority and customer links",
  "ticket:assign": "Assign tickets",
  "comment:create": "Reply to customers",
  "comment:internal": "Write internal notes",
  "ai:use": "Use AI assist",
  "audit:read": "View activity history",
  "member:read": "View the team",
  "member:invite": "Add members",
  "member:update_role": "Change roles",
  "member:remove": "Remove members",
  "billing:read": "View billing",
  "billing:manage": "Change plan and payment details",
};

const VIEWER: readonly Permission[] = ["ticket:read", "audit:read", "member:read"];

const AGENT: readonly Permission[] = [
  ...VIEWER,
  "ticket:create",
  "ticket:update",
  "ticket:assign",
  "comment:create",
  "comment:internal",
  "ai:use",
];

const ADMIN: readonly Permission[] = [
  ...AGENT,
  "member:invite",
  "member:update_role",
  "member:remove",
  "billing:read",
];

export const PERMISSION_MATRIX: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  owner: new Set(PERMISSIONS),
  admin: new Set(ADMIN),
  agent: new Set(AGENT),
  viewer: new Set(VIEWER),
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSION_MATRIX[role].has(permission);
}

export function permissionsFor(role: Role): Permission[] {
  return PERMISSIONS.filter((permission) => can(role, permission));
}

/** Role rank, used for "who may manage whom" decisions. */
const RANK: Record<Role, number> = { viewer: 0, agent: 1, admin: 2, owner: 3 };

/**
 * Whether `actorRole` may move a member from `currentRole` to `nextRole`.
 * Only owners can grant or revoke the owner role; admins manage everyone below owner.
 */
export function canAssignRole(actorRole: Role, currentRole: Role, nextRole: Role): boolean {
  if (!can(actorRole, "member:update_role")) return false;
  if (actorRole === "owner") return true;
  return RANK[currentRole] < RANK.owner && RANK[nextRole] < RANK.owner && RANK[currentRole] <= RANK[actorRole];
}
