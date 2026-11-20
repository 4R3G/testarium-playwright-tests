import type { Locator, Page } from '@playwright/test';

/**
 * Ekran logowania. Aplikacja nie ma osobnej trasy `/login` — bramka w korzeniu
 * routera renderuje formularz pod dowolnym adresem, dopóki nikt nie jest
 * zalogowany, a po zalogowaniu zostawia użytkownika pod tym samym adresem.
 */
export class LoginPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Zaloguj się' });
    this.email = page.getByLabel('Adres e-mail');
    this.password = page.getByLabel('Hasło', { exact: true });
    this.submit = page.getByRole('button', { name: 'Zaloguj', exact: true });
    this.error = page.getByRole('alert');
  }

  async goto(path = '/dashboard'): Promise<void> {
    await this.page.goto(path);
  }

  async signIn(credentials: { email: string; password: string }): Promise<void> {
    await this.email.fill(credentials.email);
    await this.password.fill(credentials.password);
    await this.submit.click();
  }
}
