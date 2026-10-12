import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

// Execute the production SQL against SQLite. Only the Cloudflare transport is
// replaced: constraints, affected rows and transactional rollback remain real.
export class TestD1 {
  constructor(beforeMigration = () => {}) {
    this.sqlite = new DatabaseSync(":memory:");
    const directory = new URL("../drizzle/", import.meta.url);
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
      beforeMigration(this.sqlite, file);
      this.sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
    }
    this.sqlite.exec("CREATE TABLE IF NOT EXISTS maintenance_operations (id TEXT PRIMARY KEY NOT NULL, completed_at INTEGER NOT NULL, actor_user_id TEXT NOT NULL)");
    this.failSql = null;
  }

  prepare(sql) {
    let values = [];
    const statement = {
      bind(...args) { values = args; return statement; },
      execute: (arrayRows = false) => {
        if (this.failSql?.test(sql)) throw new Error("Injected D1 failure");
        const query = this.sqlite.prepare(sql);
        if (arrayRows) query.setReturnArrays(true);
        const results = query.all(...values);
        return { success: true, results, meta: { changes: this.sqlite.prepare("SELECT changes() AS changes").get().changes } };
      },
      async all() { return statement.execute(); },
      async run() { return statement.execute(); },
      async raw() { return statement.execute(true).results; },
      async first(column) {
        const row = statement.execute().results[0] ?? null;
        return column && row ? row[column] : row;
      },
    };
    return statement;
  }

  async batch(statements) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.execute());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  rows(table) {
    return this.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map((row) => ({ ...row }));
  }

  insert(table, values) {
    const columns = Object.keys(values);
    this.sqlite.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...Object.values(values));
  }

  close() { this.sqlite.close(); }
}
