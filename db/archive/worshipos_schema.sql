-- /db/archive/worshipos_schema.sql
--
-- PostgreSQL database dump
--

\restrict wpppGYobhlX8GRuFRmpZGfLZoaWA7hbw7ddRJInhD1gXvkdp9XghmuVbcqlU3vU

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg13+1)

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

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "public";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: apply_template_to_service("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."apply_template_to_service"("p_template_id" "uuid", "p_service_instance_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_template record;
  v_service record;
  v_segment jsonb;
  v_new_segment_id uuid;
  v_result jsonb;
  v_segment_count int := 0;
BEGIN
  -- Get template
  SELECT * INTO v_template 
  FROM service_templates 
  WHERE id = p_template_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found: %', p_template_id;
  END IF;
  
  -- Get service instance
  SELECT si.*, sg.group_date 
  INTO v_service
  FROM service_instances si
  JOIN service_groups sg ON sg.id = si.service_group_id
  WHERE si.id = p_service_instance_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service instance not found: %', p_service_instance_id;
  END IF;
  
  -- Create segments from template
  FOR v_segment IN 
    SELECT * FROM jsonb_array_elements(v_template.structure->'segments')
  LOOP
    -- Create service segment
    INSERT INTO service_segments (
      org_id,
      service_instance_id,
      name,
      segment_type,
      start_time,
      duration_minutes,
      display_order,
      notes
    )
    VALUES (
      v_service.org_id,
      p_service_instance_id,
      v_segment->>'name',
      v_segment->>'type',
      v_template.default_start_time + 
        ((v_segment->>'relative_start_minutes')::int || ' minutes')::interval,
      (v_segment->>'duration_minutes')::int,
      (v_segment->>'order')::int,
      v_segment->>'notes'
    )
    RETURNING id INTO v_new_segment_id;
    
    v_segment_count := v_segment_count + 1;
    
    -- TODO: Create segment role assignments based on v_segment->'roles'
    -- This would create placeholder assignments for each role
  END LOOP;
  
  v_result := jsonb_build_object(
    'template_id', p_template_id,
    'template_name', v_template.name,
    'service_instance_id', p_service_instance_id,
    'segments_created', v_segment_count,
    'success', true
  );
  
  RETURN v_result;
END;
$$;


--
-- Name: FUNCTION "apply_template_to_service"("p_template_id" "uuid", "p_service_instance_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."apply_template_to_service"("p_template_id" "uuid", "p_service_instance_id" "uuid") IS 'Stamps a template onto a specific service date';


--
-- Name: auto_deactivate_family_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."auto_deactivate_family_member"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If end_date is set and is in the past, set is_active to false
  IF NEW.end_date IS NOT NULL AND NEW.end_date <= CURRENT_DATE THEN
    NEW.is_active := false;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION "auto_deactivate_family_member"(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."auto_deactivate_family_member"() IS 'Automatically sets is_active=false when end_date passes';


--
-- Name: copy_service_to_date("uuid", "date", time without time zone, "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."copy_service_to_date"("p_source_instance_id" "uuid", "p_target_date" "date", "p_target_time" time without time zone, "p_org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


--
-- Name: FUNCTION "copy_service_to_date"("p_source_instance_id" "uuid", "p_target_date" "date", "p_target_time" time without time zone, "p_org_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."copy_service_to_date"("p_source_instance_id" "uuid", "p_target_date" "date", "p_target_time" time without time zone, "p_org_id" "uuid") IS 'Copy service structure (roles, songs, segments) to a new date for easy week-to-week planning';


--
-- Name: get_checkable_children("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_checkable_children"("p_family_id" "uuid") RETURNS TABLE("person_id" "uuid", "display_name" "text", "relationship" "text")
    LANGUAGE "plpgsql"
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


--
-- Name: FUNCTION "get_checkable_children"("p_family_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."get_checkable_children"("p_family_id" "uuid") IS 'Returns only active children eligible for check-in';


--
-- Name: get_family_roster("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_family_roster"("p_family_id" "uuid") RETURNS TABLE("person_id" "uuid", "display_name" "text", "relationship" "text", "is_active" boolean, "is_temporary" boolean, "start_date" "date", "end_date" "date", "is_primary_contact" boolean)
    LANGUAGE "plpgsql"
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


--
-- Name: FUNCTION "get_family_roster"("p_family_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."get_family_roster"("p_family_id" "uuid") IS 'Returns all family members with relationship details, ordered by relationship type';


--
-- Name: get_service_roster(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_service_roster"("p_service_id" integer) RETURNS TABLE("role_name" "text", "person_name" "text", "person_status" "text", "role_id" integer, "min_needed" integer, "currently_filled" bigint, "is_filled" boolean)
    LANGUAGE "plpgsql"
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


--
-- Name: get_service_roster("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_service_roster"("p_service_instance_id" "uuid") RETURNS TABLE("ministry_area" "text", "role_name" "text", "role_id" "uuid", "person_id" "uuid", "person_name" "text", "status" "text", "is_lead" boolean, "is_required" boolean, "notes" "text")
    LANGUAGE "plpgsql"
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


--
-- Name: save_service_as_template("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."save_service_as_template"("p_service_instance_id" "uuid", "p_template_name" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
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


--
-- Name: FUNCTION "save_service_as_template"("p_service_instance_id" "uuid", "p_template_name" "text", "p_description" "text"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."save_service_as_template"("p_service_instance_id" "uuid", "p_template_name" "text", "p_description" "text") IS 'Create a new template from an existing service';


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "street" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "country" "text" DEFAULT 'US'::"text",
    "label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: assignment_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."assignment_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
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


--
-- Name: TABLE "assignment_notifications"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."assignment_notifications" IS 'Tracks scheduling notifications sent to volunteers';


--
-- Name: COLUMN "assignment_notifications"."response_method"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."assignment_notifications"."response_method" IS 'How they responded: SMS Y/N, web click, etc';


--
-- Name: campuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."campuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: contact_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."contact_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "value" "text" NOT NULL,
    "label" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: contexts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."contexts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL
);


--
-- Name: families; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."families" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "primary_address_id" "uuid",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "families"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."families" IS 'Represents households/family units';


--
-- Name: COLUMN "families"."name"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."families"."name" IS 'Display name for the family unit';


--
-- Name: COLUMN "families"."primary_address_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."families"."primary_address_id" IS 'Optional link to primary family address';


--
-- Name: family_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."family_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
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


--
-- Name: TABLE "family_members"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."family_members" IS 'Links people to families with relationship context';


--
-- Name: COLUMN "family_members"."relationship"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."family_members"."relationship" IS 'parent, child, foster_child, guardian, spouse, etc.';


--
-- Name: COLUMN "family_members"."start_date"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."family_members"."start_date" IS 'When person joined family (useful for foster care)';


--
-- Name: COLUMN "family_members"."end_date"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."family_members"."end_date" IS 'When placement ended (triggers is_active=false)';


--
-- Name: COLUMN "family_members"."is_temporary"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."family_members"."is_temporary" IS 'True for foster/temporary placements';


--
-- Name: COLUMN "family_members"."is_primary_contact"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."family_members"."is_primary_contact" IS 'Primary contact for family matters';


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
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


--
-- Name: TABLE "notification_preferences"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."notification_preferences" IS 'How each person wants to be notified about scheduling';


--
-- Name: COLUMN "notification_preferences"."phone_number"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notification_preferences"."phone_number" IS 'For SMS: E.164 format +12065551234';


--
-- Name: COLUMN "notification_preferences"."auto_accept_roles"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."notification_preferences"."auto_accept_roles" IS 'Role IDs that should auto-confirm without prompt';


--
-- Name: orgs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."orgs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


--
-- Name: people; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: person_role_capabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."person_role_capabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
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


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "load_weight" integer DEFAULT 10 NOT NULL,
    "ministry_area" "text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    CONSTRAINT "chk_roles_load_weight_positive" CHECK (("load_weight" > 0))
);


--
-- Name: service_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."service_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: service_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."service_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "group_date" "date" NOT NULL,
    "name" "text" NOT NULL,
    "context_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: service_instance_songs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."service_instance_songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_instance_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "display_order" integer NOT NULL,
    "key" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "arrangement_id" "uuid",
    "transpose_steps" integer DEFAULT 0,
    "custom_structure" "jsonb"
);


--
-- Name: TABLE "service_instance_songs"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."service_instance_songs" IS 'Songs included in each service instance (the setlist)';


--
-- Name: COLUMN "service_instance_songs"."key"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."service_instance_songs"."key" IS 'Override key for this service (e.g., transpose from G to C)';


--
-- Name: COLUMN "service_instance_songs"."arrangement_id"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."service_instance_songs"."arrangement_id" IS 'Which arrangement to use for this service';


--
-- Name: COLUMN "service_instance_songs"."transpose_steps"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."service_instance_songs"."transpose_steps" IS 'Transpose steps from arrangement key: +2 = up 2 semitones';


--
-- Name: COLUMN "service_instance_songs"."custom_structure"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."service_instance_songs"."custom_structure" IS 'Override arrangement structure for this specific service';


--
-- Name: service_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."service_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "service_date" "date" NOT NULL,
    "service_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_group_id" "uuid",
    "campus_id" "uuid"
);


--
-- Name: service_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."service_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "service_instance_id" "uuid" NOT NULL,
    "sort_order" integer NOT NULL,
    "item_type" "text" NOT NULL,
    "song_variant_id" "uuid",
    "notes" "text",
    CONSTRAINT "chk_service_items_sort_order_positive" CHECK (("sort_order" > 0))
);


--
-- Name: service_role_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."service_role_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "context_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "min_needed" integer DEFAULT 1 NOT NULL,
    "max_needed" integer,
    "display_order" integer DEFAULT 0
);


--
-- Name: service_team_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."service_team_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "service_instance_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL
);


--
-- Name: service_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."service_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "service_templates"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."service_templates" IS 'The reusable patterns/stamps for services';


--
-- Name: COLUMN "service_templates"."structure"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."service_templates"."structure" IS 'JSON structure of segments, roles, and details';


--
-- Name: song_arrangements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."song_arrangements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
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


--
-- Name: TABLE "song_arrangements"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."song_arrangements" IS 'Different arrangements/versions of songs (Standard, Acoustic, etc)';


--
-- Name: COLUMN "song_arrangements"."structure"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."song_arrangements"."structure" IS 'JSON: {flow: [{section_id: "uuid", repeat: 1}]}';


--
-- Name: song_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."song_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "section_type" "text" NOT NULL,
    "section_number" integer,
    "label" "text" NOT NULL,
    "lyrics" "text" NOT NULL,
    "chords" "jsonb",
    "display_order" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "song_sections"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."song_sections" IS 'Individual sections (verses, choruses) of songs with lyrics and chords';


--
-- Name: COLUMN "song_sections"."chords"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."song_sections"."chords" IS 'JSON: {lines: [{lyrics: "...", chords: [{position: 0, chord: "C"}]}]}';


--
-- Name: song_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."song_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "default_key" "text",
    "tempo" integer,
    "time_signature" "text",
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: songs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "ccli_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "artist" "text",
    "key" "text",
    "bpm" integer,
    "notes" "text"
);


--
-- Name: v_context_role_requirements; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_context_role_requirements" AS
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


--
-- Name: VIEW "v_context_role_requirements"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_context_role_requirements" IS 'Shows which roles are required vs optional for each service type';


--
-- Name: v_family_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_family_summary" AS
 SELECT "f"."id" AS "family_id",
    "f"."org_id",
    "f"."name" AS "family_name",
    "f"."is_active",
    "count"(DISTINCT "fm"."person_id") FILTER (WHERE ("fm"."is_active" = true)) AS "active_members",
    "count"(DISTINCT "fm"."person_id") FILTER (WHERE (("fm"."relationship" = ANY (ARRAY['child'::"text", 'foster_child'::"text"])) AND ("fm"."is_active" = true))) AS "active_children",
    "count"(DISTINCT "fm"."person_id") FILTER (WHERE (("fm"."relationship" = 'foster_child'::"text") AND ("fm"."is_active" = true))) AS "active_foster_children",
    "array_agg"(DISTINCT "p"."display_name" ORDER BY "p"."display_name") FILTER (WHERE ("fm"."is_primary_contact" = true)) AS "primary_contacts"
   FROM (("public"."families" "f"
     LEFT JOIN "public"."family_members" "fm" ON (("fm"."family_id" = "f"."id")))
     LEFT JOIN "public"."people" "p" ON ((("p"."id" = "fm"."person_id") AND ("fm"."is_primary_contact" = true))))
  GROUP BY "f"."id", "f"."org_id", "f"."name", "f"."is_active";


--
-- Name: VIEW "v_family_summary"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_family_summary" IS 'Quick overview of family composition';


--
-- Name: v_service_assignment_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_service_assignment_summary" AS
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


--
-- Name: v_service_staffing_detail; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_service_staffing_detail" AS
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


--
-- Name: VIEW "v_service_staffing_detail"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_service_staffing_detail" IS 'Shows staffing status for each role in each service with is_required flag';


--
-- Name: v_services_display; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_services_display" AS
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
    "si"."org_id",
    (("sg"."name" || ' — '::"text") || "to_char"(("si"."service_time")::interval, 'HH12:MI AM'::"text")) AS "display_name",
        CASE
            WHEN ("c"."name" IS NOT NULL) THEN ((((("sg"."name" || ' — '::"text") || "to_char"(("si"."service_time")::interval, 'HH12:MI AM'::"text")) || ' ('::"text") || "c"."name") || ')'::"text")
            ELSE (("sg"."name" || ' — '::"text") || "to_char"(("si"."service_time")::interval, 'HH12:MI AM'::"text"))
        END AS "display_name_with_campus"
   FROM ((("public"."service_instances" "si"
     JOIN "public"."service_groups" "sg" ON (("si"."service_group_id" = "sg"."id")))
     LEFT JOIN "public"."campuses" "c" ON (("si"."campus_id" = "c"."id")))
     LEFT JOIN "public"."contexts" "ctx" ON (("sg"."context_id" = "ctx"."id")));


--
-- Name: v_template_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_template_summary" AS
 SELECT "t"."id",
    "t"."name",
    "t"."description",
    "c"."name" AS "context_name",
    "t"."default_start_time",
    "t"."default_duration_minutes",
    "t"."is_default",
    "jsonb_array_length"(("t"."structure" -> 'segments'::"text")) AS "segment_count",
    "t"."created_at",
    "p"."display_name" AS "created_by_name"
   FROM (("public"."service_templates" "t"
     LEFT JOIN "public"."contexts" "c" ON (("c"."id" = "t"."context_id")))
     LEFT JOIN "public"."people" "p" ON (("p"."id" = "t"."created_by")))
  WHERE ("t"."is_active" = true)
  ORDER BY "c"."name", "t"."is_default" DESC, "t"."name";


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");


--
-- Name: assignment_notifications assignment_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignment_notifications"
    ADD CONSTRAINT "assignment_notifications_pkey" PRIMARY KEY ("id");


--
-- Name: campuses campuses_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_org_id_name_key" UNIQUE ("org_id", "name");


--
-- Name: campuses campuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_pkey" PRIMARY KEY ("id");


--
-- Name: contact_methods contact_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."contact_methods"
    ADD CONSTRAINT "contact_methods_pkey" PRIMARY KEY ("id");


--
-- Name: contexts contexts_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."contexts"
    ADD CONSTRAINT "contexts_org_id_name_key" UNIQUE ("org_id", "name");


--
-- Name: contexts contexts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."contexts"
    ADD CONSTRAINT "contexts_pkey" PRIMARY KEY ("id");


--
-- Name: families families_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_pkey" PRIMARY KEY ("id");


--
-- Name: family_members family_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("id");


--
-- Name: family_members fm_org_family_person_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "fm_org_family_person_uniq" UNIQUE ("org_id", "family_id", "person_id");


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");


--
-- Name: orgs orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orgs"
    ADD CONSTRAINT "orgs_pkey" PRIMARY KEY ("id");


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_pkey" PRIMARY KEY ("id");


--
-- Name: person_role_capabilities person_role_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."person_role_capabilities"
    ADD CONSTRAINT "person_role_capabilities_pkey" PRIMARY KEY ("id");


--
-- Name: person_role_capabilities prc_org_person_role_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."person_role_capabilities"
    ADD CONSTRAINT "prc_org_person_role_uniq" UNIQUE ("org_id", "person_id", "role_id");


--
-- Name: roles roles_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_org_id_name_key" UNIQUE ("org_id", "name");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");


--
-- Name: service_assignments sa_org_instance_role_person_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "sa_org_instance_role_person_uniq" UNIQUE ("org_id", "service_instance_id", "role_id", "person_id");


--
-- Name: service_assignments service_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "service_assignments_pkey" PRIMARY KEY ("id");


--
-- Name: service_groups service_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_groups"
    ADD CONSTRAINT "service_groups_pkey" PRIMARY KEY ("id");


--
-- Name: service_instance_songs service_instance_songs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "service_instance_songs_pkey" PRIMARY KEY ("id");


--
-- Name: service_items service_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "service_items_pkey" PRIMARY KEY ("id");


--
-- Name: service_role_requirements service_role_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_role_requirements"
    ADD CONSTRAINT "service_role_requirements_pkey" PRIMARY KEY ("id");


--
-- Name: service_team_assignments service_team_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "service_team_assignments_pkey" PRIMARY KEY ("id");


--
-- Name: service_team_assignments service_team_assignments_service_id_person_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "service_team_assignments_service_id_person_id_role_id_key" UNIQUE ("service_instance_id", "person_id", "role_id");


--
-- Name: service_templates service_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "service_templates_pkey" PRIMARY KEY ("id");


--
-- Name: service_instances services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");


--
-- Name: song_arrangements song_arrangements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_arrangements"
    ADD CONSTRAINT "song_arrangements_pkey" PRIMARY KEY ("id");


--
-- Name: song_sections song_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_sections"
    ADD CONSTRAINT "song_sections_pkey" PRIMARY KEY ("id");


--
-- Name: song_variants song_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_variants"
    ADD CONSTRAINT "song_variants_pkey" PRIMARY KEY ("id");


--
-- Name: songs songs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_pkey" PRIMARY KEY ("id");


--
-- Name: service_role_requirements srr_org_context_role_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_role_requirements"
    ADD CONSTRAINT "srr_org_context_role_uniq" UNIQUE ("org_id", "context_id", "role_id");


--
-- Name: service_templates unique_org_template_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "unique_org_template_name" UNIQUE ("org_id", "name");


--
-- Name: notification_preferences unique_person_notification_prefs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "unique_person_notification_prefs" UNIQUE ("org_id", "person_id");


--
-- Name: service_instance_songs unique_service_song_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "unique_service_song_order" UNIQUE ("service_instance_id", "display_order");


--
-- Name: song_arrangements unique_song_arrangement_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_arrangements"
    ADD CONSTRAINT "unique_song_arrangement_name" UNIQUE ("song_id", "name");


--
-- Name: idx_addresses_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_addresses_person" ON "public"."addresses" USING "btree" ("person_id");


--
-- Name: idx_assignment_notifications_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assignment_notifications_assignment" ON "public"."assignment_notifications" USING "btree" ("assignment_id");


--
-- Name: idx_assignment_notifications_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assignment_notifications_person" ON "public"."assignment_notifications" USING "btree" ("person_id");


--
-- Name: idx_contacts_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_contacts_person" ON "public"."contact_methods" USING "btree" ("person_id");


--
-- Name: idx_families_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_families_active" ON "public"."families" USING "btree" ("org_id", "is_active");


--
-- Name: idx_families_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_families_org" ON "public"."families" USING "btree" ("org_id");


--
-- Name: idx_family_members_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_family_members_active" ON "public"."family_members" USING "btree" ("family_id", "is_active");


--
-- Name: idx_family_members_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_family_members_family" ON "public"."family_members" USING "btree" ("family_id");


--
-- Name: idx_family_members_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_family_members_person" ON "public"."family_members" USING "btree" ("person_id");


--
-- Name: idx_family_members_relationship; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_family_members_relationship" ON "public"."family_members" USING "btree" ("family_id", "relationship");


--
-- Name: idx_notification_prefs_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notification_prefs_person" ON "public"."notification_preferences" USING "btree" ("person_id");


--
-- Name: idx_people_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_people_active" ON "public"."people" USING "btree" ("org_id", "is_active");


--
-- Name: idx_people_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_people_org" ON "public"."people" USING "btree" ("org_id");


--
-- Name: idx_person_role_capabilities_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_person_role_capabilities_person" ON "public"."person_role_capabilities" USING "btree" ("person_id");


--
-- Name: idx_person_role_capabilities_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_person_role_capabilities_role" ON "public"."person_role_capabilities" USING "btree" ("role_id");


--
-- Name: idx_roles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roles_active" ON "public"."roles" USING "btree" ("org_id", "is_active");


--
-- Name: idx_roles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_roles_org" ON "public"."roles" USING "btree" ("org_id");


--
-- Name: idx_service_assignments_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_assignments_instance" ON "public"."service_assignments" USING "btree" ("service_instance_id");


--
-- Name: idx_service_assignments_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_assignments_person" ON "public"."service_assignments" USING "btree" ("person_id");


--
-- Name: idx_service_assignments_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_assignments_role" ON "public"."service_assignments" USING "btree" ("role_id");


--
-- Name: idx_service_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_assignments_status" ON "public"."service_assignments" USING "btree" ("service_instance_id", "status");


--
-- Name: idx_service_groups_org_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_groups_org_date" ON "public"."service_groups" USING "btree" ("org_id", "group_date");


--
-- Name: idx_service_instance_songs_arrangement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_instance_songs_arrangement" ON "public"."service_instance_songs" USING "btree" ("arrangement_id");


--
-- Name: idx_service_instance_songs_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_instance_songs_instance" ON "public"."service_instance_songs" USING "btree" ("service_instance_id");


--
-- Name: idx_service_instance_songs_song; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_instance_songs_song" ON "public"."service_instance_songs" USING "btree" ("song_id");


--
-- Name: idx_service_instances_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_instances_campus" ON "public"."service_instances" USING "btree" ("campus_id");


--
-- Name: idx_service_instances_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_instances_group" ON "public"."service_instances" USING "btree" ("service_group_id");


--
-- Name: idx_service_instances_org_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_instances_org_date" ON "public"."service_instances" USING "btree" ("org_id", "service_date", "service_time");


--
-- Name: idx_service_items_instance_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_items_instance_sort" ON "public"."service_items" USING "btree" ("service_instance_id", "sort_order");


--
-- Name: idx_service_role_requirements_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_role_requirements_context" ON "public"."service_role_requirements" USING "btree" ("org_id", "context_id");


--
-- Name: idx_service_team_assignments_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_team_assignments_instance" ON "public"."service_team_assignments" USING "btree" ("service_instance_id");


--
-- Name: idx_service_team_assignments_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_team_assignments_person" ON "public"."service_team_assignments" USING "btree" ("person_id");


--
-- Name: idx_service_team_assignments_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_team_assignments_role" ON "public"."service_team_assignments" USING "btree" ("role_id");


--
-- Name: idx_service_templates_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_templates_context" ON "public"."service_templates" USING "btree" ("context_id");


--
-- Name: idx_service_templates_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_templates_default" ON "public"."service_templates" USING "btree" ("org_id", "is_default") WHERE ("is_default" = true);


--
-- Name: idx_service_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_service_templates_org" ON "public"."service_templates" USING "btree" ("org_id");


--
-- Name: idx_song_arrangements_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_song_arrangements_default" ON "public"."song_arrangements" USING "btree" ("song_id", "is_default") WHERE ("is_default" = true);


--
-- Name: idx_song_arrangements_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_song_arrangements_org" ON "public"."song_arrangements" USING "btree" ("org_id");


--
-- Name: idx_song_arrangements_song; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_song_arrangements_song" ON "public"."song_arrangements" USING "btree" ("song_id");


--
-- Name: idx_song_sections_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_song_sections_org" ON "public"."song_sections" USING "btree" ("org_id");


--
-- Name: idx_song_sections_song; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_song_sections_song" ON "public"."song_sections" USING "btree" ("song_id", "display_order");


--
-- Name: idx_song_variants_song; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_song_variants_song" ON "public"."song_variants" USING "btree" ("org_id", "song_id");


--
-- Name: family_members trigger_auto_deactivate_family_member; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trigger_auto_deactivate_family_member" BEFORE INSERT OR UPDATE ON "public"."family_members" FOR EACH ROW EXECUTE FUNCTION "public"."auto_deactivate_family_member"();


--
-- Name: addresses addresses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: addresses addresses_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;


--
-- Name: assignment_notifications assignment_notifications_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignment_notifications"
    ADD CONSTRAINT "assignment_notifications_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."service_assignments"("id") ON DELETE CASCADE;


--
-- Name: assignment_notifications assignment_notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignment_notifications"
    ADD CONSTRAINT "assignment_notifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: assignment_notifications assignment_notifications_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignment_notifications"
    ADD CONSTRAINT "assignment_notifications_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;


--
-- Name: campuses campuses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: contact_methods contact_methods_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."contact_methods"
    ADD CONSTRAINT "contact_methods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: contact_methods contact_methods_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."contact_methods"
    ADD CONSTRAINT "contact_methods_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;


--
-- Name: contexts contexts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."contexts"
    ADD CONSTRAINT "contexts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: families families_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: families families_primary_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_primary_address_id_fkey" FOREIGN KEY ("primary_address_id") REFERENCES "public"."addresses"("id") ON DELETE SET NULL;


--
-- Name: family_members family_members_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;


--
-- Name: family_members family_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: family_members family_members_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;


--
-- Name: person_role_capabilities fk_prc_verified_by_person; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."person_role_capabilities"
    ADD CONSTRAINT "fk_prc_verified_by_person" FOREIGN KEY ("verified_by_person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;


--
-- Name: service_instances fk_service_instances_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "fk_service_instances_group" FOREIGN KEY ("service_group_id") REFERENCES "public"."service_groups"("id") ON DELETE SET NULL;


--
-- Name: service_items fk_service_items_instance; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "fk_service_items_instance" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE CASCADE;


--
-- Name: service_team_assignments fk_service_team_assignments_instance; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "fk_service_team_assignments_instance" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;


--
-- Name: people people_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: person_role_capabilities person_role_capabilities_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."person_role_capabilities"
    ADD CONSTRAINT "person_role_capabilities_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;


--
-- Name: person_role_capabilities person_role_capabilities_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."person_role_capabilities"
    ADD CONSTRAINT "person_role_capabilities_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");


--
-- Name: roles roles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: service_assignments service_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "service_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."people"("id") ON DELETE SET NULL;


--
-- Name: service_assignments service_assignments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "service_assignments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: service_assignments service_assignments_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "service_assignments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;


--
-- Name: service_assignments service_assignments_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "service_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;


--
-- Name: service_assignments service_assignments_service_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_assignments"
    ADD CONSTRAINT "service_assignments_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE CASCADE;


--
-- Name: service_groups service_groups_context_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_groups"
    ADD CONSTRAINT "service_groups_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE SET NULL;


--
-- Name: service_groups service_groups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_groups"
    ADD CONSTRAINT "service_groups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: service_instance_songs service_instance_songs_arrangement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "service_instance_songs_arrangement_id_fkey" FOREIGN KEY ("arrangement_id") REFERENCES "public"."song_arrangements"("id") ON DELETE SET NULL;


--
-- Name: service_instance_songs service_instance_songs_service_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "service_instance_songs_service_instance_id_fkey" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE CASCADE;


--
-- Name: service_instance_songs service_instance_songs_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_instance_songs"
    ADD CONSTRAINT "service_instance_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;


--
-- Name: service_instances service_instances_campus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "service_instances_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE SET NULL;


--
-- Name: service_items service_items_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "service_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: service_items service_items_song_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_items"
    ADD CONSTRAINT "service_items_song_variant_id_fkey" FOREIGN KEY ("song_variant_id") REFERENCES "public"."song_variants"("id");


--
-- Name: service_role_requirements service_role_requirements_context_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_role_requirements"
    ADD CONSTRAINT "service_role_requirements_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id");


--
-- Name: service_role_requirements service_role_requirements_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_role_requirements"
    ADD CONSTRAINT "service_role_requirements_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");


--
-- Name: service_team_assignments service_team_assignments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "service_team_assignments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: service_team_assignments service_team_assignments_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "service_team_assignments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id");


--
-- Name: service_team_assignments service_team_assignments_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_team_assignments"
    ADD CONSTRAINT "service_team_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");


--
-- Name: service_templates service_templates_context_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "service_templates_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id");


--
-- Name: service_templates service_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "service_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id");


--
-- Name: service_templates service_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "service_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: service_instances services_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_instances"
    ADD CONSTRAINT "services_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: song_arrangements song_arrangements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_arrangements"
    ADD CONSTRAINT "song_arrangements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id");


--
-- Name: song_arrangements song_arrangements_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_arrangements"
    ADD CONSTRAINT "song_arrangements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: song_arrangements song_arrangements_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_arrangements"
    ADD CONSTRAINT "song_arrangements_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;


--
-- Name: song_sections song_sections_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_sections"
    ADD CONSTRAINT "song_sections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: song_sections song_sections_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_sections"
    ADD CONSTRAINT "song_sections_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;


--
-- Name: song_variants song_variants_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_variants"
    ADD CONSTRAINT "song_variants_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- Name: song_variants song_variants_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."song_variants"
    ADD CONSTRAINT "song_variants_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;


--
-- Name: songs songs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict wpppGYobhlX8GRuFRmpZGfLZoaWA7hbw7ddRJInhD1gXvkdp9XghmuVbcqlU3vU

