/**
 * Drizzle SQL Migration Inspector & Validator
 * Step 1.6: Generate and verify initial SQL migration for Cloudflare D1
 */

export interface ParsedMigrationSummary {
  statementCount: number;
  createdTables: string[];
  createdUniqueIndexes: string[];
}

/**
 * Parses a Drizzle-generated SQLite migration file (`--> statement-breakpoint`)
 * and extracts all `CREATE TABLE` and `CREATE UNIQUE INDEX` identifiers.
 */
export function parseDrizzleMigrationSql(
  sqlContent: string
): ParsedMigrationSummary {
  const statements = sqlContent
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const createdTables: string[] = [];
  const createdUniqueIndexes: string[] = [];

  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`/i;
  const uniqueIndexRegex =
    /CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`/i;

  for (const stmt of statements) {
    const tableMatch = tableRegex.exec(stmt);
    if (tableMatch?.[1]) {
      createdTables.push(tableMatch[1]);
    }
    const indexMatch = uniqueIndexRegex.exec(stmt);
    if (indexMatch?.[1]) {
      createdUniqueIndexes.push(indexMatch[1]);
    }
  }

  return {
    statementCount: statements.length,
    createdTables,
    createdUniqueIndexes,
  };
}
