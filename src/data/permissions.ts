import type { Role } from './users';

/**
 * Uprawnienia, po których różnią się konta demo. Spis celowo przepisany,
 * a nie zaimportowany z `@testarium/contracts`: test, który pyta aplikację
 * o jej własną macierz, nie wykryje zmiany w tej macierzy.
 */
export type Permission =
  | 'project:write'
  | 'suite:write'
  | 'case:write'
  | 'case:delete'
  | 'run:write'
  | 'run:execute'
  | 'report:schedule'
  | 'integration:manage'
  | 'token:manage';

/** Oczekiwana macierz ról (`ROLE_PERMISSIONS` aplikacji, zawężona do kont demo). */
const GRANTED: Record<Role, readonly Permission[]> = {
  admin: [
    'project:write',
    'suite:write',
    'case:write',
    'case:delete',
    'run:write',
    'run:execute',
    'report:schedule',
    'integration:manage',
    'token:manage',
  ],
  coordinator: [
    'project:write',
    'suite:write',
    'case:write',
    'case:delete',
    'run:write',
    'run:execute',
    'report:schedule',
  ],
  tester: ['case:write', 'run:execute'],
};

export function can(role: Role, permission: Permission): boolean {
  return GRANTED[role].includes(permission);
}
