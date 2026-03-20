-- =============================================================================
-- Utstyr-booking: Komplett databaseskjema for Supabase (PostgreSQL)
-- =============================================================================
-- Tabeller: profiles, equipment_categories, equipment, bookings, loans,
--           condition_reports, deviations, service_records, 
--           equipment_external_refs, integration_events,
--           competencies, equipment_requirements, user_competencies (fase 2)
-- =============================================================================

-- Aktiver UUID-generering
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----- ENUM-typer -----

CREATE TYPE user_role AS ENUM ('user', 'manager', 'admin');

CREATE TYPE equipment_status AS ENUM (
  'ledig', 'booket', 'utlånt', 'ute_av_drift', 'på_service', 'savnet'
);

CREATE TYPE booking_status AS ENUM ('aktiv', 'kansellert', 'fullført');
CREATE TYPE booking_priority AS ENUM ('normal', 'høy', 'akutt');

CREATE TYPE loan_status AS ENUM ('aktiv', 'returnert', 'forsinket');

CREATE TYPE condition_rating AS ENUM ('ok', 'mangler', 'skade', 'annet');

CREATE TYPE deviation_type AS ENUM (
  'skade', 'feil', 'mangler', 'servicebehov', 'rengjøring', 'annet'
);
CREATE TYPE deviation_severity AS ENUM ('lav', 'middels', 'høy', 'kritisk');
CREATE TYPE deviation_status AS ENUM ('åpen', 'under_behandling', 'lukket');

-- ----- PROFILER (koblet til auth.users) -----

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  role user_role NOT NULL DEFAULT 'user',
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for å auto-opprette profil ved ny bruker
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ----- UTSTYRSKATEGORIER -----

CREATE TABLE equipment_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- ikon-navn for UI (f.eks. 'truck', 'wrench')
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Forhåndsdefinerte kategorier
INSERT INTO equipment_categories (name, description, icon) VALUES
  ('verktøy', 'Håndverktøy og elektroverktøy', 'wrench'),
  ('tilhenger', 'Tilhengere for transport', 'truck'),
  ('lift', 'Sakselifter og personlifter', 'arrow-up'),
  ('gressklipper', 'Gressklippere og ridere', 'trees'),
  ('maskin', 'Større maskiner og utstyr', 'cog'),
  ('måleinstrument', 'Måleinstrumenter og testere', 'gauge'),
  ('annet', 'Annet utstyr', 'package');

-- ----- UTSTYRSREGISTER -----

CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_tag TEXT NOT NULL UNIQUE, -- inventarnummer
  name TEXT NOT NULL,
  category_id UUID REFERENCES equipment_categories(id),
  location TEXT,
  department TEXT,
  status equipment_status NOT NULL DEFAULT 'ledig',
  serial_number TEXT,
  image_url TEXT,
  description TEXT,
  requires_booking BOOLEAN NOT NULL DEFAULT false, -- true for tilhenger/lift/større
  active BOOLEAN NOT NULL DEFAULT true,
  -- Service/kontroll-felt
  next_service_date DATE,
  last_service_date DATE,
  service_interval_days INTEGER, -- dager mellom kontroller
  block_if_service_overdue BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_category ON equipment(category_id);
CREATE INDEX idx_equipment_asset_tag ON equipment(asset_tag);
CREATE INDEX idx_equipment_active ON equipment(active);

-- ----- BOOKINGER -----

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'aktiv',
  priority booking_priority NOT NULL DEFAULT 'normal',
  purpose TEXT, -- formål/kommentar
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Forhindre at sluttid er før starttid
  CONSTRAINT bookings_time_check CHECK (end_time > start_time)
);

CREATE INDEX idx_bookings_equipment ON bookings(equipment_id);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_time ON bookings(start_time, end_time);

-- Funksjon for overlappsjekk (brukes av trigger)
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE equipment_id = NEW.equipment_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status = 'aktiv'
      AND start_time < NEW.end_time
      AND end_time > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'Booking-konflikt: utstyret er allerede booket i dette tidsrommet';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_booking_overlap_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'aktiv')
  EXECUTE FUNCTION check_booking_overlap();

-- ----- UTLÅN -----

CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL, -- kobling til booking hvis relevant
  status loan_status NOT NULL DEFAULT 'aktiv',
  checked_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  checkout_comment TEXT,
  return_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loans_equipment ON loans(equipment_id);
