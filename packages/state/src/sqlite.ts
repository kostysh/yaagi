export type SqlValue = null | string | number | bigint | Uint8Array;
export interface SqlScope {
  all(sql: string, params?: readonly SqlValue[]): SqlValue[][];
  run(
    sql: string,
    params?: readonly SqlValue[],
  ): { changes: number; lastInsertRowid: bigint };
}
export type SqlMigration = { readonly id: string; readonly sql: string };
