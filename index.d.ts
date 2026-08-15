/* =========================
 *  SPLIT / REBUILD TYPES
 * ========================= */

export interface SplitOptions {
  /** Enable split / rebuild mechanism */
  enabled?: boolean

  /** Rebuild behavior (runtime) */
  mode?: 'once' | 'always' | 'strict'

  /** Automatically split database when db.close() is called */
  splitOnClose?: boolean

  /** Part size in MB (used ONLY when splitting) */
  partSizeMB?: number

  /** Force overwrite existing manifest & parts */
  overwrite?: boolean

  /** Remove .partXX files after rebuild */
  cleanup?: boolean

  /** Custom directory for parts & manifest */
  outputDir?: string

  /** Decrypt each part during rebuild */
  decrypt?: (buffer: Buffer, index: number) => Buffer

  /** Hook after rebuild */
  onRebuild?: (info: {
    filename: string
    parts: number
    size: number
  }) => void

  /** Hook after split */
  onSplit?: (info: {
    filename: string
    parts: number
    size: number
    manifest: string
  }) => void
}

/* =========================
 *  DATABASE OPTIONS
 * ========================= */

export interface DatabaseOptions {
  timeout?: number
  poolSize?: number
  busyTimeout?: number
  adaptiveChunking?: boolean
  split?: SplitOptions
}

/* =========================
 *  CURSOR & ITERATION
 * ========================= */

export interface CursorOptions {
  /** Fixed chunk size or adaptive mode */
  chunk?: number | 'auto' | 'adaptive'

  /** Named or positional parameters */
  params?: Record<string, any> | any[]

  /** Adaptive chunk minimum */
  minChunk?: number

  /** Adaptive chunk maximum */
  maxChunk?: number

  /** Backpressure control */
  highWaterMark?: number
  lowWaterMark?: number
}

export interface CursorMetrics {
  rowsFetched: number
  chunksFetched: number
  startTime: number
  lastFetchTime: number | null
  elapsedMs: number
  rowsPerSecond: number
  currentChunkSize: number
}

/* =========================
 *  STATEMENT
 * ========================= */

export class Statement<T = any> {
  get(params?: Record<string, any> | any[]): Promise<T | null>
  all(params?: Record<string, any> | any[]): Promise<T[]>
  run(params?: Record<string, any> | any[]): Promise<{
    changes: number
    lastInsertRowid: number
  }>

  iterate(options?: CursorOptions): AsyncIterableIterator<T>

  explain(params?: Record<string, any> | any[]): Promise<any[]>

  columns(): Promise<Array<{
    name: string
    type: string
    notnull: boolean
    defaultValue: any
    pk: boolean
  }>>
}

/* =========================
 *  TRANSACTION
 * ========================= */

export interface TransactionContext {
  savepoint(): Promise<string | null>
  rollbackTo(name: string): Promise<boolean>
  release(name: string): Promise<void>
}

export interface TransactionOptions {
  isolationLevel?: 'DEFERRED' | 'IMMEDIATE' | 'EXCLUSIVE'
  retries?: number
  savepoints?: boolean
}

/* =========================
 *  DATABASE
 * ========================= */

export default class Database {
  constructor(filename: string, options?: DatabaseOptions)

  exec(sql: string): Promise<{ changes: number }>
  prepare<T = any>(sql: string): Statement<T>

  get<T = any>(sql: string, params?: Record<string, any> | any[]): Promise<T | null>
  all<T = any>(sql: string, params?: Record<string, any> | any[]): Promise<T[]>
  run(sql: string, params?: Record<string, any> | any[]): Promise<{
    changes: number
    lastInsertRowid: number
  }>

  transaction<F extends (...args: any[]) => any>(
    fn: F,
    options?: TransactionOptions
  ): (...args: Parameters<F>) => Promise<ReturnType<F> extends Promise<infer U> ? U : ReturnType<F>>

  pragma(name: string, value?: any): Promise<any>

  backup(targetFilename: string): Promise<boolean>
  vacuum(): Promise<void>
  checkpoint(mode?: 'PASSIVE' | 'FULL' | 'RESTART'): Promise<void>

  close(): Promise<void>

  tableInfo(tableName: string): Promise<any[]>
  indexInfo(tableName: string): Promise<any[]>
  foreignKeyList(tableName: string): Promise<any[]>

  on(event: 'error', listener: (err: Error) => void): this
  on(event: 'closed', listener: () => void): this
}

/* =========================
 *  DEBUG
 * ========================= */

export function enableDebug(enabled?: boolean): void

/* =========================
 *  SPLITTER (BUILD-TIME)
 * ========================= */

export function splitDatabase(
  filename: string,
  options?: {
    partSizeMB?: number
    outputDir?: string
    baseName?: string
    overwrite?: boolean
    onSplit?: (info: {
      filename: string
      parts: number
      size: number
      manifest: string
    }) => void
  }
): void