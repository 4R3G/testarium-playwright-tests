import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Brak zmiennej środowiskowej ${name}. Skopiuj .env.example do .env.`);
  }
  return value;
}

/**
 * Konfiguracja testów. Czytana leniwie przez gettery, żeby brak hasła
 * wywracał dopiero test, który się loguje — a nie np. `eslint` czy
 * `playwright --list`.
 */
export const env = {
  get baseUrl(): string {
    return process.env.BASE_URL ?? 'http://localhost:5173';
  },
  get mailpitUrl(): string {
    return process.env.MAILPIT_URL ?? 'http://localhost:8025';
  },
  get password(): string {
    return required('E2E_PASSWORD');
  },
  get isCI(): boolean {
    return Boolean(process.env.CI);
  },
  /**
   * Czy Playwright ma sam podnieść środowisko (`scripts/environment.mts`).
   * Wyłącz (`E2E_START_ENV=false`), gdy BASE_URL wskazuje środowisko,
   * którego nie stawiamy lokalnie.
   */
  get startEnvironment(): boolean {
    return process.env.E2E_START_ENV !== 'false';
  },
};
