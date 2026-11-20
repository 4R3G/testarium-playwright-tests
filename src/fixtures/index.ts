import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { login, TestariumApi, type Session } from '../api/testarium-api';
import { credentialsOf, type Role } from '../data/users';
import { AppShell } from '../pages/app-shell';
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../pages/login.page';

/** Klucz, pod którym aplikacja trzyma jawny wybór języka. */
const LOCALE_STORAGE_KEY = 'testarium.locale';

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
  loginPage: LoginPage;
  shell: AppShell;
  dashboard: DashboardPage;
}

export const test = base.extend<Fixtures>({
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

  apiAs: async ({ playwright, baseURL }, use) => {
    const contexts: APIRequestContext[] = [];
    await use(async (role) => {
      const request = await playwright.request.newContext({ baseURL });
      contexts.push(request);
      return TestariumApi.as(request, credentialsOf(role));
    });
    await Promise.all(contexts.map((request) => request.dispose()));
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
});

export { expect };
