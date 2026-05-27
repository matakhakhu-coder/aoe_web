# ARCHAAR_BUILD_MANIFEST.md — AOE_WEB Absolute Source of Truth

> Atchar Automation Order Engine · Product Data · Component States · Theme Definitions  
> Document Authority: This manifest supersedes all in-code comments regarding schema, brand parameters, and UI constraints.  
> Last Updated: 2026-05-27

---

## Phase Status Matrix

| Phase | Name | Scope | Status |
|-------|------|-------|--------|
| **Phase 0** | Substrate Initialisation | Vite + Tailwind scaffold, `flags.js`, `bus.js`, fixture files, `supabase.js` client shell, `.env.example` | `[x] Complete` |
| **Phase 1** | Core Layouts & Reactive Views | `index.html` shell, Production Board view, Inventory Switchboard view, component routing layer, Tailwind dark-mode baseline | `[x] Complete` |
| **Phase 2** | Meta Webhook Handling Layer | Vercel serverless function (`/api/webhook.js`), inbound message filtering algorithm, keyword gate, payload precision parser, `200 OK` short-circuit for non-business messages | `[x] Complete` |
| **Phase 3** | Real-Time Supabase Integration | Supabase Realtime subscription on `orders` table, live stock toggle commits to `products` table, Row Level Security policy configuration | `[ ] Pending` |
| **Phase 4** | Fulfillment Engine | `generateFulfillmentTrigger()` deep-link builder, banking detail message template, WhatsApp URL scheme wrapper, "Send Banking Details" CTA button wiring | `[ ] Pending` |
| **Phase 5** | Simulation-to-Live Flag Transitions | Sequential flag flips (`ordersSimulated`, `stockSimulated`, `menuSimulated`, `adminSimulated`), end-to-end integration testing per flag | `[ ] Pending` |
| **Phase 6** | PWA Configuration | `manifest.json`, service worker registration, offline fallback shell, icon set (192px + 512px), `meta` viewport and theme-color tags | `[x] Complete` |
| **Phase 7** | Mobile Viewport Hardening | 390px base layout verification, touch target sizing (min 44px), overscroll behaviour locks, iOS Safari safe-area inset handling | `[x] Complete` |
| **Phase 8** | Staging Lock | Vercel preview deployment, full simulation-mode smoke test, Lighthouse PWA + Performance audit, client UAT sign-off | `[~] In Progress` |

---

## Brand & Operational Parameters

> These values are placeholders. Update each cell as credentials and assets are received from the client. Do NOT commit live values to source control.

| Parameter | Placeholder | Notes |
|-----------|-------------|-------|
| **Business Trading Name** | `[CLIENT_BUSINESS_NAME]` | Used in PWA manifest `name` field and fulfillment message greeting |
| **Primary WhatsApp Business Number** | `+27[XXXXXXXXX]` | The single number shared between WhatsApp Business App and Cloud API via coexistence |
| **Meta Phone Number ID** | `[PHONE_NUMBER_ID]` | Sourced from Meta Developer Console → `VITE_WHATSAPP_PHONE_NUMBER_ID` |
| **Meta Cloud API Access Token** | `[ACCESS_TOKEN]` | Long-lived system user token → `VITE_WHATSAPP_ACCESS_TOKEN` |
| **Meta Webhook Verify Token** | `[VERIFY_TOKEN]` | Arbitrary secret set during webhook registration → `VITE_VERIFY_TOKEN` |
| **Capitec Bank Account Number** | `[CAPITEC_ACC_NUMBER]` | Embedded in fulfillment message template; stored in `fulfillment/config.js` (gitignored) |
| **Capitec Account Holder Name** | `[ACCOUNT_HOLDER_NAME]` | Displayed in banking details block of fulfillment message |
| **PayShap Identifier** | `[PAYSHAP_ID]` | Mobile number or registered PayShap alias for instant EFT routing |
| **Supabase Project URL** | `https://[PROJECT_REF].supabase.co` | → `VITE_SUPABASE_URL` |
| **Supabase Anon Key** | `[SUPABASE_ANON_KEY]` | Safe for browser use with RLS enforced → `VITE_SUPABASE_ANON_KEY` |
| **QR Code Discovery Deep-Link** | `https://wa.me/27[XXXXXXXXX]?text=Menu` | Printed on physical bucket labels; pre-fills WhatsApp with keyword `Menu` |

