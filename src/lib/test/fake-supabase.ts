/**
 * Minimal in-memory Supabase test double.
 *
 * Supports the exact subset of the query builder the analysis pipeline uses:
 * select / insert / update / upsert / delete / eq / order / limit /
 * single / maybeSingle.
 *
 * Every table is workspace-partitioned by the caller, exactly like RLS: the
 * double additionally enforces a `workspaceId` scope so isolation regressions
 * surface as test failures rather than silent cross-tenant reads.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type FakeRow = Record<string, any>;
export type FakeTables = Record<string, FakeRow[]>;

let seq = 0;
export function testId(prefix = "id"): string {
  seq += 1;
  return `${prefix}-${String(seq).padStart(8, "0")}-0000-4000-8000-000000000000`;
}

export type FakeDbOptions = {
  /** When set, every read is restricted to this workspace, mimicking RLS. */
  workspaceId?: string;
  /** Tables that should return an error, keyed by table name. */
  failOn?: Record<string, string>;
};

type Op = "select" | "insert" | "update" | "upsert" | "delete";

class FakeQuery implements PromiseLike<{ data: any; error: any }> {
  private op: Op = "select";
  private filters: Array<[string, unknown]> = [];
  private payload: any = null;
  private onConflict: string[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private singleMode: "one" | "maybe" | null = null;
  private returnsRows = false;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  select(_columns?: string) {
    this.returnsRows = true;
    return this;
  }
  insert(payload: any) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: any, options?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = payload;
    this.onConflict = (options?.onConflict ?? "id").split(",").map((c) => c.trim());
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }
  limit(count: number) {
    this.limitCount = count;
    return this;
  }
  single() {
    this.singleMode = "one";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  private rows(): FakeRow[] {
    return (this.db.tables[this.table] ??= []);
  }

  private matches(row: FakeRow): boolean {
    if (this.db.options.workspaceId && "workspace_id" in row) {
      if (row["workspace_id"] !== this.db.options.workspaceId) return false;
    }
    return this.filters.every(([column, value]) => row[column] === value);
  }

  private execute(): { data: any; error: any } {
    this.db.calls.push({ table: this.table, op: this.op, filters: [...this.filters] });

    const failure = this.db.options.failOn?.[`${this.table}.${this.op}`] ?? this.db.options.failOn?.[this.table];
    if (failure) return { data: null, error: { message: failure } };

    const rows = this.rows();
    let result: FakeRow[] = [];

    if (this.op === "insert" || this.op === "upsert") {
      const incoming: FakeRow[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const raw of incoming) {
        const record: FakeRow = { ...raw };
        if (this.op === "upsert") {
          const existing = rows.find((r) =>
            this.onConflict.every((column) => r[column] === record[column]),
          );
          if (existing) {
            Object.assign(existing, record, { updated_at: new Date().toISOString() });
            result.push(existing);
            continue;
          }
        }
        record["id"] ??= testId(this.table);
        record["created_at"] ??= new Date().toISOString();
        record["updated_at"] ??= new Date().toISOString();
        rows.push(record);
        result.push(record);
      }
    } else if (this.op === "update") {
      result = rows.filter((r) => this.matches(r));
      for (const row of result) Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
    } else if (this.op === "delete") {
      result = rows.filter((r) => this.matches(r));
      this.db.tables[this.table] = rows.filter((r) => !this.matches(r));
    } else {
      result = rows.filter((r) => this.matches(r));
      if (this.orderBy) {
        const { column, ascending } = this.orderBy;
        result = [...result].sort((a, b) => {
          const av = a[column];
          const bv = b[column];
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
        });
      }
      if (this.limitCount != null) result = result.slice(0, this.limitCount);
    }

    if (this.singleMode) {
      const first = result[0] ?? null;
      if (this.singleMode === "one" && !first) {
        return { data: null, error: { message: "No rows found" } };
      }
      return { data: first ? { ...first } : null, error: null };
    }

    if (!this.returnsRows && this.op !== "select") return { data: null, error: null };
    return { data: result.map((r) => ({ ...r })), error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected);
    }
  }
}

export class FakeDb {
  calls: Array<{ table: string; op: Op; filters: Array<[string, unknown]> }> = [];

  constructor(
    public tables: FakeTables = {},
    public options: FakeDbOptions = {},
  ) {}

  from(table: string) {
    return new FakeQuery(this, table);
  }

  rows(table: string): FakeRow[] {
    return this.tables[table] ?? [];
  }

  /** Cast to the Supabase client type the pipeline expects. */
  client(): any {
    return this as any;
  }
}
