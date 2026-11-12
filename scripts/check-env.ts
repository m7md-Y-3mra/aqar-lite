import { getEnv, EnvError } from "../src/server/env.ts";

try {
  getEnv();
  process.stdout.write("Environment OK\n");
} catch (error) {
  if (!(error instanceof EnvError)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
