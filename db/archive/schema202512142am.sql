-- /db/archive/schema202512142am.sql
--
-- PostgreSQL database dump
--

\restrict pXl64AT9cePvjlQBuimxvY8r74wg3PIJHigEfWM4hCdfhszaKs4dPYuNgq7C7BF

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
    srr.is_required,
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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    person_id uuid NOT NULL,
    street text,
    city text,
    state text,
    postal_code text,
    country text DEFAULT 'US'::text,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.addresses OWNER TO worship;

--
-- Name: campuses; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.campuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    location text,
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.campuses OWNER TO worship;

--
-- Name: contact_methods; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.contact_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
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
    org_id uuid NOT NULL,
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
    org_id uuid NOT NULL,
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
    org_id uuid NOT NULL,
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
-- Name: orgs; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.orgs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.orgs OWNER TO worship;

--
-- Name: people; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.people (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    display_name text NOT NULL
);


ALTER TABLE public.people OWNER TO worship;

--
-- Name: person_role_capabilities; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.person_role_capabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
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
    org_id uuid NOT NULL,
    name text NOT NULL,
    load_weight integer DEFAULT 10 NOT NULL,
    ministry_area text,
    description text,
    CONSTRAINT chk_roles_load_weight_positive CHECK ((load_weight > 0))
);


ALTER TABLE public.roles OWNER TO worship;

--
-- Name: service_assignments; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.service_assignments OWNER TO worship;

--
-- Name: service_groups; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    group_date date NOT NULL,
    name text NOT NULL,
    context_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.service_groups OWNER TO worship;

--
-- Name: service_instances; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    service_date date NOT NULL,
    service_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    service_group_id uuid,
    campus_id uuid
);


ALTER TABLE public.service_instances OWNER TO worship;

--
-- Name: service_items; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
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
    org_id uuid NOT NULL,
    context_id uuid NOT NULL,
    role_id uuid NOT NULL,
    min_needed integer DEFAULT 1 NOT NULL,
    max_needed integer
);


ALTER TABLE public.service_role_requirements OWNER TO worship;

--
-- Name: service_team_assignments; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.service_team_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    service_instance_id uuid NOT NULL,
    person_id uuid NOT NULL,
    role_id uuid NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL
);


ALTER TABLE public.service_team_assignments OWNER TO worship;

--
-- Name: song_variants; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.song_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    song_id uuid NOT NULL,
    name text NOT NULL,
    default_key text,
    tempo integer,
    time_signature text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.song_variants OWNER TO worship;

--
-- Name: songs; Type: TABLE; Schema: public; Owner: worship
--

CREATE TABLE public.songs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    title text NOT NULL,
    ccli_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.songs OWNER TO worship;

--
-- Name: v_family_summary; Type: VIEW; Schema: public; Owner: worship
--

CREATE VIEW public.v_family_summary AS
 SELECT f.id AS family_id,
    f.org_id,
    f.name AS family_name,
    f.is_active,
    count(DISTINCT fm.person_id) FILTER (WHERE (fm.is_active = true)) AS active_members,
    count(DISTINCT fm.person_id) FILTER (WHERE ((fm.relationship = ANY (ARRAY['child'::text, 'foster_child'::text])) AND (fm.is_active = true))) AS active_children,
    count(DISTINCT fm.person_id) FILTER (WHERE ((fm.relationship = 'foster_child'::text) AND (fm.is_active = true))) AS active_foster_children,
    array_agg(DISTINCT p.display_name ORDER BY p.display_name) FILTER (WHERE (fm.is_primary_contact = true)) AS primary_contacts
   FROM ((public.families f
     LEFT JOIN public.family_members fm ON ((fm.family_id = f.id)))
     LEFT JOIN public.people p ON (((p.id = fm.person_id) AND (fm.is_primary_contact = true))))
  GROUP BY f.id, f.org_id, f.name, f.is_active;


ALTER VIEW public.v_family_summary OWNER TO worship;

--
-- Name: VIEW v_family_summary; Type: COMMENT; Schema: public; Owner: worship
--

COMMENT ON VIEW public.v_family_summary IS 'Quick overview of family composition';


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
    si.org_id,
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
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: campuses campuses_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_org_id_name_key UNIQUE (org_id, name);


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
    ADD CONSTRAINT contexts_org_id_name_key UNIQUE (org_id, name);


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
    ADD CONSTRAINT fm_org_family_person_uniq UNIQUE (org_id, family_id, person_id);


