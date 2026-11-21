import { errorMessage } from '../../src/api/testarium-api';
import { can, type Permission } from '../../src/data/permissions';
import { ROLES, users } from '../../src/data/users';
import { expect, test } from '../../src/fixtures';

/** Identyfikator, którego nie ma w bazie — poprawny UUID v4, więc przechodzi walidację. */
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

interface Probe {
  permission: Permission;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  data?: object;
  /**
   * Status dla roli z uprawnieniem. Zapisy idą z pustą treścią albo
   * nieistniejącym identyfikatorem: strażnik uprawnień działa przed walidacją,
   * więc odmowa to 403, a przepuszczone żądanie kończy się na 400/404 —
   * test niczego nie zakłada nawet wtedy, gdy strażnik zawiedzie.
   */
  allowed: number;
}

/**
 * Po jednym żądaniu na uprawnienie, które różni konta demo, plus dwa, które
 * tester ma — żeby macierz łapała też odebranie uprawnienia za dużo.
 */
const PROBES: Probe[] = [
  { permission: 'token:manage', method: 'GET', path: '/api/tokens', allowed: 200 },
  { permission: 'integration:manage', method: 'GET', path: '/api/webhooks', allowed: 200 },
  { permission: 'integration:manage', method: 'GET', path: '/api/jira/connection', allowed: 200 },
  { permission: 'project:write', method: 'POST', path: '/api/projects', data: {}, allowed: 400 },
  { permission: 'suite:write', method: 'POST', path: '/api/suites', data: {}, allowed: 400 },
  { permission: 'case:delete', method: 'DELETE', path: `/api/cases/${MISSING_ID}`, allowed: 404 },
  { permission: 'run:write', method: 'POST', path: '/api/runs', data: {}, allowed: 400 },
  { permission: 'run:write', method: 'POST', path: '/api/plans', data: {}, allowed: 400 },
  { permission: 'report:schedule', method: 'GET', path: '/api/report-schedules', allowed: 400 },
  { permission: 'case:write', method: 'POST', path: '/api/cases', data: {}, allowed: 400 },
  {
    permission: 'run:execute',
    method: 'POST',
    path: `/api/run-cases/${MISSING_ID}/results`,
    data: {},
    allowed: 400,
  },
];

for (const probe of PROBES) {
  test.describe(`Uprawnienie ${probe.permission}: ${probe.method} ${probe.path}`, () => {
    for (const role of ROLES) {
      const { roleLabel, memberRole } = users[role];

      if (can(role, probe.permission)) {
        test(`${roleLabel} przechodzi przez strażnika (${probe.allowed})`, async ({ apiAs }) => {
          const api = await apiAs(role);

          const response = await api.send(probe.method, probe.path, probe.data);

          expect(response.status()).toBe(probe.allowed);
        });
      } else {
        test(`${roleLabel} dostaje 403`, async ({ apiAs }) => {
          const api = await apiAs(role);

          const response = await api.send(probe.method, probe.path, probe.data);

          expect(response.status()).toBe(403);
          expect(await errorMessage(response)).toBe(
            `Rola ${memberRole} nie ma uprawnień: ${probe.permission}`,
          );
        });
      }
    }
  });
}

test.describe('Uwierzytelnienie w API', () => {
  test('bez tokenu każdy z tych endpointów odpowiada 401', async ({ request }) => {
    for (const probe of PROBES) {
      const response = await request.fetch(probe.path, {
        method: probe.method,
        ...(probe.data === undefined ? {} : { data: probe.data }),
      });
      expect.soft(response.status(), `${probe.method} ${probe.path}`).toBe(401);
    }
  });

  test('podmiana roli w tokenie dostępu nie daje uprawnień administratora', async ({
    apiAs,
    request,
  }) => {
    const tester = await apiAs('tester');
    const [header, payload, signature] = tester.accessToken.split('.');
    const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString()) as { role: string };
    expect(claims.role).toBe('TESTER');
    const forged = Buffer.from(JSON.stringify({ ...claims, role: 'ORG_ADMIN' })).toString(
      'base64url',
    );

    const response = await request.get('/api/tokens', {
      headers: { Authorization: `Bearer ${header}.${forged}.${signature}` },
    });

    expect(response.status()).toBe(401);
  });
});
