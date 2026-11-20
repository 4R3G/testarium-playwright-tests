# Plan testów E2E Testarium

Repozytorium testów end-to-end (TypeScript + Playwright) dla aplikacji Testarium
(`http://localhost:5173`). Plan dzieli pracę na siedem etapów, numerowanych tak
jak etapy samej aplikacji — etap N testów pokrywa przede wszystkim to, co
aplikacja dowiozła w swoim etapie N. Dzięki temu łatwo sprawdzić, które moduły
mają już siatkę bezpieczeństwa.

Stan etapów prowadzi `README.md`; tu jest zakres i kryteria ukończenia.

## Założenia przekrojowe

- **Wszystko idzie przez `:5173`.** Front proxuje `/api` do backendu (port
  z `.env` aplikacji — dziś 3100 w worktree, 3000 w głównym katalogu). Testy
  nie znają portu API: ten sam origin co przeglądarka daje to samo zachowanie
  ciasteczka `SameSite=Strict`, co na produkcji za proxy.
- **Logowanie przez API w każdym teście, bez `storageState`.** Backend rotuje
  token odświeżający i przy ponownym użyciu starego unieważnia całą rodzinę
  sesji. Wspólny plik stanu wczytywany przez kilka kontekstów = pierwszy test
  rotuje token, drugi dostaje „wykryto ponowne użycie" i wylatuje. Logowanie
  przez `context.request` kosztuje jedno `argon2.verify` (~100 ms) i daje
  każdemu testowi własną rodzinę tokenów.
