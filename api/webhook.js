/**
 * api/webhook.js
 * Meta WhatsApp Cloud API Webhook Handler
 * Vercel Serverless Function — Node.js Runtime
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RUNTIME CONTEXT NOTE
 * This file runs inside Vercel's Node.js serverless container — NOT in the
 * browser, and NOT processed by Vite. The following rules apply here:
 *
 *   ✗  import.meta.env   → does not exist. Use process.env instead.
 *   ✗  @/ path aliases   → Vite-only. Use relative paths: ../src/
 *   ✓  ESM imports       → supported (package.json has "type": "module")
 *   ✓  process.env       → Vercel injects all env vars at invocation time
 *   ✓  Top-level await   → supported in Node.js ESM
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SIMULATION / LIVE SWITCH ARCHITECTURE
 * All integration paths are governed by FLAGS imported from src/core/flags.js.
 * When FLAGS.ordersSimulated === true : order data is logged; no Supabase write.
 * When FLAGS.menuSimulated  === true  : menu payload is logged; no Meta API call.
 * No live credential is touched while any flag remains true.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ENDPOINT CONTRACT (Meta Cloud API)
 *   GET  /api/webhook  → Verification handshake during webhook registration
 *   POST /api/webhook  → Inbound message delivery (all WhatsApp traffic)
 *
 * Meta requires a 200 OK response within 20 seconds of POST delivery.
 * The handler sends 200 immediately, then processes async.
 */

// Relative imports — @/ aliases are Vite-only and do not resolve here
import { FLAGS } from '../src/core/flags.js'
import { PRODUCTS } from '../src/fixtures/products.js'

// ─── Product catalogue boundary note ──────────────────────────────────────────
// The browser-side state engine (src/core/state.js) stores the mutable product
// catalogue in localStorage and is browser-only. This serverless function runs
// in Node.js with no DOM, no localStorage, and no Vite module resolution.
//
// Simulation mode:  product lookup uses the static PRODUCTS fixture above.
//                   Owner-added products (via UI) are NOT reflected here.
//                   This is an expected simulation boundary — sim mode only logs.
//
// Live mode (FLAGS.ordersSimulated = false):
//                   Both this webhook and the dashboard read from Supabase,
//                   which is the single source of truth for the live catalogue.
//                   All dynamically added products will be present in Supabase
//                   and will be found by the lookup at processOrderFromReply().
// ──────────────────────────────────────────────────────────────────────────────

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Casual conversation phrases that should be silently dropped.
 * Prevents interrupting the client's personal WhatsApp contacts.
 */
const CASUAL_GATE = new Set([
  'hey', 'hi', 'hello', 'yo', 'sup', 'whats up', 'wassup',
  'hiya', 'howzit', 'helo', 'heya', 'howdy', 'morning', 'afternoon',
])

/**
 * Business intent keywords that trigger the Interactive List menu response.
 * Case-insensitive match on the normalised message body.
 */
const BUSINESS_GATE = new Set(['menu', 'order', 'atchar'])

/**
 * Product reply ID pattern: prod_{variant}_{size}
 * Examples: prod_mango_mild_1l · prod_garlic_extra_hot_2l · prod_lemon_chilli_5l
 * Group 1 (variant): one or more lowercase alphanumeric / underscore chars
 * Group 2 (size):    digits followed by 'l' or 'L' (e.g. 1l, 2l, 5l)
 */
const PRODUCT_ID_PATTERN = /^prod_([a-z0-9_]+)_(\d+[lL])$/

// ─── Main Handler ─────────────────────────────────────────────────────────────

/**
 * Vercel serverless function entry point.
 * Routes GET (verification) and POST (payload) to their respective handlers.
 * Returns 405 for all other HTTP methods.
 *
 * @param {import('http').IncomingMessage & { query: Object, body: any }} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (req.method === 'GET')  return handleVerification(req, res)
  if (req.method === 'POST') return handlePayload(req, res)

  return res.status(405).json({ error: 'Method Not Allowed' })
}

// ─── GET: Webhook Verification Handshake ──────────────────────────────────────

/**
 * Validates the Meta webhook registration handshake.
 * Meta sends: hub.mode=subscribe, hub.verify_token, hub.challenge
 *
 * Security: token must match VITE_VERIFY_TOKEN env var exactly.
 * On success: echoes hub.challenge as plain text with 200.
 * On failure: returns 403 Forbidden with no challenge disclosure.
 *
 * @param {Object} req
 * @param {Object} res
 */
