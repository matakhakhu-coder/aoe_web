# ARCHAAR_ROADMAP.md — AOE_WEB Engineering Milestone Tracker

> Atchar Automation Order Engine · Step-by-Step Build Checklist  
> Verification Conditions: Each milestone must meet its exit criteria before the next begins.  
> Last Updated: 2026-05-27

---

## Phase 0 — Substrate Initialisation & Simulation Adapters

> Goal: A fully runnable local dev environment with all simulation flags active, no live credentials required.

### 0.1 — Project Scaffold
- [x] `npm create vite@latest aoe_web -- --template vanilla` executed successfully
- [x] `npm install` completes with zero vulnerabilities
- [x] `npm install -D tailwindcss@3 postcss autoprefixer` installed
- [x] `npx tailwindcss init -p` generates `tailwind.config.js` and `postcss.config.js`
- [x] `tailwind.config.js` content paths set to `["./index.html", "./src/**/*.{js,html}"]`
- [x] `src/styles/main.css` created with Tailwind directives (`@tailwind base/components/utilities`)
- [x] `vite.config.js` configured to alias `@/` to `./src/`

**Exit Criteria:** `npm run dev` launches at `localhost:5173` with a blank dark canvas — no errors in console.

---

### 0.2 — Core Module Layer
- [x] `src/core/flags.js` created — all four flags set to `true`
- [x] `src/core/bus.js` created — minimal `on(event, fn)` / `emit(event, data)` / `off(event, fn)` implementation
- [x] `src/core/supabase.js` created — imports `@supabase/supabase-js`, reads `import.meta.env` vars, exports `supabase` client; does NOT connect when `adminSimulated = true`
- [x] `.env.example` committed with all five placeholder `VITE_*` variable names and empty values
- [x] `.env.local` added to `.gitignore`

**Exit Criteria:** `import { FLAGS } from '@/core/flags.js'` resolves without errors; all four flags confirm `true` in browser console.

---

### 0.3 — Simulation Fixture Files
- [x] `src/fixtures/products.js` — exports array of ≥6 product objects matching `products` table schema exactly
- [x] `src/fixtures/orders.js` — exports array of ≥4 simulated order objects matching `orders` table schema exactly, covering all three status states
- [x] `src/fixtures/session.js` — exports hardcoded admin session object with `user.id`, `user.email`, and `user.role` fields
- [x] All fixture objects include every column defined in the Database Entity Dictionary

**Exit Criteria:** Fixture data imports resolve; simulated order array covers `Pending`, `Paid`, and `Dispatched` status states.

---

### 0.4 — Dependency Completion
- [x] `npm install @supabase/supabase-js` installed
- [x] `index.html` updated — dark background `class="bg-zinc-950"` on `<html>` tag, correct viewport meta, correct PWA theme-color `<meta>` tag
- [x] `src/main.js` imports `@/styles/main.css` and bootstraps application shell
- [x] `npm run build` completes without error — `/dist` output verified (1.42 kB HTML · 7.83 kB CSS · 2.09 kB JS, all < 500 kB)
- [ ] `npm run preview` serves `/dist` correctly at `localhost:4173`

**Exit Criteria:** All three npm scripts run without error. Build output size < 500KB uncompressed.

---

## Phase 1 — Core Layouts & Reactive Views

> Goal: A pixel-accurate, fully navigable dark-mode dashboard running entirely on simulated fixture data.

### 1.1 — Application Shell & Navigation
- [x] Two-view routing layer implemented using URL hash (`#dashboard`, `#inventory`) via `src/core/router.js`
- [x] Navigation tab bar component created (`src/components/Navigation.js`) — active tab state uses `emerald-500` top indicator line
- [x] "Production Board" tab renders `#dashboard` view
- [x] "Inventory" tab renders `#inventory` view
- [x] `src/main.js` initialises correct view on page load based on current hash

**Exit Criteria:** Clicking tabs switches views with no page reload; correct hash appears in URL bar.

---

### 1.2 — Production Board View (Order Cards)
- [x] `src/views/ProductionBoard.js` created (adopted `src/views/` structure — cleaner separation than `src/features/orders/`)
- [x] Card renderer matches ARCHAAR_BUILD_MANIFEST.md layout specification exactly
- [x] Status badge renders correct color: Pending→amber, Paid→blue, Dispatched→emerald
- [x] "Send Banking Details" button generates correct `wa.me` deep-link via `generateFulfillmentTrigger()`
- [x] "Mark as Paid" button fires `bus.emit('order:status:update', { id, status: 'Paid' })`
- [x] Production Board renders all orders from `src/fixtures/orders.js` when `FLAGS.ordersSimulated = true`
- [x] Cards sorted chronologically by `created_at` (newest first)
- [ ] New card entrance animation (`opacity + translate-y`) — deferred to Phase 3 viewport hardening pass

