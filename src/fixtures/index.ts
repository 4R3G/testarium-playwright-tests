import { test as base, expect, type APIRequestContext } from '@playwright/test';
import type pg from 'pg';
import { login, TestariumApi, type Session } from '../api/testarium-api';
import { credentialsOf, type Role } from '../data/users';
import { createPool, TestAccounts } from '../db/test-accounts';
import { AppShell } from '../pages/app-shell';
import { DashboardPage } from '../pages/dashboard.page';
import { IntegrationsPage } from '../pages/integrations.page';
import { LOCALE_STORAGE_KEY } from '../pages/locale-switch';
import { LoginPage } from '../pages/login.page';
import { ReportsPage } from '../pages/reports.page';
import { RepositoryPage } from '../pages/repository.page';
import { RunsPage } from '../pages/runs.page';

interface Fixtures {
  /**
   * Loguje bieżący kontekst przeglądarki przez API. Ciasteczko z tokenem
   * odświeżającym trafia do słoika kontekstu, a aplikacja wznawia z niego
   * sesję przy pierwszym `page.goto`.
   *
   * Celowo zamiast `storageState`: backend rotuje token odświeżający i przy
   * ponownym użyciu starego unieważnia całą rodzinę sesji, więc wspólny plik
   * stanu wczytany przez dwa konteksty wylogowałby oba.
   */
  loginAs: (role: Role) => Promise<Session>;
  /** Klient REST zalogowany na wskazaną rolę — do przygotowania danych. */
  apiAs: (role: Role) => Promise<TestariumApi>;
  /**
   * Świeży kontekst żądań z własnym słoikiem ciasteczek — osobna „przeglądarka"
   * w testach sesji. Zamykany po teście.
   */
  newRequest: () => Promise<APIRequestContext>;
  /** Jednorazowe konta w bazie aplikacji (test blokady); usuwane po teście. */
  testAccounts: TestAccounts;
  loginPage: LoginPage;
  shell: AppShell;
  dashboard: DashboardPage;
  repositoryPage: RepositoryPage;
  runsPage: RunsPage;
  reportsPage: ReportsPage;
  integrationsPage: IntegrationsPage;
}

interface WorkerFixtures {
  /** Pula połączeń z bazą aplikacji — powstaje dopiero, gdy test jej potrzebuje. */
  database: pg.Pool;
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  context: async ({ context }, use) => {
    // Język przypięty do PL, ale tylko gdy nikt nie wybrał innego — inaczej
    // skrypt startowy cofałby przełącznik języka przy każdym przeładowaniu.
    await context.addInitScript((key) => {
      try {
        if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, 'pl');
      } catch {
        // about:blank i ramki z innego originu nie mają localStorage.
      }
    }, LOCALE_STORAGE_KEY);
    await use(context);
  },

  loginAs: async ({ context }, use) => {
    await use((role) => login(context.request, credentialsOf(role)));
  },

  newRequest: async ({ playwright, baseURL }, use) => {
    const contexts: APIRequestContext[] = [];
    await use(async () => {
      const request = await playwright.request.newContext({ baseURL });
      contexts.push(request);
      return request;
    });
    await Promise.all(contexts.map((request) => request.dispose()));
  },

  apiAs: async ({ newRequest }, use) => {
    await use(async (role) => TestariumApi.as(await newRequest(), credentialsOf(role)));
  },

  database: [
    // eslint-disable-next-line no-empty-pattern -- Playwright wymaga destrukturyzacji
    async ({}, use) => {
      const pool = createPool();
      await use(pool);
      await pool.end();
    },
    { scope: 'worker' },
  ],

  testAccounts: async ({ database }, use) => {
    const accounts = new TestAccounts(database);
    await use(accounts);
    await accounts.deleteCreated();
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  shell: async ({ page }, use) => {
    await use(new AppShell(page));
  },

  dashboard: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  repositoryPage: async ({ page }, use) => {
    await use(new RepositoryPage(page));
  },

  runsPage: async ({ page }, use) => {
    await use(new RunsPage(page));
  },

  reportsPage: async ({ page }, use) => {
    await use(new ReportsPage(page));
  },

  integrationsPage: async ({ page }, use) => {
    await use(new IntegrationsPage(page));
  },
});

export { expect };
