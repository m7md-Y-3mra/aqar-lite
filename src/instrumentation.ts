// Runs once when the Next.js server boots, so `next start` and `next dev` refuse to start
// with bad settings even when the container entrypoint is not used.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
