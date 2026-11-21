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

export interface ProgressBreakdown {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  untested: number;
}

/** Przypadek przebiegu na pulpicie („Moja praca", „Zablokowane"). */
export interface DashboardCaseRef {
  runCaseId: string;
  runId: string;
  runName: string;
  caseKey: string;
  caseTitle: string;
}

/** Fragment `GET /api/reports/dashboard` — tylko pola, o które pytają testy. */
export interface DashboardSummary {
  myProgress: ProgressBreakdown;
  myAssignments: DashboardCaseRef[];
  caseCount: number;
}

/** Nazwa ciasteczka z tokenem odświeżającym (`REFRESH_COOKIE` w API). */
export const REFRESH_COOKIE = 'testarium_refresh';

/** Komunikat z treści błędu NestJS (`{ statusCode, message, error }`). */
export async function errorMessage(response: APIResponse): Promise<string | undefined> {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === 'string' ? body.message : undefined;
}

/** Bieżąca wartość tokenu odświeżającego w słoiku kontekstu żądań. */
export async function refreshTokenOf(request: APIRequestContext): Promise<string | undefined> {
  const { cookies } = await request.storageState();
  return cookies.find((cookie) => cookie.name === REFRESH_COOKIE)?.value;
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

  /** Projekt po kluczu (np. `PK` z seeda); brak to błąd przygotowania danych. */
  async projectByKey(key: string): Promise<Project> {
    const project = (await this.projects()).find((candidate) => candidate.key === key);
    expect(project, `projekt ${key} w organizacji ${this.user.email}`).toBeDefined();
    return project!;
  }

  async dashboard(projectId: string): Promise<DashboardSummary> {
    return this.get<DashboardSummary>(
      `/api/reports/dashboard?projectId=${encodeURIComponent(projectId)}`,
    );
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.request.get(path, { headers: this.authHeaders() });
    await expectOk(response, `GET ${path}`);
    return (await response.json()) as T;
  }

  /**
   * Surowe żądanie z tokenem tej sesji, bez sprawdzania statusu — dla testów,
   * w których odmowa jest oczekiwanym wynikiem.
   */
  async send(method: string, path: string, data?: unknown): Promise<APIResponse> {
    return this.request.fetch(path, {
      method,
      headers: this.authHeaders(),
      ...(data === undefined ? {} : { data }),
    });
  }

  get accessToken(): string {
    return this.session.accessToken;
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
