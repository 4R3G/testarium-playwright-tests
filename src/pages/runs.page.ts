import type { Locator, Page } from '@playwright/test';

/** Lista planów i przebiegów (`/runs`). Rośnie w etapie 3. */
export class RunsPage {
  readonly heading: Locator;
  /** Oba wymagają `run:write` — bez niego są widoczne, ale nieaktywne. */
  readonly newRun: Locator;
  readonly newPlan: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { level: 1, name: 'Przebiegi testowe' });
    this.newRun = main.getByRole('button', { name: 'Nowy przebieg', exact: true });
    this.newPlan = main.getByRole('button', { name: 'Nowy plan', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/runs');
  }
}
