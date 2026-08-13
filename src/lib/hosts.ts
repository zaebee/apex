import { parse as parseToml } from "smol-toml";

/** The scheduled workflow and the live /api/ping probe must cover exactly the
 *  same hosts, so both read the list from one place: the allowlist. */
export function hostsFromToml(tomlText: string): string[] {
  const table = parseToml(tomlText) as Record<string, { host?: string }>;
  return [
    ...new Set(
      Object.values(table)
        .map((s) => s.host)
        .filter((h): h is string => !!h),
    ),
  ];
}
