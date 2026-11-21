import type { Page } from '@playwright/test';
import { credentialsOf, users } from '../../src/data/users';
import { expect, test } from '../../src/fixtures';
import { MODULES } from '../../src/pages/app-shell';
import { LOCALE_STORAGE_KEY } from '../../src/pages/locale-switch';
import { LoginPage } from '../../src/pages/login.page';

/** Etykiety nawigacji po angielsku, w kolejności `MODULES`. */
const NAV_EN = ['Dashboard', 'Test cases', 'Test runs', 'My tests', 'Reports', 'Integrations'];

async function storedLocale(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), LOCALE_STORAGE_KEY);
}

test.describe('Przełącznik języka PL/EN', () => {
  test('na ekranie logowania zmienia etykiety i zostaje po przeładowaniu', async ({
    page,
    loginPage,
  }) => {
    const english = new LoginPage(page, 'en');
    await loginPage.goto();
    await expect(loginPage.heading).toBeVisible();

    await loginPage.locale.select('en');

    await expect(english.heading).toBeVisible();
    await expect(english.email).toBeVisible();
    await expect(english.submit).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.reload();
    await expect(english.heading).toBeVisible();
    await expect(english.locale.radio('en')).toBeChecked();
    expect(await storedLocale(page)).toBe('en');
  });

  test('jawny wybór języka wygrywa z językiem z profilu', async ({
    page,
    request,
    loginPage,
    shell,
  }) => {
    const credentials = credentialsOf('tester');
    const profile = await request.post('/api/auth/login', { data: credentials });
    const { user } = (await profile.json()) as { user: { locale: string } };
    expect(user.locale, 'konto demo ma w profilu polski').toBe('pl');
    const english = new LoginPage(page, 'en');
    await loginPage.goto();
    await loginPage.locale.select('en');

    await english.signIn(credentials);

    await expect(shell.userName(users.tester.displayName)).toBeVisible();
    await expect(shell.pageHeading).toHaveText('Dashboard');
    await expect(shell.navLink('Dashboard')).toBeVisible();
  });

  test('w powłoce zmienia nawigację, a wybór przetrwa przeładowanie w obie strony', async ({
    page,
    loginAs,
    dashboard,
    shell,
  }) => {
    await loginAs('tester');
    await dashboard.goto();
    await expect(dashboard.heading).toBeVisible();

    await shell.locale.select('en');

    for (const label of NAV_EN) {
      await expect(shell.navLink(label)).toBeVisible();
    }
    await expect(shell.pageHeading).toHaveText('Dashboard');
    await page.reload();
    await expect(shell.pageHeading).toHaveText('Dashboard');
    await expect(shell.locale.radio('en')).toBeChecked();

    await shell.locale.select('pl');

    for (const module of MODULES) {
      await expect(shell.navLink(module.link)).toBeVisible();
    }
    await page.reload();
    await expect(dashboard.heading).toBeVisible();
    expect(await storedLocale(page)).toBe('pl');
  });

  test('bez zapisanego wyboru język bierze się z przeglądarki', async ({ browser, baseURL }) => {
    // Własny kontekst, bez skryptu przypinającego PL z fixtury `context`.
    const context = await browser.newContext({ baseURL, locale: 'en-US' });
    const page = await context.newPage();

    await page.goto('/dashboard');

    await expect(new LoginPage(page, 'en').heading).toBeVisible();
    expect(await storedLocale(page)).toBeNull();
    await context.close();
  });
});
