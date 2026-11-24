import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db-adapter";
import {
  formatQualityReport,
  getQualityReport,
} from "@/lib/data-quality/report";
import { scanDataQuality } from "@/lib/data-quality/issues";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function main() {
  const scan = process.argv.includes("--scan");
  const json = process.argv.includes("--json");
  const failOnError = process.argv.includes("--fail-on-error");
  const countryCode = argValue("country")?.toUpperCase() ?? undefined;

  if (scan) {
    const summary = await scanDataQuality(prisma);
    if (!json) {
      console.log(
        `Varredura concluída: ${summary.opened} novos, ${summary.updated} reincidentes, ${summary.resolved} resolvidos (${summary.detected} detectados).\n`
      );
    }
  }

  const report = await getQualityReport(prisma, { countryCode });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatQualityReport(report));
  }

  if (failOnError && (report.issues.bySeverity.ERROR ?? 0) > 0) {
    console.error(
      `\nFalha: ${report.issues.bySeverity.ERROR} problema(s) de severidade ERROR em aberto.`
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
