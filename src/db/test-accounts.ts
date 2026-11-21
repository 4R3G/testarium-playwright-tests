import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { env } from '../config/env';
import { users, type MemberRole } from '../data/users';

export interface TestAccount {
  id: string;
  email: string;
  password: string;
}

export interface LockState {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export interface AuditEntry {
  action: string;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
}

export function createPool(): pg.Pool {
  return new pg.Pool({ connectionString: env.databaseUrl, max: 2 });
}

/**
 * Jednorazowe konta zakładane bezpośrednio w bazie aplikacji.
 *
 * API nie ma endpointu zakładania użytkowników, a test blokady (PK-1041) nie
 * może ćwiczyć na koncie demo: zablokowane na 15 minut wywraca każdy inny test
 * tej roli. Każde konto ma więc unikalny adres i hasło demo (skrót przepisany
 * z konta administratora) i znika po teście razem z tokenami i członkostwem
 * (kaskada); wpisy dziennika zostają z pustym `userId`.
 *
 * Konto bez członkostwa nie pojawia się nigdzie w aplikacji — ani na liście
 * członków, ani w wyborze wykonawcy. Blokadzie to nie przeszkadza: backend
 * sprawdza ją przed hasłem, a członkostwo dopiero po nim.
 */
export class TestAccounts {
  private readonly created: string[] = [];

  constructor(private readonly db: pg.Pool) {}

  /** Nowe konto; z `role` dostaje członkostwo w organizacji demo i może się zalogować. */
  async create(options: { role?: MemberRole } = {}): Promise<TestAccount> {
    const email = `e2e-${randomUUID().slice(0, 8)}@testarium.local`;
    const inserted = await this.query<{ id: string }>(
      `INSERT INTO app_user (id, email, "passwordHash", "displayName", initials, "updatedAt")
       SELECT gen_random_uuid(), $1, "passwordHash", '[e2e] Konto testowe', 'E2',
              now() AT TIME ZONE 'UTC'
       FROM app_user WHERE email = $2
       RETURNING id`,
      [email, users.admin.email],
    );
    const id = inserted[0]?.id;
    if (!id) {
      throw new Error(`W bazie nie ma konta ${users.admin.email} — seed nie został wczytany?`);
    }
    this.created.push(id);

    if (options.role) {
      await this.query(
        `INSERT INTO membership (id, "organizationId", "userId", role)
         SELECT gen_random_uuid(), m."organizationId", $1, $2::"MemberRole"
         FROM membership m JOIN app_user u ON u.id = m."userId"
         WHERE u.email = $3
         ORDER BY m."createdAt"
         LIMIT 1`,
        [id, options.role, users.admin.email],
      );
    }

    return { id, email, password: env.password };
  }

  async lockState(id: string): Promise<LockState> {
    // Prisma zapisuje czas UTC w kolumnie bez strefy; `AT TIME ZONE 'UTC'`
    // zamienia go na znacznik ze strefą, który sterownik czyta poprawnie.
    const rows = await this.query<LockState>(
      `SELECT "failedLoginAttempts", "lockedUntil" AT TIME ZONE 'UTC' AS "lockedUntil"
       FROM app_user WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new Error(`Konto ${id} nie istnieje`);
    return rows[0];
  }

  async auditLog(id: string): Promise<AuditEntry[]> {
    return this.query<AuditEntry>(
      `SELECT action, "ipAddress", metadata FROM audit_log
       WHERE "userId" = $1 ORDER BY "createdAt", id`,
      [id],
    );
  }

  async deleteCreated(): Promise<void> {
    if (this.created.length === 0) return;
    await this.query('DELETE FROM app_user WHERE id = ANY($1::uuid[])', [this.created]);
    this.created.length = 0;
  }

  private async query<T extends pg.QueryResultRow>(sql: string, params: unknown[]): Promise<T[]> {
    try {
      return (await this.db.query<T>(sql, params)).rows;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Zapytanie do bazy aplikacji nie powiodło się (${reason}). Baza z DATABASE_URL` +
          ' w .env aplikacji albo E2E_DATABASE_URL w .env testów musi być osiągalna.',
        { cause: error },
      );
    }
  }
}
