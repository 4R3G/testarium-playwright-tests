# Luki w selektorach

Testy szukają elementów po rolach i nazwach dostępnych. Gdzie aplikacja nie
daje do tego podstaw, Page Object schodzi do CSS albo XPath — i ten wybór jest
zapisany tutaj jako propozycja zmiany w aplikacji. Każda poprawka po stronie
Testarium poprawia jednocześnie dostępność dla czytników ekranu.

| Miejsce                                                                        | Obecnie                                                               | Obejście w testach                                                                    | Proponowana zmiana w aplikacji                                                                                     |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Panel` (`apps/web/src/routes/reports/charts.tsx`) — sekcje pulpitu i raportów | `<section>` z `<h2>`, bez nazwy dostępnej, więc nie jest `region`     | `main section` filtrowane po nagłówku `h2` (`DashboardPage.section`)                  | `aria-labelledby` wskazujące `id` nagłówka (`useId()`) — sekcja staje się regionem `getByRole('region', { name })` |
| `StatTile` (`dashboard-page.tsx`) — kafle pulpitu                              | etykieta i liczba to dwa sąsiednie `span`                             | od etykiety do rodzica (`xpath=..`) i `span.tabular-nums` (`DashboardPage.tileValue`) | `<dl>`/`<dt>`/`<dd>` albo `role="group"` z `aria-label` = etykieta                                                 |
| Przełącznik języka PL/EN (logowanie i powłoka)                                 | `radio` z nazwą „on" — `<span>` z kodem języka nie jest etykietą pola | jeszcze nieużywany (etap 1)                                                           | `aria-label="Polski"` / `"English"` na `input` albo `<label>` obejmujące tekst                                     |
