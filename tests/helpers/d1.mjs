import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

// Runs the production D1 SQL against SQLite and the actual generated migration.
// Worker binding/network behavior remains a separate runtime gate.
export function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of readdirSync(new URL("../../drizzle/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort())
    sqlite.exec(readFileSync(new URL(`../../drizzle/${migration}`, import.meta.url), "utf8"));
  return {
    sqlite,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...args) {
          return {
            async first() {
              return statement.get(...args) ?? null;
            },
            async all() {
              return { results: statement.all(...args) };
            },
            async run() {
              return { meta: { changes: statement.run(...args).changes } };
            },
          };
        },
      };
    },
  };
}
