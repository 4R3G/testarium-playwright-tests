# Testarium — testy E2E

Testy end-to-end aplikacji [Testarium](../TSM) w TypeScript i Playwright.
Pokrywają interfejs (`http://localhost:5173`) i API, które front wystawia przez
proxy pod tym samym originem (`/api`).

Zakres i kryteria etapów: [`docs/PLAN.md`](docs/PLAN.md). Decyzje i pułapki:
[`CLAUDE.md`](CLAUDE.md).

---

## Stan prac

> Kronika etapów. Aktualizuj przy domknięciu każdego etapu.

| Etap | Zakres                               | Stan         |
| ---- | ------------------------------------ | ------------ |
| 0    | Fundament i testy dymne              | ✅ zamknięty |
| 1    | Uwierzytelnianie, sesja i RBAC       | —            |
| 2    | Repozytorium przypadków              | —            |
| 3    | Plany, przebiegi i wykonanie         | —            |
| 4    | Pulpit i raporty                     | —            |
| 5    | Publiczne API, automaty i integracje | —            |
| 6    | Hartowanie i CI                      | —            |

### Etap 0 — Fundament ✅

Repozytorium TypeScript (strict) + Playwright 1.65, ESLint z
`eslint-plugin-playwright`, Prettier. Projekty `api` (bez przeglądarki, pliki
`*.api.spec.ts`) i `chromium`.

**Środowisko wstaje przed testami.** `pnpm test` (i każde inne uruchomienie
Playwrighta, także z VS Code) najpierw woła `scripts/environment.mts` jako
`webServer`: Docker Desktop (przez `scripts/fix-docker.ps1` aplikacji) →
kontenery (`pnpm infra:up`) → zdrowe healthchecki → migracje → seed →
`pnpm dev`. Gdy aplikacja już odpowiada, skrypt niczego nie rusza, a Playwright
nie zamyka po testach serwera, którego sam nie stawiał. `global-setup` sprawdza
jeszcze front, API i konto demo i mówi jednym zdaniem, czego brakuje.

Fixtura `loginAs(role)` loguje kontekst przeglądarki przez API — każdy test ma
własną sesję (dlaczego nie `storageState`: `CLAUDE.md`). `apiAs(role)` daje
zalogowanego klienta REST do przygotowania danych. Page Objects: `LoginPage`,
`AppShell`, `DashboardPage`.

**23 testy dymne** (`@smoke`): zdrowie API i logowanie trzech kont demo,
401 bez tokenu i dla nieznanego konta, formularz logowania i komunikat błędu,
sesja po przeładowaniu, wylogowanie unieważniające sesję, przekierowanie `/` →
`/dashboard`, sześć modułów z nawigacji, moduły z przyszłych etapów bez linków,
kafle i sekcje pulpitu, liczba przypadków na kaflu zgodna z API. Stabilne przy
`--repeat-each=3`.

---

## Szybki start

Wymagania: Node 22+, pnpm, Docker Desktop i repozytorium aplikacji
z zainstalowanymi zależnościami (domyślnie `../TSM`, zmienisz w
`TESTARIUM_APP_DIR`). Aplikacji nie trzeba uruchamiać ręcznie — zrobi to
`pnpm test`.

```bash
pnpm install
pnpm exec playwright install chromium
cp .env.example .env
pnpm test
```

Zimny start (Docker wyłączony) trwa do kilku minut; kolejne uruchomienia przy
działającej aplikacji startują od razu. Serwer postawiony przez testy znika po
ich zakończeniu, kontenery zostają.

| Komenda            | Działanie                                                      |
| ------------------ | -------------------------------------------------------------- |
| `pnpm env:start`   | środowisko i `pnpm dev` na pierwszym planie (do pracy ręcznej) |
| `pnpm env:up`      | tylko Docker, kontenery, migracje i seed — bez `pnpm dev`      |
| `pnpm test`        | środowisko (jeśli nie działa), potem wszystkie testy           |
| `pnpm test:smoke`  | tylko `@smoke`                                                 |
| `pnpm test:api`    | tylko projekt `api` (bez przeglądarki)                         |
| `pnpm test:headed` | Chromium z widocznym oknem                                     |
| `pnpm test:ui`     | tryb UI Playwrighta                                            |
| `pnpm report`      | ostatni raport HTML                                            |
| `pnpm lint`        | ESLint                                                         |
| `pnpm typecheck`   | `tsc --noEmit`                                                 |
| `pnpm format`      | Prettier                                                       |

## Struktura

```
scripts/
  environment.mts  start środowiska aplikacji (webServer Playwrighta, env:start, env:up)
src/
  api/          klient REST (logowanie, przygotowanie i sprzątanie danych)
  config/       zmienne środowiskowe
  data/         konta demo per rola
  fixtures/     test rozszerzony o loginAs, apiAs i Page Objects
  pages/        Page Objects
  global-setup.ts
tests/
  smoke/        testy dymne (etap 0)
docs/
  PLAN.md           plan etapów
  selector-gaps.md  miejsca bez semantyki — propozycje zmian w aplikacji
```
