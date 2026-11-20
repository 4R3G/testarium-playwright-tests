import { UNKNOWN_EMAIL, credentialsOf, users } from '../../src/data/users';
import { expect, test } from '../../src/fixtures';

test.describe('Logowanie i sesja', { tag: '@smoke' }, () => {
  test('niezalogowany widzi formularz logowania', async ({ loginPage }) => {
    await loginPage.goto('/dashboard');

    await expect(loginPage.heading).toBeVisible();
    await expect(loginPage.submit).toBeEnabled();
  });

  test('logowanie z formularza prowadzi na pulpit', async ({
    page,
    loginPage,
    shell,
    dashboard,
  }) => {
    await loginPage.goto();

    await loginPage.signIn(credentialsOf('admin'));

    await expect(dashboard.heading).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(shell.userName(users.admin.displayName)).toBeVisible();
    await expect(shell.userName(users.admin.roleLabel)).toBeVisible();
  });

  test('złe dane logowania pokazują komunikat i zostawiają formularz', async ({ loginPage }) => {
    await loginPage.goto();

    // Nieistniejący adres, nie złe hasło: to drugie nabija licznik blokady konta.
    await loginPage.signIn({ email: UNKNOWN_EMAIL, password: 'ZleHaslo123!' });

    await expect(loginPage.error).toHaveText('Nieprawidłowy e-mail lub hasło');
    await expect(loginPage.heading).toBeVisible();
  });

  test('sesja przetrwa przeładowanie karty', async ({ page, loginAs, dashboard, shell }) => {
    await loginAs('tester');
    await dashboard.goto();
    await expect(dashboard.heading).toBeVisible();

    await page.reload();

    await expect(dashboard.heading).toBeVisible();
    await expect(shell.userName(users.tester.displayName)).toBeVisible();
  });

  test('wylogowanie wraca do formularza i unieważnia sesję', async ({
    page,
    loginAs,
    dashboard,
    shell,
    loginPage,
  }) => {
    await loginAs('coordinator');
    await dashboard.goto();
    await expect(shell.userName(users.coordinator.displayName)).toBeVisible();

    await shell.signOut.click();

    await expect(loginPage.heading).toBeVisible();
    await page.reload();
    await expect(loginPage.heading).toBeVisible();
  });
});
