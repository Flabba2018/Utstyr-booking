-- =============================================================================
-- Seed-data: Eksempelutstyr for testing
-- Kjør dette ETTER schema.sql
-- =============================================================================

-- Hent kategori-ID-er (vi bruker subqueries)

INSERT INTO equipment (asset_tag, name, category_id, location, department, status, serial_number, description, requires_booking, active, next_service_date, last_service_date, service_interval_days, block_if_service_overdue) VALUES

-- Tilhenger 1
(
  'TH-001',
  'Tilhenger 1 - Brenderup 2500kg',
  (SELECT id FROM equipment_categories WHERE name = 'tilhenger'),
  'Driftsgård - uteplass',
  'Drift/Vedlikehold',
  'ledig',
  'BRE-2024-4521',
  'Brenderup 2500kg tilhenger med tipp. EU-kontroll årlig. Husk sikringskjetting.',
  true, -- krever booking
  true,
  '2026-06-15',
  '2025-06-15',
  365,
  true
),

-- Sakselift 10m
(
  'LI-001',
  'Sakselift 10m - Genie GS-3246',
  (SELECT id FROM equipment_categories WHERE name = 'lift'),
  'Driftsgård - garasje 2',
  'Drift/Vedlikehold',
  'ledig',
  'GEN-2023-8812',
  'Genie GS-3246 sakselift, 10m arbeidshøyde. Krever opplæring og sertifikat. Lades etter bruk.',
  true,
  true,
  '2026-04-01',
  '2025-10-01',
  180,
  true
),

-- Gressklipper Rider
(
  'GK-001',
  'Gressklipper Rider - Husqvarna TC 242TX',
  (SELECT id FROM equipment_categories WHERE name = 'gressklipper'),
  'Driftsgård - garasje 1',
  'Park/Grønt',
  'ledig',
  'HVA-2024-1190',
  'Husqvarna rideklipper med 107cm klippebredde. Tankes med 95 oktan. Sjekk olje før bruk.',
  true,
  true,
  '2026-05-01',
  '2025-11-01',
  180,
  false
),

-- SDS Borhammer
(
  'VK-001',
  'SDS Borhammer - Hilti TE 30-A36',
  (SELECT id FROM equipment_categories WHERE name = 'verktøy'),
  'Verktøyskap A3',
  'Drift/Vedlikehold',
  'ledig',
  'HIL-2023-5567',
  'Hilti TE 30-A36 batteridrevet SDS borhammer. 2 batterier og lader følger med. Sjekk bor-sett.',
  false, -- direkte utlån
  true,
  NULL,
  '2025-08-15',
  NULL,
  false
),

-- Isolasjonsmåler
(
  'MI-001',
  'Isolasjonsmåler - Fluke 1587 FC',
  (SELECT id FROM equipment_categories WHERE name = 'måleinstrument'),
  'Verktøyskap B1',
  'Elektro',
  'ledig',
  'FLK-2024-3301',
  'Fluke 1587 FC isolasjonsmåler. Kalibreres årlig. Sjekk kalibreringsdato før bruk.',
  false,
  true,
  '2026-03-15',
  '2025-03-15',
  365,
  true
);