--
-- Name: orgs orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_pkey PRIMARY KEY (id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: person_role_capabilities person_role_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.person_role_capabilities
    ADD CONSTRAINT person_role_capabilities_pkey PRIMARY KEY (id);


--
-- Name: person_role_capabilities prc_org_person_role_uniq; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.person_role_capabilities
    ADD CONSTRAINT prc_org_person_role_uniq UNIQUE (org_id, person_id, role_id);


--
-- Name: roles roles_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_org_id_name_key UNIQUE (org_id, name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: service_assignments sa_org_instance_role_person_uniq; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT sa_org_instance_role_person_uniq UNIQUE (org_id, service_instance_id, role_id, person_id);


--
-- Name: service_assignments service_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT service_assignments_pkey PRIMARY KEY (id);


--
-- Name: service_groups service_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_groups
    ADD CONSTRAINT service_groups_pkey PRIMARY KEY (id);


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
-- Name: service_instances services_pkey; Type: CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


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
    ADD CONSTRAINT srr_org_context_role_uniq UNIQUE (org_id, context_id, role_id);


--
-- Name: idx_addresses_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_addresses_person ON public.addresses USING btree (person_id);


--
-- Name: idx_contacts_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_contacts_person ON public.contact_methods USING btree (person_id);


--
-- Name: idx_families_active; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_families_active ON public.families USING btree (org_id, is_active);


--
-- Name: idx_families_org; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_families_org ON public.families USING btree (org_id);


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
-- Name: idx_people_org; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_people_org ON public.people USING btree (org_id);


--
-- Name: idx_person_role_capabilities_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_person_role_capabilities_person ON public.person_role_capabilities USING btree (person_id);


--
-- Name: idx_person_role_capabilities_role; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_person_role_capabilities_role ON public.person_role_capabilities USING btree (role_id);


--
-- Name: idx_roles_org; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_roles_org ON public.roles USING btree (org_id);


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
-- Name: idx_service_groups_org_date; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_groups_org_date ON public.service_groups USING btree (org_id, group_date);


--
-- Name: idx_service_instances_campus; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instances_campus ON public.service_instances USING btree (campus_id);


--
-- Name: idx_service_instances_group; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instances_group ON public.service_instances USING btree (service_group_id);


--
-- Name: idx_service_instances_org_date; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_instances_org_date ON public.service_instances USING btree (org_id, service_date, service_time);


--
-- Name: idx_service_items_instance_sort; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_items_instance_sort ON public.service_items USING btree (service_instance_id, sort_order);


--
-- Name: idx_service_role_requirements_context; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_service_role_requirements_context ON public.service_role_requirements USING btree (org_id, context_id);


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
-- Name: idx_song_variants_song; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_variants_song ON public.song_variants USING btree (org_id, song_id);


--
-- Name: family_members trigger_auto_deactivate_family_member; Type: TRIGGER; Schema: public; Owner: worship
--

CREATE TRIGGER trigger_auto_deactivate_family_member BEFORE INSERT OR UPDATE ON public.family_members FOR EACH ROW EXECUTE FUNCTION public.auto_deactivate_family_member();


--
-- Name: addresses addresses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: addresses addresses_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: campuses campuses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: contact_methods contact_methods_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.contact_methods
    ADD CONSTRAINT contact_methods_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: contact_methods contact_methods_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.contact_methods
    ADD CONSTRAINT contact_methods_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: contexts contexts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.contexts
    ADD CONSTRAINT contexts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: families families_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT family_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


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
-- Name: service_instances fk_service_instances_group; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT fk_service_instances_group FOREIGN KEY (service_group_id) REFERENCES public.service_groups(id) ON DELETE SET NULL;


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
-- Name: people people_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT roles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: service_assignments service_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT service_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: service_assignments service_assignments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_assignments
    ADD CONSTRAINT service_assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


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
-- Name: service_groups service_groups_context_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_groups
    ADD CONSTRAINT service_groups_context_id_fkey FOREIGN KEY (context_id) REFERENCES public.contexts(id) ON DELETE SET NULL;


--
-- Name: service_groups service_groups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_groups
    ADD CONSTRAINT service_groups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: service_instances service_instances_campus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT service_instances_campus_id_fkey FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE SET NULL;


--
-- Name: service_items service_items_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT service_team_assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


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
-- Name: service_instances services_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.service_instances
    ADD CONSTRAINT services_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: song_variants song_variants_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_variants
    ADD CONSTRAINT song_variants_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: song_variants song_variants_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.song_variants
    ADD CONSTRAINT song_variants_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;


--
-- Name: songs songs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.songs
    ADD CONSTRAINT songs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict pXl64AT9cePvjlQBuimxvY8r74wg3PIJHigEfWM4hCdfhszaKs4dPYuNgq7C7BF

