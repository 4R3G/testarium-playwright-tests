import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { MemberRole } from '../data/users';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  locale: string;
  organizationId: string;
  role: MemberRole;
}

export interface Session {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  isArchived: boolean;
  caseCount: number;
  suiteCount: number;
}

/**
 * Logowanie przez API. Odpowiedź ustawia ciasteczko z tokenem odświeżającym
 * w słoiku przekazanego `request` — jeśli to `context.request`, przeglądarka
 * tego kontekstu wznowi sesję przy pierwszym wejściu na stronę.
 */
export async function login(
  request: APIRequestContext,
  credentials: { email: string; password: string },
): Promise<Session> {
  const response = await request.post('/api/auth/login', { data: credentials });
  await expectOk(response, `logowanie ${credentials.email}`);
  return (await response.json()) as Session;
}

/**
 * Klient REST do przygotowania i sprzątania danych. Rośnie razem z etapami —
 * każdy nowy zasób dostaje tu metodę, zamiast surowych `request.get` w testach.
 */
export class TestariumApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly session: Session,
  ) {}

  static async as(
    request: APIRequestContext,
    credentials: { email: string; password: string },
  ): Promise<TestariumApi> {
    return new TestariumApi(request, await login(request, credentials));
  }

  get user(): AuthenticatedUser {
    return this.session.user;
  }

  async me(): Promise<AuthenticatedUser> {
    return this.get<AuthenticatedUser>('/api/auth/me');
  }

  async projects(): Promise<Project[]> {
    return this.get<Project[]>('/api/projects');
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.request.get(path, { headers: this.authHeaders() });
    await expectOk(response, `GET ${path}`);
    return (await response.json()) as T;
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.session.accessToken}` };
  }
}

/** `expect(response).toBeOK()` z treścią odpowiedzi w komunikacie błędu. */
async function expectOk(response: APIResponse, what: string): Promise<void> {
  if (!response.ok()) {
    const body = await response.text().catch(() => '');
    expect(response.ok(), `${what} → ${response.status()} ${body.slice(0, 300)}`).toBe(true);
  }
}
