/**
 * Whole-string wildcard match (* only), case-insensitive (PoWned-style).
 */
export function wildcardMatch(pattern: string, subject: string): boolean {
  const re =
    "^" +
    pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*") +
    "$";
  return new RegExp(re, "i").test(subject);
}

export function anyPattern(patterns: string[], subject: string): boolean {
  return patterns.some((p) => wildcardMatch(p, subject));
}

export function pathRulesMatch(rules: { exact: string[]; prefixes: string[] }, path: string): boolean {
  if (rules.exact.some((e) => e === path)) {
    return true;
  }
  for (const prefix of rules.prefixes) {
    if (prefix.endsWith("/")) {
      if (path.startsWith(prefix) || path === prefix.slice(0, -1)) {
        return true;
      }
    } else if (path === prefix || path.startsWith(prefix + "/")) {
      return true;
    }
  }
  return false;
}

export function extensionAllowed(path: string, extensions: string[]): boolean {
  if (!extensions.length) return false;
  const lower = path.toLowerCase();
  return extensions.some((ext) => {
    const e = ext.startsWith(".") ? ext : "." + ext;
    return lower.endsWith(e);
  });
}