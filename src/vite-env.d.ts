/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gateway próprio (recomendado no .exe distribuído: a chave fica no servidor). */
  readonly VITE_FOFOLAB_AI_GATEWAY_URL?: string;
  /** Chaves diretas — só para desenvolvimento local (variáveis VITE_* vão para dentro do bundle). */
  readonly VITE_GROQ_API_KEY?: string;
  readonly VITE_GROQ_MODEL?: string;
  /** Modelo mais forte (FofoIA: aula completa e "Cai no meu edital?"); ausente = o de sempre. */
  readonly VITE_GROQ_MODEL_STRONG?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GEMINI_MODEL?: string;
  readonly VITE_GEMINI_MODEL_STRONG?: string;
  readonly VITE_DEEPSEEK_API_KEY?: string;
  readonly VITE_DEEPSEEK_MODEL?: string;
}

declare module 'sql.js' {
  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
    wasmBinary?: ArrayLike<number> | ArrayBuffer;
  }

  export interface QueryExecResult {
    columns: string[];
    values: (string | number | Uint8Array | null)[][];
  }

  /** Comando preparado: reaproveitado em lote (importação do acervo). */
  export class Statement {
    run(params?: (string | number | null | Uint8Array)[]): void;
    free(): boolean;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    prepare(sql: string): Statement;
    run(sql: string, params?: (string | number | null | Uint8Array)[]): this;
    exec(sql: string, params?: (string | number | null | Uint8Array)[]): QueryExecResult[];
    export(): Uint8Array;
    getRowsModified(): number;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}

