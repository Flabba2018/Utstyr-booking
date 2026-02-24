# Utstyrsbooking – Kommunal drift/teknisk avdeling

> PWA for utlån og booking av utstyr (verktøy, tilhengere, lifter, maskiner m.m.)

## Arkitekturvalg

| Lag | Teknologi | Begrunnelse |
|-----|-----------|-------------|
| Frontend | React 19 + TypeScript (strict) | Modent, stort økosystem, PWA-støtte |
| Bundler | Vite 8 | Rask dev-server og byggetid |
| Backend/DB/Auth | Supabase (PostgreSQL) | Hosted, RLS, realtime, auth – ingen egen backend |
| UI | Ren CSS (mobil-først) | Ingen avhengigheter, rask, enkel å vedlikeholde |
| Ikoner | Lucide React | Lett, konsistent ikonbibliotek |
| Dato | date-fns | Treeshakable datoformatering med norsk locale |
| PWA | vite-plugin-pwa (Workbox) | Automatisk manifest + service worker |

### Viktige designvalg
- **Service-lag**: All Supabase-kommunikasjon går via `src/services/` – aldri direkte fra UI
- **RLS fra start**: Row Level Security på alle tabeller
- **Booking ≠ Utlån**: Tydelig skille mellom reservasjon og faktisk utlevering
- **Overlappskontroll**: DB-trigger hindrer dobbeltbooking
- **Automatisk avvikshåndtering**: Kritisk/høy skade → utstyr settes ut av drift

## Mappestruktur

```
├── index.html
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json
├── .env.example          # Supabase connection template
├── supabase/
│   ├── schema.sql        # Komplett databaseskjema med RLS
│   └── seed.sql          # Eksempeldata (5 utstyr)
└── src/
    ├── main.tsx           # Entry point
    ├── App.tsx            # Routing og auth guard
    ├── index.css          # Global CSS (mobil-først)
    ├── types/index.ts     # Alle TypeScript-typer og enums
    ├── lib/
    │   ├── supabase.ts    # Supabase-klient (singleton)
    │   └── utils.ts       # Hjelpefunksjoner (dato, QR-URL, etc.)
    ├── context/
    │   └── AuthContext.tsx # Auth provider med session/profil
    ├── services/          # API-lag (all Supabase-kommunikasjon)
    │   ├── auth.service.ts
    │   ├── equipment.service.ts
    │   ├── booking.service.ts
    │   ├── loan.service.ts
    │   ├── deviation.service.ts
    │   └── service.service.ts
    ├── components/
    │   ├── ui/            # Gjenbrukbare UI-komponenter
    │   │   ├── StatusBadge.tsx
    │   │   ├── Modal.tsx
    │   │   ├── Toast.tsx
    │   │   ├── LoadingSpinner.tsx
    │   │   └── EmptyState.tsx
    │   └── layout/
    │       └── AppLayout.tsx  # Header + bunnmeny
    └── pages/
        ├── LoginPage.tsx
        ├── DashboardPage.tsx
        ├── EquipmentListPage.tsx
        ├── EquipmentDetailPage.tsx
        ├── BookingsPage.tsx
        ├── MyItemsPage.tsx
        └── AdminPage.tsx
```

## Kjøre prosjektet lokalt

