import { createClient } from "@supabase/supabase-js";
import { escapeSearch, matchesDraft, payload } from "./domain";
import type { Draft, RequestRow, Status } from "./domain";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;
export const pageSize = 20;
const columns =
  "id,user_id,title,description,category,status,created_at,updated_at";
function db() {
  if (!supabase) throw new Error("Missing configuration");
  return supabase;
}
export async function listRequests(
  search: string,
  status: Status | "",
  page: number,
  signal: AbortSignal,
) {
  let query = db()
    .from("requests")
    .select(columns, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (search.trim())
    query = query.ilike("title", `%${escapeSearch(search.trim())}%`);
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query
    .range(page * pageSize, (page + 1) * pageSize - 1)
    .abortSignal(signal);
  if (error) throw error;
  return { rows: (data ?? []) as RequestRow[], count: count ?? 0 };
}
export async function getRequest(id: string) {
  const { data, error } = await db()
    .from("requests")
    .select(columns)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as RequestRow | null;
}
export class CreateConflict extends Error {
  constructor(public readonly row: RequestRow) {
    super("create-conflict");
  }
}
export async function createRequest(id: string, draft: Draft) {
  const { data, error } = await db()
    .from("requests")
    .insert({ id, ...payload(draft) })
    .select(columns)
    .single();
  if (!error) return data as RequestRow;
  if (error.code === "23505") {
    const existing = await getRequest(id);
    if (existing && matchesDraft(existing, draft)) return existing;
    if (existing) throw new CreateConflict(existing);
  }
  throw error;
}
export async function updateRequest(
  row: RequestRow,
  draft: Draft,
  status: Status,
) {
  const { data, error } = await db()
    .from("requests")
    .update({ ...payload(draft), status })
    .eq("id", row.id)
    .eq("updated_at", row.updated_at)
    .select(columns)
    .maybeSingle();
  if (error) throw error;
  return data as RequestRow | null;
}
