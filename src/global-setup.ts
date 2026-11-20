import { request, type FullConfig } from '@playwright/test';
import { env } from './config/env';
import { credentialsOf } from './data/users';

/**
 * Ostatnia kontrola przed testami — już po `webServer`, który podnosi
 * środowisko (`scripts/environment.mts`). Łapie to, czego start nie sprawdza:
 * środowisko podniesione ręcznie albo zdalne (`E2E_START_ENV=false`) i bazę
 * bez seeda. Jedno zdanie o przyczynie zamiast kilkudziesięciu timeoutów.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? env.baseUrl;
  const context = await request.newContext({ baseURL });

  try {
    const front = await context.get('/', { timeout: 10_000 }).catch(() => null);
    if (!front?.ok()) {
      throw new Error(
        `Front Testarium nie odpowiada pod ${baseURL}. Uruchom środowisko: \`pnpm env:start\`.`,
      );
    }

    const health = await context.get('/api/health', { timeout: 10_000 }).catch(() => null);
    if (!health?.ok()) {
      throw new Error(
        `Front działa, ale API nie odpowiada przez proxy ${baseURL}/api` +
          (health ? ` (HTTP ${health.status()})` : '') +
          '. Zrestartuj `pnpm dev` w aplikacji i sprawdź, czy VITE_API_URL w jej .env' +
          ' wskazuje port, na którym słucha backend.',
      );
    }

    const login = await context.post('/api/auth/login', { data: credentialsOf('admin') });
    if (!login.ok()) {
      throw new Error(
        `Konto demo ${credentialsOf('admin').email} nie loguje się (HTTP ${login.status()}).` +
          ' Baza bez seeda? W aplikacji: `pnpm db:seed`, albo z tego repozytorium `pnpm env:up`' +
          ' przy zatrzymanym `pnpm dev`.',
      );
    }
  } finally {
    await context.dispose();
  }
}
