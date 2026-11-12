type QueryInput = Record<string, string | string[] | undefined>;

export function toQueryInput(source: URLSearchParams | QueryInput): QueryInput {
  const entries =
    source instanceof URLSearchParams
      ? Array.from(new Set(source.keys()), (key) => {
          const values = source.getAll(key);
          return [key, values.length > 1 ? values : values[0]] as const;
        })
      : Object.entries(source);

  return Object.fromEntries(entries.map(([key, value]) => [key, value === "" ? undefined : value]));
}
