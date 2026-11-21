import type { Locator, Page } from '@playwright/test';

export type Locale = 'pl' | 'en';

/** Klucz, pod którym aplikacja trzyma jawny wybór języka. */
export const LOCALE_STORAGE_KEY = 'testarium.locale';

/**
 * Przełącznik PL/EN — ten sam na ekranie logowania i w pasku bocznym powłoki.
 *
 * Pola radio biorą nazwę z obejmującej je etykiety („PL", „EN"), ale są ukryte
 * stylami — widać tylko etykietę. Stan czytamy więc z pola, a klikamy napis,
 * jak użytkownik.
 */
export class LocaleSwitch {
  constructor(private readonly scope: Page | Locator) {}

  radio(locale: Locale): Locator {
    return this.scope.getByRole('radio', { name: locale.toUpperCase(), exact: true });
  }

  async select(locale: Locale): Promise<void> {
    await this.scope.getByText(locale.toUpperCase(), { exact: true }).click();
  }
}
