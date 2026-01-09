--
-- PostgreSQL database dump
--

\restrict X37Y3srfqScPdXmk8wNkPbocO2D6dkHbcwkcfchuaQDmGqvDfSjwyosxUNGrfo9

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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: auto_deactivate_family_member(); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.auto_deactivate_family_member() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- If end_date is set and is in the past, set is_active to false
  IF NEW.end_date IS NOT NULL AND NEW.end_date <= CURRENT_DATE THEN
    NEW.is_active := false;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_deactivate_family_member() OWNER TO worship;

--
-- Name: FUNCTION auto_deactivate_family_member(); Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON FUNCTION public.auto_deactivate_family_member() IS 'Automatically sets is_active=false when end_date passes';


--
-- Name: complete_service_instance(uuid, uuid); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.complete_service_instance(p_service_instance_id uuid, p_completed_by uuid) RETURNS boolean
    LANGUAGE plpgsql
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


ALTER FUNCTION public.complete_service_instance(p_service_instance_id uuid, p_completed_by uuid) OWNER TO worship;

--
-- Name: FUNCTION complete_service_instance(p_service_instance_id uuid, p_completed_by uuid); Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON FUNCTION public.complete_service_instance(p_service_instance_id uuid, p_completed_by uuid) IS 'Mark a service as completed and finalize all song/section statuses.';


--
-- Name: compute_display_name(); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.compute_display_name() RETURNS trigger
    LANGUAGE plpgsql
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


ALTER FUNCTION public.compute_display_name() OWNER TO worship;

--
-- Name: copy_service_to_date(uuid, date, time without time zone, uuid); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.copy_service_to_date(p_source_instance_id uuid, p_target_date date, p_target_time time without time zone, p_org_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
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


ALTER FUNCTION public.copy_service_to_date(p_source_instance_id uuid, p_target_date date, p_target_time time without time zone, p_org_id uuid) OWNER TO worship;

--
-- Name: FUNCTION copy_service_to_date(p_source_instance_id uuid, p_target_date date, p_target_time time without time zone, p_org_id uuid); Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON FUNCTION public.copy_service_to_date(p_source_instance_id uuid, p_target_date date, p_target_time time without time zone, p_org_id uuid) IS 'Copy service structure (roles, songs, segments) to a new date for easy week-to-week planning';


--
-- Name: get_checkable_children(uuid); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.get_checkable_children(p_family_id uuid) RETURNS TABLE(person_id uuid, display_name text, relationship text)
    LANGUAGE plpgsql
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


ALTER FUNCTION public.get_checkable_children(p_family_id uuid) OWNER TO worship;

--
-- Name: FUNCTION get_checkable_children(p_family_id uuid); Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON FUNCTION public.get_checkable_children(p_family_id uuid) IS 'Returns only active children eligible for check-in';


--
-- Name: get_family_roster(uuid); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.get_family_roster(p_family_id uuid) RETURNS TABLE(person_id uuid, display_name text, relationship text, is_active boolean, is_temporary boolean, start_date date, end_date date, is_primary_contact boolean)
    LANGUAGE plpgsql
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


ALTER FUNCTION public.get_family_roster(p_family_id uuid) OWNER TO worship;

--
-- Name: FUNCTION get_family_roster(p_family_id uuid); Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON FUNCTION public.get_family_roster(p_family_id uuid) IS 'Returns all family members with relationship details, ordered by relationship type';


--
-- Name: get_service_roster(integer); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.get_service_roster(p_service_id integer) RETURNS TABLE(role_name text, person_name text, person_status text, role_id integer, min_needed integer, currently_filled bigint, is_filled boolean)
    LANGUAGE plpgsql
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


ALTER FUNCTION public.get_service_roster(p_service_id integer) OWNER TO worship;

--
-- Name: get_service_roster(uuid); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.get_service_roster(p_service_instance_id uuid) RETURNS TABLE(ministry_area text, role_name text, role_id uuid, person_id uuid, person_name text, status text, is_lead boolean, is_required boolean, notes text)
    LANGUAGE plpgsql
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


ALTER FUNCTION public.get_service_roster(p_service_instance_id uuid) OWNER TO worship;

--
-- Name: is_variant_active(uuid, date); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.is_variant_active(p_variant_id uuid, p_check_date date DEFAULT CURRENT_DATE) RETURNS boolean
    LANGUAGE plpgsql STABLE
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


ALTER FUNCTION public.is_variant_active(p_variant_id uuid, p_check_date date) OWNER TO worship;

--
-- Name: FUNCTION is_variant_active(p_variant_id uuid, p_check_date date); Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON FUNCTION public.is_variant_active(p_variant_id uuid, p_check_date date) IS 'Check if a variant is currently active based on its active_dates range';


--
-- Name: lock_service_instance(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.lock_service_instance(p_service_instance_id uuid, p_locked_by uuid, p_reason text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
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


ALTER FUNCTION public.lock_service_instance(p_service_instance_id uuid, p_locked_by uuid, p_reason text) OWNER TO worship;

--
-- Name: FUNCTION lock_service_instance(p_service_instance_id uuid, p_locked_by uuid, p_reason text); Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON FUNCTION public.lock_service_instance(p_service_instance_id uuid, p_locked_by uuid, p_reason text) IS 'Lock a service to prevent direct edits. Only amendments allowed after locking.';


--
-- Name: record_song_amendment(uuid, uuid, uuid, text, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.record_song_amendment(p_church_id uuid, p_service_instance_id uuid, p_song_instance_id uuid, p_amendment_type text, p_actual_song_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text, p_recorded_by uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
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


ALTER FUNCTION public.record_song_amendment(p_church_id uuid, p_service_instance_id uuid, p_song_instance_id uuid, p_amendment_type text, p_actual_song_id uuid, p_reason text, p_recorded_by uuid) OWNER TO worship;

--
-- Name: FUNCTION record_song_amendment(p_church_id uuid, p_service_instance_id uuid, p_song_instance_id uuid, p_amendment_type text, p_actual_song_id uuid, p_reason text, p_recorded_by uuid); Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON FUNCTION public.record_song_amendment(p_church_id uuid, p_service_instance_id uuid, p_song_instance_id uuid, p_amendment_type text, p_actual_song_id uuid, p_reason text, p_recorded_by uuid) IS 'Record when a song was skipped or substituted. Maintains planned/actual integrity for CCLI.';


--
-- Name: save_service_as_template(uuid, text, text); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.save_service_as_template(p_service_instance_id uuid, p_template_name text, p_description text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
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


ALTER FUNCTION public.save_service_as_template(p_service_instance_id uuid, p_template_name text, p_description text) OWNER TO worship;

--
-- Name: FUNCTION save_service_as_template(p_service_instance_id uuid, p_template_name text, p_description text); Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON FUNCTION public.save_service_as_template(p_service_instance_id uuid, p_template_name text, p_description text) IS 'Create a new template from an existing service';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: worship
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO worship;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: people; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.people (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    display_name text NOT NULL,
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name text,
    last_name text,
    goes_by text,
    membership_status text DEFAULT 'unknown'::text,
    first_visit_date date,
    membership_date date,
    care_notes_enabled boolean DEFAULT true,
    last_known_attendance date,
    canonical_id uuid,
    merged_at timestamp with time zone,
    legal_first_name character varying(100),
    legal_last_name character varying(100)
);


ALTER TABLE public.people OWNER TO worship;

--
-- Name: COLUMN people.membership_status; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.people.membership_status IS 'Lifecycle stage: visitor, regular, member, leader, inactive, unknown';


--
-- Name: COLUMN people.care_notes_enabled; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.people.care_notes_enabled IS 'Privacy setting: if false, pastoral/care notes cannot be recorded for this person.';


--
-- Name: COLUMN people.last_known_attendance; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.people.last_known_attendance IS 'Denormalized field for quick "haven''t seen since" queries. Updated by attendance system.';


--
-- Name: active_people; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.active_people AS
 SELECT id,
    church_id,
    display_name,
    is_active,
    updated_at,
    created_at,
    first_name,
    last_name,
    goes_by,
    membership_status,
    first_visit_date,
    membership_date,
    care_notes_enabled,
    last_known_attendance,
    canonical_id,
    merged_at,
    legal_first_name,
    legal_last_name
   FROM public.people
  WHERE ((merged_at IS NULL) AND (is_active = true));


ALTER VIEW public.active_people OWNER TO worship;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid,
    street text,
    city text,
    state text,
    postal_code text,
    country text DEFAULT 'US'::text,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    line1 text,
    line2 text,
    region text,
    lat double precision,
    lng double precision,
    timezone text,
    campus_id uuid,
    family_id uuid
);


ALTER TABLE public.addresses OWNER TO worship;

--
-- Name: assignment_notifications; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.assignment_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    assignment_id uuid NOT NULL,
    person_id uuid NOT NULL,
    notification_type text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    response_method text,
    responded_at timestamp with time zone,
    message_body text,
    delivery_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.assignment_notifications OWNER TO worship;

--
-- Name: TABLE assignment_notifications; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.assignment_notifications IS 'Tracks scheduling notifications sent to volunteers';


--
-- Name: COLUMN assignment_notifications.response_method; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.assignment_notifications.response_method IS 'How they responded: SMS Y/N, web click, etc';


--
-- Name: campuses; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.campuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    location text,
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    address_id uuid
);


ALTER TABLE public.campuses OWNER TO worship;

--
-- Name: churches; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.churches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.churches OWNER TO worship;

--
-- Name: contact_methods; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.contact_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid NOT NULL,
    type text NOT NULL,
    value text NOT NULL,
    label text,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contact_methods OWNER TO worship;

--
-- Name: contexts; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.contexts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.contexts OWNER TO worship;

--
-- Name: families; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.families (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    primary_address_id uuid,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.families OWNER TO worship;

--
-- Name: TABLE families; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.families IS 'Represents households/family units';


--
-- Name: COLUMN families.name; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.families.name IS 'Display name for the family unit';


--
-- Name: COLUMN families.primary_address_id; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.families.primary_address_id IS 'Optional link to primary family address';


--
-- Name: family_members; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.family_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    family_id uuid NOT NULL,
    person_id uuid NOT NULL,
    relationship text NOT NULL,
    start_date date,
    end_date date,
    is_temporary boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_primary_contact boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_dates CHECK (((end_date IS NULL) OR (end_date >= start_date)))
);


ALTER TABLE public.family_members OWNER TO worship;

--
-- Name: TABLE family_members; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.family_members IS 'Links people to families with relationship context';


--
-- Name: COLUMN family_members.relationship; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.family_members.relationship IS 'parent, child, foster_child, guardian, spouse, etc.';


--
-- Name: COLUMN family_members.start_date; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.family_members.start_date IS 'When person joined family (useful for foster care)';


--
-- Name: COLUMN family_members.end_date; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.family_members.end_date IS 'When placement ended (triggers is_active=false)';


--
-- Name: COLUMN family_members.is_temporary; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.family_members.is_temporary IS 'True for foster/temporary placements';


--
-- Name: COLUMN family_members.is_primary_contact; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.family_members.is_primary_contact IS 'Primary contact for family matters';


--
-- Name: identity_links; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.identity_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    person_a_id uuid NOT NULL,
    person_b_id uuid NOT NULL,
    status character varying(20) DEFAULT 'suggested'::character varying NOT NULL,
    confidence_score numeric(5,2) NOT NULL,
    match_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    detected_by character varying(50) DEFAULT 'system'::character varying NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    review_notes text,
    suppressed_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT identity_links_ordered CHECK ((person_a_id < person_b_id)),
    CONSTRAINT identity_links_status CHECK (((status)::text = ANY ((ARRAY['suggested'::character varying, 'confirmed'::character varying, 'not_match'::character varying, 'merged'::character varying])::text[])))
);


ALTER TABLE public.identity_links OWNER TO worship;

--
-- Name: merge_events; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.merge_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    survivor_id uuid NOT NULL,
    merged_ids uuid[] NOT NULL,
    merged_snapshots jsonb NOT NULL,
    field_resolutions jsonb NOT NULL,
    transferred_records jsonb DEFAULT '{}'::jsonb,
    performed_by uuid NOT NULL,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    undone_at timestamp with time zone,
    undone_by uuid,
    undo_reason text,
    identity_link_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.merge_events OWNER TO worship;

--
-- Name: ministry_areas; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.ministry_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    color text,
    icon text,
    display_order integer DEFAULT 0,
    parent_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


ALTER TABLE public.ministry_areas OWNER TO worship;

--
-- Name: TABLE ministry_areas; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.ministry_areas IS 'Ministry divisions within a church. Used for section ownership, role categorization, and future permission scoping.';


--
-- Name: COLUMN ministry_areas.name; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.ministry_areas.name IS 'Lowercase identifier: worship, pastoral, kids, youth, hospitality, tech, admin';


--
-- Name: COLUMN ministry_areas.parent_id; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.ministry_areas.parent_id IS 'Optional hierarchy: e.g., "av" under "tech"';


--
-- Name: COLUMN ministry_areas.archived_at; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.ministry_areas.archived_at IS 'Soft delete - never remove data';


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid NOT NULL,
    notify_via_email boolean DEFAULT true,
    notify_via_sms boolean DEFAULT false,
    email text,
    phone_number text,
    auto_accept_roles text[],
    require_confirmation boolean DEFAULT true,
    reminder_days_before integer DEFAULT 3,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notification_preferences OWNER TO worship;

--
-- Name: TABLE notification_preferences; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.notification_preferences IS 'How each person wants to be notified about scheduling';


--
-- Name: COLUMN notification_preferences.phone_number; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.notification_preferences.phone_number IS 'For SMS: E.164 format +12065551234';


--
-- Name: COLUMN notification_preferences.auto_accept_roles; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.notification_preferences.auto_accept_roles IS 'Role IDs that should auto-confirm without prompt';


--
-- Name: person_aliases; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.person_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid NOT NULL,
    alias_type character varying(20) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    full_name character varying(200),
    source character varying(100) DEFAULT 'manual'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT person_aliases_type CHECK (((alias_type)::text = ANY ((ARRAY['legal'::character varying, 'preferred'::character varying, 'maiden'::character varying, 'nickname'::character varying, 'typo'::character varying, 'merged'::character varying])::text[])))
);


ALTER TABLE public.person_aliases OWNER TO worship;

--
-- Name: person_role_capabilities; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.person_role_capabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    person_id uuid NOT NULL,
    role_id uuid NOT NULL,
    proficiency smallint DEFAULT 3 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    is_approved boolean DEFAULT true NOT NULL,
    notes text,
    verified_by_person_id uuid,
    verified_at timestamp with time zone,
    CONSTRAINT chk_prc_proficiency_range CHECK (((proficiency IS NULL) OR ((proficiency >= 1) AND (proficiency <= 5))))
);


ALTER TABLE public.person_role_capabilities OWNER TO worship;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    load_weight integer DEFAULT 10 NOT NULL,
    ministry_area text,
    description text,
    is_active boolean DEFAULT true,
    body_parts text[] DEFAULT '{}'::text[],
    team_id uuid,
    CONSTRAINT chk_roles_load_weight_positive CHECK ((load_weight > 0))
);


