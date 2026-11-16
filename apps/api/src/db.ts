/**
 * Runs `statements` as one D1 batch (one transaction, one consistent snapshot) and returns each
 * statement's rows. `T` is the tuple of row types in statement order; D1 itself cannot infer it
 * across mixed statements, so the cast lives here and nowhere else.
 */
export async function batchTyped<T extends unknown[]>(
  db: D1Database,
  statements: { [K in keyof T]: D1PreparedStatement },
): Promise<{ [K in keyof T]: T[K][] }> {
  const results = await db.batch(statements as D1PreparedStatement[]);
  return results.map((result) => result.results) as { [K in keyof T]: T[K][] };
}
