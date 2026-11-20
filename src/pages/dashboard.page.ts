import type { Locator, Page } from '@playwright/test';

export const DASHBOARD_TILES = [
  'Otwarte przebiegi',
  'Czeka na mnie',
  'Przypadki w projekcie',
  'Nigdy niewykonane',
] as const;

/**
 * Sekcje widoczne zawsze. Panel „Do retestu" pojawia się tylko w organizacji
 * z Jirą albo z przypadkami czekającymi na retest, więc tu go nie ma.
 */
export const DASHBOARD_SECTIONS = [
  'Aktywne przebiegi',
  'Moja praca',
  'Ostatnie niepowodzenia',
  'Zablokowane',
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number] | 'Do retestu';

/** Pulpit (`/dashboard`) — pierwszy ekran po zalogowaniu. */
export class DashboardPage {
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('main').getByRole('heading', { level: 1, name: 'Pulpit' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  tile(label: string): Locator {
    return this.page.getByRole('main').getByText(label, { exact: true });
  }

  /**
   * Liczba na kaflu. Kafel nie ma semantyki (etykieta i wartość to dwa
   * `span`-y obok siebie), więc schodzimy od etykiety do rodzica — patrz
   * `docs/selector-gaps.md`.
   */
  tileValue(label: string): Locator {
    return this.tile(label).locator('xpath=..').locator('span.tabular-nums').first();
  }

  /**
   * Sekcja pulpitu (`Panel`) to `<section>` z nagłówkiem `h2`. Bez
   * `aria-labelledby` nie jest regionem w drzewie dostępności, więc
   * `getByRole('region', { name })` jej nie znajdzie — patrz
   * `docs/selector-gaps.md`.
   */
  section(name: DashboardSection): Locator {
    return this.page
      .getByRole('main')
      .locator('section')
      .filter({ has: this.page.getByRole('heading', { level: 2, name, exact: true }) });
  }
}
