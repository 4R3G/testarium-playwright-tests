import type { Locator, Page } from '@playwright/test';

/** Moduły dostępne w nawigacji: etykieta linku, adres i nagłówek ekranu. */
export const MODULES = [
  { link: 'Pulpit', path: '/dashboard', heading: 'Pulpit' },
  { link: 'Przypadki testowe', path: '/repository', heading: 'Repozytorium przypadków' },
  { link: 'Przebiegi', path: '/runs', heading: 'Przebiegi testowe' },
  { link: 'Moje testy', path: '/my-tests', heading: 'Moje testy' },
  { link: 'Raporty', path: '/reports', heading: 'Raporty' },
  { link: 'Integracje', path: '/integrations', heading: 'Integracje' },
] as const;

export type ModuleName = (typeof MODULES)[number]['link'];

/** Pozycje nawigacji zapowiadające moduły z kolejnych etapów — nie są linkami. */
export const UPCOMING_MODULES = ['Zestawy testów', 'Dostępy', 'Ustawienia'] as const;

/**
 * Powłoka aplikacji: boczny pasek z wyborem projektu, nawigacją, użytkownikiem,
 * dzwonkiem i wylogowaniem.
 *
 * Wszystko jest zawężone do paska bocznego, bo nazwy się powtarzają: drzewo
 * repozytorium ma zestaw „Powiadomienia", a pulpit — link „Raporty".
 */
export class AppShell {
  readonly sidebar: Locator;
  readonly navigation: Locator;
  readonly projectSelect: Locator;
  readonly notifications: Locator;
  readonly signOut: Locator;
  readonly pageHeading: Locator;

  constructor(private readonly page: Page) {
    this.navigation = page.getByRole('navigation');
    this.sidebar = page.getByRole('complementary').filter({ has: this.navigation });
    this.projectSelect = this.sidebar.getByRole('combobox');
    this.notifications = this.sidebar.getByRole('button', { name: 'Powiadomienia' });
    this.signOut = this.sidebar.getByRole('button', { name: 'Wyloguj' });
    this.pageHeading = page.getByRole('main').getByRole('heading', { level: 1 });
  }

  navLink(name: string): Locator {
    return this.navigation.getByRole('link', { name, exact: true });
  }

  navItem(name: string): Locator {
    return this.navigation.getByText(name, { exact: true });
  }

  userName(displayName: string): Locator {
    return this.sidebar.getByText(displayName, { exact: true });
  }

  async open(module: ModuleName): Promise<void> {
    await this.navLink(module).click();
  }
}