CREATE INDEX idx_loans_user ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_booking ON loans(booking_id);

-- ----- TILSTANDSRAPPORTER (ut/inn-sjekk) -----

CREATE TABLE condition_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  report_type TEXT NOT NULL CHECK (report_type IN ('checkout', 'return')),
  condition condition_rating NOT NULL DEFAULT 'ok',
  description TEXT,
  reported_by UUID NOT NULL REFERENCES profiles(id),
  images TEXT[], -- URL-er til bilder (fase 2: faktisk opplasting)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_condition_reports_loan ON condition_reports(loan_id);
CREATE INDEX idx_condition_reports_equipment ON condition_reports(equipment_id);

-- ----- AVVIK/SKADE -----

CREATE TABLE deviations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  reported_by UUID NOT NULL REFERENCES profiles(id),
  type deviation_type NOT NULL,
  severity deviation_severity NOT NULL DEFAULT 'middels',
  title TEXT NOT NULL,
  description TEXT,
  images TEXT[], -- URL-er til bilder
  status deviation_status NOT NULL DEFAULT 'åpen',
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deviations_equipment ON deviations(equipment_id);
CREATE INDEX idx_deviations_status ON deviations(status);
CREATE INDEX idx_deviations_severity ON deviations(severity);

-- Composite index for booking conflict checking
CREATE INDEX idx_bookings_conflict_check ON bookings(equipment_id, status, start_time, end_time);

-- Trigger: sett utstyr ute_av_drift ved kritisk/høy avvik
CREATE OR REPLACE FUNCTION handle_critical_deviation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.severity IN ('høy', 'kritisk') AND NEW.status = 'åpen' THEN
    UPDATE equipment SET status = 'ute_av_drift', updated_at = now()
    WHERE id = NEW.equipment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_critical_deviation
  AFTER INSERT ON deviations
  FOR EACH ROW EXECUTE FUNCTION handle_critical_deviation();

-- ----- SERVICEHISTORIKK -----

CREATE TABLE service_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL, -- f.eks. 'kontroll', 'reparasjon', 'vedlikehold'
  description TEXT,
  performed_by TEXT, -- kan være ekstern eller intern person
  performed_at DATE NOT NULL,
  next_service_date DATE,
  cost NUMERIC(10,2),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_records_equipment ON service_records(equipment_id);

-- ----- EKSTERNE REFERANSER (FAMAC/FDV-forberedelse) -----

CREATE TABLE equipment_external_refs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  external_system TEXT NOT NULL, -- f.eks. 'famac', 'fdvhuset'
  external_id TEXT NOT NULL,
  external_url TEXT,
  metadata JSONB, -- ekstra data fra eksternt system
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(equipment_id, external_system)
);

-- ----- INTEGRASJONSHENDELSER (logg for fremtidig FAMAC-integrasjon) -----
-- Brukes for å spore hendelser som skal/har blitt sendt til eksterne systemer

CREATE TABLE integration_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL, -- f.eks. 'booking_created', 'deviation_reported', 'loan_completed'
  entity_type TEXT NOT NULL, -- f.eks. 'booking', 'deviation', 'loan'
  entity_id UUID NOT NULL,
  target_system TEXT NOT NULL, -- f.eks. 'famac'
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, acknowledged
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_integration_events_status ON integration_events(status);

-- ----- FASE 2: KOMPETANSER (kun tabellstruktur) -----

CREATE TABLE competencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  valid_months INTEGER, -- gyldighet i måneder (null = permanent)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE equipment_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  mandatory BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(equipment_id, competency_id)
);

CREATE TABLE user_competencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  obtained_at DATE NOT NULL,
  expires_at DATE,
  certificate_url TEXT,
  verified_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, competency_id)
);

-- ----- updated_at trigger -----

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Legg til updated_at trigger på alle relevante tabeller
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deviations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON equipment_external_refs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Aktiver RLS på alle tabeller
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE deviations ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_external_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;

