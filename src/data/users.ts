import { env } from '../config/env';

export type Role = 'admin' | 'coordinator' | 'tester';

/** Klucz roli w API (`MemberRole` w `@testarium/contracts`). */
export type MemberRole = 'ORG_ADMIN' | 'COORDINATOR' | 'TESTER' | 'OBSERVER';

export interface DemoUser {
  email: string;
  displayName: string;
  memberRole: MemberRole;
  /** Etykieta roli w powłoce aplikacji (PL). */
  roleLabel: string;
}

/**
 * Konta demo z seeda aplikacji. Rola ma znaczenie: koordynator buduje
 * przebiegi, tester je wykonuje, administrator widzi Integracje.
 */
export const users: Record<Role, DemoUser> = {
  admin: {
    email: process.env.ADMIN_EMAIL ?? 'admin@testarium.local',
    displayName: 'Administrator Systemu',
    memberRole: 'ORG_ADMIN',
    roleLabel: 'Administrator',
  },
  coordinator: {
    email: process.env.COORDINATOR_EMAIL ?? 'marta.kowalska@testarium.local',
    displayName: 'Marta Kowalska',
    memberRole: 'COORDINATOR',
    roleLabel: 'Koordynator',
  },
  tester: {
    email: process.env.TESTER_EMAIL ?? 'tomasz.nowak@testarium.local',
    displayName: 'Tomasz Nowak',
    memberRole: 'TESTER',
    roleLabel: 'Tester',
  },
};

export const ROLES = Object.keys(users) as Role[];

export function credentialsOf(role: Role): { email: string; password: string } {
  return { email: users[role].email, password: env.password };
}

/**
 * Adres, którego na pewno nie ma w bazie. Testy negatywne logowania używają
 * właśnie jego: złe hasło na prawdziwym koncie nabija licznik blokady
 * (PK-1041 — 5 prób, 15 minut) i potrafi zablokować konto innym testom.
 */
export const UNKNOWN_EMAIL = 'nie-ma-takiego-konta@testarium.local';