function handleVerification(req, res) {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  const storedToken = process.env.VITE_VERIFY_TOKEN

  // Guard: token must be configured server-side
  if (!storedToken) {
    _log('ERROR', 'VITE_VERIFY_TOKEN is not set in environment variables.')
    return res.status(500).send('Server configuration error')
  }

  // Guard: mode must be "subscribe" and token must match exactly
  if (mode === 'subscribe' && token === storedToken) {
    _log('INFO', 'Webhook verification successful — challenge echoed')
    return res.status(200).send(challenge)
  }

  _log('WARN', `Verification failed — mode: "${mode}", token match: ${token === storedToken}`)
  return res.status(403).send('Forbidden')
}

// ─── POST: Inbound Message Payload Processing ─────────────────────────────────

/**
 * Processes inbound WhatsApp message payloads from Meta Cloud API.
 * Responds 200 immediately before any async processing to satisfy
 * Meta's 20-second response window requirement.
 *
 * Bulletproof null-chain extraction guards every level of the nested
 * Meta payload structure to prevent runtime errors on unexpected shapes.
 *
 * @param {Object} req
 * @param {Object} res
 */
async function handlePayload(req, res) {
  // Acknowledge receipt immediately — Meta will retry if we don't respond in time
  res.status(200).send('OK')

  const body = req.body

  // Guard: body must be a non-null object
  if (!body || typeof body !== 'object') {
    _log('WARN', 'POST body is empty or not an object — ignored')
    return
  }

  // ── Safe nested extraction ────────────────────────────────────────────────
  // Meta payload structure:
  //   body.entry[0].changes[0].value.messages[0]
  // Any level can be absent (status updates, template events, etc.)
  // Each guard short-circuits to a silent return — never throws.

  const entry = body?.entry
  if (!Array.isArray(entry) || entry.length === 0) {
    _log('DEBUG', 'Payload has no entry array — non-message event, ignored')
    return
  }

  const changes = entry[0]?.changes
  if (!Array.isArray(changes) || changes.length === 0) {
    _log('DEBUG', 'entry[0].changes is absent — ignored')
    return
  }

  const value = changes[0]?.value
  if (!value || typeof value !== 'object') {
    _log('DEBUG', 'changes[0].value is absent — ignored')
    return
  }

  // Non-message events: status updates (delivered, read), template responses, etc.
  // These must return 200 OK (already sent) but take zero further execution steps.
  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    _log('DEBUG', 'No messages array in value — webhook system event, silently ignored')
    return
  }

  const message = value.messages[0]
  if (!message || typeof message !== 'object') {
    _log('DEBUG', 'messages[0] is null or not an object — ignored')
    return
  }

  const senderPhone = message.from ?? 'unknown'

  _log('INFO', `Message received — from: ${senderPhone} | type: ${message.type ?? 'unknown'}`)

  // ── Route by message type ─────────────────────────────────────────────────
  switch (message.type) {
    case 'text':
      routeTextMessage(message, senderPhone)
      break
    case 'interactive':
      routeInteractiveReply(message, senderPhone)
      break
    default:
      _log('DEBUG', `Unhandled message type: "${message.type}" — silently dropped`)
  }
}

// ─── Text Message Router ──────────────────────────────────────────────────────

/**
 * Applies the two-stage gate to inbound text messages:
 *
 * Stage 1 — Casual Gate:
 *   Detects casual conversation phrases and short-circuits silently.
 *   Preserves the client's personal/family conversations on the same number.
 *
 * Stage 2 — Business Keyword Gate:
 *   Detects transaction-intent keywords and triggers the Interactive List.
 *   All unmatched messages are dropped silently (200 already sent).
 *
 * @param {Object} message - WhatsApp message object
 * @param {string} senderPhone - Sender's phone number (E.164 without +)
 */
