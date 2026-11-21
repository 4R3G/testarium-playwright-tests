import type { APIRequestContext, APIResponse } from '@playwright/test';
import { SECURE_COOKIE_EXPECTED, setCookiesOf } from '../../src/api/cookies';
import {
  REFRESH_COOKIE,
  errorMessage,
  login,
  refreshTokenOf,
  type Session,
} from '../../src/api/testarium-api';
import { credentialsOf } from '../../src/data/users';
import { expect, test } from '../../src/fixtures';

const REUSE_DETECTED = 'Wykryto ponowne użycie tokenu. Wszystkie sesje zostały unieważnione.';

/**
 * Kradzież tokenu: ofiara loguje się i odświeża sesję, więc pierwszy token
 * jest już unieważniony — a „napastnik" z osobnym słoikiem przedstawia go
 * ponownie. Zwraca odpowiedź na tę próbę.
 */
async function replayRotatedToken(
  victim: APIRequestContext,
  attacker: APIRequestContext,
): Promise<APIResponse> {
  await login(victim, credentialsOf('tester'));
  const stolen = await refreshTokenOf(victim);
  expect(stolen, 'token odświeżający po logowaniu').toBeTruthy();
  await expect(await victim.post('/api/auth/refresh')).toBeOK();

  return attacker.post('/api/auth/refresh', {
    headers: { Cookie: `${REFRESH_COOKIE}=${stolen}` },
  });
}

test.describe('Token odświeżający', () => {
  test('logowanie ustawia ciasteczko HttpOnly, SameSite=Strict, Path=/ — PK-1042', async ({
    request,
  }) => {
    const response = await request.post('/api/auth/login', { data: credentialsOf('tester') });
    expect(response.status()).toBe(200);

    const cookie = setCookiesOf(response).find((candidate) => candidate.name === REFRESH_COOKIE);

    expect(cookie, `Set-Cookie z ${REFRESH_COOKIE}`).toBeDefined();
    const { attributes } = cookie!;
    expect(attributes.httponly).toBe(true);
    expect(String(attributes.samesite).toLowerCase()).toBe('strict');
    expect(attributes.path).toBe('/');
    expect(Number(attributes['max-age']), 'ciasteczko trwałe, z czasem życia').toBeGreaterThan(0);
    expect(
      attributes.secure === true,
      'Secure tylko w produkcji (https) — w dev po http przeglądarka odrzuciłaby ciasteczko',
    ).toBe(SECURE_COOKIE_EXPECTED);
  });

  test('token odświeżający jest tylko w ciasteczku, nie w treści odpowiedzi', async ({
    request,
  }) => {
    const response = await request.post('/api/auth/login', { data: credentialsOf('tester') });
    const refreshToken = await refreshTokenOf(request);

    expect(refreshToken).toBeTruthy();
    expect(await response.text()).not.toContain(refreshToken);
  });

  test('odświeżenie rotuje token i wydaje działający token dostępu', async ({ newRequest }) => {
    const client = await newRequest();
    await login(client, credentialsOf('tester'));
    const before = await refreshTokenOf(client);

    const response = await client.post('/api/auth/refresh');

    expect(response.status()).toBe(200);
    const after = await refreshTokenOf(client);
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
    const { accessToken } = (await response.json()) as Session;
    const me = await client.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await expect(me).toBeOK();
  });

  test('ponowne użycie unieważnionego tokenu wycina całą rodzinę sesji', async ({ newRequest }) => {
    const victim = await newRequest();
    const attacker = await newRequest();

    const replay = await replayRotatedToken(victim, attacker);

    expect(replay.status()).toBe(401);
    expect(await errorMessage(replay)).toBe(REUSE_DETECTED);
    // Prawowity właściciel też traci sesję: nie wiadomo, która strona ukradła token.
    const victimRefresh = await victim.post('/api/auth/refresh');
    expect(victimRefresh.status()).toBe(401);
  });

  test('wycięcie rodziny nie dotyka innych sesji tego samego konta', async ({ newRequest }) => {
    // Na tym opiera się logowanie w każdym teście: równoległe testy jednej roli
    // mają osobne rodziny tokenów i nie wylogowują się nawzajem.
    const otherDevice = await newRequest();
    await login(otherDevice, credentialsOf('tester'));

    const replay = await replayRotatedToken(await newRequest(), await newRequest());

    expect(replay.status()).toBe(401);
    await expect(await otherDevice.post('/api/auth/refresh')).toBeOK();
  });

  test('odświeżenie bez ciasteczka dostaje 401', async ({ request }) => {
    const response = await request.post('/api/auth/refresh');

    expect(response.status()).toBe(401);
    expect(await errorMessage(response)).toBe('Sesja wygasła. Zaloguj się ponownie.');
  });
});
