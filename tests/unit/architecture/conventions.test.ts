import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SKIP = new Set(["generated", ".gitkeep"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? [path, ...walk(path)] : [path];
  });
}

const KEBAB = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;
// Next.js route segments: [id], [...slug], [[...slug]], (group)
const ROUTE_SEGMENT =
  /^(?:\[\[\.\.\.([a-z0-9-]+)\]\]|\[(?:\.\.\.)?([a-z0-9-]+)\]|\(([a-z0-9-]+)\))$/;

function isValidName(name: string) {
  const match = ROUTE_SEGMENT.exec(name);
  if (match) return KEBAB.test(match[1] ?? match[2] ?? match[3] ?? "");
  return KEBAB.test(name);
}

describe("project conventions", () => {
  it("checks the session on every page, with the login page using getCurrentUser", () => {
    const loginPage = join(ROOT, "src/app/login/page.tsx");
    const pages = walk(join(ROOT, "src/app")).filter((path) => path.endsWith("/page.tsx"));
    expect(pages).toContain(loginPage);
    for (const page of pages) {
      expect(readFileSync(page, "utf8"), relative(ROOT, page)).toMatch(
        page === loginPage ? /\bgetCurrentUser\s*\(/ : /\brequireUser\s*\(/,
      );
    }
  });

  it("accepts kebab-case and Next.js route segment names only", () => {
    for (const ok of [
      "unit-list",
      "units.repository.ts",
      "[id]",
      "[...slug]",
      "[[...slug]]",
      "(auth)",
    ]) {
      expect(isValidName(ok), ok).toBe(true);
    }
    for (const bad of ["UnitList", "unit_list", "[Id]", "(Auth)"]) {
      expect(isValidName(bad), bad).toBe(false);
    }
  });

  it("uses kebab-case for every file and folder in src and tests", () => {
    const bad = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "tests"))]
      .map((path) => relative(ROOT, path))
      .filter((path) => !isValidName(path.split("/").at(-1) ?? ""));
    expect(bad).toEqual([]);
  });

  it('starts every server file with import "server-only"', () => {
    const serverDirs = [
      join(ROOT, "src/server"),
      ...readdirSync(join(ROOT, "src/features"))
        .map((feature) => join(ROOT, "src/features", feature, "server"))
        .filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory()),
    ];
    const missing = serverDirs
      .flatMap(walk)
      .filter((path) => /\.tsx?$/.test(path))
      .filter((path) => !readFileSync(path, "utf8").startsWith('import "server-only";'))
      .map((path) => relative(ROOT, path));
    expect(missing).toEqual([]);
  });
});