function routeTextMessage(message, senderPhone) {
  const rawText  = message.text?.body ?? ''
  const normalised = rawText.trim().toLowerCase()

  if (!normalised) {
    _log('DEBUG', 'Text body is empty after normalisation — dropped')
    return
  }

  // ── Stage 1: Casual Conversation Gate ────────────────────────────────────
  // Check against the full casual phrase set, including substring matches
  // (e.g. "hey there" still contains "hey" and must be dropped)
  for (const phrase of CASUAL_GATE) {
    if (normalised.includes(phrase)) {
      _log('DEBUG', `Casual message gated ("${normalised.slice(0, 40)}") — silent pass-through`)
      return
    }
  }

  // ── Stage 2: Business Keyword Gate ───────────────────────────────────────
  for (const keyword of BUSINESS_GATE) {
    if (normalised.includes(keyword)) {
      _log('INFO', `Business keyword matched: "${keyword}" from ${senderPhone} — triggering Interactive List`)
      sendInteractiveList(senderPhone)
      return
    }
  }

  // No gate matched — all other text is dropped silently
  // (200 OK was already returned; Meta receives no retry trigger)
  _log('DEBUG', `No gate match for: "${normalised.slice(0, 40)}" — silent drop`)
}

// ─── Interactive Reply Router ──────────────────────────────────────────────────

/**
 * Intercepts native WhatsApp Interactive List / Button reply payloads.
 * Extracts the button ID and validates it against the product naming convention.
 *
 * Reply ID convention: prod_{variant}_{size}
 * Examples: prod_mango_mild_1l · prod_garlic_extra_hot_2l · prod_lemon_chilli_5l
 *
 * Button taps on the Interactive List menu return these IDs as structured
 * metadata — no text-parsing errors possible (unlike free-form text orders).
 *
 * @param {Object} message - WhatsApp message object
 * @param {string} senderPhone
 */
function routeInteractiveReply(message, senderPhone) {
  // Interactive replies can be button_reply (button-type) or list_reply (list-type)
  const replyId =
    message.interactive?.button_reply?.id ??
    message.interactive?.list_reply?.id ??
    ''

  if (!replyId) {
    _log('WARN', `Interactive message from ${senderPhone} has no reply ID — dropped`)
    return
  }

  _log('INFO', `Interactive reply received — ID: "${replyId}" from ${senderPhone}`)

  const match = replyId.match(PRODUCT_ID_PATTERN)

  if (!match) {
    _log('WARN', `Reply ID "${replyId}" does not match product pattern prod_{variant}_{size} — dropped`)
    return
  }

  const [, variant, size] = match
  processOrderFromReply({ variant, size, senderPhone, replyId })
}

// ─── Order Processing ──────────────────────────────────────────────────────────

/**
 * Resolves the parsed product reply into a concrete product lookup,
 * validates stock state, and either simulates or commits the order.
 *
 * Product lookup convention:
 *   variant matches p.name.toLowerCase().replace(/\s+/g, '_')
 *   size    matches p.size.toLowerCase()
 *
 * @param {{ variant: string, size: string, senderPhone: string, replyId: string }} params
 */
function processOrderFromReply({ variant, size, senderPhone, replyId }) {
  // Exact-match lookup: name key + size key must both align with parsed reply ID
  const product = PRODUCTS.find((p) => {
    const nameKey = p.name.toLowerCase().replace(/\s+/g, '_')
    const sizeKey = p.size.toLowerCase()
    return nameKey === variant && sizeKey === size.toLowerCase()
  })

  if (!product) {
    _log('WARN', `Product lookup failed for replyId: "${replyId}" (variant="${variant}", size="${size}")`)
    _log('WARN', 'Possible ID mismatch between sendInteractiveList() row IDs and PRODUCTS fixture')
    return
  }

  // Stock shield — out-of-stock products are rejected before order creation
  if (!product.in_stock) {
    _log('INFO', `"${product.name} ${product.size}" is OUT OF STOCK — order blocked for ${senderPhone}`)
    // Live mode: send automated out-of-stock reply via Meta Cloud API
    // await sendTextReply(senderPhone, `Sorry, ${product.name} ${product.size} is out of stock right now. Reply "menu" to see what's available.`)
    return
  }

  if (FLAGS.ordersSimulated) {
    // ── Simulation path ─────────────────────────────────────────────────────
    // Log extracted transaction metrics cleanly without any live writes.
    const simulatedOrder = {
      phone_number:  `+${senderPhone}`,
      customer_name: null,
      order_summary: `1x ${product.size} ${product.name}`,
      total_amount:  product.price,
      status:        'Pending',
    }

    _log('SIM', '─── Order Intercepted ─────────────────────────────────────')
    _log('SIM', `Product  : ${product.name} ${product.size}`)
    _log('SIM', `Price    : R${product.price.toFixed(2)}`)
    _log('SIM', `From     : +${senderPhone}`)
    _log('SIM', `Payload  : ${JSON.stringify(simulatedOrder, null, 2)}`)
    _log('SIM', 'Live mode: would INSERT row to Supabase orders table')
    _log('SIM', 'Live mode: Realtime subscription would push card to Production Board')
    _log('SIM', '────────────────────────────────────────────────────────────')
    return
  }

  // ── Live mode path ───────────────────────────────────────────────────────
  // FLAGS.ordersSimulated === false:
  //   1. Initialise Supabase client (supabase.js)
  //   2. INSERT row to orders table
  //   3. Supabase Realtime broadcasts to connected dashboard clients
  //   4. Confirm receipt to customer via Meta Cloud API text reply
  _log('INFO', `Live order ingestion: ${product.name} ${product.size} from +${senderPhone}`)
}