ALTER TABLE public.roles OWNER TO worship;

--
-- Name: COLUMN roles.body_parts; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.roles.body_parts IS 'Body parts required for this role (hands, feet, voice, eyes) - used for scheduling conflict detection';


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.schema_migrations (
    id text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO worship;

--
-- Name: service_amendments; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_amendments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    service_instance_id uuid NOT NULL,
    amendment_type text NOT NULL,
    reference_table text,
    reference_id uuid,
    planned_value jsonb,
    actual_value jsonb,
    reason text,
    notes text,
    ccli_relevant boolean DEFAULT false,
    ccli_song_number text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    verified_at timestamp with time zone,
    verified_by uuid,
    CONSTRAINT valid_amendment_type CHECK ((amendment_type = ANY (ARRAY['song_change'::text, 'song_skip'::text, 'song_add'::text, 'section_skip'::text, 'section_add'::text, 'section_reorder'::text, 'timing_change'::text, 'personnel_change'::text, 'order_change'::text, 'general_note'::text])))
);


ALTER TABLE public.service_amendments OWNER TO worship;

--
-- Name: TABLE service_amendments; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.service_amendments IS 'Records differences between planned and actual service execution. Core to "system never lies" philosophy.';


--
-- Name: COLUMN service_amendments.ccli_relevant; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_amendments.ccli_relevant IS 'Flag for amendments affecting CCLI reporting (song changes/skips).';


--
-- Name: COLUMN service_amendments.recorded_by; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_amendments.recorded_by IS 'RESTRICT delete - we must always know who recorded an amendment.';


--
-- Name: service_assignments; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    service_instance_id uuid NOT NULL,
    role_id uuid NOT NULL,
    person_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    is_lead boolean DEFAULT false,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    confirmed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_assignment_status_valid CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'declined'::text, 'tentative'::text])))
);


ALTER TABLE public.service_assignments OWNER TO worship;

--
-- Name: service_audit_log; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    old_values jsonb,
    new_values jsonb,
    changed_fields text[],
    change_reason text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    is_amendment boolean DEFAULT false,
    amendment_id uuid,
    CONSTRAINT valid_audit_action CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text, 'lock'::text, 'unlock'::text, 'archive'::text, 'restore'::text])))
);


ALTER TABLE public.service_audit_log OWNER TO worship;

--
-- Name: TABLE service_audit_log; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.service_audit_log IS 'Complete audit trail for all service-related changes. Supports "system never lies" philosophy.';


--
-- Name: service_groups; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    group_date date NOT NULL,
    name text NOT NULL,
    context_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.service_groups OWNER TO worship;

--
-- Name: service_instance_sections; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_instance_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    service_instance_id uuid NOT NULL,
    template_section_id uuid,
    display_order integer NOT NULL,
    name text NOT NULL,
    section_type text NOT NULL,
    ministry_area_id uuid,
    planned_start_time time without time zone,
    planned_duration_minutes integer,
    actual_start_time time without time zone,
    actual_duration_minutes integer,
    content jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text,
    marked_ready_at timestamp with time zone,
    marked_ready_by uuid,
    approved_at timestamp with time zone,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT valid_instance_section_status CHECK ((status = ANY (ARRAY['pending'::text, 'draft'::text, 'ready'::text, 'approved'::text, 'completed'::text, 'skipped'::text])))
);


ALTER TABLE public.service_instance_sections OWNER TO worship;

--
-- Name: TABLE service_instance_sections; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.service_instance_sections IS 'Actual sections for a specific service instance. Links to template but allows overrides.';


--
-- Name: COLUMN service_instance_sections.actual_start_time; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instance_sections.actual_start_time IS 'Filled after service to record what actually happened (for reporting/care insights).';


