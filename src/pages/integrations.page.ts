import type { Locator, Page } from '@playwright/test';

/**
 * Integracje (`/integrations`) — tokeny API, webhooki i Jira. Rośnie w etapie 5.
 *
 * Link do ekranu widzi każda rola; bez `token:manage` i `integration:manage`
 * ekran zamiast treści pokazuje jedno zdanie o brakującym uprawnieniu.
 */
export class IntegrationsPage {
  readonly heading: Locator;
  readonly newToken: Locator;
  readonly tokensSection: Locator;
  readonly noPermission: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { level: 1, name: 'Integracje' });
    this.newToken = main.getByRole('button', { name: 'Nowy token', exact: true });
    this.tokensSection = main.getByRole('heading', { level: 2, name: 'Tokeny API' });
    this.noPermission = main.getByText(
      'Integracje wymagają uprawnienia token:manage albo integration:manage.',
    );
  }

  async goto(): Promise<void> {
    await this.page.goto('/integrations');
  }
}
