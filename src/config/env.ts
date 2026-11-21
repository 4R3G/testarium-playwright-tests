import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
   * Opóźnienie każdej akcji przeglądarki w ms (`slowMo`) — do oglądania testów
   * w trybie `--headed`. Domyślnie 0.
   */
  get slowMo(): number {
    return Number(process.env.E2E_SLOW_MO) || 0;
  },
  /** Katalog aplikacji — ten sam, z którego `scripts/environment.mts` ją uruchamia. */
  get appDir(): string {
    return resolve(process.cwd(), process.env.TESTARIUM_APP_DIR ?? '../TSM');
  },
  /**
   * Baza aplikacji — wyłącznie dla kont, których API nie zakłada (test blokady
   * PK-1041). Domyślnie `DATABASE_URL` z `.env` aplikacji: dokładnie ta baza,
   * na której pracuje backend, także w worktree z własną bazą.
   */
  get databaseUrl(): string {
    const raw = process.env.E2E_DATABASE_URL ?? databaseUrlOfApp(this.appDir);
    // `?schema=public` to parametr Prismy, nie Postgresa — sterownik `pg` go nie zna.
    const url = new URL(raw);
    url.searchParams.delete('schema');
    return url.toString();
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

function databaseUrlOfApp(appDir: string): string {
  const file = resolve(appDir, '.env');
  const url = existsSync(file) ? dotenv.parse(readFileSync(file)).DATABASE_URL : undefined;
  if (!url) {
    throw new Error(
      `Brak DATABASE_URL w ${file}. Ustaw E2E_DATABASE_URL w .env testów albo TESTARIUM_APP_DIR.`,
    );
  }
  return url;
}
