import type { Locator, Page, Response } from '@playwright/test';
import { LocaleSwitch, type Locale } from './locale-switch';

const LABELS = {
  pl: { heading: 'Zaloguj się', email: 'Adres e-mail', password: 'Hasło', submit: 'Zaloguj' },
  en: { heading: 'Sign in', email: 'E-mail address', password: 'Password', submit: 'Sign in' },
} as const satisfies Record<Locale, Record<string, string>>;

/**
 * Ekran logowania. Aplikacja nie ma osobnej trasy `/login` — bramka w korzeniu
 * routera renderuje formularz pod dowolnym adresem, dopóki nikt nie jest
 * zalogowany, a po zalogowaniu zostawia użytkownika pod tym samym adresem.
 *
 * Etykiety zależą od języka interfejsu; domyślnie polskie, jak w całych testach.
 */
export class LoginPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly locale: LocaleSwitch;

  constructor(
    private readonly page: Page,
    language: Locale = 'pl',
  ) {
    const labels = LABELS[language];
    this.heading = page.getByRole('heading', { name: labels.heading });
    this.email = page.getByLabel(labels.email);
    this.password = page.getByLabel(labels.password, { exact: true });
    this.submit = page.getByRole('button', { name: labels.submit, exact: true });
    this.error = page.getByRole('alert');
    this.locale = new LocaleSwitch(page);
  }

  async goto(path = '/dashboard'): Promise<void> {
    await this.page.goto(path);
  }

  async signIn(credentials: { email: string; password: string }): Promise<void> {
    await this.email.fill(credentials.email);
    await this.password.fill(credentials.password);
    await this.submit.click();
  }

  /**
   * Logowanie z formularza zakończone odpowiedzią API. Potrzebne, gdy kolejna
   * asercja nie odróżni nowego stanu od poprzedniego (ten sam komunikat błędu
   * po kolejnej próbie) albo gdy test czyta treść odpowiedzi.
   */
  async signInAndWait(credentials: { email: string; password: string }): Promise<Response> {
    const response = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'POST' &&
        new URL(candidate.url()).pathname === '/api/auth/login',
    );
    await this.signIn(credentials);
    return response;
  }
}
