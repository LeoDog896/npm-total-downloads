import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const packageSchema = z.object({
  name: z.string(),
  time: z.object({
    created: z.string(),
  }),
});

type Package = z.infer<typeof packageSchema>;

async function getPackage(name: string): Promise<Package> {
  const response = await fetch(`https://registry.npmjs.org/${name}`);

  if (!response.ok) {
    throw new Error(`Unable to fetch package ${name}`);
  }

  const data = await response.json();

  return packageSchema.parse(data);
}

const downloadsSchema = z.object({
  downloads: z.array(
    z.object({
      downloads: z.number(),
      day: z.string(),
    }),
  ),
});

const bulkDownloadsSchema = z.record(z.string(), downloadsSchema);

type Downloads = z.infer<typeof downloadsSchema>;
type BulkDownloads = z.infer<typeof bulkDownloadsSchema>;

async function getPackageDownloadsRange(
  from: Date,
  to: Date,
  name: string,
): Promise<Downloads | undefined>;
async function getPackageDownloadsRange(
  from: Date,
  to: Date,
  ...names: string[]
): Promise<BulkDownloads | undefined>;
async function getPackageDownloadsRange(
  from: Date,
  to: Date,
  ...names: string[]
): Promise<Downloads | BulkDownloads | undefined> {
  const fromString = dateToNPMDate(from);
  const toString = dateToNPMDate(to);

  const url =
    `https://api.npmjs.org/downloads/range/${fromString}:${toString}/${
      names.join(
        ",",
      )
    }`;

  const response = await fetch(url);

  if (!response.ok) {
    console.error(
      `Unable to fetch package ${name}: ${response.statusText} (${response.status}) for ${url}`,
    );
    return undefined;
  }

  const data = await response.json();

  if (names.length === 1) {
    return downloadsSchema.parse(data);
  } else {
    return bulkDownloadsSchema.parse(data);
  }
}

function dateToNPMDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getYearsBetweenDates(from: Date, to: Date): Date[] {
  const years: Date[] = [];

  while (from < to) {
    years.push(from);
    from = new Date(from.getFullYear() + 1, from.getMonth(), from.getDate());
  }

  years[years.length - 1] = to;

  return years;
}

await new Command()
  .name("npm-total-downloads")
  .description("A CLI to get the total downloads of a list of npm packages.")
  .version("v1.0.0")
  .arguments("<packages:string[]>")
  .action(async (_, packages) => {
    let total = 0;
    for (const rawName of packages) {
      const { name, time } = await getPackage(rawName);
      const parsedName = name.replace("/", "%2F");

      const created = new Date(time.created);

      const today = new Date();
      const years = getYearsBetweenDates(created, today);

      let packageTotal = 0;

      for (let i = 0; i < years.length - 1; i++) {
        const from = years[i];
        const to = years[i + 1];

        const range = await getPackageDownloadsRange(from, to, parsedName);
        if (!range) {
          continue;
        }

        const { downloads } = range;

        const total = downloads.reduce(
          (acc, { downloads }) => acc + downloads,
          0,
        );
        packageTotal += total;

        console.log(
          `${rawName} from ${from.getFullYear()} to ${to.getFullYear()}: ${total}`,
        );
      }

      total += packageTotal;
      console.log(`${rawName} total: ${packageTotal}`);
    }

    if (packages.length > 1) {
      console.log(`\nTotal: ${total}`);
    }
  })
  .parse();
