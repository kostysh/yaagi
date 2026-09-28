// Adapter-specific types; no driver or Node types cross this technical boundary.
export type SqlValue = null | string | number | bigint | Uint8Array;
export type SqlRows = SqlValue[][];
export interface SqlScope {
  all(sql: string, params?: readonly SqlValue[]): SqlRows;
  run(
    sql: string,
    params?: readonly SqlValue[],
  ): { changes: number; lastInsertRowid: bigint };
}
