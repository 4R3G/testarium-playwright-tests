import type { Page } from '@playwright/test';
import { SECURE_COOKIE_EXPECTED, refreshCookieIn } from '../../src/api/cookies';
import { REFRESH_COOKIE, type Session } from '../../src/api/testarium-api';
import { credentialsOf } from '../../src/data/users';
import { expect, test } from '../../src/fixtures';

/** Trzy segmenty base64url — kształt JWT, niezależnie od tego, czyj to token. */
const JWT_PATTERN = /eyJ[\w-]+\.[\w-]+\.[\w-]+/;

/** Wszystko, co skrypt strony może przeczytać bez uprawnień: ciasteczka i oba magazyny. */
async function readableByScript(page: Page): Promise<{ cookie: string; storage: string }> {
  return page.evaluate(() => {
    const dump = (storage: Storage) =>
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? '';
        return `${key}=${storage.getItem(key) ?? ''}`;
      });
    return {
      cookie: document.cookie,
      storage: [...dump(localStorage), ...dump(sessionStorage)].join('\n'),
    };
  });
}

test.describe('Sesja w przeglądarce', () => {
  test('przeglądarka zapisuje ciasteczko odświeżające jako HttpOnly, SameSite=Strict — PK-1042', async ({
    context,
    loginPage,
    dashboard,
  }) => {
    await loginPage.goto();

    await loginPage.signIn(credentialsOf('tester'));

    await expect(dashboard.heading).toBeVisible();
    const cookie = await refreshCookieIn(context);
    expect(cookie, `ciasteczko ${REFRESH_COOKIE}`).toBeDefined();
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' });
    expect(cookie!.expires, 'ciasteczko trwałe, nie sesyjne').toBeGreaterThan(Date.now() / 1000);
    expect(
      cookie!.secure,
      'Secure tylko w produkcji (https) — w dev po http przeglądarka odrzuciłaby ciasteczko',
    ).toBe(SECURE_COOKIE_EXPECTED);
  });

  test('skrypt strony nie widzi tokenów — ani po logowaniu, ani po wznowieniu sesji', async ({
    page,
    context,
    loginPage,
    dashboard,
  }) => {
    await loginPage.goto();
    const loginResponse = await loginPage.signInAndWait(credentialsOf('coordinator'));
    const { accessToken } = (await loginResponse.json()) as Session;
    await expect(dashboard.heading).toBeVisible();

    const afterLogin = await readableByScript(page);
    const refreshToken = (await refreshCookieIn(context))?.value;
    expect(refreshToken).toBeTruthy();
    expect(afterLogin.cookie, 'HttpOnly: document.cookie bez tokenu').not.toContain(REFRESH_COOKIE);
    expect(afterLogin.storage).not.toContain(accessToken);
    expect(afterLogin.storage).not.toContain(refreshToken);
    expect(afterLogin.storage, 'żaden JWT w localStorage/sessionStorage').not.toMatch(JWT_PATTERN);

    // Po przeładowaniu token dostępu znika z pamięci, a aplikacja wymienia
    // ciasteczko na nowy — ten też nie może trafić do magazynu.
    const refreshResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/auth/refresh',
    );
    await page.reload();
    const restored = (await (await refreshResponse).json()) as Session;
    await expect(dashboard.heading).toBeVisible();

    const afterReload = await readableByScript(page);
    expect(afterReload.cookie).not.toContain(REFRESH_COOKIE);
    expect(afterReload.storage).not.toContain(restored.accessToken);
    expect(afterReload.storage).not.toMatch(JWT_PATTERN);
  });

  test('wylogowanie usuwa ciasteczko odświeżające z przeglądarki', async ({
    context,
    loginAs,
    dashboard,
    shell,
    loginPage,
  }) => {
    await loginAs('tester');
    await dashboard.goto();
    await expect(dashboard.heading).toBeVisible();
    expect(await refreshCookieIn(context)).toBeDefined();

    await shell.signOut.click();

    await expect(loginPage.heading).toBeVisible();
    await expect.poll(async () => refreshCookieIn(context)).toBeUndefined();
  });
});