**Exit Criteria:** All fixture orders render; status badges display correctly; "Send Banking Details" link opens valid `wa.me` URL in new tab.

---

### 1.3 — Inventory Switchboard View
- [x] `src/views/InventorySwitchboard.js` created (parallel to ProductionBoard under `src/views/`)
- [x] Product row renders name, size, price, and stock badge from product object
- [x] `image_url = null` renders `zinc-800` placeholder tile with size label — no error
- [x] IN STOCK / OUT OF STOCK toggle pill renders correct emerald/red state with animated toggle switch
- [x] Toggle click fires `bus.emit('stock:changed', { id, name, size, in_stock })` 
- [x] When `FLAGS.stockSimulated = true`, toggle updates local `_stockState` Map only (no Supabase call)
- [x] All 6 products from `src/fixtures/products.js` render correctly

**Exit Criteria:** Toggle state updates instantly on click; no console errors; `image_url = null` case handled gracefully.

---

### 1.4 — Fulfillment Engine Module
- [x] `src/features/fulfillment/index.js` created
- [x] `generateFulfillmentTrigger(order)` implemented — produces valid `wa.me` URL with encoded message template
- [x] Banking detail template uses `_simConfig` placeholders in sim mode; live mode path documented in code comment
- [x] `src/features/fulfillment/config.example.js` committed with placeholder values
- [x] `src/features/fulfillment/config.js` listed in `.gitignore`

**Exit Criteria:** `generateFulfillmentTrigger()` called with fixture order returns parseable `wa.me` URL string.

---

## Phase 2 — Meta Webhook Handling Layer & Routing Logic

> Goal: A Vercel serverless function that correctly processes or drops all inbound WhatsApp messages.

### 2.1 — Vercel Serverless Function Scaffold
- [x] `api/` directory created at project root
- [x] `api/webhook.js` created — handles `GET` (verification handshake) and `POST` (message payload); returns `405` for all other methods
- [x] `GET` handler reads `hub.mode`, `hub.verify_token`, `hub.challenge` from query params; validates against `process.env.VITE_VERIFY_TOKEN`; echoes challenge on success, returns `403` on mismatch
- [x] `vercel.json` created — function config (`maxDuration: 10`, `memory: 128`) + staging `X-Robots-Tag` headers

**Exit Criteria:** Vercel CLI `vercel dev` serves `api/webhook.js`; GET request with correct verify token returns `hub.challenge` value.

---

### 2.2 — Keyword Gate Implementation
- [x] Bulletproof null-chain extraction at every level: `entry[0].changes[0].value.messages[0]` — each guard short-circuits to silent return, never throws
- [x] Non-message webhook events (status updates, read receipts) `200 OK` already sent; zero execution steps taken after guard
- [x] Casual gate: `Set(['hey','hi','hello','yo','sup','whats up','wassup','hiya','howzit',...])` — `normalised.includes(phrase)` match, silent return
- [x] Business keyword gate: `Set(['menu','order','atchar'])` — case-insensitive substring match triggers `sendInteractiveList()`
- [x] Interactive reply type (`message.type === 'interactive'`) routed to `routeInteractiveReply()` — parses `button_reply.id` or `list_reply.id`
- [x] All unmatched messages drop silently — `200 OK` already sent, Meta receives no retry trigger

**Exit Criteria:** Simulated POST payloads for each message type route to the correct handler branch; verified via `vercel dev` local function logs.

---

### 2.3 — Order Ingestion from Webhook
- [x] `prod_{variant}_{size}` reply ID parsed via `/^prod_([a-z0-9_]+)_(\d+[lL])$/` regex — variant and size extracted as named groups
- [x] Product lookup: `p.name.toLowerCase().replace(/\s+/g, '_') === variant && p.size.toLowerCase() === size` — exact bidirectional match
- [x] `in_stock = false` aborts order creation; live-mode auto-reply to customer documented in code (awaiting live credentials)
- [x] `FLAGS.ordersSimulated = true`: logs full simulated `orders` row object to Vercel Function Logs with `[SIM]` prefix; no database write
- [x] Live mode path stubbed and commented: Supabase INSERT + Realtime push to Production Board
- [ ] Supabase Realtime subscription live test — deferred to Phase 3 flag-flip sequence (requires live credentials)

