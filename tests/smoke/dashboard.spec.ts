import { expect, test } from '../../src/fixtures';
import { DASHBOARD_SECTIONS, DASHBOARD_TILES } from '../../src/pages/dashboard.page';

test.describe('Pulpit', { tag: '@smoke' }, () => {
  test('pokazuje kafle i stałe sekcje', async ({ loginAs, dashboard }) => {
    await loginAs('admin');

    await dashboard.goto();

    for (const tile of DASHBOARD_TILES) {
      await expect(dashboard.tile(tile)).toBeVisible();
    }
    for (const section of DASHBOARD_SECTIONS) {
      await expect(dashboard.section(section)).toBeVisible();
    }
  });

  test('liczba przypadków na kaflu zgadza się z API', async ({
    loginAs,
    apiAs,
    dashboard,
    shell,
  }) => {
    const api = await apiAs('admin');
    const project = (await api.projects()).find((candidate) => candidate.key === 'PK');
    expect(project, 'projekt demonstracyjny PK z seeda').toBeDefined();
    await loginAs('admin');

    await dashboard.goto();

    await expect(shell.projectSelect).toHaveValue(project!.id);
    await expect(dashboard.tileValue('Przypadki w projekcie')).toHaveText(
      String(project!.caseCount),
    );
  });

  test('„Wszystkie” w aktywnych przebiegach prowadzi do listy przebiegów', async ({
    page,
    loginAs,
    dashboard,
    shell,
  }) => {
    await loginAs('coordinator');
    await dashboard.goto();

    await dashboard.section('Aktywne przebiegi').getByRole('link', { name: 'Wszystkie' }).click();

    await expect(page).toHaveURL(/\/runs$/);
    await expect(shell.pageHeading).toHaveText('Przebiegi testowe');
  });
});
