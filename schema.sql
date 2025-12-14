--
-- PostgreSQL database dump
--

\restrict FcoUHUlLKgmHzLJUUXq50o5UZ79KCIunPyThekySAYWzi00lfHzmm0wP4ieOEhx

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


SET default_tablespace = '';

SET default_table_access_method = heap;

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
    load_weight integer DEFAULT 10 NOT NULL
);


ALTER TABLE public.roles OWNER TO worship;

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
    notes text
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
-- Name: idx_person_role_capabilities_person; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_person_role_capabilities_person ON public.person_role_capabilities USING btree (person_id);


--
-- Name: idx_person_role_capabilities_role; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_person_role_capabilities_role ON public.person_role_capabilities USING btree (role_id);


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
-- Name: idx_song_variants_song; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX idx_song_variants_song ON public.song_variants USING btree (org_id, song_id);


--
-- Name: person_role_capabilities_person_id_idx; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX person_role_capabilities_person_id_idx ON public.person_role_capabilities USING btree (person_id);


--
-- Name: person_role_capabilities_role_id_idx; Type: INDEX; Schema: public; Owner: worship
--

CREATE INDEX person_role_capabilities_role_id_idx ON public.person_role_capabilities USING btree (role_id);


--
-- Name: campuses campuses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: contexts contexts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worship
--

ALTER TABLE ONLY public.contexts
    ADD CONSTRAINT contexts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


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

\unrestrict FcoUHUlLKgmHzLJUUXq50o5UZ79KCIunPyThekySAYWzi00lfHzmm0wP4ieOEhx

