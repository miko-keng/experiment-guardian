import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config/env.js";

export type { DatabaseType };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: DatabaseType | null = null;

export function getDatabase(dbPath?: string): DatabaseType {
  if (dbInstance && !dbPath) {
    return dbInstance;
  }

  const targetPath = dbPath || config.databasePath;

  if (targetPath !== ":memory:") {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(targetPath);
  db.pragma("foreign_keys = ON");
  if (targetPath !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }

  runMigrations(db);

  if (!dbPath) {
    dbInstance = db;
  }

  return db;
}

export function runMigrations(db: DatabaseType): void {
  const migrationsDir = [
    path.resolve(__dirname, "migrations"),
    path.resolve(__dirname, "../../src/database/migrations"),
  ].find((candidate) =>
    fs.existsSync(candidate) && fs.readdirSync(candidate).some((file) => file.endsWith(".sql"))
  );
  if (!migrationsDir) {
    console.warn("[Database] No SQL migrations directory found");
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = file;
    const row = db
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(version);

    if (!row) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      db.transaction(() => {
        db.exec(sql);
        db.prepare(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
        ).run(version, new Date().toISOString());
      })();
    }
  }
}

export const db = getDatabase();
