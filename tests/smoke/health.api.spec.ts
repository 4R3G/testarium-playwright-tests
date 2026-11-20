import { login } from '../../src/api/testarium-api';
import { ROLES, UNKNOWN_EMAIL, credentialsOf, users } from '../../src/data/users';
import { expect, test } from '../../src/fixtures';

test.describe('API przez proxy frontu', { tag: '@smoke' }, () => {
  test('endpoint zdrowia odpowiada', async ({ request }) => {
    await expect(await request.get('/api/health')).toBeOK();
  });

  for (const role of ROLES) {
    test(`konto demo „${role}” loguje się z rolą ${users[role].memberRole}`, async ({
      request,
    }) => {
      const session = await login(request, credentialsOf(role));

      expect(session.accessToken).toBeTruthy();
      expect(session.user).toMatchObject({
        email: users[role].email,
        displayName: users[role].displayName,
        role: users[role].memberRole,
      });
    });
  }

  test('nieznane konto dostaje 401', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: UNKNOWN_EMAIL, password: 'ZleHaslo123!' },
    });

    expect(response.status()).toBe(401);
  });

  test('chroniony endpoint bez tokenu dostaje 401', async ({ request }) => {
    const response = await request.get('/api/projects');

    expect(response.status()).toBe(401);
  });

  test('seed zawiera projekt demonstracyjny PK', async ({ apiAs }) => {
    const api = await apiAs('admin');

    const projects = await api.projects();

    expect(projects.map((project) => project.key)).toContain('PK');
  });
});