--
-- Name: service_instance_songs; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_instance_songs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_instance_id uuid NOT NULL,
    song_id uuid NOT NULL,
    display_order integer NOT NULL,
    key text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    arrangement_id uuid,
    transpose_steps integer DEFAULT 0,
    custom_structure jsonb,
    section_id uuid,
    status text DEFAULT 'planned'::text,
    was_performed boolean,
    actual_key text,
    ccli_reported boolean DEFAULT false,
    ccli_report_date date,
    created_by uuid,
    updated_by uuid,
    church_id uuid NOT NULL
);


ALTER TABLE public.service_instance_songs OWNER TO worship;

--
-- Name: TABLE service_instance_songs; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.service_instance_songs IS 'Songs included in each service instance (the setlist)';


--
-- Name: COLUMN service_instance_songs.key; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instance_songs.key IS 'Override key for this service (e.g., transpose from G to C)';


--
-- Name: COLUMN service_instance_songs.arrangement_id; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instance_songs.arrangement_id IS 'Arrangement selection for this service slot';


--
-- Name: COLUMN service_instance_songs.transpose_steps; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instance_songs.transpose_steps IS 'Transpose steps relative to arrangement key';


--
-- Name: COLUMN service_instance_songs.custom_structure; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instance_songs.custom_structure IS 'Per-service overrides to arrangement structure';


--
-- Name: COLUMN service_instance_songs.section_id; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instance_songs.section_id IS 'Links song to a specific section (e.g., opening worship vs closing).';


--
-- Name: COLUMN service_instance_songs.was_performed; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instance_songs.was_performed IS 'NULL = pending, true = performed, false = skipped. Set after service.';


--
-- Name: COLUMN service_instance_songs.actual_key; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instance_songs.actual_key IS 'Key actually used if different from planned.';


--
-- Name: COLUMN service_instance_songs.ccli_reported; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instance_songs.ccli_reported IS 'Has this song usage been included in CCLI report?';


--
-- Name: service_instances; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    service_date date NOT NULL,
    service_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    service_group_id uuid,
    campus_id uuid,
    service_type_id uuid,
    template_id uuid,
    status text DEFAULT 'draft'::text,
    locked_at timestamp with time zone,
    locked_by uuid,
    lock_reason text,
    completed_at timestamp with time zone,
    completed_by uuid,
    archived_at timestamp with time zone,
    archived_by uuid,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT chk_service_instance_status CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'locked'::text, 'completed'::text, 'cancelled'::text])))
);


ALTER TABLE public.service_instances OWNER TO worship;

--
-- Name: COLUMN service_instances.status; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instances.status IS 'Workflow: draft (editable) -> scheduled (planned) -> locked (finalized) -> completed (done)';


--
-- Name: COLUMN service_instances.locked_at; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instances.locked_at IS 'Once locked, direct edits are prevented. Only amendments can record changes.';


--
-- Name: COLUMN service_instances.archived_at; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_instances.archived_at IS 'Soft delete - services are never truly deleted for historical accuracy.';


--
-- Name: service_items; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    service_instance_id uuid NOT NULL,
    sort_order integer NOT NULL,
    item_type text NOT NULL,
    song_variant_id uuid,
    notes text,
    CONSTRAINT chk_service_items_sort_order_positive CHECK ((sort_order > 0))
);


ALTER TABLE public.service_items OWNER TO worship;

--
-- Name: service_role_requirements; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_role_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    context_id uuid NOT NULL,
    role_id uuid NOT NULL,
    min_needed integer DEFAULT 1 NOT NULL,
    max_needed integer,
    display_order integer DEFAULT 0
);


ALTER TABLE public.service_role_requirements OWNER TO worship;

--
-- Name: service_team_assignments; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_team_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    service_instance_id uuid NOT NULL,
    person_id uuid NOT NULL,
    role_id uuid NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL
);


ALTER TABLE public.service_team_assignments OWNER TO worship;

--
-- Name: service_templates; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    context_id uuid,
    default_start_time time without time zone,
    default_duration_minutes integer DEFAULT 90,
    structure jsonb,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    version integer DEFAULT 1,
    parent_template_id uuid,
    updated_by uuid
);


ALTER TABLE public.service_templates OWNER TO worship;

--
-- Name: TABLE service_templates; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.service_templates IS 'The reusable patterns/stamps for services';


--
-- Name: COLUMN service_templates.structure; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_templates.structure IS 'JSON structure of segments, roles, and details';


--
-- Name: COLUMN service_templates.archived_at; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_templates.archived_at IS 'Soft delete timestamp';


--
-- Name: COLUMN service_templates.version; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_templates.version IS 'Version number - incremented on significant changes';


--
-- Name: COLUMN service_templates.parent_template_id; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_templates.parent_template_id IS 'If this template was derived from another';


--
-- Name: service_types; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    context_id uuid,
    recurrence_rule jsonb DEFAULT '{"frequency": "weekly", "day_of_week": ["sunday"]}'::jsonb NOT NULL,
    default_template_id uuid,
    default_times jsonb DEFAULT '[]'::jsonb NOT NULL,
    planning_lead_days integer DEFAULT 14,
    is_active boolean DEFAULT true NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


ALTER TABLE public.service_types OWNER TO worship;

--
-- Name: TABLE service_types; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.service_types IS 'Recurring service patterns. Defines when services happen and with what defaults.';


--
-- Name: COLUMN service_types.recurrence_rule; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_types.recurrence_rule IS 'RRULE-like pattern for generating service dates. See JSONB structure in comments.';


--
-- Name: COLUMN service_types.default_times; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.service_types.default_times IS 'Array of time slots with optional campus assignments for multi-campus or multi-service days.';


--
-- Name: song_arrangements; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.song_arrangements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    song_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    key text,
    bpm integer,
    time_signature text,
    structure jsonb NOT NULL,
    is_default boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.song_arrangements OWNER TO worship;

--
-- Name: TABLE song_arrangements; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.song_arrangements IS 'Different arrangements/structures for a single song';


--
-- Name: COLUMN song_arrangements.structure; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_arrangements.structure IS 'JSON payload describing section order and repeats';


--
-- Name: song_sections; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.song_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    song_id uuid NOT NULL,
    section_type text NOT NULL,
    section_number integer,
    label text NOT NULL,
    lyrics text NOT NULL,
    chords jsonb,
    display_order integer NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    seasonal_tags text[],
    availability text DEFAULT 'always'::text,
    CONSTRAINT song_sections_availability_check CHECK ((availability = ANY (ARRAY['always'::text, 'seasonal'::text, 'special'::text])))
);


ALTER TABLE public.song_sections OWNER TO worship;

--
-- Name: TABLE song_sections; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.song_sections IS 'Individual sections (verses, choruses) of songs with lyrics and chords';


--
-- Name: COLUMN song_sections.chords; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_sections.chords IS 'JSON: {lines: [{lyrics: "...", chords: [{position: 0, chord: "C"}]}]}';


--
-- Name: COLUMN song_sections.seasonal_tags; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_sections.seasonal_tags IS 'Array of tags like [''christmas'', ''easter'', ''baptism''] for seasonal verses';


--
-- Name: COLUMN song_sections.availability; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_sections.availability IS 'When this section is available: always (year-round), seasonal (tagged periods), special (one-time use)';


--
-- Name: song_variants; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.song_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    song_id uuid NOT NULL,
    name text NOT NULL,
    default_key text,
    tempo integer,
    time_signature text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    variant_type text DEFAULT 'arrangement'::text,
    style_description text,
    tempo_modifier text,
    key_modifier text,
    context_tags text[],
    active_dates daterange,
    notes text,
    is_default boolean DEFAULT false,
    CONSTRAINT song_variants_variant_type_check CHECK ((variant_type = ANY (ARRAY['style'::text, 'arrangement'::text, 'seasonal'::text, 'custom'::text])))
);


ALTER TABLE public.song_variants OWNER TO worship;

--
-- Name: COLUMN song_variants.content; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_variants.content IS 'JSONB structure: 
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


--
-- Name: COLUMN song_variants.variant_type; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_variants.variant_type IS 'Type of variant: style (R&B/Gospel), arrangement (structure), seasonal (Christmas), custom';


--
-- Name: COLUMN song_variants.style_description; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_variants.style_description IS 'Human-readable description of musical style: "R&B feel, add Hammond organ, syncopated drums"';


--
-- Name: COLUMN song_variants.tempo_modifier; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_variants.tempo_modifier IS 'Relative tempo: "slower", "faster", "more groove", "half-time feel"';


--
-- Name: COLUMN song_variants.key_modifier; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_variants.key_modifier IS 'How key changed from original: "+2 steps", "down to Am", "capo 3"';


--
-- Name: COLUMN song_variants.context_tags; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_variants.context_tags IS 'When to use: [''christmas'', ''easter'', ''baptism'', ''communion'', ''outdoor'']';


--
-- Name: COLUMN song_variants.active_dates; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_variants.active_dates IS 'Date range when variant is active (for seasonal use): ''[2024-12-01, 2025-01-06]''';


--
-- Name: COLUMN song_variants.notes; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.song_variants.notes IS 'Performance notes or instructions for using this variant';


--
-- Name: songs; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.songs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    title text NOT NULL,
    ccli_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    artist text,
    key text,
    bpm integer,
    notes text,
    source_format text DEFAULT 'plain_text'::text NOT NULL,
    raw_text text,
    parsed_json jsonb DEFAULT jsonb_build_object('format', 'plain_text', 'sections', jsonb_build_array(), 'warnings', jsonb_build_array(), 'generated_at', now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT songs_source_format_check CHECK ((source_format = ANY (ARRAY['plain_text'::text, 'chordpro'::text])))
);


ALTER TABLE public.songs OWNER TO worship;

--
-- Name: COLUMN songs.source_format; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.songs.source_format IS 'Indicates whether lyrics were entered as plain text or ChordPro';


