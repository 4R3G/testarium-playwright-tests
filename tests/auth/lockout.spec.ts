import { expect, test } from '../../src/fixtures';

test.describe('Blokada konta w formularzu — PK-1041', () => {
  test('po pięciu złych hasłach formularz mówi o blokadzie, także przy poprawnym haśle', async ({
    loginPage,
    testAccounts,
  }) => {
    // Jednorazowe konto z bazy: na koncie demo blokada wywróciłaby inne testy.
    const account = await testAccounts.create();
    await loginPage.goto();

    for (let attempt = 1; attempt <= 5; attempt++) {
      // Czekamy na odpowiedź, bo komunikat po każdej próbie jest ten sam —
      // asercja przeszłaby jeszcze na tekście z poprzedniej.
      await loginPage.signInAndWait({ email: account.email, password: 'Zle-haslo-e2e-1041' });
      await expect(loginPage.error, `próba ${attempt}`).toHaveText(
        'Nieprawidłowy e-mail lub hasło',
      );
    }

    await loginPage.signInAndWait(account);

    await expect(loginPage.error).toHaveText('Konto jest zablokowane. Spróbuj ponownie za 15 min.');
    await expect(loginPage.heading).toBeVisible();
  });
});
