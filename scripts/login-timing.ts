// Login timing check (SC-005): unknown emails and known emails with a wrong password should take about
// the same time. Run against a fresh seeded app: node scripts/login-timing.ts [base-url]
import { SEED_DATA } from "../prisma/seed-data.ts";

const BASE_URL = process.argv[2] ?? "http://localhost:3000";
const ROUNDS = 20;
const MAX_DIFF_PERCENT = 20;
// The lock starts at 5 failures per email, so no account may get more than 4 wrong guesses.
const MAX_PER_ACCOUNT = 4;

const accounts = SEED_DATA.users.map((user) => user.email);
if (accounts.length * MAX_PER_ACCOUNT < ROUNDS) {
  throw new Error(`Need at least ${Math.ceil(ROUNDS / MAX_PER_ACCOUNT)} seed accounts`);
}

async function timeLogin(email: string): Promise<number> {
  const started = performance.now();
  const response = await fetch(new URL("/api/auth/login", BASE_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: new URL(BASE_URL).origin },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
  await response.arrayBuffer();
  const elapsed = performance.now() - started;
  if (response.status !== 401) {
    throw new Error(`Expected 401 for ${email}, got ${response.status}`);
  }
  return elapsed;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const unknown: number[] = [];
const known: number[] = [];
// Alternate the two kinds so warm-up and load affect both the same way.
for (let i = 0; i < ROUNDS; i++) {
  unknown.push(await timeLogin(`timing-${crypto.randomUUID()}@unknown.test`));
  known.push(await timeLogin(accounts[i % accounts.length]!));
}

const unknownMs = average(unknown);
const knownMs = average(known);
const diffPercent = (Math.abs(knownMs - unknownMs) / Math.min(knownMs, unknownMs)) * 100;
process.stdout.write(
  `unknown email: ${unknownMs.toFixed(1)} ms average over ${ROUNDS}\n` +
    `known email, wrong password: ${knownMs.toFixed(1)} ms average over ${ROUNDS}\n` +
    `difference: ${diffPercent.toFixed(1)}% (limit ${MAX_DIFF_PERCENT}%)\n`,
);
if (diffPercent >= MAX_DIFF_PERCENT) process.exit(1);