--
-- Name: COLUMN songs.raw_text; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.songs.raw_text IS 'Original user-submitted lyrics/chords text blob';


--
-- Name: COLUMN songs.parsed_json; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.songs.parsed_json IS 'Server-side parsed representation of lyrics + chords';


--
-- Name: COLUMN songs.updated_at; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.songs.updated_at IS 'Auto-managed last update timestamp';


--
-- Name: teams; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#667eea'::text,
    icon text DEFAULT '👥'::text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.teams OWNER TO worship;

--
-- Name: TABLE teams; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.teams IS 'Ministry teams that group related roles (Worship, Hospitality, Kids, Tech, etc.)';


--
-- Name: template_sections; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.template_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    church_id uuid NOT NULL,
    template_id uuid NOT NULL,
    display_order integer NOT NULL,
    name text NOT NULL,
    section_type text NOT NULL,
    relative_start_minutes integer,
    estimated_duration_minutes integer,
    is_flexible_timing boolean DEFAULT false,
    ministry_area_id uuid,
    ownership_config jsonb DEFAULT '{}'::jsonb,
    config jsonb DEFAULT '{}'::jsonb,
    default_content jsonb,
    is_required boolean DEFAULT true,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT valid_section_type CHECK ((section_type = ANY (ARRAY['worship'::text, 'message'::text, 'announcement'::text, 'prayer'::text, 'offering'::text, 'communion'::text, 'baptism'::text, 'transition'::text, 'video'::text, 'other'::text])))
);


ALTER TABLE public.template_sections OWNER TO worship;

--
-- Name: TABLE template_sections; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON TABLE public.template_sections IS 'Sections within a service template. ministry_area_id determines ownership for future authorization.';


--
-- Name: COLUMN template_sections.ministry_area_id; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.template_sections.ministry_area_id IS 'Which ministry owns this section. Future auth will use this for edit permissions.';


--
-- Name: COLUMN template_sections.ownership_config; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON COLUMN public.template_sections.ownership_config IS 'Extensible configuration for future authorization system. Reserved for future use.';


--
-- Name: v_ccli_report_v2; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.v_ccli_report_v2 AS
 SELECT si.church_id,
    sg.group_date AS service_date,
    si.service_time,
    s.title AS song_title,
    s.ccli_number,
    COALESCE(sis.actual_key, sis.key, s.key) AS key_performed,
    sis.was_performed,
    sis.ccli_reported,
    sis.ccli_report_date,
    sa.amendment_type,
    (sa.actual_value ->> 'song_title'::text) AS substituted_with,
    (sa.actual_value ->> 'ccli_number'::text) AS substituted_ccli_number
   FROM ((((public.service_instance_songs sis
     JOIN public.service_instances si ON ((si.id = sis.service_instance_id)))
     JOIN public.service_groups sg ON ((sg.id = si.service_group_id)))
     JOIN public.songs s ON ((s.id = sis.song_id)))
     LEFT JOIN public.service_amendments sa ON (((sa.reference_id = sis.id) AND (sa.reference_table = 'service_instance_songs'::text) AND (sa.ccli_relevant = true))))
  WHERE ((si.status = 'completed'::text) AND ((sis.was_performed = true) OR (sa.id IS NOT NULL)));


ALTER VIEW public.v_ccli_report_v2 OWNER TO worship;

--
-- Name: VIEW v_ccli_report_v2; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON VIEW public.v_ccli_report_v2 IS 'View for CCLI reporting - shows performed songs including substitutions via amendments.';


--
-- Name: v_context_role_requirements; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.v_context_role_requirements AS
 SELECT c.id AS context_id,
    c.name AS context_name,
    r.id AS role_id,
    r.name AS role_name,
    r.ministry_area,
    srr.min_needed,
    srr.max_needed,
    (srr.min_needed > 0) AS is_required,
    srr.display_order,
        CASE
            WHEN (srr.min_needed > 0) THEN '✓ Required'::text
            ELSE 'Optional'::text
        END AS requirement_status
   FROM ((public.contexts c
     JOIN public.service_role_requirements srr ON ((srr.context_id = c.id)))
     JOIN public.roles r ON ((r.id = srr.role_id)))
  ORDER BY c.name, r.ministry_area, srr.display_order, r.name;


ALTER VIEW public.v_context_role_requirements OWNER TO worship;

--
-- Name: VIEW v_context_role_requirements; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON VIEW public.v_context_role_requirements IS 'Shows which roles are required vs optional for each service type';


--
-- Name: v_family_summary; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.v_family_summary AS
 SELECT f.id AS family_id,
    f.church_id,
    f.name AS family_name,
    f.is_active,
    count(DISTINCT fm.person_id) FILTER (WHERE (fm.is_active = true)) AS active_members,
    count(DISTINCT fm.person_id) FILTER (WHERE ((fm.relationship = ANY (ARRAY['child'::text, 'foster_child'::text])) AND (fm.is_active = true))) AS active_children,
    count(DISTINCT fm.person_id) FILTER (WHERE ((fm.relationship = 'foster_child'::text) AND (fm.is_active = true))) AS active_foster_children,
    array_agg(DISTINCT p.display_name ORDER BY p.display_name) FILTER (WHERE (fm.is_primary_contact = true)) AS primary_contacts
   FROM ((public.families f
     LEFT JOIN public.family_members fm ON ((fm.family_id = f.id)))
     LEFT JOIN public.people p ON (((p.id = fm.person_id) AND (fm.is_primary_contact = true))))
  GROUP BY f.id, f.church_id, f.name, f.is_active;


ALTER VIEW public.v_family_summary OWNER TO worship;

--
-- Name: v_section_ownership; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.v_section_ownership AS
 SELECT ts.id AS template_section_id,
    st.name AS template_name,
    ts.name AS section_name,
    ts.section_type,
    ts.display_order,
    ma.id AS ministry_area_id,
    ma.name AS ministry_area,
    ma.display_name AS ministry_display_name,
    ts.is_required,
    ts.estimated_duration_minutes
   FROM ((public.template_sections ts
     JOIN public.service_templates st ON ((st.id = ts.template_id)))
     LEFT JOIN public.ministry_areas ma ON ((ma.id = ts.ministry_area_id)))
  WHERE ((ts.is_active = true) AND (st.is_active = true))
  ORDER BY st.name, ts.display_order;


ALTER VIEW public.v_section_ownership OWNER TO worship;

--
-- Name: VIEW v_section_ownership; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON VIEW public.v_section_ownership IS 'Shows which ministry area owns each template section - useful for future auth system.';


--
-- Name: v_service_assignment_summary; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.v_service_assignment_summary AS
 SELECT si.id AS service_instance_id,
    sg.group_date,
    sg.name AS service_name,
    si.service_time,
    c.name AS campus_name,
    count(DISTINCT srr.role_id) AS total_positions,
    count(DISTINCT sa.id) FILTER (WHERE (sa.person_id IS NOT NULL)) AS filled_positions,
    count(DISTINCT sa.id) FILTER (WHERE (sa.status = 'confirmed'::text)) AS confirmed_assignments,
    count(DISTINCT sa.id) FILTER (WHERE (sa.status = 'pending'::text)) AS pending_confirmations,
    count(DISTINCT sa.id) FILTER (WHERE (sa.status = 'declined'::text)) AS declined_assignments,
    count(DISTINCT srr.role_id) FILTER (WHERE (NOT (EXISTS ( SELECT 1
           FROM public.service_assignments sa2
          WHERE ((sa2.service_instance_id = si.id) AND (sa2.role_id = srr.role_id) AND (sa2.person_id IS NOT NULL)))))) AS unfilled_positions
   FROM ((((public.service_instances si
     JOIN public.service_groups sg ON ((sg.id = si.service_group_id)))
     LEFT JOIN public.campuses c ON ((c.id = si.campus_id)))
     LEFT JOIN public.service_role_requirements srr ON ((srr.context_id = sg.context_id)))
     LEFT JOIN public.service_assignments sa ON (((sa.service_instance_id = si.id) AND (sa.role_id = srr.role_id))))
  GROUP BY si.id, sg.group_date, sg.name, si.service_time, c.name;


ALTER VIEW public.v_service_assignment_summary OWNER TO worship;

--
-- Name: v_service_staffing_detail; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.v_service_staffing_detail AS
 SELECT si.id AS service_instance_id,
    sg.group_date,
    sg.name AS service_name,
    si.service_time,
    r.id AS role_id,
    r.name AS role_name,
    r.ministry_area,
    srr.min_needed,
    srr.max_needed,
    (srr.min_needed > 0) AS is_required,
    count(sa.id) FILTER (WHERE (sa.person_id IS NOT NULL)) AS filled_count,
    count(sa.id) FILTER (WHERE (sa.status = 'confirmed'::text)) AS confirmed_count,
    count(sa.id) FILTER (WHERE ((sa.status = 'pending'::text) AND (sa.person_id IS NOT NULL))) AS pending_count,
        CASE
            WHEN ((srr.min_needed > 0) AND (count(sa.id) FILTER (WHERE (sa.person_id IS NOT NULL)) < srr.min_needed)) THEN '🔴 UNFILLED'::text
            WHEN (count(sa.id) FILTER (WHERE ((sa.status = 'pending'::text) AND (sa.person_id IS NOT NULL))) > 0) THEN '🟡 PENDING'::text
            WHEN (count(sa.id) FILTER (WHERE (sa.status = 'confirmed'::text)) >= srr.min_needed) THEN '🟢 STAFFED'::text
            ELSE '⚪ OPTIONAL'::text
        END AS status
   FROM ((((public.service_instances si
     JOIN public.service_groups sg ON ((sg.id = si.service_group_id)))
     JOIN public.service_role_requirements srr ON ((srr.context_id = sg.context_id)))
     JOIN public.roles r ON ((r.id = srr.role_id)))
     LEFT JOIN public.service_assignments sa ON (((sa.service_instance_id = si.id) AND (sa.role_id = r.id))))
  GROUP BY si.id, sg.group_date, sg.name, si.service_time, r.id, r.name, r.ministry_area, srr.min_needed, srr.max_needed
  ORDER BY sg.group_date DESC, si.service_time, r.ministry_area, r.name;


