/** sql.js 无自带类型声明（避免引 @types/node 的 Buffer） */
declare module 'sql.js' {
  export interface SqlStatement {
    bind(params: unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): boolean;
  }
  export interface Database {
    run(sql: string, params?: unknown[]): void;
    prepare(sql: string): SqlStatement;
    exec(sql: string): unknown;
    export(): Uint8Array;
    close(): void;
  }
}
declare module 'sql.js/dist/sql-asm.js' {
  import type { Database } from 'sql.js';
  export interface SqlAsmStatic {
    Database: new (data?: ArrayLike<number> | Uint8Array | null) => Database;
  }
  export default function initSqlJs(): Promise<SqlAsmStatic>;
}