---

## Database Entity Dictionary

### Table: `products` — Inventory Control Schema

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Immutable row identifier; auto-generated on insert |
| `name` | `TEXT` | `NOT NULL` | Product variant name — e.g., `Garlic Extra Hot`, `Mango Mild`, `Mixed Spice Original` |
| `size` | `TEXT` | `NOT NULL` | Container volume — e.g., `500ml`, `1L`, `2L`, `5L` |
| `price` | `NUMERIC` | `NOT NULL` | Unit retail price in South African Rand (ZAR); no currency symbol stored |
| `image_url` | `TEXT` | `NULLABLE` | Supabase Object Storage asset pointer; `NULL` until product photography is uploaded |
| `in_stock` | `BOOLEAN` | `DEFAULT true` | Live stock availability gate; toggled from Inventory Switchboard view in real time |

**Row Safety Rules:**
- `in_stock = false` triggers automatic out-of-stock blocking in the webhook routing layer.
- `price` must never be `0` or negative — validate at application layer before commit.
- `image_url` being `NULL` is a valid state; the UI must render a placeholder tile, not an error.
- No `DELETE` operations permitted on `products` in production — use `in_stock = false` to retire a product.

**Simulated Fixture Reference:** `src/fixtures/products.js`

---

### Table: `orders` — Real-Time Production Queue Schema

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Immutable row identifier; auto-generated on insert |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `DEFAULT NOW()` | UTC timestamp of order ingestion; drives chronological sort on Production Board |
| `phone_number` | `TEXT` | `NOT NULL` | Customer's WhatsApp number in E.164 format — e.g., `+27821234567`; used as PayShap reference |
| `customer_name` | `TEXT` | `NULLABLE` | Display name parsed from WhatsApp contact profile object; may be `NULL` for new contacts |
| `order_summary` | `TEXT` | `NOT NULL` | Human-readable concatenated order string — e.g., `2x 2L Garlic Hot, 1x 1L Mango Mild` |
| `total_amount` | `NUMERIC` | `NOT NULL` | Calculated ZAR total of order at time of ingestion; immutable after insert |
| `status` | `TEXT` | `DEFAULT 'Pending'` | Order lifecycle state; constrained to `'Pending'` → `'Paid'` → `'Dispatched'` |

**Status Lifecycle Rules:**
- `'Pending'` — Order received, banking details not yet sent. Initial state for all new rows.
- `'Paid'` — Client has confirmed proof of payment received. Manual status promotion from dashboard.
- `'Dispatched'` — Physical order handed to customer or courier. Terminal state.
- Status transitions are one-directional only (`Pending → Paid → Dispatched`); no backward transitions permitted.
- `total_amount` is calculated server-side from current `products.price` values at ingestion time and stored — never recalculated from live prices post-insert.

**Row Safety Rules:**
- No `DELETE` operations on `orders` — all records are permanent for audit trail integrity.
- `status` field must be validated against the three permitted string values at application layer before any update commit.

**Simulated Fixture Reference:** `src/fixtures/orders.js`

---

## UI & Aesthetic Constraints

### Design System Foundations

| Parameter | Specification |
|-----------|--------------|
| **Color Mode** | Dark mode only — no light mode toggle; not required by client context |
| **Base Background** | `zinc-950` (`#09090b`) — deepest application surface layer |
| **Card / Panel Surface** | `zinc-900` (`#18181b`) — elevated container layer |
| **Border Color** | `zinc-800` (`#27272a`) — subtle structural dividers |
| **Primary Text** | `zinc-100` (`#f4f4f5`) — high-contrast headings and labels |
| **Secondary Text** | `zinc-400` (`#a1a1aa`) — metadata, timestamps, helper text |
| **Primary Accent** | `emerald-500` (`#10b981`) — active states, IN STOCK badge, positive confirmations |
| **Warning Accent** | `amber-400` (`#fbbf24`) — Pending status tokens, low-stock warnings |
| **Danger Accent** | `red-500` (`#ef4444`) — OUT OF STOCK badge, error states |
| **CTA Button** | `emerald-600` background, `white` text, `hover:emerald-500` transition — "Send Banking Details" primary action |
| **Font Stack** | `font-mono` (Geist Mono or system monospace) for order IDs and amounts; `font-sans` (Inter or system) for all other text |
| **Base Viewport** | `390px` mobile-first; responsive scaling up to `1440px` desktop |
| **Border Radius** | `rounded-xl` (`12px`) for cards; `rounded-lg` (`8px`) for buttons and inputs; `rounded-full` for status badges |
| **Spacing Scale** | Tailwind default scale — base unit `4px`; minimum interactive target `44px` (touch compliance) |

