/**
 * src/features/fulfillment/config.example.js
 * Fulfillment Configuration Template
 *
 * Copy this file to config.js and populate with the client's real banking details.
 * config.js is gitignored — NEVER commit banking credentials to source control.
 *
 * This example file is committed as documentation only.
 * Used by generateFulfillmentTrigger() to build WhatsApp deep-link messages.
 *
 * Asset status: Awaiting client (see ARCHAAR_BUILD_MANIFEST.md Standby Protocol)
 */

export const FULFILLMENT_CONFIG = {
  bankName:      'Capitec Bank',
  accountNumber: '[CAPITEC_ACC_NUMBER]',
  accountHolder: '[ACCOUNT_HOLDER_NAME]',
  payshapId:     '[PAYSHAP_IDENTIFIER]',
}
