/**
 * Reads the first non-empty string from DynamoDB item attributes.
 * Tables may use snake_case, camelCase, or PascalCase.
 */
export function readNonEmptyString(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return undefined;
}