### 1. Opprett Supabase-prosjekt
1. Gå til [supabase.com](https://supabase.com) og lag et nytt prosjekt
2. Gå til **SQL Editor** i dashboardet
3. Kjør innholdet i `supabase/schema.sql` (hele filen)
4. Kjør innholdet i `supabase/seed.sql` for testdata

### 2. Konfigurer miljøvariabler
```bash
cp .env.example .env
```
Rediger `.env` med verdiene fra Supabase Dashboard → Settings → API:
```
VITE_SUPABASE_URL=https://ditt-prosjekt.supabase.co
VITE_SUPABASE_ANON_KEY=din-anon-key
```

### 3. Installer avhengigheter og start
```bash
npm install
npm run dev
```
Åpne http://localhost:5173

### 4. Opprett testbruker
- Registrer deg via login-siden, eller
- Opprett bruker i Supabase Dashboard → Authentication → Users
- For admin/manager: Oppdater `role` i `profiles`-tabellen direkte i Supabase:
  ```sql
  UPDATE profiles SET role = 'admin' WHERE email = 'din@epost.no';
  ```

### 5. Bygg for produksjon
```bash
npm run build
npm run preview    # Forhåndsvis produksjonsbygg
```

## Database

### ER-diagram (forenklet)
```
auth.users ──> profiles
equipment_categories ──> equipment
equipment ──> bookings ──> loans
equipment ──> deviations
loans ──> condition_reports
equipment ──> service_records
equipment ──> equipment_external_refs (FAMAC)
```

### Tabeller
| Tabell | Beskrivelse |
|--------|-------------|
| `profiles` | Brukerprofiler (kobles til auth.users via trigger) |
| `equipment_categories` | Kategorier (verktøy, tilhenger, lift, ...) |
| `equipment` | Utstyrsregister med status, service, booking-krav |
| `bookings` | Reservasjoner med tidsrom, prioritet, overlappsjekk |
| `loans` | Utlån med ut/inn-tidspunkt og kobling til booking |
| `condition_reports` | Tilstandsrapporter (ved utlevering og retur) |
| `deviations` | Avvik/skader med type, alvorlighetsgrad og status |
| `service_records` | Servicehistorikk per utstyr |
| `equipment_external_refs` | Eksterne referanser (FAMAC-klargjort) |
| `integration_events` | Integrasjonslogg for eksterne systemer |
| `competencies` | Kompetansetyper (fase 2, tabell opprettet) |
| `equipment_requirements` | Kompetansekrav per utstyr (fase 2) |
| `user_competencies` | Brukerkompetanser (fase 2) |

### RLS-regler (oppsummert)
- **Alle innloggede**: Lese utstyr, kategorier, bookinger, utlån, avvik
- **user**: Opprette booking/lån for seg selv, oppdatere egne
- **manager/admin**: Opprette/endre utstyr, håndtere avvik, administrere service
- **admin**: Full tilgang inkl. sletting og eksterne referanser

### Viktige DB-triggere
| Trigger | Funksjon |
|---------|----------|
| `check_booking_overlap_trigger` | Hindrer overlappende aktive bookinger |
| `on_critical_deviation` | Setter utstyr ute av drift ved høy/kritisk avvik |
| `on_auth_user_created` | Auto-oppretter profil ved ny brukerregistrering |
| `set_updated_at` | Holder `updated_at` oppdatert på relevante tabeller |

## Seed-data

Fem eksempelutstyr inkludert:

| Inventarnr | Navn | Kategori | Krever booking |
|------------|------|----------|----------------|
| TH-001 | Tilhenger 1 - Brenderup 2500kg | Tilhenger | ✅ |
| LI-001 | Sakselift 10m - Genie GS-3246 | Lift | ✅ |
| GK-001 | Gressklipper Rider - Husqvarna TC 242TX | Gressklipper | ✅ |
| VK-001 | SDS Borhammer - Hilti TE 30-A36 | Verktøy | ❌ |
| MI-001 | Isolasjonsmåler - Fluke 1587 FC | Måleinstrument | ❌ |

## Brukerflyter

### Flyt A: Låne verktøy (uten booking)
1. Bruker finner utstyr (søk eller scanner QR)
2. Trykker **Lån ut** → registrerer tilstand ut (OK/mangler/skade)
3. System setter status til "utlånt"
4. Ved retur: **Lever inn** → registrerer tilstand inn
5. System setter status tilbake til "ledig" (hvis ingen avvik)

### Flyt B: Booke tilhenger/lift
1. Bruker velger utstyr som krever booking
2. Ser ledige tider og trykker **Book**
3. Velger tidsrom, prioritet og formål
4. Når utstyret hentes: **Start utlån** fra booking-kortet
5. Ved retur: **Lever inn**
6. Booking markeres fullført automatisk

### Flyt C: Skade/avvik
1. Bruker oppdager skade ved retur → registrerer tilstand "skade"
2. Avvik opprettes automatisk med høy alvorlighetsgrad
3. System setter utstyr "ute av drift"
4. Manager/admin behandler og lukker avviket i admin-panelet

## QR-kode-støtte

- Hvert utstyr har en unik URL: `/equipment/:id`
- URL-en vises i utstyrsdetaljen med kopier-knapp
- For å generere QR-koder: bruk URL-en med en QR-generator
- Anbefalt: [qrcode.react](https://www.npmjs.com/package/qrcode.react) (fase 2)

## FAMAC / FDV-integrasjon (forberedelse)

Tabellstrukturen er klargjort med:
- `equipment_external_refs` – koble utstyr til FAMAC-ID og URL
- `integration_events` – loggføre hendelser for synkronisering

### Fremtidige API-endepunkter
Disse bør lages som Supabase Edge Functions eller eget API-lag:

| Endepunkt | Beskrivelse |
|-----------|-------------|
| `GET /api/famac/work-orders/:id` | Hent arbeidsordrer/aktiviteter fra FAMAC |
| `POST /api/famac/link` | Opprett kobling mellom utstyr og FAMAC-enhet |
| `POST /api/famac/report` | Send tilbake dokumentasjon/rapport |
| `POST /api/famac/deviation-sync` | Synkroniser avviksstatus til FAMAC |

Service-lag-arkitekturen gjør det enkelt å legge til FAMAC-kall i `src/services/` uten å endre UI.

## Fase 2 – Neste steg

| Funksjon | Beskrivelse | Prioritet |
|----------|-------------|-----------|
| Kompetansekrav | Krev sertifikater for lift, maskin etc. | Høy |
| Bildeopplasting | Supabase Storage for utstyr/avvik | Høy |
| Push-varsler | Web Push for booking-påminnelse, service-utløp | Medium |
| FAMAC-integrasjon | Edge Functions for synkronisering | Medium |
| Entra ID / SSO | Azure AD oauth via Supabase Auth | Medium |
| Kalender-DnD | Drag & drop i bookingkalender | Lav |
| Rapporter | Statistikk over bruk, avvik, utlånstid | Lav |
| Offline-støtte | Offline queue med synkronisering | Lav |
| Bulk-utlån | Lån flere verktøy samtidig | Lav |
