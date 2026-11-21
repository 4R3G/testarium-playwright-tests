import { credentialsOf, users } from '../../src/data/users';
import { expect, test } from '../../src/fixtures';

test.describe('Zmiana użytkownika w tej samej karcie', () => {
  test('po wylogowaniu administratora tester nie widzi jego danych z cache', async ({
    apiAs,
    loginPage,
    shell,
    dashboard,
    integrationsPage,
  }) => {
    // Oczekiwania z API w tym samym teście, nie stałe z seeda.
    const testerApi = await apiAs('tester');
    const project = await testerApi.projectByKey('PK');
    const tester = await testerApi.dashboard(project.id);
    const admin = await (await apiAs('admin')).dashboard(project.id);
    // Przypadek przebiegu ma jednego wykonawcę, więc kolejki się nie pokrywają —
    // każdy wiersz testera na ekranie dowodzi, że to nie cache administratora.
    expect(tester.myAssignments.length, 'tester ma przypisane przypadki').toBeGreaterThan(0);

    // Administrator wypełnia cache zapytań: pulpit i tokeny API.
    await loginPage.goto('/dashboard');
    await loginPage.signIn(credentialsOf('admin'));
    await expect(dashboard.tileValue('Czeka na mnie')).toHaveText(
      String(admin.myProgress.untested),
    );
    await shell.open('Integracje');
    await expect(integrationsPage.tokensSection).toBeVisible();
    await shell.open('Pulpit');
    await expect(dashboard.heading).toBeVisible();

    // Bez przeładowania strony: cache żyje w pamięci karty, a `staleTime`
    // (30 s) pozwoliłby mu przetrwać zmianę konta, gdyby wylogowanie go nie czyściło.
    await shell.signOut.click();
    await loginPage.signIn(credentialsOf('tester'));

    await expect(shell.userName(users.tester.displayName)).toBeVisible();
    await expect(dashboard.tileValue('Czeka na mnie')).toHaveText(
      String(tester.myProgress.untested),
    );
    const myWork = dashboard.section('Moja praca');
    for (const row of tester.myAssignments) {
      await expect(myWork.getByRole('link').filter({ hasText: row.caseKey })).toBeVisible();
    }

    await shell.open('Integracje');
    await expect(integrationsPage.noPermission).toBeVisible();
    await expect(integrationsPage.tokensSection).toHaveCount(0);
    await expect(integrationsPage.newToken).toHaveCount(0);
  });
});
