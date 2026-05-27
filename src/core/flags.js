/**
 * src/core/flags.js
 * SVVP Simulation/Live Switch Framework — Master State Module
 *
 * All integration behaviour in AOE_WEB is governed by this object.
 * Default: all flags true (full simulation mode, no live credentials required).
 *
 * Flipping a flag from true → false graduates that integration to live production.
 * Every flag flip must be logged in ARCHAAR_ROADMAP.md Switch Flip Log before commit.
 *
 * DO NOT import credentials or tokens in this file.
 * DO NOT hardcode phone numbers, account details, or API endpoints here.
 */

export const FLAGS = {
  /**
   * menuSimulated: true
   * Emulates WhatsApp Interactive List component layouts in the UI using
   * static JSON fixtures from src/fixtures/products.js.
   * Live (false): Maps directly to Meta Cloud API Interactive Message schema
   * and dispatches to the configured live WhatsApp Business number.
   */
  menuSimulated: true,

  /**
   * ordersSimulated: true
   * Feeds static simulated order arrays into the real-time queue on a
   * configurable interval via src/fixtures/orders.js.
   * Live (false): Processes live webhook payloads from Meta Cloud API;
   * pushes rows to production Supabase `orders` table.
   */
  ordersSimulated: true,

  /**
   * stockSimulated: true
   * Mimics localStorage-backed stock toggle mutations for instant
   * edge-case and UI validation without a database connection.
   * Live (false): Commits `in_stock` boolean mutations directly to
   * Supabase `products` table in real time via Realtime subscription.
   */
  stockSimulated: true,

  /**
   * adminSimulated: true
   * Bypasses Supabase Auth using the hardcoded session object from
   * src/fixtures/session.js. No credentials required.
   * Live (false): Requires valid Supabase JWT session; enforces Row Level
   * Security policies on all queries.
   */
  adminSimulated: true,
}
