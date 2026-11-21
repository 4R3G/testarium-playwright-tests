import type { Locator } from '@playwright/test';
import { can } from '../../src/data/permissions';
import { ROLES, users } from '../../src/data/users';
import { expect, test } from '../../src/fixtures';
import { MODULES } from '../../src/pages/app-shell';

/** Akcja bez uprawnienia jest widoczna, ale nieaktywna — tak pokazuje ją aplikacja. */
async function expectEnabledIf(action: Locator, allowed: boolean): Promise<void> {
  await expect(action).toBeVisible();
  if (allowed) {
    await expect(action).toBeEnabled();
  } else {
    await expect(action).toBeDisabled();
  }
}

const state = (allowed: boolean): string => (allowed ? 'aktywny' : 'nieaktywny');

for (const role of ROLES) {
  const label = users[role].roleLabel;

  test.describe(`Macierz ról w interfejsie: ${label}`, () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs(role);
    });

    // Nawigacja nie zależy od roli: link do Integracji widzi każdy, a odmawia
    // dopiero sam ekran. Zmiana tego zachowania ma wywrócić ten test.
    test('nawigacja pokazuje wszystkie aktywne moduły', async ({ dashboard, shell }) => {
      await dashboard.goto();
      await expect(dashboard.heading).toBeVisible();

      for (const module of MODULES) {
        await expect(shell.navLink(module.link)).toBeVisible();
      }
    });

    test(`„Nowy przypadek” jest ${state(can(role, 'case:write'))}`, async ({ repositoryPage }) => {
      await repositoryPage.goto();
      await expect(repositoryPage.heading).toBeVisible();

      await expectEnabledIf(repositoryPage.newCase, can(role, 'case:write'));
    });

    test(`„Nowy przebieg” i „Nowy plan” są ${can(role, 'run:write') ? 'aktywne' : 'nieaktywne'}`, async ({
      runsPage,
    }) => {
      await runsPage.goto();
      await expect(runsPage.heading).toBeVisible();

      await expectEnabledIf(runsPage.newRun, can(role, 'run:write'));
      await expectEnabledIf(runsPage.newPlan, can(role, 'run:write'));
    });

    if (can(role, 'report:schedule')) {
      test('„Raporty cykliczne” są dostępne', async ({ reportsPage }) => {
        await reportsPage.goto();
        await expect(reportsPage.heading).toBeVisible();

        await expect(reportsPage.schedules).toBeVisible();
      });
    } else {
      test('„Raporty cykliczne” są ukryte', async ({ reportsPage }) => {
        await reportsPage.goto();
        await expect(reportsPage.heading).toBeVisible();

        await expect(reportsPage.schedules).toHaveCount(0);
      });
    }

    if (can(role, 'token:manage')) {
      test('ekran Integracje pokazuje tokeny API', async ({ integrationsPage }) => {
        await integrationsPage.goto();

        await expect(integrationsPage.heading).toBeVisible();
        await expect(integrationsPage.tokensSection).toBeVisible();
        await expect(integrationsPage.newToken).toBeEnabled();
      });
    } else {
      test('ekran Integracje odmawia dostępu', async ({ integrationsPage }) => {
        await integrationsPage.goto();

        await expect(integrationsPage.noPermission).toBeVisible();
        await expect(integrationsPage.heading).toHaveCount(0);
        await expect(integrationsPage.newToken).toHaveCount(0);
      });
    }
  });
}