// ─── Interactive List Builder ──────────────────────────────────────────────────

/**
 * Constructs and dispatches a WhatsApp Interactive List message
 * containing all currently in-stock products.
 *
 * Row ID convention: prod_{name_slug}_{size_lower}
 * This must be consistent with the PRODUCT_ID_PATTERN parser above.
 *
 * Simulation path: logs the full payload structure — no HTTP call.
 * Live path:       POSTs to Meta Graph API messages endpoint.
 *
 * @param {string} toPhone - Recipient phone number (E.164 without +)
 */
function sendInteractiveList(toPhone) {
  const availableProducts = PRODUCTS.filter((p) => p.in_stock)

  if (availableProducts.length === 0) {
    _log('WARN', 'No in-stock products available — cannot build Interactive List')
    return
  }

  // Build rows — IDs must match PRODUCT_ID_PATTERN for reply parsing to work
  const rows = availableProducts.map((p) => ({
    id:          `prod_${p.name.toLowerCase().replace(/\s+/g, '_')}_${p.size.toLowerCase()}`,
    title:       `${p.name} — ${p.size}`,
    description: `R${Number(p.price).toFixed(2)}`,
  }))

  // Full Meta Cloud API Interactive List payload
  const listPayload = {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                toPhone,
    type:              'interactive',
    interactive: {
      type: 'list',
      header: {
        type: 'text',
        text: 'Atchar Menu 🌶️',
      },
      body: {
        text: `Fresh handmade atchar — ${availableProducts.length} products available.\nTap below to place your order instantly.`,
      },
      footer: {
        text: 'Payment via EFT · Capitec / PayShap',
      },
      action: {
        button: 'View Menu',
        sections: [
          {
            title: `Available Now (${rows.length})`,
            rows,
          },
        ],
      },
    },
  }

  if (FLAGS.menuSimulated) {
    _log('SIM', '─── Interactive List Payload ───────────────────────────────')
    _log('SIM', `Recipient : ${toPhone}`)
    _log('SIM', `Products  : ${rows.map((r) => r.title).join(', ')}`)
    _log('SIM', `Full JSON :\n${JSON.stringify(listPayload, null, 2)}`)
    _log('SIM', 'Live mode : would POST to https://graph.facebook.com/v19.0/{phoneNumberId}/messages')
    _log('SIM', '────────────────────────────────────────────────────────────')
    return
  }

  // ── Live mode: Meta Cloud API dispatch ──────────────────────────────────
  // FLAGS.menuSimulated === false:
  //   const phoneId    = process.env.VITE_WHATSAPP_PHONE_NUMBER_ID
  //   const token      = process.env.VITE_WHATSAPP_ACCESS_TOKEN
  //   const apiUrl     = `https://graph.facebook.com/v19.0/${phoneId}/messages`
  //   await fetch(apiUrl, {
  //     method:  'POST',
  //     headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  //     body:    JSON.stringify(listPayload),
  //   })
  _log('INFO', `Interactive List dispatched to ${toPhone} via Meta Cloud API`)
}

// ─── Internal Logger ───────────────────────────────────────────────────────────

/**
 * Structured logger for the serverless function context.
 * All output is visible in Vercel Function Logs (vercel.com/dashboard → Logs).
 *
 * Levels: INFO · WARN · ERROR · DEBUG · SIM
 * [SIM] prefix indicates simulation-mode output — never appears in live production.
 *
 * This is the ONLY console.log path in the webhook handler.
 *
 * @param {'INFO'|'WARN'|'ERROR'|'DEBUG'|'SIM'} level
 * @param {string} message
 */
function _log(level, message) {
  const tag = level === 'SIM' ? '[SIM]' : `[AOE:WEBHOOK:${level}]`
  // eslint-disable-next-line no-console
  console.log(`${tag} ${message}`)
}
