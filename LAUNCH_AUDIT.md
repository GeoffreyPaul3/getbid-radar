# GetBidRadar — Pre-Launch Security & Production-Readiness Audit

**Audit Date**: 2026-09-11  
**Auditor**: Antigravity AI (forensic review + automated verification)

---

## Executive Summary

> **LAUNCH DECISION: CONDITIONAL GO** — All Critical and High security vulnerabilities have been fully remediated. Production build is clean, TypeScript passes at 0 errors, 244/246 automated tests pass. The 2 failing tests are live-API tests gated by `DASHSCOPE_API_KEY`; they are environmental, not code defects.
>
> **BLOCKING**: Before exposing to real customers, apply `supabase/migrations/20260911120000_security_audit_hardening.sql` to the production Supabase instance.

---

## Automated Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run test` (246 tests) | ✅ 244 pass, 2 fail (live API — env gated) |
| `npm run build` | ✅ Clean — built in ~12s (exit 0) |
| Import-protection violations | ✅ 0 (was blocking build before this audit session) |

---

## Critical Vulnerabilities — Remediated ✅

### CRIT-1: Privilege Escalation on `profiles.is_platform_admin`

**Finding**: RLS policy `"own profile write"` permitted any authenticated user to self-promote to platform admin via `UPDATE profiles SET is_platform_admin = true WHERE id = auth.uid()`.

**Remediation**: Migration adds `tr_protect_profiles_admin_escalation` BEFORE UPDATE trigger on `public.profiles` — raises EXCEPTION unless `auth.role() = 'service_role'`. The `supabaseAdmin` service-role client used by `toggleUserAdminStatusFn` can still legitimately manage admin status.

**Verification**:
```sql
-- As regular authenticated user:
UPDATE profiles SET is_platform_admin = true WHERE id = auth.uid();
-- Expected: ERROR: UNAUTHORIZED: Only service_role can modify platform administrator status.
```

---

### CRIT-2: Admin Functions — IDOR / No Authorization

**Finding**: All `admin.functions.ts` server functions accepted `adminUserId` from the client payload with no authentication middleware. Anyone with a known admin UUID could call any admin endpoint.

**Remediation**:
- All admin server functions chain `.middleware([requireSupabaseAuth])` for JWT validation
- `assertPlatformAdmin(context.userId)` is called inside each handler using the session-derived user ID — never from the client payload
- The `admin.middleware.ts` file was restructured to remove `supabaseAdmin` import, fixing the `RolldownError` import-protection build failure
- Dead `adminUserId` parameters removed from all admin route call sites

---

### CRIT-3 (High): Plaintext `temporary_password` in Database

**Finding**: `workspace_invitations.temporary_password` stored cleartext credentials.

**Remediation**: Migration drops the column. All code references removed. Net DB state: no plaintext credential fields.

**Verification**:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'workspace_invitations' AND column_name = 'temporary_password';
-- Expected: 0 rows
```

---

### CRIT-4 (High): Invitation Cross-Account Acceptance

**Finding**: `accept_invitation_by_token` accepted any authenticated user's `_user_id`, enabling cross-account workspace access if the token was known.

**Remediation**: DB function updated to:
1. Fetch caller's email from `auth.users WHERE id = _user_id`
2. Compare `LOWER(caller_email) <> LOWER(invitation.email)`
3. Return `{ success: false, error: 'ACCOUNT_MISMATCH' }` on mismatch
4. NULL the token on successful acceptance (prevents replay)

---

## High Vulnerabilities — Remediated ✅

### HIGH-1: Billing Checkout — No Role Authorization

**Finding**: `initiateCheckoutFn` did not verify the caller holds `owner` or `admin` role in the target workspace.

**Remediation**: Added workspace membership role check using session-scoped RLS client before initiating checkout. Members and viewers receive `BILLING_UNAUTHORIZED` error.

---

## Production Checklist

### Invitation Flow Security

| Scenario | Status |
|---|---|
| New-user invitation via `/join?token=...` | ✅ |
| Expired invitation caught client + server | ✅ |
| Already-used invitation blocked | ✅ |
| Wrong-account invitation → ACCOUNT_MISMATCH | ✅ |
| Token replay prevented (token nulled on accept) | ✅ |
| `must_change_password` prompt on first login | ✅ |
| Seat limit enforced on invite creation | ✅ |

### Routes

| Route | Status |
|---|---|
| `/pricing` | ✅ Added — redirects to `/#pricing` |
| `/join?token=...` | ✅ Full expiry + email match checks |
| `/admin/*` (5 sub-routes) | ✅ All guarded via assertPlatformAdmin |

---

## BLOCKING Pre-Launch Action Required

Apply migration to production:
```bash
supabase db push --db-url <PRODUCTION_DB_URL>
```

**Migration**: `supabase/migrations/20260911120000_security_audit_hardening.sql`

This is the ONLY blocking action. All code changes are already in the codebase.

---

## Required Environment Variables (Production)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin operations) |
| `RESEND_API_KEY` | Email delivery |
| `RESEND_FROM_EMAIL` | Verified sender address |
| `CONTACT_EMAIL` | Contact form recipient |
| `SUPPORT_EMAIL` | Support ticket recipient |
| `CRON_SECRET` | Deadline reminder protection |
| `DASHSCOPE_API_KEY` | Qwen AI provider (optional, Gemini fallback active) |
| `APP_URL` | Production app URL (for email links) |

---

## Remaining Acceptable Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Live Qwen API tests fail without DASHSCOPE_API_KEY | Low | By design; Gemini fallback active in production |
| Email fallback to personal address if env vars unset | Low | Set CONTACT_EMAIL/SUPPORT_EMAIL in production |
| No rate limiting on public token lookup endpoint | Low | UUID token space (2¹²²) makes brute force impractical |
| Deadline reminders unprotected without CRON_SECRET | Medium | Set CRON_SECRET env var before launch |
