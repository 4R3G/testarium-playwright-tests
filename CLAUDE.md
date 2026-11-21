# CLAUDE.md

Repozytorium testów E2E (TypeScript + Playwright) aplikacji **Testarium**.
Kod aplikacji i jej dokumentacja: `C:\Users\Arek\Documents\Importante\Claude\TSM`
(`CLAUDE.md` tam wyjaśnia model danych i reguły domenowe, które testy sprawdzają).

Językiem projektu jest polski — nazwy testów, komentarze, dokumentacja.
Nazwy symboli w kodzie są angielskie.

`README.md` jest kroniką etapów (aktualizowaną przy domknięciu każdego),
`docs/PLAN.md` — zakresem etapów, ten plik — decyzjami i pułapkami.

## Komendy

```bash
pnpm test             # całość
pnpm test:smoke       # @smoke
pnpm exec playwright test tests/smoke/auth.spec.ts -g "wylogowanie"   # pojedynczy test
pnpm lint && pnpm typecheck && pnpm format:check                      # bramki jakości
```

## Decyzje

**Środowisko podnosi `webServer` Playwrighta, nie `globalSetup`.** Playwright
startuje `webServer` przed `globalSetup`, a `pnpm dev` potrzebuje już działającej
bazy — więc cały start (Docker → `infra:up` → healthchecki → `db:deploy` →
`db:seed` → `pnpm dev`) siedzi w jednym procesie, `scripts/environment.mts`.
Gotowość to `GET /api/health` przez proxy frontu: odpowiada dopiero, gdy wstały
oba serwery. `reuseExistingServer` lokalnie oznacza, że przy działającej
aplikacji skrypt w ogóle się nie uruchamia — testy nie dotykają cudzego
`pnpm dev` ani bazy. W CI (`CI=1`) zajęty adres jest błędem.

**Migracje, klient Prismy i seed tylko przed `pnpm dev`, nigdy obok.** `pnpm db:seed`
buduje `@testarium/contracts`, a drugi `tsup` czyści `dist` działającemu watcherowi;
`pnpm db:generate` przy żywym watcherze API pada na `EPERM` (pułapki z CLAUDE.md
aplikacji). Klienta generujemy przy każdym zimnym starcie, bo po migracjach
z nowej gałęzi aplikacji stary klient wywraca kompilację API dziesiątkami błędów TS.
Wygenerowany klient (`apps/api/generated/`) jest poza gitem aplikacji — to nie
jest zmiana jej kodu. Dlatego skrypt odmawia, gdy front odpowiada,
a API nie — to zwykle padnięty watcher w działającym `pnpm dev`, którego
lekarstwem jest restart, a nie druga kopia na zajętym porcie.

**Docker startuje wyłącznie przez `scripts/fix-docker.ps1` aplikacji.** Skrypt
aplikacji odmawia pracy przy żywych procesach Dockera, więc zamykamy je
wcześniej — ale najpierw dajemy 90 s Dockerowi, który właśnie wstaje, żeby nie
zabić startu rozpoczętego ręcznie.

**Wszystko idzie przez `:5173`, łącznie z API.** Vite proxuje `/api` do backendu,
którego port zależy od miejsca uruchomienia aplikacji (3000 w katalogu głównym
TSM, 3100 w worktree). Testy portu backendu nie znają i nie powinny: ten sam
origin co przeglądarka daje ciasteczku `SameSite=Strict` to samo zachowanie co
za proxy na produkcji.