**Exit Criteria (Simulated):** `[SIM] Order Intercepted` block with full order payload appears in function logs when prod_{variant}_{size} reply ID is received.

---

## Phase 3 — Fulfillment Loop, PWA Manifests & Pre-Production Gate

> Goal: Complete PWA configuration, mobile viewport hardening, and full simulation smoke test.

### 3.1 — Progressive Web App Configuration
- [x] `public/manifest.json` created with correct `name`, `short_name`, `start_url`, `display: "standalone"`, `background_color: "#09090b"`, `theme_color: "#10b981"`
- [ ] App icon set generated — `192x192` and `512x512` PNG files in `public/icons/` — *awaiting client assets*
- [x] `<link rel="manifest">` tag in `index.html`
- [x] `<meta name="apple-mobile-web-app-capable" content="yes">` tag added
- [x] Service worker registration implemented in `src/main.js` — PROD only; offline fallback returns app shell from cache; `public/sw.js` fully implemented
- [ ] Lighthouse PWA audit score ≥ 90 — *deferred to Phase 8 staging gate (requires icon assets)*

**Exit Criteria:** Chrome DevTools → Application → Manifest shows correct fields; "Add to Home Screen" prompt appears on mobile.

---

### 3.2 — Mobile Viewport Hardening (390px)
- [x] All interactive elements have minimum touch target of `44px × 44px` — stock toggle refactored to `role="switch"` wrapper with `p-2.5 -m-2.5 min-h-[44px] min-w-[44px]`
- [x] No horizontal scroll at 390px viewport width — max-w-lg mx-auto container constrains layout
- [x] iOS Safari safe-area insets applied via `env(safe-area-inset-*)` on bottom navigation — `.pb-safe` class applied to `<nav>`; `.scroll-pad-nav` on scroll root; `.toast-offset` on toast container
- [x] `overscroll-behavior: none` applied to root to prevent pull-to-refresh on dashboard
- [x] Order cards stack vertically and remain fully legible at 390px
- [x] "Send Banking Details" button text does not wrap or truncate at 390px — `min-h-[44px]` flex row with `<span>` label
- [x] `prefers-reduced-motion` media query disables all CSS transitions

**Exit Criteria:** Full manual review at 390px in Chrome DevTools device emulation — zero layout breaks, zero truncated text.

---

### 3.3 — Supabase Real-Time Integration (Live Mode Readiness)
- [ ] Supabase `orders` table Realtime replication enabled in Supabase dashboard — *awaiting Supabase project provisioning*
- [ ] Supabase `products` table Realtime replication enabled — *awaiting Supabase project provisioning*
- [ ] Row Level Security (RLS) policies defined and verified:
  - `orders` — `INSERT` allowed for service role only (webhook function)
  - `orders` — `SELECT` + `UPDATE` allowed for authenticated admin users only
  - `products` — `SELECT` allowed for all (anon); `UPDATE` allowed for authenticated admin only
- [x] `supabase.js` subscription architecture complete — `subscribeToOrders()` and `subscribeToStock()` implemented; sim path active (DEV 20s mock injector); live channel code ready for flag flip
- [x] `subscribeToOrders()` + `subscribeToStock()` called from `_bootstrap()` in `src/main.js`
- [ ] End-to-end live test: `FLAGS.ordersSimulated = false` with real Supabase project — *deferred to Phase 5 flag-flip sequence*
- [ ] Stock toggle with `FLAGS.stockSimulated = false` confirmed reflecting on all connected clients — *deferred to Phase 5*

**Exit Criteria:** Two browser tabs open to dashboard — stock toggle on Tab A reflects immediately on Tab B via Realtime subscription.

---

## Switch Flip Log

> Record each transition from simulation (`true`) to live production (`false`) here. Never flip a flag without an entry in this table.

| Flag | Flipped By | Flip Date | Trigger Condition | Verified By |
|------|-----------|-----------|-------------------|-------------|
| `FLAGS.adminSimulated` | — | — | Supabase project provisioned + Auth enabled + RLS policies confirmed active | — |
| `FLAGS.stockSimulated` | — | — | Supabase `products` table populated with real product rows; Realtime confirmed active | — |
| `FLAGS.ordersSimulated` | — | — | Meta Webhook registered + verified; test order received end-to-end from real WhatsApp number | — |
| `FLAGS.menuSimulated` | — | — | Interactive List message template approved by client on real device; WhatsApp Business API tier confirmed | — |

