import type { APIResponse, BrowserContext } from '@playwright/test';
import { env } from '../config/env';
import { REFRESH_COOKIE } from './testarium-api';

export interface SetCookie {
  name: string;
  value: string;
  /** Atrybuty z kluczami małymi literami; flagi bez wartości (`HttpOnly`) mają `true`. */
  attributes: Record<string, string | true>;
}

type BrowserCookie = Awaited<ReturnType<BrowserContext['cookies']>>[number];

/**
 * Czy ciasteczko sesji musi mieć `Secure` (PK-1042). Backend włącza flagę
 * tylko w produkcji: po `http://localhost` przeglądarka odrzuciłaby
 * ciasteczko `Secure` z odpowiedzi i nie dałoby się zalogować. Adres `https`
 * to jedyny sygnał produkcji widoczny z zewnątrz.
 */
export const SECURE_COOKIE_EXPECTED = new URL(env.baseUrl).protocol === 'https:';

/** Nagłówki `Set-Cookie` odpowiedzi — tak, jak wysłał je serwer. */
export function setCookiesOf(response: APIResponse): SetCookie[] {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => parseSetCookie(header.value));
}

/** Ciasteczko odświeżające w słoiku przeglądarki — tak, jak je zapisała. */
export async function refreshCookieIn(context: BrowserContext): Promise<BrowserCookie | undefined> {
  return (await context.cookies()).find((cookie) => cookie.name === REFRESH_COOKIE);
}

function parseSetCookie(header: string): SetCookie {
  const [pair = '', ...rest] = header.split(';');
  const separator = pair.indexOf('=');
  const attributes: Record<string, string | true> = {};

  for (const part of rest) {
    const attribute = part.trim();
    if (!attribute) continue;
    const equals = attribute.indexOf('=');
    if (equals === -1) {
      attributes[attribute.toLowerCase()] = true;
    } else {
      attributes[attribute.slice(0, equals).toLowerCase()] = attribute.slice(equals + 1);
    }
  }

  return {
    name: pair.slice(0, separator).trim(),
    value: pair.slice(separator + 1).trim(),
    attributes,
  };
}
