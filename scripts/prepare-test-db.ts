import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Gera um schema SQLite isolado para os testes de integração.
 *
 * O schema de produção é Postgres; aqui só trocamos o provider e o diretório
 * de saída do client. O banco fica em `.test/test.db` e é recriado a cada
 * execução, sem tocar em DATABASE_URL de produção.
 */
const root = process.cwd();
const testDir = join(root, ".test");
const schemaPath = join(testDir, "schema.prisma");
const dbPath = join(testDir, "test.db");

mkdirSync(testDir, { recursive: true });

const source = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
const schema = source
  .replace('provider = "postgresql"', 'provider = "sqlite"')
  .replace(
    'output   = "../app/generated/prisma"',
    'output   = "./generated/prisma"'
  );

if (!schema.includes('provider = "sqlite"')) {
  throw new Error("não foi possível converter o schema para SQLite");
}
if (!schema.includes('output   = "./generated/prisma"')) {
  throw new Error("não foi possível redirecionar a saída do client de teste");
}

writeFileSync(schemaPath, schema, "utf8");
rmSync(dbPath, { force: true });

const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;
const executable = process.platform === "win32" ? "npx.cmd" : "npx";

execFileSync(
  executable,
  ["prisma", "db", "push", "--schema", schemaPath],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      // O prisma.config.ts prioriza DIRECT_URL; ambos apontam para o banco
      // isolado para que nenhum comando alcance produção.
      DATABASE_URL: dbUrl,
      DIRECT_URL: dbUrl,
    },
  }
);

console.log(`Banco de teste pronto em ${dbPath}`);
