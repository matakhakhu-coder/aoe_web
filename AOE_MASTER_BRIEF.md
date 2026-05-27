This document serves as the absolute architectural template, communication profile, and behavioral specification for the Atchar Automation Order Engine (AOE). It establishes the technical boundaries required to build a lightweight, high-performance SVVP (System Viable Viable Product).

---

## 1. Project Identity

| Key | Value |
|-----|-------|
| **Project Name** | AOE_WEB (Atchar Automation Order Engine) |
| **Client Context** | Independent High-Volume Atchar Producer (South Africa) |
| **Concept** | Conversational Order Ingestion Pipeline + Instant Stock Shield |
| **Core Stack** | Vite · Vanilla JS ESM · Tailwind CSS 3.x · PostCSS · Autoprefixer |
| **Backend Infrastructure** | Supabase (PostgreSQL · Realtime Replication · Object Storage) |
| **Communications Engine** | Meta WhatsApp Cloud API (Webhooks Layer) |
| **Hosting Environment** | Vercel Edge Runtime & Cloud Architecture |
| **Primary Blueprint** | Complete architectural feature isolation; dynamic code modularity |

---

## 2. SVVP (System Viable Viable Product) Model

The AOE is engineered as a fully decoupled, real-time control system. It must operate flawlessly under an explicit **Simulation/Live Switch Framework**. Every external mechanism (WhatsApp incoming webhook delivery, stock verification loops, order pipeline ingestion) must be completely simulated via programmatic flags before mapping directly to live production access tokens.

### Simulation Matrix
A master state flag module (`src/core/flags.js`) manages the integration behavior:
* `FLAGS.menuSimulated = true` — Emulates WhatsApp Interactive List component layouts inside the UI for quick validation.
* `FLAGS.ordersSimulated = true` — Feeds simulated order arrays to the real-time pipeline queue without making API network queries.
* `FLAGS.stockSimulated = true` — Mimics local storage stock mutations for instant edge-case handling.
* `FLAGS.adminSimulated = true` — Bypasses Supabase Auth barriers via a hardcoded administrative session container.

---

## 3. Communication Architecture & Coexistence Matrix

The engine utilizes **WhatsApp Coexistence**, sharing a single primary business phone number concurrently between the official mobile **WhatsApp Business App** and the **WhatsApp Cloud API** script environment.

             ┌───────── [ Inbound WhatsApp Message ] ─────────┐
             │                                                │
             ▼                                                ▼
 [ Interactive List Button Click ]                [ Casual/Unstructured Text ]
 Payload Example: "prod_garlic_2l"                Example: "Hey man, you around?"
             │                                                │
             ▼                                                ▼
 [ Webhook Intercepts Payload ]                    [ Webhook Retracts / Safely Drops ]
             │                                                │
             ▼                                                ▼
Validates Inventory State                     Bypasses database completely.

Pushes row to Supabase Pipeline               Lands natively on phone for 1-to-1

Sends real-time toast to client               manual user interaction.


### The Inbound Filtering Algorithm
To prevent interrupting the client's personal contacts, family circles, and non-business conversations, the webhook routing logic uses strict payload evaluation:

1. **The Keyword Gate:** The webhook ignores all casual phrases (`"hey"`, `"hello"`, `"yo"`, `"whats up"`). If the message does not match specific keyword strings (`"menu"`, `"order"`, `"atchar"`), the script returns an instant `200 OK` status and takes zero execution steps.
2. **The Discovery Link:** Customers interact with the menu via a targeted deep link or a QR code printed on physical bucket labels (`https://wa.me/27XXXXXXXXX?text=Menu`). This method pre-fills the text field with the precise keyword, eliminating conversational friction.
3. **Payload Precision:** Tapping items within the native WhatsApp Interactive UI component returns a specific metadata string (e.g., `prod_mango_5l`) instead of raw text. This allows the backend script to instantly process orders with zero text-parsing errors.

---

## 4. Operational Pipeline Logic (Manual EFT Mapping)

The application bypasses third-party merchant accounts, handling payments natively through local banking behaviors (EFT, banking app transfers, PayShap). 

### The Deep-Link Fulfillment Loop
When an order lands on the client's dashboard, it generates a manual fulfillment mechanism using a **WhatsApp URL Scheme Wrapper**:

```javascript
export function generateFulfillmentTrigger(order) {
  const messageTemplate = `Hi ${order.customer_name}, I've locked in your order for ${order.order_summary} (Total Due: R${order.total_amount}). Please transfer payment to Capitec Bank, Acc: 148902345 using your number (${order.phone_number}) as the payment reference. Send proof of payment here when done!`;
  
  return `https://wa.me/${order.phone_number}?text=${encodeURIComponent(messageTemplate)}`;
}
Tapping this button on his dashboard instantly shifts the client out of his web application and opens his native WhatsApp app, with the customer's chat screen open and the banking details pre-filled.

5. Master Database Definitions (Supabase Schema)
SQL
-- 1. Inventory Control Schema
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,          -- e.g., 'Garlic Extra Hot', 'Mango Mild'
    size TEXT NOT NULL,          -- e.g., '1L', '2L', '5L'
    price NUMERIC NOT NULL,      -- Unit value in ZAR
    image_url TEXT,              -- Storage bucket asset pointer
    in_stock BOOLEAN DEFAULT true
);

-- 2. Real-Time Production Queue Schema
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    phone_number TEXT NOT NULL,
    customer_name TEXT,          -- Parsed from WhatsApp profile object
    order_summary TEXT NOT NULL,  -- Concatenated list (e.g., "2x 2L Garlic Hot")
    total_amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'Pending' -- 'Pending' -> 'Paid' -> 'Dispatched'
);
6. Functional UI Specifications
The dashboard is designed as a high-fidelity, high-contrast, dark-mode Progressive Web App (PWA) layout optimized for mobile viewports (390px base).

View 1: The Production Board: A chronological stream of incoming orders. Each order card features structural typography, an illuminated status token, and a prominent "Send Banking Details" deep-link button.

View 2: The Inventory Switchboard: A streamlined view showing rows of products with a clear toggle component ([🟢 IN STOCK] / [🔴 OUT OF STOCK]). Toggling an item to false instantly updates the database, prompting the WhatsApp API script to block orders for that product and send an automatic out-of-stock notification.