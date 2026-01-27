


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "drizzle";


ALTER SCHEMA "drizzle" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role_type" AS ENUM (
    'admin',
    'editor',
    'viewer',
    'volunteer'
);


ALTER TYPE "public"."app_role_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_deactivate_family_member"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$

BEGIN

  -- If end_date is set and is in the past, set is_active to false

  IF NEW.end_date IS NOT NULL AND NEW.end_date <= CURRENT_DATE THEN

    NEW.is_active := false;

  END IF;



  RETURN NEW;

END;

$$;


ALTER FUNCTION "public"."auto_deactivate_family_member"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_deactivate_family_member"() IS 'Automatically sets is_active=false when end_date passes';



CREATE OR REPLACE FUNCTION "public"."complete_service_instance"("p_service_instance_id" "uuid", "p_completed_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Update service status
  UPDATE service_instances
  SET
    status = 'completed',
    completed_at = now(),
    completed_by = p_completed_by,
    updated_at = now(),
    updated_by = p_completed_by
  WHERE id = p_service_instance_id
    AND status IN ('scheduled', 'locked');

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Mark all pending songs as performed (unless explicitly skipped)
  UPDATE service_instance_songs
  SET
    was_performed = COALESCE(was_performed, true),
    status = CASE
      WHEN status = 'planned' THEN 'performed'
      ELSE status
    END
  WHERE service_instance_id = p_service_instance_id
    AND status NOT IN ('skipped', 'substituted');

  -- Mark all sections as completed
  UPDATE service_instance_sections
  SET
    status = CASE
      WHEN status IN ('pending', 'draft', 'ready', 'approved') THEN 'completed'
      ELSE status
    END
  WHERE service_instance_id = p_service_instance_id;

  -- Log completion
  INSERT INTO service_audit_log (
    church_id, table_name, record_id, action,
    new_values, changed_by
  )
  SELECT
    church_id, 'service_instances', id, 'update',
    jsonb_build_object('status', 'completed', 'completed_at', now()),
    p_completed_by
  FROM service_instances
  WHERE id = p_service_instance_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."complete_service_instance"("p_service_instance_id" "uuid", "p_completed_by" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."complete_service_instance"("p_service_instance_id" "uuid", "p_completed_by" "uuid") IS 'Mark a service as completed and finalize all song/section statuses.';



CREATE OR REPLACE FUNCTION "public"."compute_display_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Use goes_by if set, otherwise first_name
  -- Concatenate with last_name
  NEW.display_name := TRIM(
    COALESCE(NULLIF(NEW.goes_by, ''), NEW.first_name, '') ||
    CASE
      WHEN COALESCE(NEW.last_name, '') <> ''
      THEN ' ' || NEW.last_name
      ELSE ''
    END
  );

  -- Fallback to existing display_name if result is empty
  IF NEW.display_name = '' OR NEW.display_name IS NULL THEN
    NEW.display_name := COALESCE(OLD.display_name, 'Unknown');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."compute_display_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."copy_service_to_date"("p_source_instance_id" "uuid", "p_target_date" "date", "p_target_time" time without time zone, "p_org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_source_service record;
  v_target_group_id uuid;
  v_target_instance_id uuid;
  v_context_id uuid;
  v_campus_id uuid;
  v_copied_assignments int := 0;
  v_copied_songs int := 0;
  v_copied_segments int := 0;
BEGIN
  -- Get source service info
  SELECT si.*, sg.context_id, sg.name as group_name
  INTO v_source_service
  FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  WHERE si.id = p_source_instance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source service not found';
  END IF;

  -- Get or create target service group
  INSERT INTO service_groups (org_id, group_date, name, context_id)
  VALUES (p_org_id, p_target_date, v_source_service.group_name, v_source_service.context_id)
  ON CONFLICT (org_id, group_date, name) DO UPDATE SET org_id = EXCLUDED.org_id
  RETURNING id INTO v_target_group_id;

  -- Get or create target service instance
  INSERT INTO service_instances (service_group_id, service_time, campus_id)
  VALUES (v_target_group_id, p_target_time, v_source_service.campus_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_target_instance_id;

  IF v_target_instance_id IS NULL THEN
    SELECT id INTO v_target_instance_id
    FROM service_instances
    WHERE service_group_id = v_target_group_id AND service_time = p_target_time;
  END IF;

  -- Copy assignments (only the roles, not the specific people)
  INSERT INTO service_assignments (org_id, service_instance_id, role_id, person_id, status, is_lead, notes)
  SELECT
    p_org_id,
    v_target_instance_id,
    role_id,
    NULL, -- Don't copy the person, just the slot
    'pending',
    is_lead,
    notes
  FROM service_assignments
  WHERE service_instance_id = p_source_instance_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_copied_assignments = ROW_COUNT;

  -- Copy songs
  INSERT INTO service_instance_songs (service_instance_id, song_id, display_order, key, notes)
  SELECT
    v_target_instance_id,
    song_id,
    display_order,
    key,
    notes
  FROM service_instance_songs
  WHERE service_instance_id = p_source_instance_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_copied_songs = ROW_COUNT;

  -- Copy segments
  INSERT INTO service_segments (org_id, service_instance_id, name, segment_type, start_time, duration_minutes, display_order, notes)
  SELECT
    p_org_id,
    v_target_instance_id,
    name,
    segment_type,
    start_time,
    duration_minutes,
    display_order,
    notes
  FROM service_segments
  WHERE service_instance_id = p_source_instance_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_copied_segments = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'source_instance_id', p_source_instance_id,
    'target_instance_id', v_target_instance_id,
    'target_date', p_target_date,
    'target_time', p_target_time,
    'copied_assignments', v_copied_assignments,
    'copied_songs', v_copied_songs,
    'copied_segments', v_copied_segments
  );
END;
$$;


ALTER FUNCTION "public"."copy_service_to_date"("p_source_instance_id" "uuid", "p_target_date" "date", "p_target_time" time without time zone, "p_org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."copy_service_to_date"("p_source_instance_id" "uuid", "p_target_date" "date", "p_target_time" time without time zone, "p_org_id" "uuid") IS 'Copy service structure (roles, songs, segments) to a new date for easy week-to-week planning';



CREATE OR REPLACE FUNCTION "public"."get_checkable_children"("p_family_id" "uuid") RETURNS TABLE("person_id" "uuid", "display_name" "text", "relationship" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$

BEGIN

  RETURN QUERY

  SELECT

    p.id,

    p.display_name,

    fm.relationship

  FROM family_members fm

  JOIN people p ON p.id = fm.person_id

  WHERE fm.family_id = p_family_id

    AND fm.is_active = true

    AND fm.relationship IN ('child', 'foster_child')

    AND (fm.end_date IS NULL OR fm.end_date > CURRENT_DATE)

  ORDER BY p.display_name;

END;

$$;


ALTER FUNCTION "public"."get_checkable_children"("p_family_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_checkable_children"("p_family_id" "uuid") IS 'Returns only active children eligible for check-in';



CREATE OR REPLACE FUNCTION "public"."get_family_roster"("p_family_id" "uuid") RETURNS TABLE("person_id" "uuid", "display_name" "text", "relationship" "text", "is_active" boolean, "is_temporary" boolean, "start_date" "date", "end_date" "date", "is_primary_contact" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$

BEGIN

  RETURN QUERY

  SELECT

    p.id,

    p.display_name,

    fm.relationship,

    fm.is_active,

    fm.is_temporary,

    fm.start_date,

    fm.end_date,

    fm.is_primary_contact

  FROM family_members fm

  JOIN people p ON p.id = fm.person_id

  WHERE fm.family_id = p_family_id

  ORDER BY

    CASE fm.relationship

      WHEN 'parent' THEN 1

      WHEN 'guardian' THEN 2

      WHEN 'spouse' THEN 3

      WHEN 'child' THEN 4

      WHEN 'foster_child' THEN 5

      ELSE 6

    END,

    p.display_name;

END;

$$;


ALTER FUNCTION "public"."get_family_roster"("p_family_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_family_roster"("p_family_id" "uuid") IS 'Returns all family members with relationship details, ordered by relationship type';



CREATE OR REPLACE FUNCTION "public"."get_service_roster"("p_service_id" integer) RETURNS TABLE("role_name" "text", "person_name" "text", "person_status" "text", "role_id" integer, "min_needed" integer, "currently_filled" bigint, "is_filled" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$

BEGIN

    RETURN QUERY

    WITH role_counts AS (

        -- Step 1: Calculate how many people are currently assigned to each role

        -- We need this to compare against min_needed later

        SELECT

            a.role_id,

            COUNT(a.person_id) as assigned_count

        FROM service_assignments a

        WHERE a.service_id = p_service_id

        AND a.deleted_at IS NULL

        GROUP BY a.role_id

    )

    SELECT

        r.name AS role_name,

        -- If person is NULL, return 'VACANT' for clarity in UI logic

        COALESCE(p.first_name || ' ' || p.last_name, NULL) AS person_name,

        a.status AS person_status, -- e.g., 'CONFIRMED', 'PENDING', 'DECLINED'

        r.id AS role_id,

        req.min_needed,

        COALESCE(rc.assigned_count, 0) AS currently_filled,



        -- THE FIX: The Logic Check

        -- A role is only "Filled" if the assigned count >= min_needed

        (COALESCE(rc.assigned_count, 0) >= req.min_needed) AS is_filled



    FROM service_requirements req

    JOIN roles r ON req.role_id = r.id



    -- We LEFT JOIN assignments so we still get a row even if nobody is scheduled

    LEFT JOIN service_assignments a ON a.role_id = r.id AND a.service_id = p_service_id

    LEFT JOIN people p ON a.person_id = p.id

    LEFT JOIN role_counts rc ON rc.role_id = r.id



    WHERE req.service_id = p_service_id



    -- Sorting: Put unfilled critical roles at the top so the admin sees them first

    ORDER BY

        (COALESCE(rc.assigned_count, 0) >= req.min_needed) ASC, -- FALSE (Unfilled) comes first

        r.name ASC;



END;

$$;


ALTER FUNCTION "public"."get_service_roster"("p_service_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_service_roster"("p_service_instance_id" "uuid") RETURNS TABLE("ministry_area" "text", "role_name" "text", "role_id" "uuid", "person_id" "uuid", "person_name" "text", "status" "text", "is_lead" boolean, "is_required" boolean, "notes" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.ministry_area,
    r.name as role_name,
    r.id as role_id,
    sa.person_id,
    p.display_name as person_name,
    COALESCE(sa.status, 'unfilled') as status,
    COALESCE(sa.is_lead, false) as is_lead,
    (srr.min_needed > 0) as is_required, -- Calculate from min_needed
    sa.notes
  FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  JOIN service_role_requirements srr ON srr.context_id = sg.context_id
  JOIN roles r ON r.id = srr.role_id
  LEFT JOIN service_assignments sa ON sa.service_instance_id = si.id AND sa.role_id = r.id
  LEFT JOIN people p ON p.id = sa.person_id
  WHERE si.id = p_service_instance_id
  ORDER BY
    r.ministry_area,
    srr.display_order,
    sa.is_lead DESC NULLS LAST,
    r.name;
END;
$$;


ALTER FUNCTION "public"."get_service_roster"("p_service_instance_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_variant_active"("p_variant_id" "uuid", "p_check_date" "date" DEFAULT CURRENT_DATE) RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$

DECLARE

  v_dates DATERANGE;

  v_tags TEXT[];

BEGIN

  SELECT active_dates, context_tags

  INTO v_dates, v_tags

  FROM song_variants

  WHERE id = p_variant_id;



  -- If no date range, always active

  IF v_dates IS NULL THEN

    RETURN TRUE;

  END IF;



  -- Check if current date is in range

  RETURN v_dates @> p_check_date;

END;

$$;


ALTER FUNCTION "public"."is_variant_active"("p_variant_id" "uuid", "p_check_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_variant_active"("p_variant_id" "uuid", "p_check_date" "date") IS 'Check if a variant is currently active based on its active_dates range';



CREATE OR REPLACE FUNCTION "public"."lock_service_instance"("p_service_instance_id" "uuid", "p_locked_by" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status
  FROM service_instances
  WHERE id = p_service_instance_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Service instance not found: %', p_service_instance_id;
  END IF;

  IF v_current_status NOT IN ('draft', 'scheduled') THEN
    RAISE EXCEPTION 'Cannot lock service with status: %', v_current_status;
  END IF;

  UPDATE service_instances
  SET
    status = 'locked',
    locked_at = now(),
    locked_by = p_locked_by,
    lock_reason = p_reason,
    updated_at = now(),
    updated_by = p_locked_by
  WHERE id = p_service_instance_id;

  -- Log the lock action
  INSERT INTO service_audit_log (
    church_id, table_name, record_id, action,
    new_values, change_reason, changed_by
  )
  SELECT
    church_id, 'service_instances', id, 'lock',
    jsonb_build_object('status', 'locked', 'locked_at', now()),
    p_reason, p_locked_by
  FROM service_instances
  WHERE id = p_service_instance_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."lock_service_instance"("p_service_instance_id" "uuid", "p_locked_by" "uuid", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."lock_service_instance"("p_service_instance_id" "uuid", "p_locked_by" "uuid", "p_reason" "text") IS 'Lock a service to prevent direct edits. Only amendments allowed after locking.';



CREATE OR REPLACE FUNCTION "public"."record_song_amendment"("p_church_id" "uuid", "p_service_instance_id" "uuid", "p_song_instance_id" "uuid", "p_amendment_type" "text", "p_actual_song_id" "uuid" DEFAULT NULL::"uuid", "p_reason" "text" DEFAULT NULL::"text", "p_recorded_by" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_amendment_id UUID;
  v_original RECORD;
  v_actual_song RECORD;
BEGIN
  -- Get original song details
  SELECT
    sis.id,
    sis.song_id,
    s.title,
    s.ccli_number,
    sis.key
  INTO v_original
  FROM service_instance_songs sis
  JOIN songs s ON s.id = sis.song_id
  WHERE sis.id = p_song_instance_id;

  IF v_original IS NULL THEN
    RAISE EXCEPTION 'Song instance not found: %', p_song_instance_id;
  END IF;

  -- Get actual song details if substitution
  IF p_actual_song_id IS NOT NULL THEN
    SELECT title, ccli_number
    INTO v_actual_song
    FROM songs
    WHERE id = p_actual_song_id;
  END IF;

  -- Create amendment record
  INSERT INTO service_amendments (
    church_id,
    service_instance_id,
    amendment_type,
    reference_table,
    reference_id,
    planned_value,
    actual_value,
    reason,
    ccli_relevant,
    ccli_song_number,
    recorded_by
  ) VALUES (
    p_church_id,
    p_service_instance_id,
    p_amendment_type,
    'service_instance_songs',
    p_song_instance_id,
    jsonb_build_object(
      'song_id', v_original.song_id,
      'song_title', v_original.title,
      'ccli_number', v_original.ccli_number,
      'key', v_original.key
    ),
    CASE
      WHEN p_amendment_type = 'song_skip' THEN
        jsonb_build_object('skipped', true)
      WHEN p_amendment_type = 'song_change' AND p_actual_song_id IS NOT NULL THEN
        jsonb_build_object(
          'song_id', p_actual_song_id,
          'song_title', v_actual_song.title,
          'ccli_number', v_actual_song.ccli_number
        )
      ELSE '{}'::jsonb
    END,
    p_reason,
    true,
    COALESCE(v_actual_song.ccli_number, v_original.ccli_number),
    p_recorded_by
  )
  RETURNING id INTO v_amendment_id;

  -- Update the song instance status
  UPDATE service_instance_songs
  SET
    status = CASE
      WHEN p_amendment_type = 'song_skip' THEN 'skipped'
      WHEN p_amendment_type = 'song_change' THEN 'substituted'
      ELSE status
    END,
    was_performed = (p_amendment_type != 'song_skip'),
    updated_at = now(),
    updated_by = p_recorded_by
  WHERE id = p_song_instance_id;

  RETURN v_amendment_id;
END;
$$;


ALTER FUNCTION "public"."record_song_amendment"("p_church_id" "uuid", "p_service_instance_id" "uuid", "p_song_instance_id" "uuid", "p_amendment_type" "text", "p_actual_song_id" "uuid", "p_reason" "text", "p_recorded_by" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_song_amendment"("p_church_id" "uuid", "p_service_instance_id" "uuid", "p_song_instance_id" "uuid", "p_amendment_type" "text", "p_actual_song_id" "uuid", "p_reason" "text", "p_recorded_by" "uuid") IS 'Record when a song was skipped or substituted. Maintains planned/actual integrity for CCLI.';



CREATE OR REPLACE FUNCTION "public"."save_service_as_template"("p_service_instance_id" "uuid", "p_template_name" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_service record;
  v_segments jsonb;
  v_new_template_id uuid;
BEGIN
  -- Get service info
  SELECT si.*, sg.context_id, sg.group_date
  INTO v_service
  FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  WHERE si.id = p_service_instance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service instance not found: %', p_service_instance_id;
  END IF;

  -- Build structure from existing segments
  SELECT jsonb_build_object(
    'segments', jsonb_agg(
      jsonb_build_object(
        'order', display_order,
        'name', name,
        'type', segment_type,
        'relative_start_minutes',
          EXTRACT(EPOCH FROM (start_time - v_service.service_time))/60,
        'duration_minutes', duration_minutes,
        'notes', notes
      ) ORDER BY display_order
    )
  )
  INTO v_segments
  FROM service_segments
  WHERE service_instance_id = p_service_instance_id;

  -- Create new template
  INSERT INTO service_templates (
    org_id,
    name,
    description,
    context_id,
    default_start_time,
    structure
  )
  VALUES (
    v_service.org_id,
    p_template_name,
    p_description,
    v_service.context_id,
    v_service.service_time,
    v_segments
  )
  RETURNING id INTO v_new_template_id;

  RETURN v_new_template_id;
END;
$$;


ALTER FUNCTION "public"."save_service_as_template"("p_service_instance_id" "uuid", "p_template_name" "text", "p_description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."save_service_as_template"("p_service_instance_id" "uuid", "p_template_name" "text", "p_description" "text") IS 'Create a new template from an existing service';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
    "id" integer NOT NULL,
    "hash" "text" NOT NULL,
    "created_at" bigint
);


ALTER TABLE "drizzle"."__drizzle_migrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "drizzle"."__drizzle_migrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "drizzle"."__drizzle_migrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "drizzle"."__drizzle_migrations_id_seq" OWNED BY "drizzle"."__drizzle_migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "person_id" "uuid",
    "street" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "country" "text" DEFAULT 'US'::"text",
    "label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "line1" "text",
    "line2" "text",
    "region" "text",
    "lat" double precision,
    "lng" double precision,
    "timezone" "text",
    "campus_id" "uuid",
    "family_id" "uuid"
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_users" (
    "id" "uuid" NOT NULL,
    "person_id" "uuid",
    "church_id" "uuid",
    "role" "public"."app_role_type" DEFAULT 'volunteer'::"public"."app_role_type",
    "can_view_giving" boolean DEFAULT false,
    "can_manage_schedules" boolean DEFAULT false,
    "can_manage_people" boolean DEFAULT false,
    "can_view_care_notes" boolean DEFAULT false
);


ALTER TABLE "public"."app_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "response_method" "text",
    "responded_at" timestamp with time zone,
    "message_body" "text",
    "delivery_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assignment_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."assignment_notifications" IS 'Tracks scheduling notifications sent to volunteers';



COMMENT ON COLUMN "public"."assignment_notifications"."response_method" IS 'How they responded: SMS Y/N, web click, etc';



CREATE TABLE IF NOT EXISTS "public"."campuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "address_id" "uuid"
);


ALTER TABLE "public"."campuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."care_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "title" "text",
    "status" "text" DEFAULT 'active'::"text",
    "sensitivity_level" "text" DEFAULT 'standard'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source_signal_id" "uuid",
    "assigned_to" "uuid"
);

ALTER TABLE ONLY "public"."care_cases" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."care_cases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."care_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "visibility_level" "text" DEFAULT 'pastoral'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."care_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_memberships" (
    "church_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."church_memberships" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."churches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."churches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "value" "text" NOT NULL,
    "label" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contexts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."contexts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."families" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "primary_address_id" "uuid",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."families" OWNER TO "postgres";


COMMENT ON TABLE "public"."families" IS 'Represents households/family units';



COMMENT ON COLUMN "public"."families"."name" IS 'Display name for the family unit';



COMMENT ON COLUMN "public"."families"."primary_address_id" IS 'Optional link to primary family address';



CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "family_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "relationship" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "is_temporary" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_primary_contact" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_dates" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date")))
);


ALTER TABLE "public"."family_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."family_members" IS 'Links people to families with relationship context';



COMMENT ON COLUMN "public"."family_members"."relationship" IS 'parent, child, foster_child, guardian, spouse, etc.';



COMMENT ON COLUMN "public"."family_members"."start_date" IS 'When person joined family (useful for foster care)';



COMMENT ON COLUMN "public"."family_members"."end_date" IS 'When placement ended (triggers is_active=false)';



COMMENT ON COLUMN "public"."family_members"."is_temporary" IS 'True for foster/temporary placements';



COMMENT ON COLUMN "public"."family_members"."is_primary_contact" IS 'Primary contact for family matters';



CREATE TABLE IF NOT EXISTS "public"."identity_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "person_a_id" "uuid" NOT NULL,
    "person_b_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'suggested'::character varying NOT NULL,
    "confidence_score" numeric(5,2) NOT NULL,
    "match_reasons" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "detected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "detected_by" character varying(50) DEFAULT 'system'::character varying NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_notes" "text",
    "suppressed_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "identity_links_ordered" CHECK (("person_a_id" < "person_b_id")),
    CONSTRAINT "identity_links_status" CHECK ((("status")::"text" = ANY (ARRAY[('suggested'::character varying)::"text", ('confirmed'::character varying)::"text", ('not_match'::character varying)::"text", ('merged'::character varying)::"text"])))
);


ALTER TABLE "public"."identity_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merge_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "survivor_id" "uuid" NOT NULL,
    "merged_ids" "uuid"[] NOT NULL,
    "merged_snapshots" "jsonb" NOT NULL,
    "field_resolutions" "jsonb" NOT NULL,
    "transferred_records" "jsonb" DEFAULT '{}'::"jsonb",
    "performed_by" "uuid" NOT NULL,
    "performed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text",
    "undone_at" timestamp with time zone,
    "undone_by" "uuid",
    "undo_reason" "text",
    "identity_link_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."merge_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ministry_areas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "color" "text",
    "icon" "text",
    "display_order" integer DEFAULT 0,
    "parent_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."ministry_areas" OWNER TO "postgres";


COMMENT ON TABLE "public"."ministry_areas" IS 'Ministry divisions within a church. Used for section ownership, role categorization, and future permission scoping.';



COMMENT ON COLUMN "public"."ministry_areas"."name" IS 'Lowercase identifier: worship, pastoral, kids, youth, hospitality, tech, admin';



COMMENT ON COLUMN "public"."ministry_areas"."parent_id" IS 'Optional hierarchy: e.g., "av" under "tech"';



COMMENT ON COLUMN "public"."ministry_areas"."archived_at" IS 'Soft delete - never remove data';



CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "notify_via_email" boolean DEFAULT true,
    "notify_via_sms" boolean DEFAULT false,
    "email" "text",
    "phone_number" "text",
    "auto_accept_roles" "text"[],
    "require_confirmation" boolean DEFAULT true,
    "reminder_days_before" integer DEFAULT 3,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_preferences" IS 'How each person wants to be notified about scheduling';



COMMENT ON COLUMN "public"."notification_preferences"."phone_number" IS 'For SMS: E.164 format +12065551234';



COMMENT ON COLUMN "public"."notification_preferences"."auto_accept_roles" IS 'Role IDs that should auto-confirm without prompt';



CREATE TABLE IF NOT EXISTS "public"."people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "alias_type" character varying(20) NOT NULL,
    "first_name" character varying(100),
    "last_name" character varying(100),
    "full_name" character varying(200),
    "source" character varying(100) DEFAULT 'manual'::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "person_aliases_type" CHECK ((("alias_type")::"text" = ANY (ARRAY[('legal'::character varying)::"text", ('preferred'::character varying)::"text", ('maiden'::character varying)::"text", ('nickname'::character varying)::"text", ('typo'::character varying)::"text", ('merged'::character varying)::"text"])))
);


ALTER TABLE "public"."person_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_role_capabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "proficiency" smallint DEFAULT 3 NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "is_approved" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "verified_by_person_id" "uuid",
    "verified_at" timestamp with time zone,
    CONSTRAINT "chk_prc_proficiency_range" CHECK ((("proficiency" IS NULL) OR (("proficiency" >= 1) AND ("proficiency" <= 5))))
);


ALTER TABLE "public"."person_role_capabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "load_weight" integer DEFAULT 10 NOT NULL,
    "ministry_area" "text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "body_parts" "text"[] DEFAULT '{}'::"text"[],
    "team_id" "uuid",
    CONSTRAINT "chk_roles_load_weight_positive" CHECK (("load_weight" > 0))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."roles"."body_parts" IS 'Body parts required for this role (hands, feet, voice, eyes) - used for scheduling conflict detection';



CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "id" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."schema_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_amendments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "service_instance_id" "uuid" NOT NULL,
    "amendment_type" "text" NOT NULL,
    "reference_table" "text",
    "reference_id" "uuid",
    "planned_value" "jsonb",
    "actual_value" "jsonb",
    "reason" "text",
    "notes" "text",
    "ccli_relevant" boolean DEFAULT false,
    "ccli_song_number" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recorded_by" "uuid" NOT NULL,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    CONSTRAINT "valid_amendment_type" CHECK (("amendment_type" = ANY (ARRAY['song_change'::"text", 'song_skip'::"text", 'song_add'::"text", 'section_skip'::"text", 'section_add'::"text", 'section_reorder'::"text", 'timing_change'::"text", 'personnel_change'::"text", 'order_change'::"text", 'general_note'::"text"])))
);


ALTER TABLE "public"."service_amendments" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_amendments" IS 'Records differences between planned and actual service execution. Core to "system never lies" philosophy.';



COMMENT ON COLUMN "public"."service_amendments"."ccli_relevant" IS 'Flag for amendments affecting CCLI reporting (song changes/skips).';



COMMENT ON COLUMN "public"."service_amendments"."recorded_by" IS 'RESTRICT delete - we must always know who recorded an amendment.';



CREATE TABLE IF NOT EXISTS "public"."service_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "service_instance_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "person_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "is_lead" boolean DEFAULT false,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid",
    "confirmed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_assignment_status_valid" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'declined'::"text", 'tentative'::"text"])))
);


ALTER TABLE "public"."service_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "changed_fields" "text"[],
    "change_reason" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "uuid",
    "is_amendment" boolean DEFAULT false,
    "amendment_id" "uuid",
    CONSTRAINT "valid_audit_action" CHECK (("action" = ANY (ARRAY['insert'::"text", 'update'::"text", 'delete'::"text", 'lock'::"text", 'unlock'::"text", 'archive'::"text", 'restore'::"text"])))
);


ALTER TABLE "public"."service_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_audit_log" IS 'Complete audit trail for all service-related changes. Supports "system never lies" philosophy.';



CREATE TABLE IF NOT EXISTS "public"."service_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "group_date" "date" NOT NULL,
    "name" "text" NOT NULL,
    "context_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_instance_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "service_instance_id" "uuid" NOT NULL,
    "template_section_id" "uuid",
    "display_order" integer NOT NULL,
    "name" "text" NOT NULL,
    "section_type" "text" NOT NULL,
    "ministry_area_id" "uuid",
    "planned_start_time" time without time zone,
    "planned_duration_minutes" integer,
    "actual_start_time" time without time zone,
    "actual_duration_minutes" integer,
    "content" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "marked_ready_at" timestamp with time zone,
    "marked_ready_by" "uuid",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "valid_instance_section_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'draft'::"text", 'ready'::"text", 'approved'::"text", 'completed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."service_instance_sections" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_instance_sections" IS 'Actual sections for a specific service instance. Links to template but allows overrides.';



COMMENT ON COLUMN "public"."service_instance_sections"."actual_start_time" IS 'Filled after service to record what actually happened (for reporting/care insights).';



CREATE TABLE IF NOT EXISTS "public"."service_instance_songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_instance_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "display_order" integer NOT NULL,
    "key" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "arrangement_id" "uuid",
    "transpose_steps" integer DEFAULT 0,
    "custom_structure" "jsonb",
    "section_id" "uuid",
    "status" "text" DEFAULT 'planned'::"text",
    "was_performed" boolean,
    "actual_key" "text",
    "ccli_reported" boolean DEFAULT false,
    "ccli_report_date" "date",
    "created_by" "uuid",
    "updated_by" "uuid",
    "church_id" "uuid" NOT NULL
);


