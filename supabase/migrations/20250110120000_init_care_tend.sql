-- Enable standard extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For UUIDs
CREATE EXTENSION IF NOT EXISTS "pgtap";    -- For Testing

-- 1. TEND SIGNALS (The "Sensor")
CREATE TABLE public.tend_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid DEFAULT gen_random_uuid(), -- simplified for demo
  person_id uuid DEFAULT gen_random_uuid(),
  signal_type text NOT NULL,
  severity text DEFAULT 'info',
  data jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable Security
ALTER TABLE public.tend_signals ENABLE ROW LEVEL SECURITY;

-- Policy: Broad Visibility (as you requested)
-- "Everyone can see signals (to prevent burnout), but only system can write."
CREATE POLICY "Everyone can view signals"
ON public.tend_signals FOR SELECT
TO authenticated
USING (true);


-- 2. CARE CASES (The "Safe")
CREATE TABLE public.care_cases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid DEFAULT gen_random_uuid(),
  person_id uuid DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text DEFAULT 'open',
  sensitivity_level text DEFAULT 'normal',
  assigned_to uuid REFERENCES auth.users(id), -- Vital for security
  source_signal_id uuid REFERENCES public.tend_signals(id),
  created_at timestamptz DEFAULT now()
);

-- Enable Security
ALTER TABLE public.care_cases ENABLE ROW LEVEL SECURITY;

-- Policy: Strict Visibility
-- "Only the person assigned to the case can see it."
CREATE POLICY "Only assigned user can view case"
ON public.care_cases FOR SELECT
TO authenticated
USING (auth.uid() = assigned_to);
