/**
 * Uruchamia środowisko Testarium przed testami.
 *
 *   node scripts/environment.mts           Docker → kontenery → migracje → klient Prismy
 *                                          → seed → `pnpm dev`
 *                                          (pierwszy plan; tak woła go `webServer` Playwrighta)
 *   node scripts/environment.mts --infra   to samo bez `pnpm dev` — kończy się po seedzie
 *
 * Kolejność i sposób startu są wzięte z CLAUDE.md aplikacji. Skrypt jest
 * idempotentny: gdy aplikacja już odpowiada, niczego nie rusza — ani
 * kontenerów, ani bazy, ani działających watcherów.
 */
import { spawn, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
dotenv.config({ path: resolve(repoRoot, '.env'), quiet: true });

const isWindows = process.platform === 'win32';
const infraOnly = process.argv.includes('--infra');
const baseUrl = process.env.BASE_URL ?? 'http://localhost:5173';
const appDir = resolve(repoRoot, process.env.TESTARIUM_APP_DIR ?? '../TSM');

const DOCKER_WARMUP_MS = 90_000;
const CONTAINERS_HEALTHY_MS = 120_000;

class EnvironmentError extends Error {}

function log(message: string): void {
  // stderr, bo `webServer` Playwrighta pokazuje go w wyniku testów, a stdout
  // (gadatliwy `pnpm dev`) ignoruje.
  process.stderr.write(`[środowisko] ${message}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

async function responds(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Krok z przechwyconym wyjściem — pokazujemy je tylko przy niepowodzeniu,
 * żeby udany start zajmował w wyniku testów kilka linijek, a nie kilkaset.
 */
function step(title: string, command: string, args: string[]): SpawnSyncReturns<string> {
  const started = Date.now();
  log(`${title}…`);
  const result = spawnSync(command, args, {
    cwd: appDir,
    encoding: 'utf8',
    // pnpm na Windows to `pnpm.cmd`, który bez powłoki się nie uruchomi.
    shell: isWindows,
    windowsHide: true,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new EnvironmentError(`${title} — niepowodzenie (kod ${result.status ?? '?'})`);
  }
  log(`${title} — gotowe (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  return result;
}

function dockerReady(): boolean {
  return spawnSync('docker', ['info'], { stdio: 'ignore', windowsHide: true }).status === 0;
}

function dockerProcessesRunning(): boolean {
  if (!isWindows) return false;
  const result = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      "@(Get-Process -Name '*docker*','*com.docker*' -ErrorAction SilentlyContinue).Count",
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  return Number(result.stdout.trim()) > 0;
}

async function waitFor(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(3_000);
  }
  return check();
}

/**
 * Docker Desktop startuje wyłącznie przez `scripts/fix-docker.ps1` aplikacji —
 * po twardym zamknięciu zostają zaślepki gniazd i zwykły start pada. Skrypt
 * odmawia pracy przy działających procesach Dockera, więc najpierw je
 * zamykamy. Zanim to zrobimy, dajemy szansę Dockerowi, który właśnie wstaje.
 */
async function ensureDocker(): Promise<void> {
  if (dockerReady()) {
    log('Docker działa.');
    return;
  }

  if (dockerProcessesRunning()) {
    log(`Docker Desktop wstaje — czekam do ${DOCKER_WARMUP_MS / 1000} s…`);
    if (await waitFor(dockerReady, DOCKER_WARMUP_MS)) {
      log('Docker działa.');
      return;
    }
  }

  if (!isWindows) {
    throw new EnvironmentError(
      'Docker nie odpowiada (`docker info`). Uruchom go i spróbuj ponownie.',
    );
  }

  log('Docker nie odpowiada — zamykam jego procesy i uruchamiam scripts/fix-docker.ps1.');
  spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      "Get-Process -Name '*docker*','*com.docker*' -ErrorAction SilentlyContinue | Stop-Process -Force",
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  await sleep(3_000);
  // fix-docker.ps1 sam czeka na demona (do 240 s) i kończy się kodem 0, gdy wstanie.
  step('Start Docker Desktop (do 4 min)', 'powershell', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    'scripts/fix-docker.ps1',
  ]);
}

function composeProjectName(): string {
  const compose = readFileSync(resolve(appDir, 'docker/compose.yml'), 'utf8');
  return /^name:\s*(\S+)/m.exec(compose)?.[1] ?? 'testarium';
}

/** `pnpm infra:up` wraca od razu po `up -d` — czekamy na healthchecki kontenerów. */
async function waitForHealthyContainers(): Promise<void> {
  const project = composeProjectName();
  const pending = (): string[] => {
    const result = spawnSync(
      'docker',
      [
        'ps',
        '--filter',
        `label=com.docker.compose.project=${project}`,
        '--format',
        '{{.Names}}|{{.Status}}',
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    return result.stdout
      .split('\n')
      .filter((line) => /health: starting|unhealthy/.test(line))
      .map((line) => line.split('|')[0] ?? line);
  };

  log('Czekam na zdrowe kontenery…');
  const healthy = await waitFor(() => pending().length === 0, CONTAINERS_HEALTHY_MS);
  if (!healthy) {
    throw new EnvironmentError(`Kontenery nie są zdrowe: ${pending().join(', ')}`);
  }
}

function startDevServer(): void {
  log(`Uruchamiam \`pnpm dev\` w ${appDir} (API i front)…`);
  const dev = spawn('pnpm', ['dev'], {
    cwd: appDir,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: isWindows,
    windowsHide: true,
  });
  // Playwright zamyka nas drzewem procesów (`taskkill /T` na Windows);
  // przy ręcznym uruchomieniu przekazujemy sygnał dalej.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => dev.kill(signal));
  }
  dev.on('exit', (code) => process.exit(code ?? 0));
}

async function main(): Promise<void> {
  if (!existsSync(resolve(appDir, 'package.json'))) {
    throw new EnvironmentError(
      `Nie znaleziono aplikacji pod ${appDir}. Ustaw TESTARIUM_APP_DIR w .env.`,
    );
  }

  if (await responds(`${baseUrl}/api/health`)) {
    log(`Aplikacja już odpowiada pod ${baseUrl} — niczego nie uruchamiam.`);
    return;
  }

  // Front bez API to najczęściej watcher API, który padł w `pnpm dev`. Drugi
  // `pnpm dev` dostałby zajęty port 5173, a seed zbudowałby kontrakty pod
  // działającym watcherem — w obu trybach odmawiamy.
  if (await responds(baseUrl)) {
    throw new EnvironmentError(
      `Front działa pod ${baseUrl}, ale API nie odpowiada przez proxy. ` +
        'Zrestartuj `pnpm dev` w aplikacji — nie uruchamiam drugiej kopii.',
    );
  }

  await ensureDocker();
  step('Kontenery (pnpm infra:up)', 'pnpm', ['infra:up']);
  await waitForHealthyContainers();
  step('Migracje (pnpm db:deploy)', 'pnpm', ['db:deploy']);
  // Klient Prismy nie odświeża się sam po migracjach z nowej gałęzi aplikacji —
  // stary daje dziesiątki błędów TS w watcherze API. Generowanie przy żywym
  // `pnpm dev` pada na EPERM (watcher trzyma silnik zapytań), więc też tylko tu.
  step('Klient Prismy (pnpm db:generate)', 'pnpm', ['db:generate']);
  // Seed buduje `@testarium/contracts`, co psuje działający watcher — dlatego
  // tylko tutaj, zanim wystartuje `pnpm dev`, nigdy obok niego.
  step('Dane demonstracyjne (pnpm db:seed)', 'pnpm', ['db:seed']);

  if (infraOnly) {
    log('Infrastruktura gotowa. Aplikację uruchomi `pnpm dev` w repozytorium aplikacji.');
    return;
  }
  startDevServer();
}

main().catch((error: unknown) => {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
