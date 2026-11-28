/**
 * Tiny Firestore data client with a fluent, Supabase-shaped surface.
 * Collections here are small, so every query reads the collection and
 * filters/sorts in memory — this avoids Firestore composite indexes entirely.
 * Errors are always RETURNED as { data, error }, never thrown.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "./firebase";

/* eslint-disable @typescript-eslint/no-explicit-any */
// `any` on purpose: Firestore documents are dynamic and screens read them freely.
export type Row = any;
export type Result<T> = { data: T; error: Error | null; count?: number };

const nowIso = () => new Date().toISOString();
const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function readAll(table: string): Promise<Row[]> {
  const snap = await getDocs(collection(getDb(), table));
  return snap.docs.map((d) => ({ ...(d.data() as Row), id: d.id }));
}

/**
 * Uses single-document or single-field indexed queries whenever an `eq` filter
 * exists so user lookups read 1-5 documents instead of scanning whole collections
 * (which exhausts the daily Firestore read quota). Single-field `where` never
 * requires a composite index; remaining filters and sorting run in memory.
 */
async function readMatching(table: string, filters: Filter[]): Promise<Row[]> {
  const idFilter = filters.find((f) => f.op === "eq" && f.col === "id" && f.value != null && String(f.value).trim());
  if (idFilter) {
    const snap = await getDoc(doc(getDb(), table, String(idFilter.value)));
    const rows = snap.exists() ? [{ ...(snap.data() as Row), id: snap.id }] : [];
    return applyFilters(rows, filters);
  }
  const eqFilter = filters.find((f) => f.op === "eq" && f.value !== undefined);
  if (eqFilter) {
    const snap = await getDocs(query(collection(getDb(), table), where(eqFilter.col, "==", eqFilter.value)));
    const rows = snap.docs.map((d) => ({ ...(d.data() as Row), id: d.id }));
    return applyFilters(rows, filters);
  }
  return applyFilters(await readAll(table), filters);
}