---

## Staging Deployment Record

> Last Updated: 2026-05-28

| Field | Value |
|-------|-------|
| **Deployment ID** | `dpl_J9uVNHzuKtJSbbnfJDQc6xHz96wC` |
| **Stable Preview URL** | `https://aoe-web-eta.vercel.app` |
| **Deployment-Specific URL** | `https://aoe-q8qd9jbr5-matakhakhu-coders-projects.vercel.app` |
| **Inspector URL** | `https://vercel.com/matakhakhu-coders-projects/aoe-web/J9uVNHzuKtJSbbnfJDQc6xHz96wC` |
| **Vercel Project** | `matakhakhu-coders-projects/aoe-web` |
| **Deploy Region** | Washington D.C., USA (iad1) |
| **Build Status** | `READY` |
| **Git Commit** | `f870f89` — feat: complete SVVP simulation engine baseline (Phases 0-3) |
| **Deployed** | 2026-05-28 |

**GitHub Remote:** Not yet connected — push `origin` to `github.com/matakhakhu-coder/aoe-web` then link in Vercel dashboard for automatic preview deployments on push.

---

## Pre-Production Final Gate Checklist

> All items must be checked before Vercel production deployment is approved. No exceptions.

### Build Performance
- [x] `npm run build` completes with zero errors and zero warnings — confirmed on Vercel edge build (iad1)
- [x] Total JS bundle (gzipped) < 150KB — **6.41 kB** ✓
- [x] Total CSS bundle (gzipped) < 20KB — **4.15 kB** ✓
- [ ] Lighthouse Performance score ≥ 85 on mobile simulation — *pending UAT phase*
- [ ] Lighthouse PWA score ≥ 90 — *pending icon assets + UAT phase*
- [x] No unused Tailwind CSS classes in production bundle (purge verified — content paths confirmed in `tailwind.config.js`)

### Database Row Safety
- [ ] `orders` table: confirmed no `DELETE` RLS policy exists for any role — *pending Supabase provisioning*
- [ ] `products` table: confirmed no `DELETE` RLS policy exists for any role — *pending Supabase provisioning*
- [x] `status` field update validated at application layer — only `'Pending'`, `'Paid'`, `'Dispatched'` accepted
- [ ] `price` field validated — no zero or negative values accepted on insert — *pending live webhook integration*
- [ ] `total_amount` calculated at ingestion time only — architecture confirmed; live test pending credentials
- [ ] All Supabase environment variables confirmed present in Vercel production environment settings — *pending credential receipt*

### Responsive Layout Verification
- [ ] 390px (iPhone 14 base) — full Production Board and Inventory Switchboard review complete — *pending client UAT*
- [ ] 430px (iPhone 14 Plus) — layout scales without overflow — *pending client UAT*
- [ ] 768px (iPad Mini) — two-column grid layout renders correctly if implemented
- [ ] 1280px (Desktop) — dashboard centered with max-width container, no stretched elements
- [ ] No horizontal scroll on any tested viewport
- [ ] All touch targets ≥ 44px on mobile viewports — implemented; device verification pending
- [ ] iOS Safari bottom navigation safe-area inset verified on real device or accurate simulator

### Security & Credential Hygiene
- [x] `.env.local` confirmed absent from git history (`git log --all -- .env.local` returns empty — file never staged)
- [x] `src/features/fulfillment/config.js` confirmed absent from git history — file never created; listed in `.gitignore`
- [x] No live API tokens, account numbers, or real phone numbers hardcoded anywhere in source files — audit passed 2026-05-28
- [ ] `VITE_VERIFY_TOKEN` confirmed as a long random string (≥ 32 characters) — *pending credential receipt from client*
- [ ] Vercel environment variables confirmed set to production values — *pending all five `VITE_*` credentials*

### Client UAT Sign-Off
- [ ] Client reviewed Production Board on their own mobile device
- [ ] Client reviewed Inventory Switchboard on their own mobile device
- [ ] "Send Banking Details" deep-link tested on client device — opens WhatsApp with correct pre-filled message
- [ ] Out-of-stock toggle tested end-to-end — toggled product stops accepting orders from WhatsApp
- [ ] Client confirmed business name, banking details, and message template text are correct
- [ ] Client confirmed QR code deep-link URL matches the live WhatsApp business number

---

*Engineering milestone completion is tracked by checking boxes above. For Phase status (Pending / In Progress / Complete), update the Phase Status Matrix in `ARCHAAR_BUILD_MANIFEST.md`.*
