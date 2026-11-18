import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { ALL_SCHEMA_TABLES } from "../schema";
import { parseDrizzleMigrationSql } from "../migrations";

describe("Step 1.6 — Initial Drizzle SQL Migration Verification", () => {
  const migrationsDir = path.resolve(process.cwd(), "drizzle/migrations");

  it("contains the generated 0000 SQL migration file and journal metadata", () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const files = fs.readdirSync(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    expect(sqlFiles.length).toBeGreaterThanOrEqual(1);
    expect(sqlFiles[0]).toMatch(/^0000_.*\.sql$/);

    const journalPath = path.join(migrationsDir, "meta", "_journal.json");
    expect(fs.existsSync(journalPath)).toBe(true);

    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8")) as {
      dialect: string;
      entries: Array<{ idx: number; tag: string }>;
    };
    expect(journal.dialect).toBe("sqlite");
    expect(journal.entries).toHaveLength(1);
    expect(journal.entries[0].idx).toBe(0);
  });

  it("creates all 22 schema tables and all 15 unique indexes in the SQL migration", () => {
    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"));
    const sqlContent = fs.readFileSync(
      path.join(migrationsDir, sqlFiles[0]),
      "utf-8"
    );

    const summary = parseDrizzleMigrationSql(sqlContent);
    const expectedTableNames = Object.values(ALL_SCHEMA_TABLES)
      .map((t) => getTableConfig(t).name)
      .sort();
    const expectedIndexNames = Object.values(ALL_SCHEMA_TABLES)
      .flatMap((t) => getTableConfig(t).indexes.map((i) => i.config.name))
      .sort();

    expect([...summary.createdTables].sort()).toEqual(expectedTableNames);
    expect([...summary.createdUniqueIndexes].sort()).toEqual(expectedIndexNames);
    expect(summary.createdTables).toHaveLength(22);
    expect(summary.createdUniqueIndexes).toHaveLength(15);
    expect(summary.statementCount).toBe(37);
  });
});