function compare(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

type Filter = { col: string; value: unknown; op: "eq" | "neq" | "in" };

function applyFilters(rows: Row[], filters: Filter[]) {
  return rows.filter((r) =>
    filters.every((f) => {
      const v = r[f.col];
      if (f.op === "eq") return v === f.value;
      if (f.op === "neq") return v !== f.value;
      return Array.isArray(f.value) && (f.value as unknown[]).includes(v);
    }),
  );
}

class SelectQuery implements PromiseLike<Result<Row[]>> {
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private max: number | undefined;

  constructor(private table: string) {}

  eq(col: string, value: unknown) {
    this.filters.push({ col, value, op: "eq" });
    return this;
  }
  neq(col: string, value: unknown) {
    this.filters.push({ col, value, op: "neq" });
    return this;
  }
  in(col: string, values: unknown[]) {
    this.filters.push({ col, value: values, op: "in" });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }

  private async run(): Promise<Result<Row[]>> {
    try {
      let rows = await readMatching(this.table, this.filters);
      for (const o of [...this.orders].reverse()) {
        rows = rows.sort((a, b) => (o.asc ? compare(a[o.col], b[o.col]) : compare(b[o.col], a[o.col])));
      }
      const count = rows.length;
      if (this.max != null) rows = rows.slice(0, this.max);
      return { data: rows, error: null, count };
    } catch (error) {
      return { data: [], error: error as Error, count: 0 };
    }
  }

  async maybeSingle(): Promise<Result<Row | null>> {
    const { data, error } = await this.limit(1).run();
    return { data: data[0] ?? null, error };
  }
  single() {
    return this.maybeSingle();
  }
  then<A, B = never>(
    onfulfilled?: ((v: Result<Row[]>) => A | PromiseLike<A>) | null,
    onrejected?: ((r: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class WriteQuery implements PromiseLike<Result<Row[]>> {
  private filters: Filter[] = [];

  constructor(
    private table: string,
    private kind: "update" | "delete",
    private patch: Row = {},
  ) {}

  eq(col: string, value: unknown) {
    this.filters.push({ col, value, op: "eq" });
    return this;
  }
  in(col: string, values: unknown[]) {
    this.filters.push({ col, value: values, op: "in" });
    return this;
  }
  select() {
    return this;
  }

  private async run(): Promise<Result<Row[]>> {
    try {
      const db = getDb();
      if (this.kind === "update" && this.filters.length === 1 && this.filters[0]?.op === "eq" && this.filters[0].col === "id" && this.filters[0].value != null) {
        const id = String(this.filters[0].value);
        await updateDoc(doc(db, this.table, id), { ...this.patch, updated_at: nowIso() });
        return { data: [{ id, ...this.patch }], error: null };
      }
      const rows = await readMatching(this.table, this.filters);
      for (const r of rows) {
        if (this.kind === "delete") await deleteDoc(doc(db, this.table, String(r.id)));
        else await updateDoc(doc(db, this.table, String(r.id)), { ...this.patch, updated_at: nowIso() });
      }
      return { data: rows.map((r) => ({ ...r, ...this.patch })), error: null };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  }

  then<A, B = never>(
    onfulfilled?: ((v: Result<Row[]>) => A | PromiseLike<A>) | null,
    onrejected?: ((r: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/** Writes are thenable and expose .select()/.single() so callers read back rows. */
class InsertQuery implements PromiseLike<Result<Row[]>> {
  constructor(
    private table: string,
    private rows: Row[],
  ) {}

  select() {
    return this;
  }

  private async run(): Promise<Result<Row[]>> {
    try {
      const db = getDb();
      const saved: Row[] = [];
      for (const row of this.rows) {
        const id = String(row.id ?? uuid());
        const body = { ...row, id, created_at: row.created_at ?? nowIso() };
        await setDoc(doc(db, this.table, id), body, { merge: true });
        saved.push(body);
      }
      return { data: saved, error: null };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  }

  async maybeSingle(): Promise<Result<Row | null>> {
    const { data, error } = await this.run();
    return { data: data[0] ?? null, error };
  }
  async single(): Promise<Result<Row>> {
    const { data, error } = await this.run();
    return { data: data[0] ?? null, error };
  }
  then<A, B = never>(
    onfulfilled?: ((v: Result<Row[]>) => A | PromiseLike<A>) | null,
    onrejected?: ((r: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class Table {
  constructor(private table: string) {}

  select(_cols?: string) {
    return new SelectQuery(this.table);
  }

  insert(input: Row | Row[]) {
    return new InsertQuery(this.table, Array.isArray(input) ? input : [input]);
  }

  upsert(input: Row | Row[], opts?: { onConflict?: string }) {
    const key = opts?.onConflict;
    const rows = (Array.isArray(input) ? input : [input]).map((row) =>
      key && row[key] != null ? { ...row, id: String(row[key]) } : row,
    );
    return this.insert(rows);
  }


  update(patch: Row) {
    return new WriteQuery(this.table, "update", patch);
  }

  delete() {
    return new WriteQuery(this.table, "delete");
  }
}

export const fdb = {
  from: (table: string) => new Table(table),
};

/**
 * Live collection listener — fires whenever anything in the collection changes,
 * so screens update without a page refresh. Returns an unsubscribe function.
 */
export function watchTable(table: string, onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  try {
    return onSnapshot(
      collection(getDb(), table),
      () => onChange(),
      () => {
        /* a dropped listener must never break the page */
      },
    );
  } catch {
    return () => {};
  }
}

/** Deletes every document in a collection, 400 at a time. Returns the count. */
export async function purgeTable(table: string) {
  const db = getDb();
  let removed = 0;
  for (;;) {
    const snap = await getDocs(collection(db, table));
    if (snap.empty) break;
    const docs = snap.docs.slice(0, 400);
    const batch = writeBatch(db);
    for (const d of docs) batch.delete(d.ref);
    await batch.commit();
    removed += docs.length;
    if (snap.docs.length <= docs.length) break;
  }
  return removed;
}

export { uuid, nowIso };
