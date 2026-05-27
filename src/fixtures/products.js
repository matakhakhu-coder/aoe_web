/**
 * src/fixtures/products.js
 * Simulated Product Catalogue — Active when FLAGS.stockSimulated === true
 *
 * Columns match the `products` table schema exactly (ARCHAAR_BUILD_MANIFEST.md):
 * id, name, size, price, image_url, in_stock
 *
 * DO NOT hardcode these values in component files.
 * All product data must be sourced from this fixture (sim) or Supabase (live).
 */

export const PRODUCTS = [
  {
    id: 'prod-001',
    name: 'Mango Mild',
    size: '1L',
    price: 65,
    image_url: null, // Awaiting client product photography
    in_stock: true,
  },
  {
    id: 'prod-002',
    name: 'Mango Mild',
    size: '2L',
    price: 115,
    image_url: null,
    in_stock: true,
  },
  {
    id: 'prod-003',
    name: 'Garlic Extra Hot',
    size: '2L',
    price: 120,
    image_url: null,
    in_stock: true,
  },
  {
    id: 'prod-004',
    name: 'Garlic Extra Hot',
    size: '5L',
    price: 270,
    image_url: null,
    in_stock: true,
  },
  {
    id: 'prod-005',
    name: 'Lemon Chilli',
    size: '1L',
    price: 70,
    image_url: null,
    in_stock: false, // Demonstrates OUT OF STOCK state in Inventory Switchboard
  },
  {
    id: 'prod-006',
    name: 'Lemon Chilli',
    size: '5L',
    price: 290,
    image_url: null,
    in_stock: true,
  },
]
