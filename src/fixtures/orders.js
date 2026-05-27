/**
 * src/fixtures/orders.js
 * Simulated Order Stream — Active when FLAGS.ordersSimulated === true
 *
 * Columns match the `orders` table schema exactly (ARCHAAR_BUILD_MANIFEST.md):
 * id, created_at, phone_number, customer_name, order_summary, total_amount, status
 *
 * Covers all three status states: Pending, Paid, Dispatched.
 * Phone numbers in E.164 format (+27XXXXXXXXX) — used as PayShap payment reference.
 */

export const ORDERS = [
  {
    id: 'order-001',
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(), // 8 minutes ago
    phone_number: '+27821234567',
    customer_name: 'Thabo Dlamini',
    order_summary: '2x 2L Garlic Extra Hot, 1x 1L Mango Mild',
    total_amount: 305,
    status: 'Pending',
  },
  {
    id: 'order-002',
    created_at: new Date(Date.now() - 1000 * 60 * 47).toISOString(), // 47 minutes ago
    phone_number: '+27734567890',
    customer_name: 'Naledi Khumalo',
    order_summary: '1x 5L Lemon Chilli',
    total_amount: 290,
    status: 'Paid',
  },
  {
    id: 'order-003',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    phone_number: '+27609876543',
    customer_name: 'Sipho Nkosi',
    order_summary: '1x 2L Mango Mild, 1x 2L Garlic Extra Hot',
    total_amount: 235,
    status: 'Dispatched',
  },
  {
    id: 'order-004',
    created_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(), // 3 minutes ago
    phone_number: '+27711122334',
    customer_name: null, // Demonstrates nullable customer_name (new contact)
    order_summary: '3x 1L Mango Mild',
    total_amount: 195,
    status: 'Pending',
  },
]
