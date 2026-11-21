import type { Locator, Page } from '@playwright/test';

/** Raporty (`/reports`). Rośnie w etapie 4. */
export class ReportsPage {
  readonly heading: Locator;
  /** Wymaga `report:schedule` — bez niego przycisku nie ma wcale. */
  readonly schedules: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { level: 1, name: 'Raporty' });
    this.schedules = main.getByRole('button', { name: 'Raporty cykliczne', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/reports');
  }
}
