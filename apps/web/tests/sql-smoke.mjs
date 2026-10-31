// Local PostgreSQL-in-WASM checks; not a substitute for live Supabase/Auth tests.
// Run from any directory: node apps/web/tests/sql-smoke.mjs
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL(
    "../../../supabase/migrations/202610300001_requests.sql",
    import.meta.url,
  ),
  "utf8",
);
const accessTests = await readFile(
  new URL("../../../supabase/tests/requests_access.sql", import.meta.url),
  "utf8",
);

async function checkMigration(automaticRls) {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create schema auth;
      create table auth.users (id uuid primary key);
      insert into auth.users (id) values
        ('11111111-1111-4111-8111-111111111111'),
        ('22222222-2222-4222-8222-222222222222');
      create function auth.uid() returns uuid language sql stable
        set search_path = ''
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      -- Reproduce broad existing-project grants; the migration must narrow them.
      alter default privileges in schema public
        grant all on tables to anon, authenticated, service_role;
    `);

    if (automaticRls) {
      // Reproduce an existing Supabase-style enable-RLS DDL event trigger.
      await db.exec(`
        create function public.test_auto_enable_rls() returns event_trigger
        language plpgsql as $$
        declare command record;
        begin
          for command in select * from pg_event_trigger_ddl_commands() loop
            if command.object_type = 'table' and command.schema_name = 'public' then
              execute format('alter table %s enable row level security', command.object_identity);
            end if;
          end loop;
        end;
        $$;
        create event trigger test_auto_enable_rls
          on ddl_command_end when tag in ('CREATE TABLE')
          execute function public.test_auto_enable_rls();
      `);
    }

    await db.exec(migration);
    const results = await db.exec(accessTests);
    assert.ok(
      results.some(({ rows }) =>
        rows?.some(
          ({ result }) =>
            typeof result === "string" && result.startsWith("PASS:"),
        ),
      ),
      "SQL assertions did not finish",
    );

    const {
      rows: [state],
    } = await db.query(`
      select
        (select relrowsecurity from pg_class where oid = 'public.requests'::regclass) as rls,
        (select count(*)::int from public.requests) as remaining_rows,
        (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'requests') as policies,
        has_table_privilege('authenticated', 'public.requests', 'INSERT') as broad_insert,
        has_table_privilege('authenticated', 'public.requests', 'UPDATE') as broad_update,
        has_table_privilege('authenticated', 'public.requests', 'DELETE') as delete_allowed,
        has_table_privilege('anon', 'public.requests', 'SELECT') as anon_select,
        has_schema_privilege('authenticated', 'ld_latte_private', 'USAGE') as private_schema_visible,
        has_function_privilege('authenticated', 'ld_latte_private.prepare_request()', 'EXECUTE') as trigger_callable;
    `);
    assert.deepEqual(state, {
      rls: true,
      remaining_rows: 0,
      policies: 3,
      broad_insert: false,
      broad_update: false,
      delete_allowed: false,
      anon_select: false,
      private_schema_visible: false,
      trigger_callable: false,
    });
    console.log(
      `PASS: local PostgreSQL migration, grants, constraints, A/B/anon, rollback (automatic RLS ${automaticRls ? "on" : "off"})`,
    );
  } finally {
    await db.close();
  }
}

await checkMigration(false);
await checkMigration(true);
