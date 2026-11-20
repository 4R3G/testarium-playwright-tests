import { expect, test } from '../../src/fixtures';
import { MODULES, UPCOMING_MODULES } from '../../src/pages/app-shell';

test.describe('Nawigacja', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin');
  });

  test('korzeń aplikacji prowadzi na pulpit', async ({ page, dashboard }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dashboard.heading).toBeVisible();
  });

  for (const module of MODULES) {
    test(`moduł „${module.link}” otwiera się z nawigacji`, async ({ page, shell, dashboard }) => {
      await dashboard.goto();
      await expect(dashboard.heading).toBeVisible();

      await shell.open(module.link);

      await expect(page).toHaveURL(new RegExp(`${module.path}(\\?.*)?$`));
      await expect(shell.pageHeading).toHaveText(module.heading);
    });
  }

  test('moduły z kolejnych etapów są widoczne, ale nie są linkami', async ({
    shell,
    dashboard,
  }) => {
    await dashboard.goto();
    await expect(dashboard.heading).toBeVisible();

    for (const name of UPCOMING_MODULES) {
      await expect(shell.navItem(name)).toBeVisible();
      await expect(shell.navLink(name)).toHaveCount(0);
    }
  });
});
