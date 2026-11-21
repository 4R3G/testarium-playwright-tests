import type { Locator, Page } from '@playwright/test';

/** Repozytorium przypadków (`/repository`). Rośnie w etapie 2. */
export class RepositoryPage {
  readonly heading: Locator;
  /** Wymaga `case:write` — bez niego przycisk jest widoczny, ale nieaktywny. */
  readonly newCase: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { level: 1, name: 'Repozytorium przypadków' });
    this.newCase = main.getByRole('button', { name: 'Nowy przypadek', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/repository');
  }
}