### Component State Specifications

#### Order Card (Production Board)
```
┌─────────────────────────────────────────────────────┐
│  [CUSTOMER_NAME]              [STATUS BADGE]         │
│  +27 XX XXX XXXX              ● Pending / Paid       │
│  ─────────────────────────────────────────────────  │
│  2x 2L Garlic Hot, 1x 1L Mango Mild                 │
│  ─────────────────────────────────────────────────  │
│  Total: R 245.00              [12 min ago]           │
│                                                      │
│  [ Send Banking Details ↗ ]   [ Mark as Paid ]      │
└─────────────────────────────────────────────────────┘
```
- Status badge `Pending` → `amber-400` text on `amber-400/10` background
- Status badge `Paid` → `emerald-500` text on `emerald-500/10` background
- Status badge `Dispatched` → `zinc-400` text on `zinc-800` background
- "Send Banking Details" button opens WhatsApp deep-link in new tab/native app

#### Inventory Row (Switchboard)
```
┌─────────────────────────────────────────────────────┐
│  [Product Image]   Garlic Extra Hot · 2L            │
│                    R 95.00                          │
│                    ────────────────────────         │
│                    [● IN STOCK]   /   [○ OUT]       │
└─────────────────────────────────────────────────────┘
```
- Toggle `IN STOCK` → `emerald-500` illuminated pill
- Toggle `OUT OF STOCK` → `red-500` muted pill; triggers Supabase commit
- Image slot renders `zinc-800` placeholder rectangle if `image_url` is `NULL`

### Animation & Motion
- Transition duration: `150ms` for color state changes; `200ms` for transform/scale interactions
- New order card entrance: `opacity-0 → opacity-100` + `translate-y-2 → translate-y-0` over `300ms`
- No decorative animations — all motion serves state communication only
- `prefers-reduced-motion` media query must disable all transitions

### Typography Scale
| Role | Class | Size |
|------|-------|------|
| Page Header | `text-xl font-semibold` | 20px |
| Card Title | `text-base font-medium` | 16px |
| Body / Order Summary | `text-sm` | 14px |
| Metadata / Timestamps | `text-xs text-zinc-400` | 12px |
| Order ID / Amount | `text-sm font-mono` | 14px monospace |

---

## Webhook Payload Reference

### Inbound Keyword Gate (Routing Logic)
| Message Content | Action |
|-----------------|--------|
| `"menu"` (case-insensitive) | Respond with WhatsApp Interactive List |
| `"order"` (case-insensitive) | Respond with WhatsApp Interactive List |
| `"atchar"` (case-insensitive) | Respond with WhatsApp Interactive List |
| `prod_[variant]_[size]` (button reply ID) | Parse and insert order row to Supabase |
| Any other text | Return `200 OK`, take zero execution steps |

### Interactive List Button Reply ID Convention
```
prod_{variant}_{size}
```
Examples: `prod_garlic_hot_2l`, `prod_mango_mild_1l`, `prod_mixed_5l`

---

## Fulfillment Message Template

```
Hi [CUSTOMER_NAME], I've locked in your order for [ORDER_SUMMARY] 
(Total Due: R[TOTAL_AMOUNT]). 

Please transfer payment to:
Bank: Capitec Bank
Account: [CAPITEC_ACC_NUMBER]
Account Holder: [ACCOUNT_HOLDER_NAME]
Reference: [PHONE_NUMBER] (your number)

Alternatively, PayShap to: [PAYSHAP_ID]

Send proof of payment here when done!
```

Deep-link format: `https://wa.me/[PHONE_NUMBER]?text=[encodeURIComponent(template)]`
