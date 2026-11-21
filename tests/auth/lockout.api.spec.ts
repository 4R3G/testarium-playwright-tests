import type { APIRequestContext, APIResponse } from '@playwright/test';
import { errorMessage } from '../../src/api/testarium-api';
import type { TestAccount } from '../../src/db/test-accounts';
import { expect, test } from '../../src/fixtures';

/** PK-1041: pięć nieudanych prób blokuje konto na piętnaście minut. */
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const WRONG_PASSWORD = 'Zle-haslo-e2e-1041';
const INVALID_CREDENTIALS = 'Nieprawidłowy e-mail lub hasło';
const LOCKED = `Konto jest zablokowane. Spróbuj ponownie za ${LOCK_MINUTES} min.`;

async function attemptLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<APIResponse> {
  return request.post('/api/auth/login', { data: { email, password } });
}

async function failLogins(
  request: APIRequestContext,
  account: TestAccount,
  count: number,
): Promise<void> {
  for (let attempt = 1; attempt <= count; attempt++) {
    const response = await attemptLogin(request, account.email, WRONG_PASSWORD);
    expect(response.status(), `zła próba ${attempt}`).toBe(401);
    expect(await errorMessage(response), `zła próba ${attempt}`).toBe(INVALID_CREDENTIALS);
  }
}

// Konta są jednorazowe (zakładane w bazie, patrz `TestAccounts`), więc testy
// nie dzielą licznika prób i mogą chodzić równolegle.
test.describe('Blokada konta — PK-1041', () => {
  test('piąta zła próba blokuje konto na 15 minut — także dla poprawnego hasła', async ({
    request,
    testAccounts,
  }) => {
    const account = await testAccounts.create();

    // Piąta próba nadal mówi tylko „złe dane" — blokada nie zdradza, że hasło było blisko.
    await failLogins(request, account, MAX_ATTEMPTS);

    const state = await testAccounts.lockState(account.id);
    expect(state.failedLoginAttempts).toBe(MAX_ATTEMPTS);
    expect(state.lockedUntil, 'konto zablokowane po piątej próbie').not.toBeNull();
    const minutesLeft = (state.lockedUntil!.getTime() - Date.now()) / 60_000;
    expect(minutesLeft).toBeGreaterThan(LOCK_MINUTES - 1);
    expect(minutesLeft).toBeLessThanOrEqual(LOCK_MINUTES);

    const correct = await attemptLogin(request, account.email, account.password);
    expect(correct.status()).toBe(401);
    expect(await errorMessage(correct)).toBe(LOCKED);
  });

  test('blokada zostawia w dzienniku wpis z adresem IP', async ({ request, testAccounts }) => {
    const account = await testAccounts.create();
    await failLogins(request, account, MAX_ATTEMPTS);

    await attemptLogin(request, account.email, account.password);

    const log = await testAccounts.auditLog(account.id);
    const locked = log.find((entry) => entry.action === 'auth.account.locked');
    expect(locked, 'wpis o zablokowaniu konta').toBeDefined();
    expect(locked!.ipAddress, 'adres IP próby').toBeTruthy();
    expect(locked!.metadata).toMatchObject({ attempts: MAX_ATTEMPTS, max: MAX_ATTEMPTS });
    const rejected = log.find((entry) => entry.action === 'auth.login.locked');
    expect(rejected, 'wpis o odrzuceniu logowania na zablokowane konto').toBeDefined();
    expect(rejected!.ipAddress).toBeTruthy();
  });

  test('udane logowanie przed piątą próbą zeruje licznik', async ({ request, testAccounts }) => {
    // Logowanie musi się udać, więc konto dostaje członkostwo — z najwęższą rolą.
    const account = await testAccounts.create({ role: 'OBSERVER' });
    await failLogins(request, account, MAX_ATTEMPTS - 1);
    expect((await testAccounts.lockState(account.id)).failedLoginAttempts).toBe(MAX_ATTEMPTS - 1);

    const success = await attemptLogin(request, account.email, account.password);

    await expect(success).toBeOK();
    expect(await testAccounts.lockState(account.id)).toEqual({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    // Kolejna seria liczy się od zera: cztery złe próby nadal nie blokują.
    await failLogins(request, account, MAX_ATTEMPTS - 1);
    await expect(await attemptLogin(request, account.email, account.password)).toBeOK();
  });
});