**Logowanie przez API w każdym teście, nigdy `storageState`.** Backend rotuje
token odświeżający przy każdym `/auth/refresh` i nie ma okna łaski: przedstawienie
tokenu już unieważnionego wycina całą rodzinę sesji („wykryto ponowne użycie").
Plik stanu wczytany przez drugi kontekst przedstawia dokładnie taki token, więc
drugi test wylogowałby pierwszy. `loginAs` woła `/api/auth/login` przez
`context.request` — ciasteczko trafia do słoika kontekstu, a aplikacja wznawia
z niego sesję przy pierwszym `page.goto`. Koszt to jedno `argon2.verify` na test.

**Testy negatywne logowania używają nieistniejącego e-maila.** Złe hasło na
prawdziwym koncie nabija `failedLoginAttempts`; piąta próba blokuje konto na
15 minut (PK-1041) i wywraca każdy inny test tej roli. Nieistniejące konto
dostaje ten sam 401 bez skutków ubocznych.

**Konta do testu blokady (PK-1041) zakłada test w bazie aplikacji.** API nie ma
endpointu zakładania użytkowników, a blokada konta demo na 15 minut wywraca
każdy test tej roli. `TestAccounts` (`src/db/`) wstawia do `app_user` konto
z unikalnym adresem i skrótem hasła przepisanym z konta administratora, a po
teście je kasuje (tokeny i członkostwo znikają kaskadą, dziennik zostaje
z pustym `userId`). Konto bez członkostwa jest w aplikacji niewidoczne, a do
blokady wystarcza — backend sprawdza ją przed hasłem, członkostwo po nim.
Adres bazy to `DATABASE_URL` z `.env` aplikacji, więc worktree z własną bazą
działa bez konfiguracji. Poza tym jednym przypadkiem testy do bazy nie sięgają.

**Macierz uprawnień jest przepisana, nie importowana.** `src/data/permissions.ts`
powtarza `ROLE_PERMISSIONS` aplikacji dla trzech kont demo. Import z
`@testarium/contracts` dałby testy, które pytają aplikację o jej własną
macierz — i przechodzą po każdej jej zmianie. Rozgałęzienie po roli siedzi
na poziomie `describe` (osobny test na gałąź), nie w ciele testu: tytuł mówi,
czego się spodziewamy, a lint nie ma czego zgłaszać.

**Sprawdzenie uprawnień w API nie może niczego zapisać.** Zapis idzie z pustą
treścią albo nieistniejącym identyfikatorem. Strażnik uprawnień NestJS działa
przed walidacją, więc rola bez uprawnienia dostaje 403, a z uprawnieniem —
400/404. Gdyby strażnik zawiódł, test padnie na statusie, ale nic nie powstanie.

**Selektory po rolach i nazwach, `data-testid` nie istnieje.** Aplikacja ma
dobrą semantykę (`main`, `navigation`, `aria-label` w rodzaju „Zaznacz PK-1004").
Każde zejście do CSS/XPath jest zapisane w `docs/selector-gaps.md` jako
propozycja zmiany w aplikacji — nie dokładamy `data-testid` po cichu.

**Locatory powłoki są zawężone do paska bocznego.** Nazwy się powtarzają: drzewo
repozytorium ma zestaw „Powiadomienia" (jak dzwonek), pulpit ma link „Raporty"
(jak nawigacja), „Administrator" jest prefiksem „Administrator Systemu" — stąd
`exact: true` przy tekstach.

**Język przypięty do PL skryptem startowym, który nie nadpisuje wyboru.** Aplikacja
czyta `testarium.locale` z localStorage, potem `navigator.language`, potem profil.
Skrypt ustawia `pl` tylko przy pustym kluczu — inaczej cofałby przełącznik języka
przy każdym przeładowaniu i testy PL/EN (etap 1) byłyby niemożliwe.

**Seed jest tylko do odczytu.** Testy zapisujące dane zakładają własne obiekty
z prefiksem `[e2e]` i sprzątają je przez API. Przebiegu z wynikami nie da się
skasować (reguła aplikacji) — takie przebiegi zamykamy. Asercje na liczbach
z seeda porównujemy z odczytem API w tym samym teście, a nie ze stałą.

## Pułapki

**`getByRole('region')` nie znajduje sekcji pulpitu.** `Panel` renderuje
`<section>` bez nazwy dostępnej, a taki element według ARIA nie jest regionem —
mimo że drzewo w DevTools/Chrome pokazuje go jako „region". Szukamy `section`
po nagłówku `h2`.

**TypeScript jest przypięty do 6.0.** `typescript-eslint` 8.x deklaruje
`typescript <6.1`; TypeScript 7 (natywny kompilator) instaluje się domyślnie
i psuje parser lintera. Playwright transpiluje testy sam, więc wersja TS dotyczy
wyłącznie `typecheck` i `lint`.

**`TESTARIUM_APP_DIR` musi wskazywać tę wersję aplikacji, której schemat ma
baza.** Główny katalog TSM i worktree w `.claude/worktrees/` dzielą jedną bazę
(projekt Compose `testarium`, port 5434), ale mogą mieć różne migracje. Seed
ze starszej gałęzi na bazie po nowszych migracjach to proszenie się o kłopot.
Przy działającej aplikacji problem nie występuje — skrypt niczego wtedy nie
uruchamia.

**Zimnego startu nie sprawdzaj na środowisku deweloperskim.** Do testów samego
skryptu służy atrapa aplikacji: katalog z `package.json`, którego `infra:up`,
`db:deploy` i `db:seed` tylko wypisują tekst, a `dev` stawia serwer HTTP na
wolnym porcie; uruchomienie z `BASE_URL` i `TESTARIUM_APP_DIR` wskazującymi
atrapę przechodzi całą ścieżkę razem z zamknięciem procesu po testach.

**`infra:up` pada na „port 9000 is already allocated".** Aplikacja zamieniła
MinIO na RustFS (`testarium-storage`), a stary kontener `testarium-minio` ma
`restart: unless-stopped` i wstaje razem z Dockerem, zajmując 9000–9001. Compose
zgłasza go jako sierotę. Lekarstwo: `docker stop testarium-minio` — skrypt
startowy go nie rusza, bo to kontener aplikacji.

**Ukryte pole radio klikamy przez etykietę.** Przełącznik PL/EN ma pola radio
z nazwą dostępną („PL"/„EN"), ale ukryte stylami — `check()` czeka w nieskończoność
na widoczność. `LocaleSwitch` klika napis, a stan czyta z roli `radio`.

**`.env` aplikacji, nie testów, decyduje o porcie API.** Gdy `global-setup`
mówi „front działa, ale API nie odpowiada", sprawdź, czy backend wystartował
i czy `VITE_API_URL` w `.env` aplikacji wskazuje port, na którym słucha.