ALTER TABLE "public"."service_instance_songs" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_instance_songs" IS 'Songs included in each service instance (the setlist)';



COMMENT ON COLUMN "public"."service_instance_songs"."key" IS 'Override key for this service (e.g., transpose from G to C)';



COMMENT ON COLUMN "public"."service_instance_songs"."arrangement_id" IS 'Arrangement selection for this service slot';



COMMENT ON COLUMN "public"."service_instance_songs"."transpose_steps" IS 'Transpose steps relative to arrangement key';



COMMENT ON COLUMN "public"."service_instance_songs"."custom_structure" IS 'Per-service overrides to arrangement structure';



COMMENT ON COLUMN "public"."service_instance_songs"."section_id" IS 'Links song to a specific section (e.g., opening worship vs closing).';



COMMENT ON COLUMN "public"."service_instance_songs"."was_performed" IS 'NULL = pending, true = performed, false = skipped. Set after service.';



COMMENT ON COLUMN "public"."service_instance_songs"."actual_key" IS 'Key actually used if different from planned.';



COMMENT ON COLUMN "public"."service_instance_songs"."ccli_reported" IS 'Has this song usage been included in CCLI report?';



CREATE TABLE IF NOT EXISTS "public"."service_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "service_date" "date" NOT NULL,
    "service_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_group_id" "uuid",
    "campus_id" "uuid",
    "service_type_id" "uuid",
    "template_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text",
    "locked_at" timestamp with time zone,
    "locked_by" "uuid",
    "lock_reason" "text",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "chk_service_instance_status" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'locked'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."service_instances" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_instances"."status" IS 'Workflow: draft (editable) -> scheduled (planned) -> locked (finalized) -> completed (done)';



