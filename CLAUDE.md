# CLAUDE.md — AOE_WEB Working Protocol

> Atchar Automation Order Engine · Engineering Collaboration Specification  
> Session Scope: Active Development  
> Last Updated: 2026-05-27

---

## Project Identity

| Key | Value |
|-----|-------|
| **Project Name** | AOE_WEB (Atchar Automation Order Engine) |
| **Client Context** | Independent High-Volume Atchar Producer — South Africa |
| **Concept** | Conversational Order Ingestion Pipeline + Instant Stock Shield |
| **Stack** | Vite · Vanilla JS ESM · Tailwind CSS 3.x · PostCSS · Autoprefixer |
| **Backend** | Supabase (PostgreSQL · Realtime Replication · Object Storage) |
| **Communications** | Meta WhatsApp Cloud API (Webhooks Layer) |
| **Hosting** | Vercel Edge Runtime & Cloud Architecture |
| **Architecture Principle** | Complete feature isolation; dynamic code modularity; zero external dependencies beyond defined stack |

---

## Collaboration Protocol

Before executing any directive, Claude must:

1. **Audit** — Check against the SVVP system model, simulation/live switch architecture, and module placement rules.
2. **Weigh** — Suggest cleaner isolation paths if they exist. Never entangle modules.
3. **Flag deficits** — Surface missing data or unresolved integration stubs before building against them.
4. **Proceed** — Execute without friction once the path is sound.

---

## SVVP Definition

**SVVP (System Viable Viable Product)** — The AOE is engineered as a fully decoupled, real-time control system that operates flawlessly in a fully simulated state before any live production credentials are connected. This means the entire application UX, order flow, inventory state, and admin dashboard can be demonstrated and validated without a single live API call.

### The Simulation/Live Switch Framework

All integration behavior is governed by a single master state flag module located at `src/core/flags.js`.

| Flag | Default | Governs | Simulation Behavior | Live Behavior |
|------|---------|---------|---------------------|---------------|
| `FLAGS.menuSimulated` | `true` | WhatsApp Interactive List rendering | Emulates WhatsApp List component layouts in the UI using static JSON fixtures | Maps directly to Meta Cloud API Interactive Message schema and sends to live number |
| `FLAGS.ordersSimulated` | `true` | Order ingestion pipeline | Feeds static simulated order arrays into the real-time queue on a configurable interval | Processes live webhook payloads from Meta; pushes rows to production `orders` table |
| `FLAGS.stockSimulated` | `true` | Inventory mutation state | Mimics localStorage-backed stock toggles for instant edge-case and UI validation | Commits `in_stock` boolean mutations directly to Supabase `products` table in real time |
| `FLAGS.adminSimulated` | `true` | Supabase Auth barrier | Bypasses Supabase Auth using a hardcoded administrative session object; no credentials required | Requires valid Supabase JWT session; enforces Row Level Security policies on all queries |

### Fixture Files (Simulation Sources)
All simulation fixtures live under `src/fixtures/`:
- `src/fixtures/products.js` — Static product catalogue array
- `src/fixtures/orders.js` — Simulated order stream array
- `src/fixtures/session.js` — Hardcoded admin session object

---

## Local Development Scripts

| Command | Runner | Purpose |
|---------|--------|---------|
| `npm run dev` | Vite Dev Server | Launches local development loop with HMR on `http://localhost:5173`. All simulation flags default to `true`. |
| `npm run build` | Vite Bundle Generation | Compiles and tree-shakes the full production bundle into `/dist`. Validates PostCSS/Tailwind purge correctness. |
| `npm run preview` | Vite Staging Inspection | Serves the `/dist` bundle locally at `http://localhost:4173` for pre-deployment staging review. |

### Environment Variable Convention
```
# .env.local (never committed)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
VITE_WHATSAPP_ACCESS_TOKEN=your-access-token
VITE_VERIFY_TOKEN=your-webhook-verify-token
```

Access in code exclusively via `import.meta.env.VITE_*`. Never destructure at module level — always read inside functions to allow environment substitution in tests.

---

## Directory Structure Convention

```
aoe_web/
├── src/
│   ├── core/
│   │   ├── flags.js          # SVVP simulation flag master module
│   │   ├── bus.js            # Lightweight event bus (pub/sub)
│   │   └── supabase.js       # Supabase client initialisation
│   ├── features/
│   │   ├── orders/           # Order card rendering + real-time subscription
│   │   ├── inventory/        # Product toggle + stock state sync
│   │   ├── fulfillment/      # Deep-link WhatsApp trigger generator
│   │   └── admin/            # Auth guard + session management
│   ├── fixtures/
│   │   ├── products.js       # Simulated product catalogue
│   │   ├── orders.js         # Simulated order stream
│   │   └── session.js        # Simulated admin session
│   ├── styles/
│   │   └── main.css          # Tailwind directives entry point
│   └── main.js               # Application bootstrap entry
├── public/
│   ├── manifest.json         # PWA manifest
│   └── icons/                # App icons (192px, 512px)
├── .env.local                # Local secrets (gitignored)
├── .env.example              # Committed template with placeholder values
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── AOE_MASTER_BRIEF.md
├── CLAUDE.md
├── ARCHAAR_BUILD_MANIFEST.md
└── ARCHAAR_ROADMAP.md
```

---

## Standby Protocol — Client Asset Management

The following assets are required before live production deployment but are NOT required for simulation-mode development. They must never block engineering progress.

| Asset | Status | Required For | Storage Location When Received |
|-------|--------|-------------|-------------------------------|
| Product Photography | Awaiting client | Supabase Object Storage → `image_url` column population | `supabase/storage/product-images/` |
| WhatsApp Business Phone Number | Awaiting client | `VITE_WHATSAPP_PHONE_NUMBER_ID` env var | `.env.local` only |
| Meta Cloud API Access Token | Awaiting client | `VITE_WHATSAPP_ACCESS_TOKEN` env var | `.env.local` only |
| Capitec Bank Account Number | Awaiting client | Fulfillment deep-link message template | `src/features/fulfillment/config.js` (not source-controlled) |
| PayShap Settlement Identifier | Awaiting client | Alternative EFT fulfillment path | `src/features/fulfillment/config.js` (not source-controlled) |
| Supabase Project URL + Anon Key | Awaiting provisioning | Live database connection | `.env.local` only |

**Rule:** If a client asset has not been received, the corresponding feature flag remains `true` (simulated). Document receipt of each asset in the Switch Flip Log in `ARCHAAR_ROADMAP.md`.

---

## Prohibited Patterns

- No `console.log` left in committed code — use the event bus debug channel exclusively in dev mode.
- No inline `style=""` attributes — all styling routes through Tailwind utility classes.
- No `any` type-equivalent patterns — no unguarded `eval()`, `innerHTML` with unsanitised data, or dynamic `import()` outside of lazy-load boundaries.
- No direct DOM queries inside Supabase subscription callbacks — dispatch to bus, handle in view layer.
- No hardcoded ZAR amounts or product names in component files — all data sources from fixtures or database only.
