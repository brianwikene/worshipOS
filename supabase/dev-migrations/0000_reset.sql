-- DEV RESET: drop all public tables/types (data loss expected)
BEGIN;

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop views
  FOR r IN (
    SELECT table_schema, table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  ) LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE;', r.table_schema, r.table_name);
  END LOOP;

  -- Drop tables
  FOR r IN (
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ) LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE;', r.table_schema, r.table_name);
  END LOOP;

  -- Drop enums
  FOR r IN (
    SELECT n.nspname AS schema_name, t.typname AS type_name
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype = 'e' AND n.nspname = 'public'
  ) LOOP
    EXECUTE format('DROP TYPE IF EXISTS %I.%I CASCADE;', r.schema_name, r.type_name);
  END LOOP;
END $$;

COMMIT;