COMMENT ON COLUMN "public"."service_instances"."locked_at" IS 'Once locked, direct edits are prevented. Only amendments can record changes.';



COMMENT ON COLUMN "public"."service_instances"."archived_at" IS 'Soft delete - services are never truly deleted for historical accuracy.';



CREATE TABLE IF NOT EXISTS "public"."service_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "service_instance_id" "uuid" NOT NULL,
    "sort_order" integer NOT NULL,
    "item_type" "text" NOT NULL,
    "song_variant_id" "uuid",
    "notes" "text",
    "title" "text",
    "duration_seconds" integer,
    "role_id" "uuid",
    "person_id" "uuid",
    "related_item_id" "uuid",
    CONSTRAINT "chk_service_items_sort_order_positive" CHECK (("sort_order" > 0)),
    CONSTRAINT "service_items_song_variant_required_for_song" CHECK (((("item_type" = 'song'::"text") AND ("song_variant_id" IS NOT NULL)) OR (("item_type" <> 'song'::"text") AND ("song_variant_id" IS NULL))))
);


ALTER TABLE "public"."service_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_role_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "context_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "min_needed" integer DEFAULT 1 NOT NULL,
    "max_needed" integer,
    "display_order" integer DEFAULT 0
);


ALTER TABLE "public"."service_role_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_team_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "service_instance_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL
);