-- Hjelpefunksjon: hent brukerens rolle
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Hjelpefunksjon: sjekk om bruker er admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Hjelpefunksjon: sjekk om bruker er manager eller admin
CREATE OR REPLACE FUNCTION is_manager_or_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('manager', 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----- profiles -----
CREATE POLICY "Brukere kan se alle profiler" ON profiles
  FOR SELECT USING (true);
CREATE POLICY "Brukere kan oppdatere egen profil" ON profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admin kan oppdatere alle profiler" ON profiles
  FOR UPDATE USING (is_admin());

-- ----- equipment_categories -----
CREATE POLICY "Alle kan lese kategorier" ON equipment_categories
  FOR SELECT USING (true);
CREATE POLICY "Admin kan endre kategorier" ON equipment_categories
  FOR ALL USING (is_admin());

-- ----- equipment -----
CREATE POLICY "Alle kan se aktivt utstyr" ON equipment
  FOR SELECT USING (true);
CREATE POLICY "Manager/admin kan opprette utstyr" ON equipment
  FOR INSERT WITH CHECK (is_manager_or_admin());
CREATE POLICY "Manager/admin kan oppdatere utstyr" ON equipment
  FOR UPDATE USING (is_manager_or_admin());
CREATE POLICY "Admin kan slette utstyr" ON equipment
  FOR DELETE USING (is_admin());

-- ----- bookings -----
CREATE POLICY "Brukere kan se alle bookinger" ON bookings
  FOR SELECT USING (true);
CREATE POLICY "Brukere kan opprette egne bookinger" ON bookings
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Brukere kan oppdatere egne bookinger" ON bookings
  FOR UPDATE USING (user_id = auth.uid() OR is_manager_or_admin());
CREATE POLICY "Manager/admin kan slette bookinger" ON bookings
  FOR DELETE USING (is_manager_or_admin());

-- ----- loans -----
CREATE POLICY "Brukere kan se alle utlån" ON loans
  FOR SELECT USING (true);
CREATE POLICY "Brukere kan opprette egne utlån" ON loans
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_manager_or_admin());
CREATE POLICY "Brukere kan oppdatere egne utlån" ON loans
  FOR UPDATE USING (user_id = auth.uid() OR is_manager_or_admin());

-- ----- condition_reports -----
CREATE POLICY "Alle kan se tilstandsrapporter" ON condition_reports
  FOR SELECT USING (true);
CREATE POLICY "Brukere kan opprette tilstandsrapporter" ON condition_reports
  FOR INSERT WITH CHECK (reported_by = auth.uid());

-- ----- deviations -----
CREATE POLICY "Alle kan se avvik" ON deviations
  FOR SELECT USING (true);
CREATE POLICY "Brukere kan opprette avvik" ON deviations
  FOR INSERT WITH CHECK (reported_by = auth.uid());
CREATE POLICY "Manager/admin kan oppdatere avvik" ON deviations
  FOR UPDATE USING (is_manager_or_admin());

-- ----- service_records -----
CREATE POLICY "Alle kan se servicehistorikk" ON service_records
  FOR SELECT USING (true);
CREATE POLICY "Manager/admin kan administrere servicehistorikk" ON service_records
  FOR ALL USING (is_manager_or_admin());

-- ----- equipment_external_refs -----
CREATE POLICY "Alle kan se eksterne referanser" ON equipment_external_refs
  FOR SELECT USING (true);
CREATE POLICY "Admin kan administrere eksterne referanser" ON equipment_external_refs
  FOR ALL USING (is_admin());

-- ----- integration_events -----
CREATE POLICY "Admin kan se integrasjonshendelser" ON integration_events
  FOR SELECT USING (is_admin());
CREATE POLICY "System kan opprette integrasjonshendelser" ON integration_events
  FOR INSERT WITH CHECK (is_admin());

-- =============================================================================
-- STORAGE: Bucket for bildeopplasting
-- =============================================================================
-- Kjør dette i Supabase Dashboard → SQL Editor etter at schema er opprettet,
-- eller opprett bucket manuelt via Dashboard → Storage.

INSERT INTO storage.buckets (id, name, public) VALUES ('equipment-images', 'equipment-images', true)
  ON CONFLICT (id) DO NOTHING;

-- Alle innloggede brukere kan laste opp bilder
CREATE POLICY "Innloggede kan laste opp bilder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'equipment-images' AND auth.role() = 'authenticated'
  );

-- Alle kan lese bilder (public bucket)
CREATE POLICY "Alle kan lese bilder" ON storage.objects
  FOR SELECT USING (bucket_id = 'equipment-images');

-- Brukere kan slette egne bilder, admin kan slette alle
CREATE POLICY "Admin kan slette bilder" ON storage.objects
  FOR DELETE USING (bucket_id = 'equipment-images' AND is_admin());
