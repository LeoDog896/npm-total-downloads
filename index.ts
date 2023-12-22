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

await new Command()
  .name("npm-total-downloads")
  .description("A CLI to get the total downloads of a list of npm packages.")
  .version("v1.0.0")
  .arguments("<packages:string[]>")
  .action(async (_, packages) => {
    for (const name of packages) {
      const data = await getPackage(name);
      console.log(data);
    }
  })
  .parse();
