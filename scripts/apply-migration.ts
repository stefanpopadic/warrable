import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

/**
 * Apply one .sql file over the Neon HTTP driver, which refuses multi-statement
 * payloads. Splits on semicolons while respecting dollar-quoted function bodies.
 *
 *   npx tsx scripts/apply-migration.ts drizzle/0008_extend_by_amount.sql
 */

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function splitStatements(source: string): string[] {
  const statements: string[] = [];
  let current = "";
  let dollarTag: string | null = null;
  let i = 0;

  while (i < source.length) {
    if (dollarTag === null) {
      if (source.startsWith("--", i)) {
        const end = source.indexOf("\n", i);
        const stop = end === -1 ? source.length : end;
        current += source.slice(i, stop);
        i = stop;
        continue;
      }

      const tag = /^\$[A-Za-z_]*\$/.exec(source.slice(i));
      if (tag) {
        dollarTag = tag[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }

      if (source[i] === ";") {
        if (current.trim()) statements.push(current.trim());
        current = "";
        i++;
        continue;
      }
    } else if (source.startsWith(dollarTag, i)) {
      current += dollarTag;
      i += dollarTag.length;
      dollarTag = null;
      continue;
    }

    current += source[i];
    i++;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function main() {
  loadEnv();
  const file = process.argv[2];
  if (!file) throw new Error("Usage: tsx scripts/apply-migration.ts <path-to.sql>");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");

  const sql = neon(process.env.DATABASE_URL);
  const statements = splitStatements(readFileSync(file, "utf8"));

  console.log(`Applying ${statements.length} statements from ${file}`);
  for (const [index, statement] of statements.entries()) {
    const label = statement.replace(/\s+/g, " ").slice(0, 72);
    try {
      await sql.query(statement);
      console.log(`  ${index + 1}/${statements.length} ok   ${label}`);
    } catch (error) {
      console.error(`  ${index + 1}/${statements.length} FAIL ${label}`);
      throw error;
    }
  }
  console.log("Migration applied");
}

void main();