ALTER TABLE "public"."service_team_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "context_id" "uuid",
    "default_start_time" time without time zone,
    "default_duration_minutes" integer DEFAULT 90,
    "structure" "jsonb",
    "is_active" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "version" integer DEFAULT 1,
    "parent_template_id" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."service_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_templates" IS 'The reusable patterns/stamps for services';



COMMENT ON COLUMN "public"."service_templates"."structure" IS 'JSON structure of segments, roles, and details';



COMMENT ON COLUMN "public"."service_templates"."archived_at" IS 'Soft delete timestamp';



COMMENT ON COLUMN "public"."service_templates"."version" IS 'Version number - incremented on significant changes';



COMMENT ON COLUMN "public"."service_templates"."parent_template_id" IS 'If this template was derived from another';



CREATE TABLE IF NOT EXISTS "public"."service_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "context_id" "uuid",
    "recurrence_rule" "jsonb" DEFAULT '{"frequency": "weekly", "day_of_week": ["sunday"]}'::"jsonb" NOT NULL,
    "default_template_id" "uuid",
    "default_times" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "planning_lead_days" integer DEFAULT 14,
    "is_active" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."service_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_types" IS 'Recurring service patterns. Defines when services happen and with what defaults.';



COMMENT ON COLUMN "public"."service_types"."recurrence_rule" IS 'RRULE-like pattern for generating service dates. See JSONB structure in comments.';



COMMENT ON COLUMN "public"."service_types"."default_times" IS 'Array of time slots with optional campus assignments for multi-campus or multi-service days.';



CREATE TABLE IF NOT EXISTS "public"."song_arrangements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "key" "text",
    "bpm" integer,
    "time_signature" "text",
    "structure" "jsonb" NOT NULL,
    "is_default" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."song_arrangements" OWNER TO "postgres";


COMMENT ON TABLE "public"."song_arrangements" IS 'Different arrangements/structures for a single song';



COMMENT ON COLUMN "public"."song_arrangements"."structure" IS 'JSON payload describing section order and repeats';



CREATE TABLE IF NOT EXISTS "public"."song_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "section_type" "text" NOT NULL,
    "section_number" integer,
    "label" "text" NOT NULL,
    "lyrics" "text" NOT NULL,
    "chords" "jsonb",
    "display_order" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "seasonal_tags" "text"[],
    "availability" "text" DEFAULT 'always'::"text",
    CONSTRAINT "song_sections_availability_check" CHECK (("availability" = ANY (ARRAY['always'::"text", 'seasonal'::"text", 'special'::"text"])))
);


ALTER TABLE "public"."song_sections" OWNER TO "postgres";


COMMENT ON TABLE "public"."song_sections" IS 'Individual sections (verses, choruses) of songs with lyrics and chords';



COMMENT ON COLUMN "public"."song_sections"."chords" IS 'JSON: {lines: [{lyrics: "...", chords: [{position: 0, chord: "C"}]}]}';



COMMENT ON COLUMN "public"."song_sections"."seasonal_tags" IS 'Array of tags like [''christmas'', ''easter'', ''baptism''] for seasonal verses';



COMMENT ON COLUMN "public"."song_sections"."availability" IS 'When this section is available: always (year-round), seasonal (tagged periods), special (one-time use)';