ALTER VIEW public.v_service_staffing_detail OWNER TO worship;

--
-- Name: VIEW v_service_staffing_detail; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON VIEW public.v_service_staffing_detail IS 'Shows staffing status for each role in each service with is_required flag';


--
-- Name: v_service_status_v2; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.v_service_status_v2 AS
 SELECT si.id,
    si.church_id,
    sg.group_date,
    sg.name AS service_name,
    si.service_time,
    c.name AS campus_name,
    st.name AS service_type_name,
    si.status,
    si.locked_at,
    lp.display_name AS locked_by_name,
    si.completed_at,
    ( SELECT count(*) AS count
           FROM public.service_instance_sections
          WHERE (service_instance_sections.service_instance_id = si.id)) AS total_sections,
    ( SELECT count(*) AS count
           FROM public.service_instance_sections
          WHERE ((service_instance_sections.service_instance_id = si.id) AND (service_instance_sections.status = ANY (ARRAY['ready'::text, 'approved'::text, 'completed'::text])))) AS ready_sections,
    ( SELECT count(*) AS count
           FROM public.service_amendments
          WHERE (service_amendments.service_instance_id = si.id)) AS amendment_count,
    ( SELECT count(*) AS count
           FROM public.service_instance_songs
          WHERE (service_instance_songs.service_instance_id = si.id)) AS planned_songs,
    ( SELECT count(*) AS count
           FROM public.service_instance_songs
          WHERE ((service_instance_songs.service_instance_id = si.id) AND (service_instance_songs.was_performed = true))) AS performed_songs
   FROM ((((public.service_instances si
     JOIN public.service_groups sg ON ((sg.id = si.service_group_id)))
     LEFT JOIN public.campuses c ON ((c.id = si.campus_id)))
     LEFT JOIN public.service_types st ON ((st.id = si.service_type_id)))
     LEFT JOIN public.people lp ON ((lp.id = si.locked_by)))
  WHERE (si.archived_at IS NULL);


ALTER VIEW public.v_service_status_v2 OWNER TO worship;

--
-- Name: VIEW v_service_status_v2; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON VIEW public.v_service_status_v2 IS 'Service instances with status, readiness, and amendment metrics.';


--
-- Name: v_services_display; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.v_services_display AS
 SELECT si.id AS service_instance_id,
    si.service_date,
    si.service_time,
    sg.id AS service_group_id,
    sg.group_date,
    sg.name AS service_name,
    sg.context_id,
    ctx.name AS context_name,
    si.campus_id,
    c.name AS campus_name,
    si.church_id,
    ((sg.name || ' — '::text) || to_char((si.service_time)::interval, 'HH12:MI AM'::text)) AS display_name,
        CASE
            WHEN (c.name IS NOT NULL) THEN (((((sg.name || ' — '::text) || to_char((si.service_time)::interval, 'HH12:MI AM'::text)) || ' ('::text) || c.name) || ')'::text)
            ELSE ((sg.name || ' — '::text) || to_char((si.service_time)::interval, 'HH12:MI AM'::text))
        END AS display_name_with_campus
   FROM (((public.service_instances si
     JOIN public.service_groups sg ON ((si.service_group_id = sg.id)))
     LEFT JOIN public.campuses c ON ((si.campus_id = c.id)))
     LEFT JOIN public.contexts ctx ON ((sg.context_id = ctx.id)));


ALTER VIEW public.v_services_display OWNER TO worship;

--
-- Name: v_template_summary; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.v_template_summary AS
 SELECT t.id,
    t.name,
    t.description,
    c.name AS context_name,
    t.default_start_time,
    t.default_duration_minutes,
    t.is_default,
    jsonb_array_length((t.structure -> 'segments'::text)) AS segment_count,
    t.created_at,
    p.display_name AS created_by_name
   FROM ((public.service_templates t
     LEFT JOIN public.contexts c ON ((c.id = t.context_id)))
     LEFT JOIN public.people p ON ((p.id = t.created_by)))
  WHERE (t.is_active = true)
  ORDER BY c.name, t.is_default DESC, t.name;


ALTER VIEW public.v_template_summary OWNER TO worship;

--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: assignment_notifications assignment_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.assignment_notifications
    ADD CONSTRAINT assignment_notifications_pkey PRIMARY KEY (id);


--
-- Name: campuses campuses_church_id_id_uniq; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_church_id_id_uniq UNIQUE (church_id, id);


--
-- Name: campuses campuses_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_org_id_name_key UNIQUE (church_id, name);


--
-- Name: campuses campuses_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_pkey PRIMARY KEY (id);


--
-- Name: contact_methods contact_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.contact_methods
    ADD CONSTRAINT contact_methods_pkey PRIMARY KEY (id);


--
-- Name: contexts contexts_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.contexts
    ADD CONSTRAINT contexts_org_id_name_key UNIQUE (church_id, name);


--
-- Name: contexts contexts_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.contexts
    ADD CONSTRAINT contexts_pkey PRIMARY KEY (id);


--
-- Name: families families_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_pkey PRIMARY KEY (id);


--
-- Name: family_members family_members_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_pkey PRIMARY KEY (id);


--
-- Name: family_members fm_org_family_person_uniq; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT fm_org_family_person_uniq UNIQUE (church_id, family_id, person_id);


--
-- Name: identity_links identity_links_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.identity_links
    ADD CONSTRAINT identity_links_pkey PRIMARY KEY (id);


--
-- Name: identity_links identity_links_unique; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.identity_links
    ADD CONSTRAINT identity_links_unique UNIQUE (church_id, person_a_id, person_b_id);


--
-- Name: merge_events merge_events_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.merge_events
    ADD CONSTRAINT merge_events_pkey PRIMARY KEY (id);


