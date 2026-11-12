const APP_ORIGIN = "http://localhost:3000";

type ApiRequestOptions = {
  method: string;
  body?: unknown;
  origin?: string | null;
  cookie?: string;
};

export function apiRequest(path: string, options: ApiRequestOptions): Request {
  const headers = new Headers();
  const origin = options.origin === undefined ? APP_ORIGIN : options.origin;
  if (origin !== null) headers.set("Origin", origin);
  if (options.cookie !== undefined) headers.set("Cookie", options.cookie);

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  return new Request(new URL(path, APP_ORIGIN), { method: options.method, headers, body });
}

export async function readJson(response: Response): Promise<unknown> {
  return (await response.json()) as unknown;
}

export function getSetCookie(response: Response): string {
  const cookie = response.headers.get("set-cookie");
  if (cookie === null) throw new Error("Expected a Set-Cookie response header");
  return cookie;
}