CREATE TABLE IF NOT EXISTS "public"."song_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "default_key" "text",
    "tempo" integer,
    "time_signature" "text",
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "variant_type" "text" DEFAULT 'arrangement'::"text",
    "style_description" "text",
    "tempo_modifier" "text",
    "key_modifier" "text",
    "context_tags" "text"[],
    "active_dates" "daterange",
    "notes" "text",
    "is_default" boolean DEFAULT false,
    CONSTRAINT "song_variants_variant_type_check" CHECK (("variant_type" = ANY (ARRAY['style'::"text", 'arrangement'::"text", 'seasonal'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."song_variants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."song_variants"."content" IS 'JSONB structure:

  {

    "flow": [

      {"section_id": "uuid", "repeat": 1, "notes": "optional"},

      {"section_id": "uuid", "repeat": 2}

    ],

    "modifications": {

      "skip_intro": true,

      "extended_bridge": true

    }

  }';



COMMENT ON COLUMN "public"."song_variants"."variant_type" IS 'Type of variant: style (R&B/Gospel), arrangement (structure), seasonal (Christmas), custom';



COMMENT ON COLUMN "public"."song_variants"."style_description" IS 'Human-readable description of musical style: "R&B feel, add Hammond organ, syncopated drums"';



COMMENT ON COLUMN "public"."song_variants"."tempo_modifier" IS 'Relative tempo: "slower", "faster", "more groove", "half-time feel"';



COMMENT ON COLUMN "public"."song_variants"."key_modifier" IS 'How key changed from original: "+2 steps", "down to Am", "capo 3"';



COMMENT ON COLUMN "public"."song_variants"."context_tags" IS 'When to use: [''christmas'', ''easter'', ''baptism'', ''communion'', ''outdoor'']';



COMMENT ON COLUMN "public"."song_variants"."active_dates" IS 'Date range when variant is active (for seasonal use): ''[2024-12-01, 2025-01-06]''';



COMMENT ON COLUMN "public"."song_variants"."notes" IS 'Performance notes or instructions for using this variant';



CREATE TABLE IF NOT EXISTS "public"."songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "ccli_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "artist" "text",
    "key" "text",
    "bpm" integer,
    "notes" "text",
    "source_format" "text" DEFAULT 'plain_text'::"text" NOT NULL,
    "raw_text" "text",
    "parsed_json" "jsonb" DEFAULT "jsonb_build_object"('format', 'plain_text', 'sections', "jsonb_build_array"(), 'warnings', "jsonb_build_array"(), 'generated_at', "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "songs_source_format_check" CHECK (("source_format" = ANY (ARRAY['plain_text'::"text", 'chordpro'::"text"])))
);


ALTER TABLE "public"."songs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."songs"."source_format" IS 'Indicates whether lyrics were entered as plain text or ChordPro';



COMMENT ON COLUMN "public"."songs"."raw_text" IS 'Original user-submitted lyrics/chords text blob';



COMMENT ON COLUMN "public"."songs"."parsed_json" IS 'Server-side parsed representation of lyrics + chords';



COMMENT ON COLUMN "public"."songs"."updated_at" IS 'Auto-managed last update timestamp';



CREATE TABLE IF NOT EXISTS "public"."stage_people_import" (
    "first_name" "text",
    "last_name" "text",
    "goes_by" "text",
    "home_email" "text",
    "mobile_phone" "text",
    "roles" "text",
    "home_street" "text",
    "home_city" "text",
    "home_state" "text",
    "home_postal_code" "text"
);


ALTER TABLE "public"."stage_people_import" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#667eea'::"text",
    "icon" "text" DEFAULT '👥'::"text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON TABLE "public"."teams" IS 'Ministry teams that group related roles (Worship, Hospitality, Kids, Tech, etc.)';



CREATE TABLE IF NOT EXISTS "public"."template_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "display_order" integer NOT NULL,
    "name" "text" NOT NULL,
    "section_type" "text" NOT NULL,
    "relative_start_minutes" integer,
    "estimated_duration_minutes" integer,
    "is_flexible_timing" boolean DEFAULT false,
    "ministry_area_id" "uuid",
    "ownership_config" "jsonb" DEFAULT '{}'::"jsonb",
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "default_content" "jsonb",
    "is_required" boolean DEFAULT true,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "valid_section_type" CHECK (("section_type" = ANY (ARRAY['worship'::"text", 'message'::"text", 'announcement'::"text", 'prayer'::"text", 'offering'::"text", 'communion'::"text", 'baptism'::"text", 'transition'::"text", 'video'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."template_sections" OWNER TO "postgres";


COMMENT ON TABLE "public"."template_sections" IS 'Sections within a service template. ministry_area_id determines ownership for future authorization.';



COMMENT ON COLUMN "public"."template_sections"."ministry_area_id" IS 'Which ministry owns this section. Future auth will use this for edit permissions.';



COMMENT ON COLUMN "public"."template_sections"."ownership_config" IS 'Extensible configuration for future authorization system. Reserved for future use.';



CREATE TABLE IF NOT EXISTS "public"."tend_signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_id" "uuid" NOT NULL,
    "person_id" "uuid",
    "signal_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tend_signals" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "public"."user_links" (
    "church_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_links" OWNER TO "supabase_admin";


CREATE OR REPLACE VIEW "public"."v_ccli_report_v2" WITH ("security_invoker"='true') AS
 SELECT "si"."church_id",
    "sg"."group_date" AS "service_date",
    "si"."service_time",
    "s"."title" AS "song_title",
    "s"."ccli_number",
    COALESCE("sis"."actual_key", "sis"."key", "s"."key") AS "key_performed",
    "sis"."was_performed",
    "sis"."ccli_reported",
    "sis"."ccli_report_date",
    "sa"."amendment_type",
    ("sa"."actual_value" ->> 'song_title'::"text") AS "substituted_with",
    ("sa"."actual_value" ->> 'ccli_number'::"text") AS "substituted_ccli_number"
   FROM (((("public"."service_instance_songs" "sis"
     JOIN "public"."service_instances" "si" ON (("si"."id" = "sis"."service_instance_id")))
     JOIN "public"."service_groups" "sg" ON (("sg"."id" = "si"."service_group_id")))
     JOIN "public"."songs" "s" ON (("s"."id" = "sis"."song_id")))
     LEFT JOIN "public"."service_amendments" "sa" ON ((("sa"."reference_id" = "sis"."id") AND ("sa"."reference_table" = 'service_instance_songs'::"text") AND ("sa"."ccli_relevant" = true))))
  WHERE (("si"."status" = 'completed'::"text") AND (("sis"."was_performed" = true) OR ("sa"."id" IS NOT NULL)));


ALTER VIEW "public"."v_ccli_report_v2" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_ccli_report_v2" IS 'View for CCLI reporting - shows performed songs including substitutions via amendments.';



CREATE OR REPLACE VIEW "public"."v_context_role_requirements" WITH ("security_invoker"='true') AS
 SELECT "c"."id" AS "context_id",
    "c"."name" AS "context_name",
    "r"."id" AS "role_id",
    "r"."name" AS "role_name",
    "r"."ministry_area",
    "srr"."min_needed",
    "srr"."max_needed",
    ("srr"."min_needed" > 0) AS "is_required",
    "srr"."display_order",
        CASE
            WHEN ("srr"."min_needed" > 0) THEN '✓ Required'::"text"
            ELSE 'Optional'::"text"
        END AS "requirement_status"
   FROM (("public"."contexts" "c"
     JOIN "public"."service_role_requirements" "srr" ON (("srr"."context_id" = "c"."id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "srr"."role_id")))
  ORDER BY "c"."name", "r"."ministry_area", "srr"."display_order", "r"."name";


ALTER VIEW "public"."v_context_role_requirements" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_context_role_requirements" IS 'Shows which roles are required vs optional for each service type';



CREATE OR REPLACE VIEW "public"."v_section_ownership" WITH ("security_invoker"='true') AS
 SELECT "ts"."id" AS "template_section_id",
    "st"."name" AS "template_name",
    "ts"."name" AS "section_name",
    "ts"."section_type",
    "ts"."display_order",
    "ma"."id" AS "ministry_area_id",
    "ma"."name" AS "ministry_area",
    "ma"."display_name" AS "ministry_display_name",
    "ts"."is_required",
    "ts"."estimated_duration_minutes"
   FROM (("public"."template_sections" "ts"
     JOIN "public"."service_templates" "st" ON (("st"."id" = "ts"."template_id")))
     LEFT JOIN "public"."ministry_areas" "ma" ON (("ma"."id" = "ts"."ministry_area_id")))
  WHERE (("ts"."is_active" = true) AND ("st"."is_active" = true))
  ORDER BY "st"."name", "ts"."display_order";


ALTER VIEW "public"."v_section_ownership" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_section_ownership" IS 'Shows which ministry area owns each template section - useful for future auth system.';



CREATE OR REPLACE VIEW "public"."v_service_assignment_summary" WITH ("security_invoker"='true') AS
 SELECT "si"."id" AS "service_instance_id",
    "sg"."group_date",
    "sg"."name" AS "service_name",
    "si"."service_time",
    "c"."name" AS "campus_name",
    "count"(DISTINCT "srr"."role_id") AS "total_positions",
    "count"(DISTINCT "sa"."id") FILTER (WHERE ("sa"."person_id" IS NOT NULL)) AS "filled_positions",
    "count"(DISTINCT "sa"."id") FILTER (WHERE ("sa"."status" = 'confirmed'::"text")) AS "confirmed_assignments",
    "count"(DISTINCT "sa"."id") FILTER (WHERE ("sa"."status" = 'pending'::"text")) AS "pending_confirmations",
    "count"(DISTINCT "sa"."id") FILTER (WHERE ("sa"."status" = 'declined'::"text")) AS "declined_assignments",
    "count"(DISTINCT "srr"."role_id") FILTER (WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."service_assignments" "sa2"
          WHERE (("sa2"."service_instance_id" = "si"."id") AND ("sa2"."role_id" = "srr"."role_id") AND ("sa2"."person_id" IS NOT NULL)))))) AS "unfilled_positions"
   FROM (((("public"."service_instances" "si"
     JOIN "public"."service_groups" "sg" ON (("sg"."id" = "si"."service_group_id")))
     LEFT JOIN "public"."campuses" "c" ON (("c"."id" = "si"."campus_id")))
     LEFT JOIN "public"."service_role_requirements" "srr" ON (("srr"."context_id" = "sg"."context_id")))
     LEFT JOIN "public"."service_assignments" "sa" ON ((("sa"."service_instance_id" = "si"."id") AND ("sa"."role_id" = "srr"."role_id"))))
  GROUP BY "si"."id", "sg"."group_date", "sg"."name", "si"."service_time", "c"."name";


ALTER VIEW "public"."v_service_assignment_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_service_staffing_detail" WITH ("security_invoker"='true') AS
 SELECT "si"."id" AS "service_instance_id",
    "sg"."group_date",
    "sg"."name" AS "service_name",
    "si"."service_time",
    "r"."id" AS "role_id",
    "r"."name" AS "role_name",
    "r"."ministry_area",
    "srr"."min_needed",
    "srr"."max_needed",
    ("srr"."min_needed" > 0) AS "is_required",
    "count"("sa"."id") FILTER (WHERE ("sa"."person_id" IS NOT NULL)) AS "filled_count",
    "count"("sa"."id") FILTER (WHERE ("sa"."status" = 'confirmed'::"text")) AS "confirmed_count",
    "count"("sa"."id") FILTER (WHERE (("sa"."status" = 'pending'::"text") AND ("sa"."person_id" IS NOT NULL))) AS "pending_count",
        CASE
            WHEN (("srr"."min_needed" > 0) AND ("count"("sa"."id") FILTER (WHERE ("sa"."person_id" IS NOT NULL)) < "srr"."min_needed")) THEN '🔴 UNFILLED'::"text"
            WHEN ("count"("sa"."id") FILTER (WHERE (("sa"."status" = 'pending'::"text") AND ("sa"."person_id" IS NOT NULL))) > 0) THEN '🟡 PENDING'::"text"
            WHEN ("count"("sa"."id") FILTER (WHERE ("sa"."status" = 'confirmed'::"text")) >= "srr"."min_needed") THEN '🟢 STAFFED'::"text"
            ELSE '⚪ OPTIONAL'::"text"
        END AS "status"
   FROM (((("public"."service_instances" "si"
     JOIN "public"."service_groups" "sg" ON (("sg"."id" = "si"."service_group_id")))
     JOIN "public"."service_role_requirements" "srr" ON (("srr"."context_id" = "sg"."context_id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "srr"."role_id")))
     LEFT JOIN "public"."service_assignments" "sa" ON ((("sa"."service_instance_id" = "si"."id") AND ("sa"."role_id" = "r"."id"))))
  GROUP BY "si"."id", "sg"."group_date", "sg"."name", "si"."service_time", "r"."id", "r"."name", "r"."ministry_area", "srr"."min_needed", "srr"."max_needed"
  ORDER BY "sg"."group_date" DESC, "si"."service_time", "r"."ministry_area", "r"."name";


ALTER VIEW "public"."v_service_staffing_detail" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_service_staffing_detail" IS 'Shows staffing status for each role in each service with is_required flag';



CREATE OR REPLACE VIEW "public"."v_services_display" WITH ("security_invoker"='true') AS
 SELECT "si"."id" AS "service_instance_id",
    "si"."service_date",
    "si"."service_time",
    "sg"."id" AS "service_group_id",
    "sg"."group_date",
    "sg"."name" AS "service_name",
    "sg"."context_id",
    "ctx"."name" AS "context_name",
    "si"."campus_id",
    "c"."name" AS "campus_name",
    "si"."church_id",
    (("sg"."name" || ' — '::"text") || "to_char"(("si"."service_time")::interval, 'HH12:MI AM'::"text")) AS "display_name",
        CASE
            WHEN ("c"."name" IS NOT NULL) THEN ((((("sg"."name" || ' — '::"text") || "to_char"(("si"."service_time")::interval, 'HH12:MI AM'::"text")) || ' ('::"text") || "c"."name") || ')'::"text")
            ELSE (("sg"."name" || ' — '::"text") || "to_char"(("si"."service_time")::interval, 'HH12:MI AM'::"text"))
        END AS "display_name_with_campus"
   FROM ((("public"."service_instances" "si"
     JOIN "public"."service_groups" "sg" ON (("si"."service_group_id" = "sg"."id")))
     LEFT JOIN "public"."campuses" "c" ON (("si"."campus_id" = "c"."id")))
     LEFT JOIN "public"."contexts" "ctx" ON (("sg"."context_id" = "ctx"."id")));


ALTER VIEW "public"."v_services_display" OWNER TO "postgres";


ALTER TABLE ONLY "drizzle"."__drizzle_migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"drizzle"."__drizzle_migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "drizzle"."__drizzle_migrations"
    ADD CONSTRAINT "__drizzle_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_notifications"
    ADD CONSTRAINT "assignment_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_church_id_id_uniq" UNIQUE ("church_id", "id");



ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_org_id_name_key" UNIQUE ("church_id", "name");



ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."care_cases"
    ADD CONSTRAINT "care_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."care_notes"
    ADD CONSTRAINT "care_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_memberships"
    ADD CONSTRAINT "church_memberships_pkey" PRIMARY KEY ("church_id", "user_id");



ALTER TABLE ONLY "public"."contact_methods"
    ADD CONSTRAINT "contact_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contexts"
    ADD CONSTRAINT "contexts_org_id_name_key" UNIQUE ("church_id", "name");



ALTER TABLE ONLY "public"."contexts"
    ADD CONSTRAINT "contexts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "fm_org_family_person_uniq" UNIQUE ("church_id", "family_id", "person_id");



ALTER TABLE ONLY "public"."identity_links"
    ADD CONSTRAINT "identity_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."identity_links"
    ADD CONSTRAINT "identity_links_unique" UNIQUE ("church_id", "person_a_id", "person_b_id");



ALTER TABLE ONLY "public"."merge_events"
    ADD CONSTRAINT "merge_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ministry_areas"
    ADD CONSTRAINT "ministry_areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."churches"
    ADD CONSTRAINT "orgs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_aliases"
    ADD CONSTRAINT "person_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_role_capabilities"
    ADD CONSTRAINT "person_role_capabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_role_capabilities"
    ADD CONSTRAINT "prc_org_person_role_uniq" UNIQUE ("church_id", "person_id", "role_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_org_id_name_key" UNIQUE ("church_id", "name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "sa_org_instance_role_person_uniq" UNIQUE ("church_id", "service_instance_id", "role_id", "person_id");



ALTER TABLE ONLY "public"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_amendments"
    ADD CONSTRAINT "service_amendments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "service_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_audit_log"
    ADD CONSTRAINT "service_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_groups"
    ADD CONSTRAINT "service_groups_church_id_id_uniq" UNIQUE ("church_id", "id");



ALTER TABLE ONLY "public"."service_groups"
    ADD CONSTRAINT "service_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_instance_sections"
    ADD CONSTRAINT "service_instance_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "service_instance_songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "service_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_role_requirements"
    ADD CONSTRAINT "service_role_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "service_team_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "service_team_assignments_service_id_person_id_role_id_key" UNIQUE ("service_instance_id", "person_id", "role_id");



ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "service_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."song_arrangements"
    ADD CONSTRAINT "song_arrangements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."song_sections"
    ADD CONSTRAINT "song_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."song_variants"
    ADD CONSTRAINT "song_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_role_requirements"
    ADD CONSTRAINT "srr_org_context_role_uniq" UNIQUE ("church_id", "context_id", "role_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_church_id_name_key" UNIQUE ("church_id", "name");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_sections"
    ADD CONSTRAINT "template_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tend_signals"
    ADD CONSTRAINT "tend_signals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ministry_areas"
    ADD CONSTRAINT "unique_church_ministry_area" UNIQUE ("church_id", "name");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "unique_church_service_type" UNIQUE ("church_id", "name");



ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "unique_instance_church_id" UNIQUE ("church_id", "id");



ALTER TABLE ONLY "public"."service_instance_sections"
    ADD CONSTRAINT "unique_instance_section_order" UNIQUE ("service_instance_id", "display_order");



ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "unique_org_template_name" UNIQUE ("church_id", "name");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "unique_person_notification_prefs" UNIQUE ("church_id", "person_id");



ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "unique_service_song_order" UNIQUE ("service_instance_id", "display_order");



ALTER TABLE ONLY "public"."song_arrangements"
    ADD CONSTRAINT "unique_song_arrangement_name" UNIQUE ("song_id", "name");



ALTER TABLE ONLY "public"."template_sections"
    ADD CONSTRAINT "unique_template_section_order" UNIQUE ("template_id", "display_order");



ALTER TABLE ONLY "public"."user_links"
    ADD CONSTRAINT "user_links_church_id_person_id_key" UNIQUE ("church_id", "person_id");



ALTER TABLE ONLY "public"."user_links"
    ADD CONSTRAINT "user_links_pkey" PRIMARY KEY ("church_id", "user_id");



CREATE INDEX "church_memberships_user_id_church_id_role_idx" ON "public"."church_memberships" USING "btree" ("user_id", "church_id", "role");



CREATE INDEX "idx_addresses_campus" ON "public"."addresses" USING "btree" ("campus_id");



CREATE INDEX "idx_addresses_church" ON "public"."addresses" USING "btree" ("church_id");



CREATE INDEX "idx_addresses_church_id" ON "public"."addresses" USING "btree" ("church_id");



CREATE INDEX "idx_addresses_family" ON "public"."addresses" USING "btree" ("family_id");



CREATE INDEX "idx_addresses_person" ON "public"."addresses" USING "btree" ("person_id");



CREATE INDEX "idx_amendments_ccli" ON "public"."service_amendments" USING "btree" ("church_id") WHERE ("ccli_relevant" = true);



CREATE INDEX "idx_amendments_recorded" ON "public"."service_amendments" USING "btree" ("recorded_at" DESC);



CREATE INDEX "idx_amendments_service" ON "public"."service_amendments" USING "btree" ("service_instance_id");



CREATE INDEX "idx_amendments_type" ON "public"."service_amendments" USING "btree" ("amendment_type");



CREATE INDEX "idx_assignment_notifications_assignment" ON "public"."assignment_notifications" USING "btree" ("assignment_id");



CREATE INDEX "idx_assignment_notifications_person" ON "public"."assignment_notifications" USING "btree" ("person_id");



CREATE INDEX "idx_audit_changed_at" ON "public"."service_audit_log" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_audit_church_date" ON "public"."service_audit_log" USING "btree" ("church_id", "changed_at" DESC);



CREATE INDEX "idx_audit_table_record" ON "public"."service_audit_log" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_campuses_address_id" ON "public"."campuses" USING "btree" ("address_id");



CREATE INDEX "idx_care_cases_assigned_to" ON "public"."care_cases" USING "btree" ("church_id", "assigned_to");



CREATE INDEX "idx_contacts_person" ON "public"."contact_methods" USING "btree" ("person_id");



CREATE INDEX "idx_families_active" ON "public"."families" USING "btree" ("church_id", "is_active");



CREATE INDEX "idx_families_org" ON "public"."families" USING "btree" ("church_id");



CREATE INDEX "idx_family_members_active" ON "public"."family_members" USING "btree" ("family_id", "is_active");



CREATE INDEX "idx_family_members_family" ON "public"."family_members" USING "btree" ("family_id");



CREATE INDEX "idx_family_members_person" ON "public"."family_members" USING "btree" ("person_id");



CREATE INDEX "idx_family_members_relationship" ON "public"."family_members" USING "btree" ("family_id", "relationship");



CREATE INDEX "idx_identity_links_church" ON "public"."identity_links" USING "btree" ("church_id");



CREATE INDEX "idx_identity_links_pending" ON "public"."identity_links" USING "btree" ("church_id", "status") WHERE (("status")::"text" = ANY (ARRAY[('suggested'::character varying)::"text", ('confirmed'::character varying)::"text"]));



CREATE INDEX "idx_identity_links_person_a" ON "public"."identity_links" USING "btree" ("person_a_id");



CREATE INDEX "idx_identity_links_person_b" ON "public"."identity_links" USING "btree" ("person_b_id");



CREATE INDEX "idx_identity_links_review" ON "public"."identity_links" USING "btree" ("church_id", "status", "confidence_score" DESC);



CREATE INDEX "idx_instance_sections_ministry" ON "public"."service_instance_sections" USING "btree" ("ministry_area_id");



CREATE INDEX "idx_instance_sections_service" ON "public"."service_instance_sections" USING "btree" ("service_instance_id");



CREATE INDEX "idx_instance_sections_status" ON "public"."service_instance_sections" USING "btree" ("status");



CREATE INDEX "idx_instance_songs_ccli_pending" ON "public"."service_instance_songs" USING "btree" ("ccli_reported") WHERE (("was_performed" = true) AND ("ccli_reported" = false));



CREATE INDEX "idx_instance_songs_performed" ON "public"."service_instance_songs" USING "btree" ("service_instance_id") WHERE ("was_performed" = true);



CREATE INDEX "idx_instance_songs_section" ON "public"."service_instance_songs" USING "btree" ("section_id");



CREATE INDEX "idx_merge_events_church" ON "public"."merge_events" USING "btree" ("church_id");



CREATE INDEX "idx_merge_events_merged" ON "public"."merge_events" USING "gin" ("merged_ids");



CREATE INDEX "idx_merge_events_recent" ON "public"."merge_events" USING "btree" ("church_id", "performed_at" DESC);



CREATE INDEX "idx_merge_events_survivor" ON "public"."merge_events" USING "btree" ("survivor_id");



CREATE INDEX "idx_merge_events_undoable" ON "public"."merge_events" USING "btree" ("church_id") WHERE ("undone_at" IS NULL);



CREATE INDEX "idx_ministry_areas_active" ON "public"."ministry_areas" USING "btree" ("church_id") WHERE ("is_active" = true);



CREATE INDEX "idx_ministry_areas_church" ON "public"."ministry_areas" USING "btree" ("church_id");



CREATE INDEX "idx_ministry_areas_parent" ON "public"."ministry_areas" USING "btree" ("parent_id") WHERE ("parent_id" IS NOT NULL);



CREATE INDEX "idx_notification_prefs_person" ON "public"."notification_preferences" USING "btree" ("person_id");



CREATE INDEX "idx_people_church" ON "public"."people" USING "btree" ("church_id");



CREATE INDEX "idx_people_church_active" ON "public"."people" USING "btree" ("church_id", "is_active");



CREATE INDEX "idx_people_display_name" ON "public"."people" USING "btree" ("display_name");



CREATE INDEX "idx_person_aliases_active" ON "public"."person_aliases" USING "btree" ("person_id", "alias_type") WHERE ("is_active" = true);



CREATE INDEX "idx_person_aliases_church" ON "public"."person_aliases" USING "btree" ("church_id");



CREATE INDEX "idx_person_aliases_name" ON "public"."person_aliases" USING "btree" ("church_id", "lower"(("last_name")::"text"), "lower"(("first_name")::"text")) WHERE ("is_active" = true);



CREATE INDEX "idx_person_aliases_person" ON "public"."person_aliases" USING "btree" ("person_id");



CREATE INDEX "idx_person_role_capabilities_person" ON "public"."person_role_capabilities" USING "btree" ("person_id");



CREATE INDEX "idx_person_role_capabilities_role" ON "public"."person_role_capabilities" USING "btree" ("role_id");



CREATE INDEX "idx_roles_active" ON "public"."roles" USING "btree" ("church_id", "is_active");



CREATE INDEX "idx_roles_church" ON "public"."roles" USING "btree" ("church_id");



CREATE INDEX "idx_roles_org" ON "public"."roles" USING "btree" ("church_id");



CREATE INDEX "idx_roles_team" ON "public"."roles" USING "btree" ("team_id");



CREATE INDEX "idx_service_assignments_instance" ON "public"."service_assignments" USING "btree" ("service_instance_id");



CREATE INDEX "idx_service_assignments_person" ON "public"."service_assignments" USING "btree" ("person_id");



CREATE INDEX "idx_service_assignments_role" ON "public"."service_assignments" USING "btree" ("role_id");



CREATE INDEX "idx_service_assignments_status" ON "public"."service_assignments" USING "btree" ("service_instance_id", "status");



CREATE INDEX "idx_service_groups_church_date" ON "public"."service_groups" USING "btree" ("church_id", "group_date");



CREATE INDEX "idx_service_groups_org_date" ON "public"."service_groups" USING "btree" ("church_id", "group_date");



CREATE INDEX "idx_service_instance_songs_arrangement" ON "public"."service_instance_songs" USING "btree" ("arrangement_id");



CREATE INDEX "idx_service_instance_songs_instance" ON "public"."service_instance_songs" USING "btree" ("service_instance_id");



CREATE INDEX "idx_service_instance_songs_song" ON "public"."service_instance_songs" USING "btree" ("song_id");



CREATE INDEX "idx_service_instances_campus" ON "public"."service_instances" USING "btree" ("campus_id");



CREATE INDEX "idx_service_instances_church_date" ON "public"."service_instances" USING "btree" ("church_id", "service_date", "service_time");



CREATE INDEX "idx_service_instances_group" ON "public"."service_instances" USING "btree" ("service_group_id");



CREATE INDEX "idx_service_instances_locked" ON "public"."service_instances" USING "btree" ("church_id", "locked_at") WHERE ("locked_at" IS NOT NULL);



CREATE INDEX "idx_service_instances_org_date" ON "public"."service_instances" USING "btree" ("church_id", "service_date", "service_time");



CREATE INDEX "idx_service_instances_service_type" ON "public"."service_instances" USING "btree" ("service_type_id");



CREATE INDEX "idx_service_instances_status" ON "public"."service_instances" USING "btree" ("status");



CREATE INDEX "idx_service_items_instance_sort" ON "public"."service_items" USING "btree" ("service_instance_id", "sort_order");



CREATE INDEX "idx_service_role_requirements_context" ON "public"."service_role_requirements" USING "btree" ("church_id", "context_id");



CREATE INDEX "idx_service_team_assignments_instance" ON "public"."service_team_assignments" USING "btree" ("service_instance_id");



CREATE INDEX "idx_service_team_assignments_person" ON "public"."service_team_assignments" USING "btree" ("person_id");



CREATE INDEX "idx_service_team_assignments_role" ON "public"."service_team_assignments" USING "btree" ("role_id");



CREATE INDEX "idx_service_templates_context" ON "public"."service_templates" USING "btree" ("context_id");



CREATE INDEX "idx_service_templates_default" ON "public"."service_templates" USING "btree" ("church_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_service_templates_org" ON "public"."service_templates" USING "btree" ("church_id");



CREATE INDEX "idx_service_types_active" ON "public"."service_types" USING "btree" ("church_id") WHERE ("is_active" = true);



CREATE INDEX "idx_service_types_church" ON "public"."service_types" USING "btree" ("church_id");



CREATE INDEX "idx_service_types_context" ON "public"."service_types" USING "btree" ("context_id");



CREATE INDEX "idx_sis_church_instance" ON "public"."service_instance_songs" USING "btree" ("church_id", "service_instance_id");



CREATE INDEX "idx_song_arrangements_church" ON "public"."song_arrangements" USING "btree" ("church_id");



CREATE INDEX "idx_song_arrangements_default" ON "public"."song_arrangements" USING "btree" ("song_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_song_arrangements_org" ON "public"."song_arrangements" USING "btree" ("church_id");



CREATE INDEX "idx_song_arrangements_song" ON "public"."song_arrangements" USING "btree" ("song_id");



CREATE INDEX "idx_song_sections_org" ON "public"."song_sections" USING "btree" ("church_id");



CREATE INDEX "idx_song_sections_seasonal" ON "public"."song_sections" USING "gin" ("seasonal_tags") WHERE ("seasonal_tags" IS NOT NULL);



CREATE INDEX "idx_song_sections_song" ON "public"."song_sections" USING "btree" ("song_id", "display_order");



CREATE INDEX "idx_song_variants_context" ON "public"."song_variants" USING "gin" ("context_tags") WHERE ("context_tags" IS NOT NULL);



CREATE INDEX "idx_song_variants_dates" ON "public"."song_variants" USING "gist" ("active_dates") WHERE ("active_dates" IS NOT NULL);



CREATE INDEX "idx_song_variants_default" ON "public"."song_variants" USING "btree" ("song_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_song_variants_song" ON "public"."song_variants" USING "btree" ("church_id", "song_id");



CREATE INDEX "idx_song_variants_type" ON "public"."song_variants" USING "btree" ("song_id", "variant_type");



CREATE INDEX "idx_teams_active" ON "public"."teams" USING "btree" ("church_id", "is_active");



CREATE INDEX "idx_teams_church" ON "public"."teams" USING "btree" ("church_id");



CREATE INDEX "idx_template_sections_ministry" ON "public"."template_sections" USING "btree" ("ministry_area_id");



CREATE INDEX "idx_template_sections_template" ON "public"."template_sections" USING "btree" ("template_id");



CREATE INDEX "user_links_person_idx" ON "public"."user_links" USING "btree" ("church_id", "person_id");



CREATE INDEX "user_links_user_idx" ON "public"."user_links" USING "btree" ("church_id", "user_id");



CREATE OR REPLACE TRIGGER "identity_links_updated_at" BEFORE UPDATE ON "public"."identity_links" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "song_arrangements_updated_at" BEFORE UPDATE ON "public"."song_arrangements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "songs_updated_at" BEFORE UPDATE ON "public"."songs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_auto_deactivate_family_member" BEFORE INSERT OR UPDATE ON "public"."family_members" FOR EACH ROW EXECUTE FUNCTION "public"."auto_deactivate_family_member"();



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."assignment_notifications"
    ADD CONSTRAINT "assignment_notifications_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."service_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_notifications"
    ADD CONSTRAINT "assignment_notifications_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."care_cases"
    ADD CONSTRAINT "care_cases_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."care_cases"
    ADD CONSTRAINT "care_cases_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id");



ALTER TABLE ONLY "public"."care_cases"
    ADD CONSTRAINT "care_cases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."care_cases"
    ADD CONSTRAINT "care_cases_source_signal_id_fkey" FOREIGN KEY ("source_signal_id") REFERENCES "public"."tend_signals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."church_memberships"
    ADD CONSTRAINT "church_memberships_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_memberships"
    ADD CONSTRAINT "church_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_methods"
    ADD CONSTRAINT "contact_methods_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contexts"
    ADD CONSTRAINT "contexts_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_primary_address_id_fkey" FOREIGN KEY ("primary_address_id") REFERENCES "public"."addresses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "fk_service_items_instance" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "fk_service_team_assignments_instance" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "fk_sis_strict_tenancy" FOREIGN KEY ("church_id", "service_instance_id") REFERENCES "public"."service_instances"("church_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_instance_sections"
    ADD CONSTRAINT "fk_sisec_strict_tenancy" FOREIGN KEY ("church_id", "service_instance_id") REFERENCES "public"."service_instances"("church_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "fk_sitems_strict_tenancy" FOREIGN KEY ("church_id", "service_instance_id") REFERENCES "public"."service_instances"("church_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "fk_sta_strict_tenancy" FOREIGN KEY ("church_id", "service_instance_id") REFERENCES "public"."service_instances"("church_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."identity_links"
    ADD CONSTRAINT "identity_links_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merge_events"
    ADD CONSTRAINT "merge_events_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."merge_events"
    ADD CONSTRAINT "merge_events_identity_link_id_fkey" FOREIGN KEY ("identity_link_id") REFERENCES "public"."identity_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ministry_areas"
    ADD CONSTRAINT "ministry_areas_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ministry_areas"
    ADD CONSTRAINT "ministry_areas_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."ministry_areas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_aliases"
    ADD CONSTRAINT "person_aliases_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_role_capabilities"
    ADD CONSTRAINT "person_role_capabilities_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_amendments"
    ADD CONSTRAINT "service_amendments_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_amendments"
    ADD CONSTRAINT "service_amendments_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "service_assignments_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "service_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "service_assignments_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_audit_log"
    ADD CONSTRAINT "service_audit_log_amendment_id_fkey" FOREIGN KEY ("amendment_id") REFERENCES "public"."service_amendments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_audit_log"
    ADD CONSTRAINT "service_audit_log_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_groups"
    ADD CONSTRAINT "service_groups_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_groups"
    ADD CONSTRAINT "service_groups_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_instance_sections"
    ADD CONSTRAINT "service_instance_sections_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_instance_sections"
    ADD CONSTRAINT "service_instance_sections_ministry_area_id_fkey" FOREIGN KEY ("ministry_area_id") REFERENCES "public"."ministry_areas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_instance_sections"
    ADD CONSTRAINT "service_instance_sections_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_instance_sections"
    ADD CONSTRAINT "service_instance_sections_template_section_id_fkey" FOREIGN KEY ("template_section_id") REFERENCES "public"."template_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "service_instance_songs_arrangement_id_fkey" FOREIGN KEY ("arrangement_id") REFERENCES "public"."song_arrangements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "service_instance_songs_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."service_instance_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "service_instance_songs_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "service_instance_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "service_instances_campus_tenant_fk" FOREIGN KEY ("church_id", "campus_id") REFERENCES "public"."campuses"("church_id", "id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "service_instances_group_tenant_fk" FOREIGN KEY ("church_id", "service_group_id") REFERENCES "public"."service_groups"("church_id", "id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "service_instances_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "service_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."service_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "service_items_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "service_items_related_item_id_fkey" FOREIGN KEY ("related_item_id") REFERENCES "public"."service_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "service_items_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "service_items_song_variant_id_fkey" FOREIGN KEY ("song_variant_id") REFERENCES "public"."song_variants"("id");



ALTER TABLE ONLY "public"."service_role_requirements"
    ADD CONSTRAINT "service_role_requirements_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id");



ALTER TABLE ONLY "public"."service_role_requirements"
    ADD CONSTRAINT "service_role_requirements_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "service_team_assignments_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "service_team_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "service_templates_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id");



ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "service_templates_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "service_templates_parent_template_id_fkey" FOREIGN KEY ("parent_template_id") REFERENCES "public"."service_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_default_template_id_fkey" FOREIGN KEY ("default_template_id") REFERENCES "public"."service_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "services_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_arrangements"
    ADD CONSTRAINT "song_arrangements_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_arrangements"
    ADD CONSTRAINT "song_arrangements_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_sections"
    ADD CONSTRAINT "song_sections_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_sections"
    ADD CONSTRAINT "song_sections_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_variants"
    ADD CONSTRAINT "song_variants_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_variants"
    ADD CONSTRAINT "song_variants_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_org_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_sections"
    ADD CONSTRAINT "template_sections_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_sections"
    ADD CONSTRAINT "template_sections_ministry_area_id_fkey" FOREIGN KEY ("ministry_area_id") REFERENCES "public"."ministry_areas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."template_sections"
    ADD CONSTRAINT "template_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."service_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_links"
    ADD CONSTRAINT "user_links_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_links"
    ADD CONSTRAINT "user_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Care Notes: Insertable by Author" ON "public"."care_notes" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Care Notes: Viewable by Creator or Permission" ON "public"."care_notes" FOR SELECT USING ((("auth"."uid"() = "author_id") OR (EXISTS ( SELECT 1
   FROM "public"."app_users"
  WHERE (("app_users"."id" = "auth"."uid"()) AND ("app_users"."can_view_care_notes" = true))))));



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."addresses" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."assignment_notifications" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."campuses" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."churches" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."contact_methods" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."contexts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."families" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."family_members" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."identity_links" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."merge_events" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."ministry_areas" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."notification_preferences" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."person_aliases" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."person_role_capabilities" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_amendments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_assignments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_audit_log" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_groups" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_instance_sections" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_instance_songs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_instances" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_role_requirements" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_team_assignments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_templates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."service_types" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."song_arrangements" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."song_sections" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."song_variants" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."songs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."teams" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."template_sections" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Dev: Allow All Authenticated" ON "public"."tend_signals" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can read own permissions" ON "public"."app_users" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignment_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."care_cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."care_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "church_memberships_select_self" ON "public"."church_memberships" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."churches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contexts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."families" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."identity_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merge_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ministry_areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."person_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."person_role_capabilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_amendments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_instance_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_instance_songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_role_requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_team_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."song_arrangements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."song_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."song_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tend_signals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_links_select_self" ON "public"."user_links" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."auto_deactivate_family_member"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_deactivate_family_member"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_deactivate_family_member"() TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_service_instance"("p_service_instance_id" "uuid", "p_completed_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_service_instance"("p_service_instance_id" "uuid", "p_completed_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_service_instance"("p_service_instance_id" "uuid", "p_completed_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_display_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."compute_display_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_display_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."copy_service_to_date"("p_source_instance_id" "uuid", "p_target_date" "date", "p_target_time" time without time zone, "p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."copy_service_to_date"("p_source_instance_id" "uuid", "p_target_date" "date", "p_target_time" time without time zone, "p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."copy_service_to_date"("p_source_instance_id" "uuid", "p_target_date" "date", "p_target_time" time without time zone, "p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_checkable_children"("p_family_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_checkable_children"("p_family_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_checkable_children"("p_family_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_family_roster"("p_family_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_family_roster"("p_family_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_family_roster"("p_family_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_service_roster"("p_service_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_roster"("p_service_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_roster"("p_service_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_service_roster"("p_service_instance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_roster"("p_service_instance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_roster"("p_service_instance_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_variant_active"("p_variant_id" "uuid", "p_check_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."is_variant_active"("p_variant_id" "uuid", "p_check_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_variant_active"("p_variant_id" "uuid", "p_check_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."lock_service_instance"("p_service_instance_id" "uuid", "p_locked_by" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lock_service_instance"("p_service_instance_id" "uuid", "p_locked_by" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lock_service_instance"("p_service_instance_id" "uuid", "p_locked_by" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_song_amendment"("p_church_id" "uuid", "p_service_instance_id" "uuid", "p_song_instance_id" "uuid", "p_amendment_type" "text", "p_actual_song_id" "uuid", "p_reason" "text", "p_recorded_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_song_amendment"("p_church_id" "uuid", "p_service_instance_id" "uuid", "p_song_instance_id" "uuid", "p_amendment_type" "text", "p_actual_song_id" "uuid", "p_reason" "text", "p_recorded_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_song_amendment"("p_church_id" "uuid", "p_service_instance_id" "uuid", "p_song_instance_id" "uuid", "p_amendment_type" "text", "p_actual_song_id" "uuid", "p_reason" "text", "p_recorded_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_service_as_template"("p_service_instance_id" "uuid", "p_template_name" "text", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."save_service_as_template"("p_service_instance_id" "uuid", "p_template_name" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_service_as_template"("p_service_instance_id" "uuid", "p_template_name" "text", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."addresses" TO "anon";
GRANT ALL ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT ALL ON TABLE "public"."app_users" TO "anon";
GRANT ALL ON TABLE "public"."app_users" TO "authenticated";
GRANT ALL ON TABLE "public"."app_users" TO "service_role";



GRANT ALL ON TABLE "public"."assignment_notifications" TO "anon";
GRANT ALL ON TABLE "public"."assignment_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."campuses" TO "anon";
GRANT ALL ON TABLE "public"."campuses" TO "authenticated";
GRANT ALL ON TABLE "public"."campuses" TO "service_role";



GRANT ALL ON TABLE "public"."care_cases" TO "anon";
GRANT ALL ON TABLE "public"."care_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."care_cases" TO "service_role";



GRANT ALL ON TABLE "public"."care_notes" TO "anon";
GRANT ALL ON TABLE "public"."care_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."care_notes" TO "service_role";



GRANT ALL ON TABLE "public"."church_memberships" TO "postgres";
GRANT ALL ON TABLE "public"."church_memberships" TO "anon";
GRANT ALL ON TABLE "public"."church_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."church_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."churches" TO "anon";
GRANT ALL ON TABLE "public"."churches" TO "authenticated";
GRANT ALL ON TABLE "public"."churches" TO "service_role";



GRANT ALL ON TABLE "public"."contact_methods" TO "anon";
GRANT ALL ON TABLE "public"."contact_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_methods" TO "service_role";



GRANT ALL ON TABLE "public"."contexts" TO "anon";
GRANT ALL ON TABLE "public"."contexts" TO "authenticated";
GRANT ALL ON TABLE "public"."contexts" TO "service_role";



GRANT ALL ON TABLE "public"."families" TO "anon";
GRANT ALL ON TABLE "public"."families" TO "authenticated";
GRANT ALL ON TABLE "public"."families" TO "service_role";



GRANT ALL ON TABLE "public"."family_members" TO "anon";
GRANT ALL ON TABLE "public"."family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."family_members" TO "service_role";



GRANT ALL ON TABLE "public"."identity_links" TO "anon";
GRANT ALL ON TABLE "public"."identity_links" TO "authenticated";
GRANT ALL ON TABLE "public"."identity_links" TO "service_role";



GRANT ALL ON TABLE "public"."merge_events" TO "anon";
GRANT ALL ON TABLE "public"."merge_events" TO "authenticated";
GRANT ALL ON TABLE "public"."merge_events" TO "service_role";



GRANT ALL ON TABLE "public"."ministry_areas" TO "anon";
GRANT ALL ON TABLE "public"."ministry_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."ministry_areas" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."people" TO "anon";
GRANT ALL ON TABLE "public"."people" TO "authenticated";
GRANT ALL ON TABLE "public"."people" TO "service_role";



GRANT ALL ON TABLE "public"."person_aliases" TO "anon";
GRANT ALL ON TABLE "public"."person_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."person_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."person_role_capabilities" TO "anon";
GRANT ALL ON TABLE "public"."person_role_capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."person_role_capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."schema_migrations" TO "anon";
GRANT ALL ON TABLE "public"."schema_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."schema_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."service_amendments" TO "anon";
GRANT ALL ON TABLE "public"."service_amendments" TO "authenticated";
GRANT ALL ON TABLE "public"."service_amendments" TO "service_role";



GRANT ALL ON TABLE "public"."service_assignments" TO "anon";
GRANT ALL ON TABLE "public"."service_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."service_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."service_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."service_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."service_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."service_groups" TO "anon";
GRANT ALL ON TABLE "public"."service_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."service_groups" TO "service_role";



GRANT ALL ON TABLE "public"."service_instance_sections" TO "anon";
GRANT ALL ON TABLE "public"."service_instance_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."service_instance_sections" TO "service_role";



GRANT ALL ON TABLE "public"."service_instance_songs" TO "anon";
GRANT ALL ON TABLE "public"."service_instance_songs" TO "authenticated";
GRANT ALL ON TABLE "public"."service_instance_songs" TO "service_role";



GRANT ALL ON TABLE "public"."service_instances" TO "anon";
GRANT ALL ON TABLE "public"."service_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."service_instances" TO "service_role";



GRANT ALL ON TABLE "public"."service_items" TO "anon";
GRANT ALL ON TABLE "public"."service_items" TO "authenticated";
GRANT ALL ON TABLE "public"."service_items" TO "service_role";



GRANT ALL ON TABLE "public"."service_role_requirements" TO "anon";
GRANT ALL ON TABLE "public"."service_role_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."service_role_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."service_team_assignments" TO "anon";
GRANT ALL ON TABLE "public"."service_team_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."service_team_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."service_templates" TO "anon";
GRANT ALL ON TABLE "public"."service_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."service_templates" TO "service_role";



GRANT ALL ON TABLE "public"."service_types" TO "anon";
GRANT ALL ON TABLE "public"."service_types" TO "authenticated";
GRANT ALL ON TABLE "public"."service_types" TO "service_role";



GRANT ALL ON TABLE "public"."song_arrangements" TO "anon";
GRANT ALL ON TABLE "public"."song_arrangements" TO "authenticated";
GRANT ALL ON TABLE "public"."song_arrangements" TO "service_role";



GRANT ALL ON TABLE "public"."song_sections" TO "anon";
GRANT ALL ON TABLE "public"."song_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."song_sections" TO "service_role";



GRANT ALL ON TABLE "public"."song_variants" TO "anon";
GRANT ALL ON TABLE "public"."song_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."song_variants" TO "service_role";



GRANT ALL ON TABLE "public"."songs" TO "anon";
GRANT ALL ON TABLE "public"."songs" TO "authenticated";
GRANT ALL ON TABLE "public"."songs" TO "service_role";



GRANT ALL ON TABLE "public"."stage_people_import" TO "postgres";
GRANT ALL ON TABLE "public"."stage_people_import" TO "anon";
GRANT ALL ON TABLE "public"."stage_people_import" TO "authenticated";
GRANT ALL ON TABLE "public"."stage_people_import" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."template_sections" TO "anon";
GRANT ALL ON TABLE "public"."template_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."template_sections" TO "service_role";



GRANT ALL ON TABLE "public"."tend_signals" TO "postgres";
GRANT ALL ON TABLE "public"."tend_signals" TO "anon";
GRANT ALL ON TABLE "public"."tend_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."tend_signals" TO "service_role";



GRANT ALL ON TABLE "public"."user_links" TO "postgres";
GRANT ALL ON TABLE "public"."user_links" TO "anon";
GRANT ALL ON TABLE "public"."user_links" TO "authenticated";
GRANT ALL ON TABLE "public"."user_links" TO "service_role";



GRANT ALL ON TABLE "public"."v_ccli_report_v2" TO "anon";
GRANT ALL ON TABLE "public"."v_ccli_report_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ccli_report_v2" TO "service_role";



GRANT ALL ON TABLE "public"."v_context_role_requirements" TO "anon";
GRANT ALL ON TABLE "public"."v_context_role_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."v_context_role_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."v_section_ownership" TO "anon";
GRANT ALL ON TABLE "public"."v_section_ownership" TO "authenticated";
GRANT ALL ON TABLE "public"."v_section_ownership" TO "service_role";



GRANT ALL ON TABLE "public"."v_service_assignment_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_service_assignment_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_service_assignment_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_service_staffing_detail" TO "anon";
GRANT ALL ON TABLE "public"."v_service_staffing_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."v_service_staffing_detail" TO "service_role";



GRANT ALL ON TABLE "public"."v_services_display" TO "anon";
GRANT ALL ON TABLE "public"."v_services_display" TO "authenticated";
GRANT ALL ON TABLE "public"."v_services_display" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































