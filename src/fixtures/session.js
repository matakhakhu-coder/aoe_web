/**
 * src/fixtures/session.js
 * Simulated Admin Session — Active when FLAGS.adminSimulated === true
 *
 * Provides a structural mock of the Supabase Auth session object so the
 * admin auth guard in src/features/admin/ can operate without a live
 * Supabase connection or valid JWT.
 *
 * Shape mirrors the Supabase `session.user` object exactly so that any
 * downstream code reading session.user.id, session.user.email, or
 * session.user.role works identically in both simulation and live modes.
 */

export const SIMULATED_SESSION = {
  access_token: 'sim_access_token_aoe_admin',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'sim_refresh_token_aoe_admin',
  user: {
    id: 'sim-admin-user-001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'admin@aoe-local.sim',
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      admin: true,
    },
    user_metadata: {
      name: 'AOE Admin',
      role: 'owner',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
}
