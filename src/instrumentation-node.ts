import { EnvError, getEnv } from "@/server/env";

try {
  getEnv();
} catch (error) {
  if (!(error instanceof EnvError)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