- **Selektory po rolach i tekstach, nie po `data-testid`.** Aplikacja nie ma
  ani jednego `data-testid`, za to ma porządną dostępność (`main`, `region`
  z nagłówkiem, `aria-label` w rodzaju „Zaznacz PK-1004"). Gdzie roli zabraknie,
  zapisujemy brak w `docs/selector-gaps.md` jako propozycję zmiany w aplikacji.
- **Język interfejsu przypięty do PL** (`locale: pl-PL` + `testarium.locale`
  w localStorage). Testy przełącznika PL/EN ustawiają język jawnie.
- **Dane: seed jest tylko do odczytu.** Testy, które coś zapisują, zakładają
  własne obiekty z prefiksem `[e2e]` i unikalnym sufiksem, a sprzątają je przez
  API w fixturze. Przebiegu z wynikami nie da się skasować (reguła domenowa) —
  takie przebiegi zamykamy (`CLOSED`) i filtrujemy po prefiksie.
- **Blokada konta (PK-1041) jest realna.** Pięć złych haseł blokuje konto na
  15 minut. Testy negatywne logowania używają nieistniejącego e-maila; test
  samej blokady wymaga dedykowanego konta (patrz „Otwarte kwestie").
- **Warstwy:** `src/api` (klient REST do przygotowania danych), `src/pages`
  (Page Objects), `src/fixtures` (wstrzykiwanie zalogowanych stron i klientów),
  `tests/<obszar>` (scenariusze). Testy czysto API-owe w projekcie `api`, bez
  przeglądarki.

## Etap 0 — Fundament

Szkielet repozytorium i dowód, że łańcuch działa.

- TypeScript (strict), Playwright, ESLint z `eslint-plugin-playwright`, Prettier.
- `playwright.config.ts`: `baseURL` z `.env`, projekty `api` i `chromium`,
  trace/screenshot/wideo przy niepowodzeniu, raport HTML.
- Start środowiska przed testami (`scripts/environment.mts` jako `webServer`):
  Docker, kontenery, migracje, seed, `pnpm dev`; przy działającej aplikacji
  bez zmian. Te same kroki pod `pnpm env:start` i `pnpm env:up`.
- `global-setup`: sprawdzenie frontu, `/api/health` i konta demo — przy
  problemie czytelny komunikat zamiast trzydziestu identycznych timeoutów.
- Konta demo per rola (`admin`, `coordinator`, `tester`) w `src/data/users.ts`.
- Fixture `loginAs(role)` — logowanie przez API, jak opisano wyżej.
- Page Objects: `LoginPage`, `AppShell` (nawigacja, użytkownik, wylogowanie),
  `DashboardPage`.
- Testy dymne: zdrowie API, przekierowanie `/` → `/dashboard`, logowanie z UI,
  odmowa przy złych danych, sesja po przeładowaniu, wylogowanie, nawigacja po
  wszystkich aktywnych modułach, sekcje pulpitu.

**Gotowe, gdy:** `pnpm test` przechodzi lokalnie, `pnpm lint` i `pnpm typecheck`
są czyste, README opisuje szybki start.

## Etap 1 — Uwierzytelnianie, sesja i RBAC

- Ciasteczko odświeżające: `HttpOnly`, `SameSite=Strict`, `path=/`; `Secure`
  sprawdzany warunkowo (w dev wyłączony celowo) — **PK-1042**.
- Token dostępu nie trafia do `localStorage` ani `sessionStorage`.
- Wylogowanie czyści cache — druga osoba w tej samej przeglądarce nie widzi
  danych pierwszej (wylogowanie admina → logowanie testera → brak „Integracji",
  inna „Moja praca").
- Wykrycie ponownego użycia tokenu odświeżającego unieważnia sesję (test API).
- Blokada konta po 5 próbach — **PK-1041** (wymaga dedykowanego konta).
- Macierz ról w interfejsie: co widzi administrator, koordynator, tester
  (pozycje nawigacji, przyciski „Nowy przypadek", „Nowy przebieg", ekran
  Integracje) oraz odmowa 403 z API przy próbie obejścia interfejsu.
- Przełącznik PL/EN: zmiana etykiet, zapamiętanie wyboru po przeładowaniu.

## Etap 2 — Repozytorium przypadków

- Drzewo zestawów: liczniki rekurencyjne, zawężanie listy, nowy zestaw
  i podzestaw, zmiana nazwy inline, usunięcie (na własnych danych).
- Lista: filtry priorytetu/typu/wyniku/tagów/autora **w adresie URL**
  (link otwiera ten sam widok), wyszukiwanie po kluczu, tytule i tagu.
- Dialog przypadku: utworzenie z krokami, walidacja pól wymaganych.
- Wersjonowanie: zmiana treści → nowa wersja; zmiana priorytetu/tagów → bez
  nowej wersji; historia z diffem; przywrócenie **dokłada** wersję.
- Duplikat (nowy autor, brak `automationKey`), przeniesienie do zestawu,
  operacje masowe, zapisane widoki (prywatne i współdzielone).
- Paginacja kursorowa listy (test API na `nextCursor`) — **PK-1007**.

## Etap 3 — Plany, przebiegi i wykonanie

- Koordynator: kamień milowy, plan, przebieg z wyboru ręcznego i z filtru
  dynamicznego (podgląd liczby dopasowań), przypisanie testerów.
- Tester: „Moje testy", ekran wykonania, wyniki per krok, skróty `P/F/B/N`,
  przejście do następnego nieprzetestowanego, pomiar czasu.
- Retest dokłada próbę (licznik „N prób", historia).
- Zamrożona wersja: edycja przypadku po zbudowaniu przebiegu nie zmienia kroków
  w runnerze, za to pokazuje rozjazd wersji.
- Załączniki: wybór pliku i wklejenie ze schowka; widoczność zrzutu
  nieprzypiętego tylko dla autora.
- Wzmianki `@użytkownik` → powiadomienie w dzwonku drugiego użytkownika
  (dwa konteksty przeglądarki w jednym teście).
- Skróty runnera nie działają przy otwartym dialogu.
- Przebiegu z wynikami nie da się usunąć.

## Etap 4 — Pulpit i raporty

- Pulpit spójny z danymi przebiegu: kafle, aktywne przebiegi, moja kolejka,
  ostatnie niepowodzenia, blokady — każdy wiersz prowadzi do właściwego ekranu.
- Raport przebiegu: rozkład, podziały, „wykonane przez", krzywa wypalania;
  zakładka i przebieg w adresie URL.
- Zaliczalność liczona wobec rozstrzygniętych (blokady poza mianownikiem,
  brak danych = myślnik, nie 0%).
- Macierz pokrycia: tło komórki tylko dla luk.
- Eksport PDF/CSV/XLSX: zlecenie → status → pobranie; CSV z BOM i rozbrojonymi
  formułami — **PK-1004**.
- Raport cykliczny: harmonogram → e-mail w Mailpit (`:8025`, API Mailpit).

## Etap 5 — Publiczne API, automaty i integracje

- Tokeny API z ekranu Integracje: sekret pokazany raz, rotacja, unieważnienie.
- `/api/v1`: lista przypadków z kursorem, otwarcie przebiegu z kluczy
  automatyzacji, wsad wyników (pominięcia z powodem), import JUnit XML
  (`skipped` → BLOCKED), zamknięcie przebiegu.
- Limit 60 zapytań/min → `429` z `Retry-After` — **PK-1011** (osobny token,
  test seryjny).
- Webhooki: odbiornik HTTP stawiany przez fixturę, weryfikacja podpisu HMAC,
  `case.failed` tylko przy niepowodzeniu, historia doręczeń i ponowne
  doręczenie, `ping`.
- Import/eksport przypadków CSV/XLSX: mapowanie kolumn, podgląd bez zapisu,
  eksport → import bez różnic.
- Jira (przez atrapę `scripts/atrapa-jiry.mjs` aplikacji): połączenie,
  zgłoszenie błędu z runnera ze szkicem, plakietki, „do retestu", wymagania
  i macierz śledzenia.

## Etap 6 — Hartowanie i CI

- GitHub Actions: stack aplikacji w Dockerze, migracje, seed, testy,
  artefakty (raport HTML, trace).
- Drugi i trzeci silnik (Firefox, WebKit) dla testów dymnych.
- Dostępność: `@axe-core/playwright` na głównych ekranach.
- Regresja wizualna wybranych ekranów (pulpit, runner) na stałych danych.
- Tagowanie testów (`@smoke`, `@regression`) i osobne komendy dla nich.
- Kwarantanna niestabilnych testów i raport flaky.

## Otwarte kwestie

1. **Dedykowane konto do testu blokady (PK-1041).** API nie ma endpointu
   zakładania użytkowników. Opcje: konto `e2e-lockout@testarium.local`
   w seedzie aplikacji albo zdjęcie blokady bezpośrednio w bazie po teście.
2. **Izolacja danych w CI.** Lokalnie testy chodzą po bazie deweloperskiej
   z seedem; w CI baza powinna być świeża przy każdym uruchomieniu.
3. **Port API zależy od miejsca uruchomienia** (worktree vs katalog główny).
   Testy go nie potrzebują dopóki chodzą przez proxy Vite — trzymamy się tego.