--
-- Name: ministry_areas ministry_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.ministry_areas
    ADD CONSTRAINT ministry_areas_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: churches orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.churches
    ADD CONSTRAINT orgs_pkey PRIMARY KEY (id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: person_aliases person_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.person_aliases
    ADD CONSTRAINT person_aliases_pkey PRIMARY KEY (id);


--
-- Name: person_role_capabilities person_role_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.person_role_capabilities
    ADD CONSTRAINT person_role_capabilities_pkey PRIMARY KEY (id);


--
-- Name: person_role_capabilities prc_org_person_role_uniq; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.person_role_capabilities
    ADD CONSTRAINT prc_org_person_role_uniq UNIQUE (church_id, person_id, role_id);


--
-- Name: roles roles_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_org_id_name_key UNIQUE (church_id, name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: service_assignments sa_org_instance_role_person_uniq; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT sa_org_instance_role_person_uniq UNIQUE (church_id, service_instance_id, role_id, person_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: service_amendments service_amendments_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_amendments
    ADD CONSTRAINT service_amendments_pkey PRIMARY KEY (id);


--
-- Name: service_assignments service_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT service_assignments_pkey PRIMARY KEY (id);


--
-- Name: service_audit_log service_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_audit_log
    ADD CONSTRAINT service_audit_log_pkey PRIMARY KEY (id);


--
-- Name: service_groups service_groups_church_id_id_uniq; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_groups
    ADD CONSTRAINT service_groups_church_id_id_uniq UNIQUE (church_id, id);


--
-- Name: service_groups service_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_groups
    ADD CONSTRAINT service_groups_pkey PRIMARY KEY (id);


--
-- Name: service_instance_sections service_instance_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT service_instance_sections_pkey PRIMARY KEY (id);


--
-- Name: service_instance_songs service_instance_songs_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_songs
    ADD CONSTRAINT service_instance_songs_pkey PRIMARY KEY (id);


--
-- Name: service_items service_items_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_pkey PRIMARY KEY (id);


--
-- Name: service_role_requirements service_role_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_role_requirements
    ADD CONSTRAINT service_role_requirements_pkey PRIMARY KEY (id);


--
-- Name: service_team_assignments service_team_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_team_assignments
    ADD CONSTRAINT service_team_assignments_pkey PRIMARY KEY (id);


--
-- Name: service_team_assignments service_team_assignments_service_id_person_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_team_assignments
    ADD CONSTRAINT service_team_assignments_service_id_person_id_role_id_key UNIQUE (service_instance_id, person_id, role_id);


--
-- Name: service_templates service_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_templates
    ADD CONSTRAINT service_templates_pkey PRIMARY KEY (id);


--
-- Name: service_types service_types_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_pkey PRIMARY KEY (id);


--
-- Name: service_instances services_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: song_arrangements song_arrangements_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_arrangements
    ADD CONSTRAINT song_arrangements_pkey PRIMARY KEY (id);


--
-- Name: song_sections song_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_sections
    ADD CONSTRAINT song_sections_pkey PRIMARY KEY (id);


--
-- Name: song_variants song_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_variants
    ADD CONSTRAINT song_variants_pkey PRIMARY KEY (id);


--
-- Name: songs songs_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.songs
    ADD CONSTRAINT songs_pkey PRIMARY KEY (id);


--
-- Name: service_role_requirements srr_org_context_role_uniq; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_role_requirements
    ADD CONSTRAINT srr_org_context_role_uniq UNIQUE (church_id, context_id, role_id);


--
-- Name: teams teams_church_id_name_key; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_church_id_name_key UNIQUE (church_id, name);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: template_sections template_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.template_sections
    ADD CONSTRAINT template_sections_pkey PRIMARY KEY (id);


--
-- Name: ministry_areas unique_church_ministry_area; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.ministry_areas
    ADD CONSTRAINT unique_church_ministry_area UNIQUE (church_id, name);


--
-- Name: service_types unique_church_service_type; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT unique_church_service_type UNIQUE (church_id, name);


--
-- Name: service_instances unique_instance_church_id; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT unique_instance_church_id UNIQUE (church_id, id);


--
-- Name: service_instance_sections unique_instance_section_order; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT unique_instance_section_order UNIQUE (service_instance_id, display_order);


--
-- Name: service_templates unique_org_template_name; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_templates
    ADD CONSTRAINT unique_org_template_name UNIQUE (church_id, name);


--
-- Name: notification_preferences unique_person_notification_prefs; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT unique_person_notification_prefs UNIQUE (church_id, person_id);


--
-- Name: service_instance_songs unique_service_song_order; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_songs
    ADD CONSTRAINT unique_service_song_order UNIQUE (service_instance_id, display_order);


--
-- Name: song_arrangements unique_song_arrangement_name; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_arrangements
    ADD CONSTRAINT unique_song_arrangement_name UNIQUE (song_id, name);


--
-- Name: template_sections unique_template_section_order; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.template_sections
    ADD CONSTRAINT unique_template_section_order UNIQUE (template_id, display_order);


--
-- Name: idx_addresses_campus; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_addresses_campus ON public.addresses USING btree (campus_id);


--
-- Name: idx_addresses_church; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_addresses_church ON public.addresses USING btree (church_id);


--
-- Name: idx_addresses_church_id; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_addresses_church_id ON public.addresses USING btree (church_id);


--
-- Name: idx_addresses_family; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_addresses_family ON public.addresses USING btree (family_id);


--
-- Name: idx_addresses_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_addresses_person ON public.addresses USING btree (person_id);


--
-- Name: idx_amendments_ccli; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_amendments_ccli ON public.service_amendments USING btree (church_id) WHERE (ccli_relevant = true);


--
-- Name: idx_amendments_recorded; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_amendments_recorded ON public.service_amendments USING btree (recorded_at DESC);


--
-- Name: idx_amendments_service; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_amendments_service ON public.service_amendments USING btree (service_instance_id);


--
-- Name: idx_amendments_type; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_amendments_type ON public.service_amendments USING btree (amendment_type);


--
-- Name: idx_assignment_notifications_assignment; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_assignment_notifications_assignment ON public.assignment_notifications USING btree (assignment_id);


--
-- Name: idx_assignment_notifications_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_assignment_notifications_person ON public.assignment_notifications USING btree (person_id);


--
-- Name: idx_audit_changed_at; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_audit_changed_at ON public.service_audit_log USING btree (changed_at DESC);


--
-- Name: idx_audit_church_date; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_audit_church_date ON public.service_audit_log USING btree (church_id, changed_at DESC);


--
-- Name: idx_audit_table_record; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_audit_table_record ON public.service_audit_log USING btree (table_name, record_id);


--
-- Name: idx_campuses_address_id; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_campuses_address_id ON public.campuses USING btree (address_id);


--
-- Name: idx_contacts_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_contacts_person ON public.contact_methods USING btree (person_id);


--
-- Name: idx_families_active; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_families_active ON public.families USING btree (church_id, is_active);


--
-- Name: idx_families_org; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_families_org ON public.families USING btree (church_id);


--
-- Name: idx_family_members_active; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_family_members_active ON public.family_members USING btree (family_id, is_active);


--
-- Name: idx_family_members_family; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_family_members_family ON public.family_members USING btree (family_id);


--
-- Name: idx_family_members_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_family_members_person ON public.family_members USING btree (person_id);


--
-- Name: idx_family_members_relationship; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_family_members_relationship ON public.family_members USING btree (family_id, relationship);


--
-- Name: idx_identity_links_church; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_identity_links_church ON public.identity_links USING btree (church_id);


--
-- Name: idx_identity_links_pending; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_identity_links_pending ON public.identity_links USING btree (church_id, status) WHERE ((status)::text = ANY ((ARRAY['suggested'::character varying, 'confirmed'::character varying])::text[]));


--
-- Name: idx_identity_links_person_a; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_identity_links_person_a ON public.identity_links USING btree (person_a_id);


--
-- Name: idx_identity_links_person_b; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_identity_links_person_b ON public.identity_links USING btree (person_b_id);


--
-- Name: idx_identity_links_review; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_identity_links_review ON public.identity_links USING btree (church_id, status, confidence_score DESC);


--
-- Name: idx_instance_sections_ministry; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_instance_sections_ministry ON public.service_instance_sections USING btree (ministry_area_id);


--
-- Name: idx_instance_sections_service; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_instance_sections_service ON public.service_instance_sections USING btree (service_instance_id);


--
-- Name: idx_instance_sections_status; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_instance_sections_status ON public.service_instance_sections USING btree (status);


--
-- Name: idx_instance_songs_ccli_pending; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_instance_songs_ccli_pending ON public.service_instance_songs USING btree (ccli_reported) WHERE ((was_performed = true) AND (ccli_reported = false));


--
-- Name: idx_instance_songs_performed; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_instance_songs_performed ON public.service_instance_songs USING btree (service_instance_id) WHERE (was_performed = true);


--
-- Name: idx_instance_songs_section; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_instance_songs_section ON public.service_instance_songs USING btree (section_id);


--
-- Name: idx_merge_events_church; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_merge_events_church ON public.merge_events USING btree (church_id);


--
-- Name: idx_merge_events_merged; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_merge_events_merged ON public.merge_events USING gin (merged_ids);


--
-- Name: idx_merge_events_recent; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_merge_events_recent ON public.merge_events USING btree (church_id, performed_at DESC);


--
-- Name: idx_merge_events_survivor; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_merge_events_survivor ON public.merge_events USING btree (survivor_id);


--
-- Name: idx_merge_events_undoable; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_merge_events_undoable ON public.merge_events USING btree (church_id) WHERE (undone_at IS NULL);


--
-- Name: idx_ministry_areas_active; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_ministry_areas_active ON public.ministry_areas USING btree (church_id) WHERE (is_active = true);


--
-- Name: idx_ministry_areas_church; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_ministry_areas_church ON public.ministry_areas USING btree (church_id);


--
-- Name: idx_ministry_areas_parent; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_ministry_areas_parent ON public.ministry_areas USING btree (parent_id) WHERE (parent_id IS NOT NULL);


--
-- Name: idx_notification_prefs_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_notification_prefs_person ON public.notification_preferences USING btree (person_id);


--
-- Name: idx_people_active; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_people_active ON public.people USING btree (church_id, is_active);


--
-- Name: idx_people_canonical; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_people_canonical ON public.people USING btree (canonical_id) WHERE (canonical_id IS NOT NULL);


--
-- Name: idx_people_merged; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_people_merged ON public.people USING btree (merged_at) WHERE (merged_at IS NOT NULL);


--
-- Name: idx_people_org; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_people_org ON public.people USING btree (church_id);


--
-- Name: idx_person_aliases_active; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_person_aliases_active ON public.person_aliases USING btree (person_id, alias_type) WHERE (is_active = true);


--
-- Name: idx_person_aliases_church; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_person_aliases_church ON public.person_aliases USING btree (church_id);


--
-- Name: idx_person_aliases_name; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_person_aliases_name ON public.person_aliases USING btree (church_id, lower((last_name)::text), lower((first_name)::text)) WHERE (is_active = true);


--
-- Name: idx_person_aliases_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_person_aliases_person ON public.person_aliases USING btree (person_id);


--
-- Name: idx_person_role_capabilities_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_person_role_capabilities_person ON public.person_role_capabilities USING btree (person_id);


--
-- Name: idx_person_role_capabilities_role; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_person_role_capabilities_role ON public.person_role_capabilities USING btree (role_id);


--
-- Name: idx_roles_active; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_roles_active ON public.roles USING btree (church_id, is_active);


--
-- Name: idx_roles_church; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_roles_church ON public.roles USING btree (church_id);


--
-- Name: idx_roles_org; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_roles_org ON public.roles USING btree (church_id);


--
-- Name: idx_roles_team; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_roles_team ON public.roles USING btree (team_id);


--
-- Name: idx_service_assignments_instance; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_assignments_instance ON public.service_assignments USING btree (service_instance_id);


--
-- Name: idx_service_assignments_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_assignments_person ON public.service_assignments USING btree (person_id);


--
-- Name: idx_service_assignments_role; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_assignments_role ON public.service_assignments USING btree (role_id);


--
-- Name: idx_service_assignments_status; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_assignments_status ON public.service_assignments USING btree (service_instance_id, status);


--
-- Name: idx_service_groups_church_date; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_groups_church_date ON public.service_groups USING btree (church_id, group_date);


--
-- Name: idx_service_groups_org_date; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_groups_org_date ON public.service_groups USING btree (church_id, group_date);


--
-- Name: idx_service_instance_songs_arrangement; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instance_songs_arrangement ON public.service_instance_songs USING btree (arrangement_id);


--
-- Name: idx_service_instance_songs_instance; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instance_songs_instance ON public.service_instance_songs USING btree (service_instance_id);


--
-- Name: idx_service_instance_songs_song; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instance_songs_song ON public.service_instance_songs USING btree (song_id);


--
-- Name: idx_service_instances_campus; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instances_campus ON public.service_instances USING btree (campus_id);


--
-- Name: idx_service_instances_church_date; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instances_church_date ON public.service_instances USING btree (church_id, service_date, service_time);


--
-- Name: idx_service_instances_group; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instances_group ON public.service_instances USING btree (service_group_id);


--
-- Name: idx_service_instances_locked; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instances_locked ON public.service_instances USING btree (church_id, locked_at) WHERE (locked_at IS NOT NULL);


--
-- Name: idx_service_instances_org_date; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instances_org_date ON public.service_instances USING btree (church_id, service_date, service_time);


--
-- Name: idx_service_instances_service_type; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instances_service_type ON public.service_instances USING btree (service_type_id);


--
-- Name: idx_service_instances_status; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instances_status ON public.service_instances USING btree (status);


--
-- Name: idx_service_items_instance_sort; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_items_instance_sort ON public.service_items USING btree (service_instance_id, sort_order);


--
-- Name: idx_service_role_requirements_context; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_role_requirements_context ON public.service_role_requirements USING btree (church_id, context_id);


--
-- Name: idx_service_team_assignments_instance; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_team_assignments_instance ON public.service_team_assignments USING btree (service_instance_id);


--
-- Name: idx_service_team_assignments_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_team_assignments_person ON public.service_team_assignments USING btree (person_id);


--
-- Name: idx_service_team_assignments_role; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_team_assignments_role ON public.service_team_assignments USING btree (role_id);


--
-- Name: idx_service_templates_context; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_templates_context ON public.service_templates USING btree (context_id);


--
-- Name: idx_service_templates_default; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_templates_default ON public.service_templates USING btree (church_id, is_default) WHERE (is_default = true);


--
-- Name: idx_service_templates_org; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_templates_org ON public.service_templates USING btree (church_id);


--
-- Name: idx_service_types_active; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_types_active ON public.service_types USING btree (church_id) WHERE (is_active = true);


--
-- Name: idx_service_types_church; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_types_church ON public.service_types USING btree (church_id);


--
-- Name: idx_service_types_context; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_types_context ON public.service_types USING btree (context_id);


--
-- Name: idx_sis_church_instance; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_sis_church_instance ON public.service_instance_songs USING btree (church_id, service_instance_id);


--
-- Name: idx_song_arrangements_church; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_arrangements_church ON public.song_arrangements USING btree (church_id);


--
-- Name: idx_song_arrangements_default; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_arrangements_default ON public.song_arrangements USING btree (song_id, is_default) WHERE (is_default = true);


--
-- Name: idx_song_arrangements_org; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_arrangements_org ON public.song_arrangements USING btree (church_id);


--
-- Name: idx_song_arrangements_song; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_arrangements_song ON public.song_arrangements USING btree (song_id);


--
-- Name: idx_song_sections_org; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_sections_org ON public.song_sections USING btree (church_id);


--
-- Name: idx_song_sections_seasonal; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_sections_seasonal ON public.song_sections USING gin (seasonal_tags) WHERE (seasonal_tags IS NOT NULL);


--
-- Name: idx_song_sections_song; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_sections_song ON public.song_sections USING btree (song_id, display_order);


--
-- Name: idx_song_variants_context; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_variants_context ON public.song_variants USING gin (context_tags) WHERE (context_tags IS NOT NULL);


--
-- Name: idx_song_variants_dates; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_variants_dates ON public.song_variants USING gist (active_dates) WHERE (active_dates IS NOT NULL);


--
-- Name: idx_song_variants_default; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_variants_default ON public.song_variants USING btree (song_id, is_default) WHERE (is_default = true);


--
-- Name: idx_song_variants_song; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_variants_song ON public.song_variants USING btree (church_id, song_id);


--
-- Name: idx_song_variants_type; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_variants_type ON public.song_variants USING btree (song_id, variant_type);


--
-- Name: idx_teams_active; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_teams_active ON public.teams USING btree (church_id, is_active);


--
-- Name: idx_teams_church; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_teams_church ON public.teams USING btree (church_id);


--
-- Name: idx_template_sections_ministry; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_template_sections_ministry ON public.template_sections USING btree (ministry_area_id);


--
-- Name: idx_template_sections_template; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_template_sections_template ON public.template_sections USING btree (template_id);


--
-- Name: identity_links identity_links_updated_at; Type: TRIGGER; Schema: public; Owner: worship
--

CREATE TRIGGER identity_links_updated_at BEFORE UPDATE ON public.identity_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: song_arrangements song_arrangements_updated_at; Type: TRIGGER; Schema: public; Owner: worship
--

CREATE TRIGGER song_arrangements_updated_at BEFORE UPDATE ON public.song_arrangements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: songs songs_updated_at; Type: TRIGGER; Schema: public; Owner: worship
--

CREATE TRIGGER songs_updated_at BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: people trg_compute_display_name; Type: TRIGGER; Schema: public; Owner: worship
--

CREATE TRIGGER trg_compute_display_name BEFORE INSERT OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.compute_display_name();


--
-- Name: family_members trigger_auto_deactivate_family_member; Type: TRIGGER; Schema: public; Owner: worship
--

CREATE TRIGGER trigger_auto_deactivate_family_member BEFORE INSERT OR UPDATE ON public.family_members FOR EACH ROW EXECUTE FUNCTION public.auto_deactivate_family_member();


--
-- Name: addresses addresses_campus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_campus_id_fkey FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE CASCADE;


--
-- Name: addresses addresses_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;


--
-- Name: addresses addresses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: addresses addresses_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: assignment_notifications assignment_notifications_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.assignment_notifications
    ADD CONSTRAINT assignment_notifications_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.service_assignments(id) ON DELETE CASCADE;


--
-- Name: assignment_notifications assignment_notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.assignment_notifications
    ADD CONSTRAINT assignment_notifications_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: assignment_notifications assignment_notifications_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.assignment_notifications
    ADD CONSTRAINT assignment_notifications_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: campuses campuses_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE SET NULL;


--
-- Name: campuses campuses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: contact_methods contact_methods_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.contact_methods
    ADD CONSTRAINT contact_methods_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: contact_methods contact_methods_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.contact_methods
    ADD CONSTRAINT contact_methods_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: contexts contexts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.contexts
    ADD CONSTRAINT contexts_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: families families_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: families families_primary_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_primary_address_id_fkey FOREIGN KEY (primary_address_id) REFERENCES public.addresses(id) ON DELETE SET NULL;


--
-- Name: family_members family_members_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;


--
-- Name: family_members family_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: family_members family_members_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: person_role_capabilities fk_prc_verified_by_person; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.person_role_capabilities
    ADD CONSTRAINT fk_prc_verified_by_person FOREIGN KEY (verified_by_person_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_items fk_service_items_instance; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT fk_service_items_instance FOREIGN KEY (service_instance_id) REFERENCES public.service_instances(id) ON DELETE CASCADE;


--
-- Name: service_team_assignments fk_service_team_assignments_instance; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_team_assignments
    ADD CONSTRAINT fk_service_team_assignments_instance FOREIGN KEY (service_instance_id) REFERENCES public.service_instances(id) ON DELETE CASCADE;


--
-- Name: service_instance_songs fk_sis_strict_tenancy; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_songs
    ADD CONSTRAINT fk_sis_strict_tenancy FOREIGN KEY (church_id, service_instance_id) REFERENCES public.service_instances(church_id, id) ON DELETE CASCADE;


--
-- Name: service_instance_sections fk_sisec_strict_tenancy; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT fk_sisec_strict_tenancy FOREIGN KEY (church_id, service_instance_id) REFERENCES public.service_instances(church_id, id) ON DELETE CASCADE;


--
-- Name: service_items fk_sitems_strict_tenancy; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT fk_sitems_strict_tenancy FOREIGN KEY (church_id, service_instance_id) REFERENCES public.service_instances(church_id, id) ON DELETE CASCADE;


--
-- Name: service_team_assignments fk_sta_strict_tenancy; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_team_assignments
    ADD CONSTRAINT fk_sta_strict_tenancy FOREIGN KEY (church_id, service_instance_id) REFERENCES public.service_instances(church_id, id) ON DELETE CASCADE;


--
-- Name: identity_links identity_links_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.identity_links
    ADD CONSTRAINT identity_links_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: identity_links identity_links_person_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.identity_links
    ADD CONSTRAINT identity_links_person_a_id_fkey FOREIGN KEY (person_a_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: identity_links identity_links_person_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.identity_links
    ADD CONSTRAINT identity_links_person_b_id_fkey FOREIGN KEY (person_b_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: identity_links identity_links_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.identity_links
    ADD CONSTRAINT identity_links_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: merge_events merge_events_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.merge_events
    ADD CONSTRAINT merge_events_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: merge_events merge_events_identity_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.merge_events
    ADD CONSTRAINT merge_events_identity_link_id_fkey FOREIGN KEY (identity_link_id) REFERENCES public.identity_links(id) ON DELETE SET NULL;


--
-- Name: merge_events merge_events_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.merge_events
    ADD CONSTRAINT merge_events_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.people(id);


--
-- Name: merge_events merge_events_survivor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.merge_events
    ADD CONSTRAINT merge_events_survivor_id_fkey FOREIGN KEY (survivor_id) REFERENCES public.people(id);


--
-- Name: merge_events merge_events_undone_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.merge_events
    ADD CONSTRAINT merge_events_undone_by_fkey FOREIGN KEY (undone_by) REFERENCES public.people(id);


--
-- Name: ministry_areas ministry_areas_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.ministry_areas
    ADD CONSTRAINT ministry_areas_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: ministry_areas ministry_areas_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.ministry_areas
    ADD CONSTRAINT ministry_areas_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: ministry_areas ministry_areas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.ministry_areas
    ADD CONSTRAINT ministry_areas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: ministry_areas ministry_areas_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.ministry_areas
    ADD CONSTRAINT ministry_areas_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.ministry_areas(id) ON DELETE SET NULL;


--
-- Name: ministry_areas ministry_areas_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.ministry_areas
    ADD CONSTRAINT ministry_areas_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: notification_preferences notification_preferences_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: people people_canonical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_canonical_id_fkey FOREIGN KEY (canonical_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: people people_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: person_aliases person_aliases_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.person_aliases
    ADD CONSTRAINT person_aliases_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: person_aliases person_aliases_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.person_aliases
    ADD CONSTRAINT person_aliases_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: person_role_capabilities person_role_capabilities_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.person_role_capabilities
    ADD CONSTRAINT person_role_capabilities_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: person_role_capabilities person_role_capabilities_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.person_role_capabilities
    ADD CONSTRAINT person_role_capabilities_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: roles roles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: roles roles_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: service_amendments service_amendments_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_amendments
    ADD CONSTRAINT service_amendments_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: service_amendments service_amendments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_amendments
    ADD CONSTRAINT service_amendments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.people(id) ON DELETE RESTRICT;


--
-- Name: service_amendments service_amendments_service_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_amendments
    ADD CONSTRAINT service_amendments_service_instance_id_fkey FOREIGN KEY (service_instance_id) REFERENCES public.service_instances(id) ON DELETE CASCADE;


--
-- Name: service_amendments service_amendments_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_amendments
    ADD CONSTRAINT service_amendments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_assignments service_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT service_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_assignments service_assignments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT service_assignments_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: service_assignments service_assignments_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT service_assignments_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_assignments service_assignments_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT service_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: service_assignments service_assignments_service_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT service_assignments_service_instance_id_fkey FOREIGN KEY (service_instance_id) REFERENCES public.service_instances(id) ON DELETE CASCADE;


--
-- Name: service_audit_log service_audit_log_amendment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_audit_log
    ADD CONSTRAINT service_audit_log_amendment_id_fkey FOREIGN KEY (amendment_id) REFERENCES public.service_amendments(id) ON DELETE SET NULL;


--
-- Name: service_audit_log service_audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_audit_log
    ADD CONSTRAINT service_audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_audit_log service_audit_log_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_audit_log
    ADD CONSTRAINT service_audit_log_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: service_groups service_groups_context_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_groups
    ADD CONSTRAINT service_groups_context_id_fkey FOREIGN KEY (context_id) REFERENCES public.contexts(id) ON DELETE SET NULL;


--
-- Name: service_groups service_groups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_groups
    ADD CONSTRAINT service_groups_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: service_instance_sections service_instance_sections_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT service_instance_sections_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instance_sections service_instance_sections_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT service_instance_sections_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: service_instance_sections service_instance_sections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT service_instance_sections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instance_sections service_instance_sections_marked_ready_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT service_instance_sections_marked_ready_by_fkey FOREIGN KEY (marked_ready_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instance_sections service_instance_sections_ministry_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT service_instance_sections_ministry_area_id_fkey FOREIGN KEY (ministry_area_id) REFERENCES public.ministry_areas(id) ON DELETE SET NULL;


--
-- Name: service_instance_sections service_instance_sections_service_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT service_instance_sections_service_instance_id_fkey FOREIGN KEY (service_instance_id) REFERENCES public.service_instances(id) ON DELETE CASCADE;


--
-- Name: service_instance_sections service_instance_sections_template_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT service_instance_sections_template_section_id_fkey FOREIGN KEY (template_section_id) REFERENCES public.template_sections(id) ON DELETE SET NULL;


--
-- Name: service_instance_sections service_instance_sections_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_sections
    ADD CONSTRAINT service_instance_sections_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instance_songs service_instance_songs_arrangement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_songs
    ADD CONSTRAINT service_instance_songs_arrangement_id_fkey FOREIGN KEY (arrangement_id) REFERENCES public.song_arrangements(id) ON DELETE SET NULL;


--
-- Name: service_instance_songs service_instance_songs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_songs
    ADD CONSTRAINT service_instance_songs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instance_songs service_instance_songs_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_songs
    ADD CONSTRAINT service_instance_songs_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.service_instance_sections(id) ON DELETE SET NULL;


--
-- Name: service_instance_songs service_instance_songs_service_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_songs
    ADD CONSTRAINT service_instance_songs_service_instance_id_fkey FOREIGN KEY (service_instance_id) REFERENCES public.service_instances(id) ON DELETE CASCADE;


--
-- Name: service_instance_songs service_instance_songs_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_songs
    ADD CONSTRAINT service_instance_songs_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;


--
-- Name: service_instance_songs service_instance_songs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instance_songs
    ADD CONSTRAINT service_instance_songs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instances service_instances_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT service_instances_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instances service_instances_campus_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT service_instances_campus_tenant_fk FOREIGN KEY (church_id, campus_id) REFERENCES public.campuses(church_id, id) ON DELETE SET NULL;


--
-- Name: service_instances service_instances_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT service_instances_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instances service_instances_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT service_instances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instances service_instances_group_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT service_instances_group_tenant_fk FOREIGN KEY (church_id, service_group_id) REFERENCES public.service_groups(church_id, id) ON DELETE SET NULL;


--
-- Name: service_instances service_instances_locked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT service_instances_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instances service_instances_service_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT service_instances_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES public.service_types(id) ON DELETE SET NULL;


--
-- Name: service_instances service_instances_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT service_instances_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.service_templates(id) ON DELETE SET NULL;


--
-- Name: service_instances service_instances_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT service_instances_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_items service_items_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: service_items service_items_song_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_song_variant_id_fkey FOREIGN KEY (song_variant_id) REFERENCES public.song_variants(id);


--
-- Name: service_role_requirements service_role_requirements_context_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_role_requirements
    ADD CONSTRAINT service_role_requirements_context_id_fkey FOREIGN KEY (context_id) REFERENCES public.contexts(id);


--
-- Name: service_role_requirements service_role_requirements_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_role_requirements
    ADD CONSTRAINT service_role_requirements_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: service_team_assignments service_team_assignments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_team_assignments
    ADD CONSTRAINT service_team_assignments_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: service_team_assignments service_team_assignments_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_team_assignments
    ADD CONSTRAINT service_team_assignments_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: service_team_assignments service_team_assignments_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_team_assignments
    ADD CONSTRAINT service_team_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: service_templates service_templates_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_templates
    ADD CONSTRAINT service_templates_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_templates service_templates_context_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_templates
    ADD CONSTRAINT service_templates_context_id_fkey FOREIGN KEY (context_id) REFERENCES public.contexts(id);


--
-- Name: service_templates service_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_templates
    ADD CONSTRAINT service_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.people(id);


--
-- Name: service_templates service_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_templates
    ADD CONSTRAINT service_templates_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: service_templates service_templates_parent_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_templates
    ADD CONSTRAINT service_templates_parent_template_id_fkey FOREIGN KEY (parent_template_id) REFERENCES public.service_templates(id) ON DELETE SET NULL;


--
-- Name: service_templates service_templates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_templates
    ADD CONSTRAINT service_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_types service_types_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_types service_types_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: service_types service_types_context_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_context_id_fkey FOREIGN KEY (context_id) REFERENCES public.contexts(id) ON DELETE SET NULL;


--
-- Name: service_types service_types_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_types service_types_default_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_default_template_id_fkey FOREIGN KEY (default_template_id) REFERENCES public.service_templates(id) ON DELETE SET NULL;


--
-- Name: service_types service_types_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_instances services_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT services_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: song_arrangements song_arrangements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_arrangements
    ADD CONSTRAINT song_arrangements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.people(id);


--
-- Name: song_arrangements song_arrangements_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_arrangements
    ADD CONSTRAINT song_arrangements_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: song_arrangements song_arrangements_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_arrangements
    ADD CONSTRAINT song_arrangements_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;


--
-- Name: song_sections song_sections_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_sections
    ADD CONSTRAINT song_sections_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: song_sections song_sections_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_sections
    ADD CONSTRAINT song_sections_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;


--
-- Name: song_variants song_variants_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_variants
    ADD CONSTRAINT song_variants_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: song_variants song_variants_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_variants
    ADD CONSTRAINT song_variants_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;


--
-- Name: songs songs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.songs
    ADD CONSTRAINT songs_org_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: teams teams_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: template_sections template_sections_church_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.template_sections
    ADD CONSTRAINT template_sections_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE;


--
-- Name: template_sections template_sections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.template_sections
    ADD CONSTRAINT template_sections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: template_sections template_sections_ministry_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.template_sections
    ADD CONSTRAINT template_sections_ministry_area_id_fkey FOREIGN KEY (ministry_area_id) REFERENCES public.ministry_areas(id) ON DELETE SET NULL;


--
-- Name: template_sections template_sections_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.template_sections
    ADD CONSTRAINT template_sections_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.service_templates(id) ON DELETE CASCADE;


--
-- Name: template_sections template_sections_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.template_sections
    ADD CONSTRAINT template_sections_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict X37Y3srfqScPdXmk8wNkPbocO2D6dkHbcwkcfchuaQDmGqvDfSjwyosxUNGrfo9

