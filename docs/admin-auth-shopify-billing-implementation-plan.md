# Admin Auth, Shopify Billing Bridge, and Admin Console Implementation Plan

Last updated: 2026-04-14
Status: Phases 1–2 implemented; Phases 3–5 not started

---

## Implementation Progress Notes (2026-04-14 audit)

### What is done

- [x] **Phase 1: Auth foundation** — COMPLETE
- [x] **Phase 2: Admin store editing** — COMPLETE (no store creation API)

### What remains

- [ ] **Phase 3: Menu import and publish flow** — NOT STARTED
  - No `menu_import_jobs` table, no storage bucket, no extraction pipeline
  - No diff/review/publish UI or API
  - Menu updates currently only possible via `scripts/seed-menu-snapshot.js`
- [ ] **Phase 4: Shopify billing bridge** — NOT STARTED
  - No billing tables (`store_billing_accounts`, `billing_sessions`, `billing_subscriptions`, `store_entitlements`)
  - No Shopify Admin API env support
  - No backend checkout creation endpoint (`POST /api/billing/checkout`)
  - No webhook handlers (`orders-paid`, `orders-updated`)
  - No entitlement computation logic
  - Shopify Storefront cart creation still lives in frontend `app.js` only
- [ ] **Phase 5: Entitlement-aware user foundation** — NOT STARTED
  - No client portal for non-admin users (placeholder message only)
  - No store entitlement check helpers
  - `store_memberships` table exists in schema but is unused in app code

### SQL migration gap

Existing migrations: `005_auth_profiles_and_memberships.sql`, `006_admin_audit_logs.sql`

Still needed per plan:
- `006_billing_bridge.sql` (or renumber) — billing accounts, sessions, subscriptions, entitlements
- `007_menu_import_jobs.sql` — menu import job tracking
- `008_admin_rls_policies.sql` — RLS policies for admin tables

### API route gap

Implemented:
- `GET /api/auth/session`, `POST /api/auth/register`, `POST /api/auth/resolve-identifier`
- `GET /api/admin/stores`, `GET/PATCH /api/admin/stores/:slug`
- `PUT /api/admin/stores/:slug/keywords`, `PUT /api/admin/stores/:slug/staff`
- `GET /api/runtime-config`

Still needed per plan:
- `POST /api/billing/checkout`
- `POST /api/shopify/webhooks/orders-paid`
- `POST /api/shopify/webhooks/orders-updated`
- `POST /api/admin/stores/:slug/menu-imports`
- `POST /api/admin/stores/:slug/menu-imports/:jobId/extract`
- `POST /api/admin/stores/:slug/menu-imports/:jobId/diff`
- `POST /api/admin/stores/:slug/menu-imports/:jobId/publish`
- `POST /api/admin/stores` (create new store — not in plan but needed for multi-store)

### Server helper gap

Implemented: `lib/server/auth.js`, `lib/server/admin-guard.js`

Still needed per plan:
- `lib/server/billing.js` — plan map, billing sessions, webhook normalization, entitlements
- `lib/server/shopify-admin.js` — Shopify Admin API client
- `lib/server/menu-import.js` — extraction, diff, publish logic

### Frontend gap

Implemented: login/register UI, admin dashboard, store list, store editor (identity + keywords + staff)

Still needed:
- Menu import UI in admin store editor
- Billing/subscription status display
- Client portal for non-admin users

---

## Purpose

This document is the canonical implementation plan for the approved first version of the account system.

The product owner approved the following direction:

- The app should have its own login system.
- Registration uses username, email, and password.
- Login should support username or email plus password.
- The system must support `admin` and `user` roles.
- Only the `admin` interface is in scope right now.
- Shopify should remain the payment and billing system in v1.
- Shopify should not become the primary login system in v1.
- Subscription and payment facts from Shopify must be synchronized into the app so the app can decide which permissions and features are open.

This document is intentionally detailed so the next AI agent can execute without re-discovering the architecture.

## Frozen Product Decisions

The next AI should treat these as locked unless the user explicitly changes them:

1. App authentication in v1 is handled by Supabase Auth, not Shopify customer login.
2. Shopify in v1 is billing-only:
   - checkout
   - subscription purchase
   - order and renewal facts
3. The app remains the source of truth for:
   - roles
   - store access
   - feature access
   - admin permissions
4. `admin` users are internal operators and are not gated by customer subscription entitlements.
5. `user` users are customer-side accounts and will eventually be gated by store membership plus store entitlements.
6. Only admin-facing UI must be built now, but the data model must support both admin and user.
7. Price list updates must support two input modes:
   - image upload plus AI extraction
   - text input
8. Price list updates must be a review-and-publish flow, not a blind overwrite.
9. Existing service identifiers must be preserved whenever possible:
   - `uqid` values inside `menu_json` are business-critical and should remain stable across updates when the same service still exists.

## Executive Summary

### What exists today

The current project is a vanilla single-page front end with Vercel serverless endpoints and Supabase as the database.

Relevant existing paths:

- Frontend SPA router:
  - [app.js](../app.js)
- Frontend shell:
  - [index.html](../index.html)
- Vercel rewrites:
  - [vercel.json](../vercel.json)
- Database schema:
  - [sql/001_schema.sql](../sql/001_schema.sql)
- Data access:
  - [lib/server/store-repo.js](../lib/server/store-repo.js)
- Menu parsing:
  - [lib/server/menu.js](../lib/server/menu.js)
- Receipt recognition:
  - [lib/server/recognize.js](../lib/server/recognize.js)
- Review generation:
  - [lib/server/reviews.js](../lib/server/reviews.js)

### What does not exist today

The following do not exist yet:

- user accounts
- login UI
- registration flow
- user roles
- store memberships
- billing linkage between Shopify and app users
- app-side subscription/entitlement tables
- protected admin APIs
- protected admin routes
- menu import jobs
- menu diff/review/publish workflow
- upload storage for admin price list files

### Core architecture decision

V1 should be implemented as:

- Supabase Auth for app login
- app-owned roles and memberships for access control
- Shopify Storefront API for checkout creation
- Shopify Admin API plus webhooks for payment state synchronization
- app-owned entitlement tables as the runtime source of truth for permissions

The app must not depend on live Shopify calls during every page load to decide permissions.

## Why This Architecture Is Correct

### Why not use Shopify as the main login system in v1

This product is not only an ecommerce storefront. It has its own business objects and permissions:

- internal admin access
- store ownership and membership
- store-specific editing rights
- feature entitlements by subscription plan
- audit logs for data changes

Shopify is good at:

- checkout
- payment collection
- customer records
- subscriptions and order events

Shopify is not the natural source of truth for:

- which internal operator can edit all stores
- which app user belongs to which store
- which app features are unlocked for a store
- admin-side workflow objects such as menu import jobs

### Why this does not create a bad two-password experience

V1 does not require customers to log in through Shopify.

Customer experience in v1 should be:

1. Register on the app with username, email, and password.
2. Log in to the app with username or email plus password.
3. If payment is needed, the app redirects to Shopify checkout.
4. After payment, Shopify sends order facts back to the app.
5. The app updates internal entitlements.
6. The customer continues using only the app login.

From the customer perspective, there is one app account.

Shopify functions like the payment rail, not the primary identity provider.

### Why not query Shopify live for permissions

The app should not check Shopify on every request to decide whether features are open because that is:

- slower
- more fragile
- harder to audit
- harder to debug during webhook delays
- less flexible for grace periods and manual overrides

Instead:

- Shopify provides payment and order facts.
- The app converts those facts into internal subscription rows and entitlements.
- The app then checks its own entitlement tables at runtime.

## Current Repo Facts That Matter To This Plan

### Existing tables

Current business tables are:

- `stores`
- `store_menu_snapshots`
- `scan_events`
- `store_staff`

See [sql/001_schema.sql](../sql/001_schema.sql).

Important existing fields:

- `stores.name_zh`
- `stores.name_en`
- `stores.google_review_url`
- `stores.google_review_fallback_url`
- `stores.review_keywords`
- `store_staff.name`
- `store_staff.display_name`
- `store_staff.sort_order`
- `store_menu_snapshots.menu_json`
- `store_menu_snapshots.version`
- `store_menu_snapshots.is_published`

### Existing backend access pattern

The server currently uses Supabase service role credentials for all backend reads and writes:

- [lib/server/supabase.js](../lib/server/supabase.js)
- [lib/server/env.js](../lib/server/env.js)

This means there is currently no user identity or permission gate at the API layer.

### Existing menu storage model

The store service catalog is stored as versioned JSON in `store_menu_snapshots.menu_json`.

The current menu structure is parsed from:

- [menu.json](../menu.json)
- [lib/server/menu.js](../lib/server/menu.js)

Important service fields inside the snapshot:

- `uqid`
- `n`
- `zh`
- `id`
- `pp`
- `ingr`
- `aliases`
- `dish_type`
- `dish_subtype`
- `primary_proteins`
- `primary_carbs`
- `cooking_methods`
- `serving_vessel`
- `visual_tags`
- `texture_tags`
- `presentation_tags`
- `match_hints`
- `negative_hints`
- `confidence_priority`

Even though some names still say `dish` or `menu`, they currently represent salon services. Do not attempt a mass naming refactor in the same implementation pass unless the user explicitly asks for it.

### Existing receipt recognition flow

The current recognition endpoint:

- [api/stores/[slug]/recognize.js](../api/stores/[slug]/recognize.js)

This flow only handles:

- upload a customer receipt photo
- map receipt lines to an existing published service catalog
- return matched service IDs

It does not handle:

- uploading a new salon menu or price list
- generating a structured updated catalog
- computing diff versus the current published catalog
- saving a draft update job

### Existing review keyword logic

Review keywords are already a real business field, not just UI text.

They are normalized in:

- [lib/server/store-repo.js](../lib/server/store-repo.js)

They are actively used in review generation in:

- [lib/server/reviews.js](../lib/server/reviews.js)

This means the admin keyword editor must preserve the current structure:

- `key`
- `textZh`
- `textEn`
- `enabled`
- `weight`

The `key` field is especially important because known keys such as `clean`, `detailed`, `gentle`, `polished`, `relaxing`, `natural`, `glossy`, `precise`, `lasting`, and `welcoming` currently map into more natural phrase generation logic.

## V1 Scope

### In scope now

- app authentication foundation
- username plus email registration
- username or email login
- admin role support
- user role support in data model
- protected admin route(s)
- admin UI for store data editing
- admin editing APIs
- Shopify billing bridge data model
- Shopify checkout enrichment so the app can identify who initiated the payment
- Shopify webhook handling for order and renewal synchronization
- store entitlement model
- admin price list import and diff workflow

### Explicitly not in scope now

- customer-facing self-service store portal UI
- Shopify as the primary login system
- Shopify customer SSO into the app
- Shopify OIDC or Multipass integration
- a full user-facing dashboard for non-admins
- broad refactor of all `dish/menu/restaurant` naming across the codebase

## Recommended Architecture

### Identity and access layers

The system should be split into four layers:

1. Authentication layer
   - Supabase Auth
   - email plus password as canonical credential
   - username as an app-side alias that resolves to email during login

2. Authorization layer
   - global app role:
     - `admin`
     - `user`
   - store membership:
     - which user belongs to which store

3. Billing linkage layer
   - connects app users and stores to Shopify customer/order/subscription facts

4. Entitlement layer
   - app-side flags and limits derived from billing state
   - used by runtime permission checks

### Effective permission rules

The next AI should implement permission checks according to this logic:

1. If `global_role = admin`, allow unrestricted admin access.
2. If `global_role = user`, access should eventually require:
   - active store membership
   - active store entitlement for the requested feature
3. In v1, only admin UI is built, so non-admin users can be authenticated but should not be allowed into admin routes.

## Recommended Database Additions

The next AI should add the following SQL migrations after `004_seed_store_staff.sql`.

Suggested file order:

- `sql/005_auth_profiles_and_memberships.sql`
- `sql/006_billing_bridge.sql`
- `sql/007_menu_import_jobs.sql`
- `sql/008_admin_rls_policies.sql`

### 1. `user_profiles`

Purpose:

- app-owned profile data
- role assignment
- username uniqueness
- Shopify linkage

Recommended columns:

```sql
create extension if not exists citext;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  username citext not null unique,
  global_role text not null default 'user',
  status text not null default 'active',
  shopify_customer_gid text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_global_role_chk check (global_role in ('admin', 'user')),
  constraint user_profiles_status_chk check (status in ('active', 'disabled'))
);
```

Implementation notes:

- `email` is duplicated from `auth.users` intentionally for easier lookup and webhook matching.
- Username must be treated case-insensitively.
- `admin` should never be self-assigned during public registration.
- Public registration must always create `global_role = user`.
- Admin elevation must happen manually or through a secure internal flow.

### 2. `store_memberships`

Purpose:

- map app users to the stores they can access

Recommended columns:

```sql
create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  membership_role text not null default 'owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_memberships_role_chk check (membership_role in ('owner', 'member'))
);

create unique index if not exists store_memberships_store_user_uidx
on public.store_memberships (store_id, user_id);
```

Notes:

- Even though the current requirement only says `admin` and `user`, a store membership role is still worth adding now because entitlement checks belong at the store level.
- Do not confuse global role with store membership role.

### 3. `store_billing_accounts`

Purpose:

- stable bridge between a store and Shopify billing identity

Recommended columns:

```sql
create table if not exists public.store_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  shopify_customer_gid text,
  shopify_customer_email citext,
  billing_email citext,
  billing_status text not null default 'unlinked',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_billing_accounts_status_chk
    check (billing_status in ('unlinked', 'linked', 'past_due', 'cancelled'))
);
```

Notes:

- The subscription should be modeled as store-level, not user-level.
- Multiple users can later belong to the same paid store.

### 4. `billing_sessions`

Purpose:

- record which authenticated app user initiated a checkout
- create a stable internal reference that can be echoed into Shopify checkout attributes

Recommended columns:

```sql
create table if not exists public.billing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  plan_code text not null,
  checkout_provider text not null default 'shopify',
  status text not null default 'created',
  shopify_cart_id text,
  shopify_checkout_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_sessions_status_chk check (status in ('created', 'redirected', 'paid', 'failed', 'expired'))
);
```

### 5. `billing_subscriptions`

Purpose:

- app-side normalized billing state
- current plan and renewal period

Recommended columns:

```sql
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  billing_account_id uuid references public.store_billing_accounts(id) on delete set null,
  plan_code text not null,
  provider text not null default 'shopify',
  provider_subscription_gid text,
  source_order_gid text,
  source_order_name text,
  source_selling_plan_id text,
  source_variant_id text,
  status text not null,
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  last_paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_status_chk
    check (status in ('active', 'trialing', 'past_due', 'cancelled', 'expired'))
);

create index if not exists billing_subscriptions_store_status_idx
on public.billing_subscriptions (store_id, status, current_period_end desc);
```

Important v1 note:

- V1 does not need to depend on Shopify Subscription Contract APIs to function.
- V1 can derive active access primarily from successful paid orders and renewal orders that include the expected selling plan.

### 6. `store_entitlements`

Purpose:

- fast, app-owned, runtime permission table

Recommended columns:

```sql
create table if not exists public.store_entitlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  plan_code text not null,
  status text not null,
  can_access_store_dashboard boolean not null default false,
  can_edit_store_identity boolean not null default false,
  can_edit_keywords boolean not null default false,
  can_edit_staff boolean not null default false,
  can_import_menu boolean not null default false,
  max_users integer,
  max_locations integer,
  effective_from timestamptz,
  effective_until timestamptz,
  source_subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_entitlements_status_chk
    check (status in ('active', 'grace_period', 'expired', 'manual_override'))
);
```

### 7. `menu_import_jobs`

Purpose:

- record admin menu upload/import attempts
- support two-step extraction and diff review

Recommended columns:

```sql
create table if not exists public.menu_import_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  input_mode text not null,
  status text not null default 'draft',
  source_files jsonb not null default '[]'::jsonb,
  source_text text,
  extracted_menu_json jsonb,
  diff_json jsonb,
  approved_snapshot_json jsonb,
  published_snapshot_id uuid references public.store_menu_snapshots(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_import_jobs_input_mode_chk check (input_mode in ('image', 'text')),
  constraint menu_import_jobs_status_chk
    check (status in ('draft', 'uploaded', 'extracted', 'diffed', 'approved', 'published', 'failed'))
);
```

### 8. `audit_logs`

Purpose:

- trace admin changes to business data

Recommended columns:

```sql
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## Auth Flow Design

### Registration

Public registration should create a normal app user only.

Flow:

1. User enters:
   - username
   - email
   - password
2. Client validates locally.
3. Server checks whether username is already taken.
4. Server creates Supabase Auth account.
5. Server inserts `user_profiles`.
6. New users default to:
   - `global_role = user`
   - `status = active`

Important:

- Do not allow users to choose `admin`.
- Do not create store membership automatically unless the user is created as part of a store onboarding flow.

### Login

Supabase Auth signs in by email and password.

To support username-or-email login:

1. Accept one `identifier` field.
2. If the identifier contains `@`, treat it as email.
3. Otherwise look up `user_profiles.username` and resolve the corresponding email.
4. Call Supabase Auth sign-in using the resolved email and password.

This logic should live in one reusable auth helper or auth API endpoint.

### Session handling

Recommended for this repo:

- Use the browser Supabase client for auth session persistence.
- Use the Supabase anon key in the browser.
- Never expose the service role key.

Because this repo is plain HTML plus JS, the lowest-friction implementation is:

- load Supabase JS in the browser
- use the browser client for sign-up, sign-in, sign-out, session refresh
- send the access token to protected app APIs

The next AI may implement this in one of two ways:

1. Recommended v1 approach:
   - browser Supabase client
   - bearer token to app APIs

2. Alternative heavier approach:
   - server-issued cookies
   - custom session bridging

The first option fits this repo better and is preferred unless the user asks otherwise.

### Required environment and runtime config changes

The next AI should add support for:

- `SUPABASE_ANON_KEY`

Recommended delivery options:

1. Preferred:
   - expose a minimal `/api/runtime-config` endpoint that returns public-safe config
   - this avoids hardcoding the anon key in tracked files

2. Acceptable fallback:
   - expose the anon key in a tracked public config file
   - only if the user explicitly prefers the simpler route

Do not confuse:

- public anon key
- public Shopify storefront token
- private Shopify Admin API token
- private Supabase service role key

## Role and Permission Model

### Global roles

`admin`

- internal operator
- can see all stores
- can edit all stores
- bypasses store subscription gating

`user`

- customer-side app user
- must eventually be linked to one or more stores via `store_memberships`
- future access must be limited to owned stores and active entitlements

### Effective access in v1

For this first build:

- Admin route access requires `global_role = admin`
- If a non-admin logs in:
  - they can authenticate successfully
  - they must not be allowed into admin routes
  - the UI can show a simple placeholder such as `Client portal coming soon`

## Shopify Billing Bridge Design

### Key design rule

The app does not ask Shopify who is allowed into admin routes.

Instead:

- Shopify reports payment facts.
- The app translates those payment facts into:
  - `billing_subscriptions`
  - `store_entitlements`

Runtime permission checks then use app-owned tables.

### Identity bridge between app and Shopify

The system should connect the app user and Shopify checkout through three data points:

1. buyer email
2. app-generated `billing_session_id`
3. store context and plan code in cart attributes

### Current checkout code that must change

Current pricing checkout is created in the frontend in:

- [app.js](../app.js)

This currently creates a cart using public Storefront API config only.

V1 implementation should move checkout creation behind a backend endpoint:

- suggested endpoint:
  - `POST /api/billing/checkout`

Reason:

- the server must know the authenticated app user
- the server must create `billing_sessions`
- the server must add identifying attributes to Shopify cart creation
- the server must centralize plan mapping

### Data to attach to Shopify cart

When creating the Shopify cart, include:

- `buyerIdentity.email = appUser.email`
- cart attribute `billing_session_id`
- cart attribute `supabase_user_id`
- cart attribute `store_id`
- cart attribute `plan_code`

The next AI should verify the exact Storefront cart payload shape against the active Shopify API version, but these fields are supported conceptually by:

- `CartInput.attributes`
- `CartBuyerIdentity.email`

### Internal plan mapping

The app should define an internal plan registry, for example:

```js
{
  professional_setup: {
    type: "one_time",
    sourceVariantId: config.shopify.setupVariantId
  },
  rankmysalon_monthly: {
    type: "subscription",
    sourceVariantId: config.shopify.monthlyVariantId,
    sourceSellingPlanId: config.shopify.monthlySellingPlanId
  }
}
```

This registry must live on the server, not only in the browser.

### How the app knows what the customer subscribed to

V1 should infer the purchased product from Shopify order lines:

- line variant
- selling plan on the line item

The next AI should normalize these into:

- internal `plan_code`
- internal entitlement changes

### Required Shopify server-side credentials

The next AI should add server-only env vars for Shopify Admin API and webhooks:

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ADMIN_API_VERSION`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_WEBHOOK_SECRET`

These must not be exposed in tracked frontend config.

### Recommended webhook approach

The next AI should implement webhook handlers for payment state synchronization.

At minimum, the webhook layer should support:

- successful paid order ingestion
- recurring renewal ingestion
- cancellation or order reversal handling
- app uninstall cleanup if relevant

The exact webhook topic names should be verified against the active Shopify version at implementation time.

The first webhook that matters most for v1 is the one that confirms a paid order.

### Recommended billing synchronization strategy for v1

Do not block v1 on Shopify subscription contract APIs.

Instead:

1. Initial paid order creates or updates:
   - `store_billing_accounts`
   - `billing_subscriptions`
   - `store_entitlements`
2. Renewal paid orders extend:
   - `current_period_end`
   - `last_paid_at`
3. If a cancellation event is received:
   - mark `cancel_at_period_end = true`
   - keep access until `current_period_end`
4. If no renewal arrives by `current_period_end`:
   - expire entitlements with a scheduled job or on-read reconciliation

This is the simplest reliable v1 model.

### Entitlement computation

The next AI should implement a single function that converts billing state into app entitlements.

For example:

`rankmysalon_monthly`

- `can_access_store_dashboard = true`
- `can_edit_store_identity = true`
- `can_edit_keywords = true`
- `can_edit_staff = true`
- `can_import_menu = true`
- `max_users = 1`
- `max_locations = 1`

`professional_setup`

- this is primarily an onboarding fee, not a recurring feature plan
- it can be recorded for operations, but recurring app access should depend on the monthly plan

Important:

- The entitlement function must be centralized.
- Route checks and UI gating must not contain scattered hardcoded plan logic.

## Admin Route and UI Design

### Required routes

The router in [app.js](../app.js) should be extended to support at least:

- `/login`
- `/admin`
- `/admin/stores`
- `/admin/stores/:slug`

The next AI should also add matching rewrites in:

- [vercel.json](../vercel.json)

### Homepage login requirement

The product owner specifically asked for the current homepage to include the login system.

Recommended approach:

- add a `Sign in` button in the top navigation or hero chrome
- open a modal or route to `/login`
- include both:
  - sign in
  - register

### Admin information architecture

The admin console should start simple:

`/admin`

- summary dashboard
- list of stores

`/admin/stores`

- searchable store list
- open store editor

`/admin/stores/:slug`

- store identity section
- keyword editor
- staff editor
- menu import section
- publish history section if time permits

### Non-admin handling

If a normal `user` logs in during v1:

- they must not see admin controls
- they must not be able to call admin APIs
- a placeholder page is acceptable

## Admin API Design

The next AI should create new protected APIs under a clear namespace.

Suggested route layout:

- `GET /api/auth/session`
- `POST /api/auth/resolve-identifier`
- `POST /api/billing/checkout`
- `POST /api/shopify/webhooks/orders-paid`
- `POST /api/shopify/webhooks/orders-updated`
- `GET /api/admin/stores`
- `GET /api/admin/stores/:slug`
- `PATCH /api/admin/stores/:slug`
- `PUT /api/admin/stores/:slug/keywords`
- `PUT /api/admin/stores/:slug/staff`
- `POST /api/admin/stores/:slug/menu-imports`
- `POST /api/admin/stores/:slug/menu-imports/:jobId/extract`
- `POST /api/admin/stores/:slug/menu-imports/:jobId/diff`
- `POST /api/admin/stores/:slug/menu-imports/:jobId/publish`

### Shared auth utilities to add

Suggested new server helpers:

- `lib/server/auth.js`
  - verify bearer token
  - fetch current user profile
  - assert role
- `lib/server/admin-guard.js`
  - reusable admin-only middleware
- `lib/server/billing.js`
  - plan map
  - billing session creation
  - webhook order normalization
  - entitlement calculation
- `lib/server/menu-import.js`
  - extraction normalization
  - diff generation
  - publish logic

## Store Editing Requirements

### 1. Store identity

Editable now:

- salon name
- optionally both `name_zh` and `name_en`
- optionally review URLs if useful

Do not allow arbitrary slug changes in the first admin pass unless the next AI also handles:

- route stability
- existing links
- membership linkage
- billing linkage

Slug editing is optional and lower priority than the other fields.

### 2. Review keywords

Editable now:

- add keyword
- remove keyword
- edit display text
- enable or disable keyword
- adjust weight

Strong recommendation:

- expose known keyword keys as recommended presets
- allow custom keys only in an advanced flow

Reason:

- existing known keys map into better natural phrase generation
- random keys still work structurally but reduce the current phrase-realization quality

### 3. Staff list

Editable now:

- add staff member
- edit name
- edit display name
- reorder
- activate or deactivate

Staff order matters because current bootstrap response sorts staff by `sort_order` and `display_name`.

### 4. Menu or price list update

This is the most complex part and must be implemented as a controlled workflow.

## Menu Import Workflow

### Why a new workflow is required

The current receipt recognition logic is not the correct pipeline for salon menu or price list uploads.

Receipt recognition today:

- assumes a receipt image
- extracts purchased services from the existing catalog
- returns matched service IDs

Menu import needs:

- structured extraction of the full available service list
- comparison to current published menu snapshot
- controlled publish of a new version

### Supported input modes

#### Image upload plus AI extraction

Flow:

1. Admin uploads one or more menu images.
2. Original files are stored in Supabase Storage.
3. A `menu_import_job` row is created.
4. AI extracts a structured candidate catalog.
5. Extracted candidate catalog is saved to `extracted_menu_json`.
6. System computes diff versus the currently published snapshot.
7. Admin reviews and confirms.
8. System publishes a new `store_menu_snapshots` version.

#### Text input

Flow:

1. Admin pastes structured or semi-structured menu text.
2. The text is saved to `source_text`.
3. AI converts text into the same structured candidate catalog schema.
4. Remaining flow is the same as image mode.

### Suggested intermediate schema for extracted services

The extraction layer should normalize into a consistent internal structure before diffing:

```json
{
  "categories": [
    {
      "categoryName": "Manicure 美甲护理",
      "items": [
        {
          "temp_id": "tmp_001",
          "nameEn": "Regular Manicure",
          "nameZh": "Regular Manicure",
          "price": 18,
          "description": "includes hand sanitizing, nail trim and shaping...",
          "aliases": ["Classic manicure"],
          "serviceType": "manicure",
          "serviceSubtype": "manicure"
        }
      ]
    }
  ]
}
```

The extraction result does not assign final `uqid` values yet.

### Diff categories required in admin review

The diff view should classify items into:

- `unchanged`
- `modified`
- `new`
- `removed`
- `ambiguous`

Admin must explicitly resolve:

- ambiguous matches
- removed items
- major modifications

### UQID preservation rules

This is critical.

When generating the new snapshot:

- If the new item clearly corresponds to an existing service, preserve the existing `uqid`.
- Only assign a new `uqid` when the service is truly new.

Suggested matching precedence:

1. exact normalized English title match within the same category
2. exact normalized Chinese title match within the same category
3. alias match
4. strong title similarity plus same price or near price
5. strong title similarity plus same category plus overlapping description

If the system cannot decide confidently:

- classify as `ambiguous`
- require admin review

### New UQID assignment rule

For true new services:

- compute the current maximum `uqid` in the published snapshot
- assign new IDs incrementally from `max + 1`

Never renumber all services globally.

### Removed items

If a service is no longer on the menu:

- show it in the `removed` section
- do not silently delete it
- publish logic may omit it from the new snapshot only after admin confirmation

### Modified items

Examples of modification:

- name changed
- price changed
- aliases changed
- description changed
- category changed

If the item is still the same service concept, preserve `uqid`.

### Published snapshot generation

Publishing should:

1. read current published snapshot
2. build approved new snapshot JSON
3. compute next version number
4. insert new `store_menu_snapshots` row
5. mark it published
6. unpublish previous snapshot
7. mark `menu_import_job.status = published`
8. store the new snapshot ID on the import job

### Why this works with the existing app

The existing app already reads only the currently published snapshot:

- bootstrap endpoint
- recognition endpoint
- review generation endpoint

So once a new snapshot is published, the current app behavior will naturally switch to the latest menu version without extra changes to those business flows.

## Storage Requirements

The next AI should create a Supabase Storage bucket for admin uploads.

Suggested bucket:

- `menu-imports`

Suggested object path convention:

- `store-slug/yyyy-mm-dd/job-id/original-filename.ext`

Do not store only base64 blobs in database rows for this workflow.

## Security Model

### API protection

All admin write routes must require:

- valid auth token
- active user profile
- `global_role = admin`

### Database protection

The next AI should add RLS policies, but v1 should not rely on direct browser writes to admin tables.

Recommended v1 pattern:

- browser authenticates as normal user session
- browser calls protected app APIs
- app APIs verify auth and role
- app APIs perform DB writes server-side

This is faster to implement safely in the current repo than converting every mutation to user-scoped DB access immediately.

### Admin bypass and entitlements

Admin users should bypass subscription entitlement checks.

Customer users should not bypass subscription entitlement checks in future phases.

### Audit logging

All admin mutations should write audit log entries.

At minimum log:

- actor user
- target entity
- action
- before state
- after state

## Required Frontend Refactor Plan

### Minimal routing changes

Extend the current route parser in [app.js](../app.js) rather than replacing the whole SPA architecture.

Add route kinds for:

- login
- admin dashboard
- admin store editor

### Suggested UI components

The next AI should add:

- homepage `Sign in` button
- auth modal or dedicated login route
- admin shell layout
- admin store list
- admin tabs or panels:
  - store info
  - keywords
  - staff
  - menu import

### Separation between public marketing and admin UI

Do not try to mix admin editor controls into the public marketing homepage.

Recommended behavior:

- homepage contains login entrypoint only
- actual admin editing happens under `/admin`

## Suggested File-Level Work Plan

The next AI should expect to touch at least these files or add nearby new ones:

### Existing files likely to change

- [index.html](../index.html)
- [app.js](../app.js)
- [styles.css](../styles.css)
- [config.js](../config.js)
- [vercel.json](../vercel.json)
- [README.md](../README.md)

### Existing server helpers likely to change

- [lib/server/env.js](../lib/server/env.js)
- [lib/server/http.js](../lib/server/http.js)
- [lib/server/store-repo.js](../lib/server/store-repo.js)

### New server files likely to add

- `lib/server/auth.js`
- `lib/server/admin-guard.js`
- `lib/server/billing.js`
- `lib/server/shopify-admin.js`
- `lib/server/menu-import.js`

### New API routes likely to add

- `api/runtime-config.js`
- `api/billing/checkout.js`
- `api/auth/session.js`
- `api/admin/stores/index.js`
- `api/admin/stores/[slug].js`
- `api/admin/stores/[slug]/keywords.js`
- `api/admin/stores/[slug]/staff.js`
- `api/admin/stores/[slug]/menu-imports/index.js`
- `api/admin/stores/[slug]/menu-imports/[jobId]/extract.js`
- `api/admin/stores/[slug]/menu-imports/[jobId]/diff.js`
- `api/admin/stores/[slug]/menu-imports/[jobId]/publish.js`
- `api/shopify/webhooks/orders-paid.js`
- possibly additional Shopify webhook routes depending on the implementation choice

### New SQL files likely to add

- `sql/005_auth_profiles_and_memberships.sql`
- `sql/006_billing_bridge.sql`
- `sql/007_menu_import_jobs.sql`
- `sql/008_admin_rls_policies.sql`

## Recommended Implementation Order

The next AI should not try to do everything at once. Use the phases below.

### Phase 1: Auth foundation ✅ COMPLETE

Goal:

- users can register and log in
- admin role exists
- admin route can be protected

Tasks:

1. [x] Add new schema files for:
   - `user_profiles` → `sql/005_auth_profiles_and_memberships.sql`
   - `store_memberships` → same file (table exists but unused in app code)
2. [x] Add public runtime config support for:
   - `SUPABASE_URL` → `api/runtime-config.js`
   - `SUPABASE_ANON_KEY` → same endpoint
3. [x] Add browser auth client support. → `portal.js` uses Supabase browser client
4. [x] Add register and login UI. → `portal.js` login/register forms
5. [x] Add username resolution logic. → `lib/server/auth.js` → `resolveIdentifierToEmail()`
6. [x] Add logout flow. → `portal.js` → `signOutLocal()`
7. [x] Add protected `/admin` route skeleton. → `app.js` + `portal.js` route handling
8. [x] Add server auth verification helpers. → `lib/server/auth.js` → `verifyAccessToken()`
9. [x] Add admin guard middleware. → `lib/server/admin-guard.js` → `requireAdmin()`

Exit criteria:

- [x] admin can register only if later promoted or seeded
- [x] seeded admin can log in
- [x] `/admin` rejects unauthenticated visitors
- [x] `/admin` rejects authenticated non-admin users

Note: `registerUser()` now defaults to `global_role = 'admin'` per 2026-04-14 change.

### Phase 2: Admin store editing ✅ COMPLETE

Goal:

- admin can edit core store business data

Tasks:

1. [x] Add admin store list API. → `api/admin/stores/index.js` (GET only, no POST create)
2. [x] Add single-store admin API. → `api/admin/stores/[slug].js` (GET + PATCH)
3. [x] Add store identity editor. → `portal.js` admin store editor UI
4. [x] Add review keyword editor. → `api/admin/stores/[slug]/keywords.js` (PUT) + portal UI
5. [x] Add staff editor. → `api/admin/stores/[slug]/staff.js` (PUT) + portal UI
6. [x] Add audit logs for these mutations. → `sql/006_admin_audit_logs.sql` + writes in all PATCH/PUT handlers

Exit criteria:

- [x] admin can change store names
- [x] admin can change review keywords
- [x] admin can change staff list
- [x] changes persist in Supabase
- [ ] review generation still works after keyword updates (not yet verified end-to-end)
- [ ] bootstrap returns updated staff after staff edits (not yet verified end-to-end)

Note: No store creation (POST) API exists yet. Admin can only edit existing stores, not create new ones.

### Phase 3: Menu import and publish flow ❌ NOT STARTED

Goal:

- admin can upload or paste a menu
- system can extract, diff, review, and publish a new snapshot

Tasks:

1. [ ] Create storage bucket and upload workflow.
2. [ ] Add `menu_import_jobs` table (SQL migration needed).
3. [ ] Add image extraction pipeline.
4. [ ] Add text input extraction pipeline.
5. [ ] Add diff algorithm with UQID preservation.
6. [ ] Add admin diff review UI.
7. [ ] Add publish flow that creates new `store_menu_snapshots`.
8. [ ] Add audit logging.

Exit criteria:

- [ ] admin can upload image and get draft extraction
- [ ] admin can paste text and get draft extraction
- [ ] admin can review new, changed, removed, ambiguous items
- [ ] publishing creates a new versioned snapshot
- [ ] current bootstrap and review flows use the new published snapshot

### Phase 4: Shopify billing bridge ❌ NOT STARTED

Goal:

- app can know which store is paid and what plan is active

Tasks:

1. [ ] Add billing tables (SQL migration needed):
   - `store_billing_accounts`
   - `billing_sessions`
   - `billing_subscriptions`
   - `store_entitlements`
2. [ ] Add Shopify Admin API env support (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`).
3. [ ] Move checkout creation to backend (`POST /api/billing/checkout`).
4. [ ] Create billing session before checkout.
5. [ ] Add cart attributes and buyer email to checkout.
6. [ ] Add webhook handler(s) (`/api/shopify/webhooks/orders-paid`, etc.).
7. [ ] Normalize paid orders into internal subscription rows.
8. [ ] Compute and persist entitlements.

Exit criteria:

- [ ] backend can create checkout for authenticated app users
- [ ] webhook can map payment back to app user and store
- [ ] app can show internal billing and entitlement state without live Shopify lookup

Note: Shopify Storefront config (public token, variant IDs, selling plan ID) is already in `config.js`. Frontend cart creation via Storefront API works. But no server-side billing session or identity bridge exists.

### Phase 5: Entitlement-aware future user foundation ❌ NOT STARTED

Goal:

- foundation is ready for future customer portal

Tasks:

1. [ ] Add store entitlement check helpers.
2. [ ] Add placeholder user portal page. (partial: login shows "Client portal coming soon" for non-admins)
3. [ ] Add store membership-aware store scoping utilities. (`store_memberships` table exists but is unused)
4. [ ] Ensure future user portal can rely on the same data model.

Exit criteria:

- [ ] data model is ready for user rollout without redesign

## Suggested Testing Plan

### Auth tests

Manual checks:

1. Register with new username and email.
2. Log in with email.
3. Log in with username.
4. Attempt duplicate username registration.
5. Attempt duplicate email registration.
6. Verify non-admin is denied `/admin`.
7. Verify admin is allowed `/admin`.

### Store editing tests

1. Edit store name and reload.
2. Edit keywords and verify DB shape remains valid.
3. Edit staff ordering and verify bootstrap ordering changes.
4. Disable a staff member and verify they disappear from bootstrap.

### Menu import tests

1. Import by image.
2. Import by text.
3. Verify unchanged services preserve `uqid`.
4. Verify new services receive new `uqid`.
5. Verify changed services preserve `uqid`.
6. Publish and verify new snapshot is used by:
   - bootstrap
   - recognition
   - reviews

### Billing bridge tests

1. Authenticated user starts checkout.
2. Billing session row created.
3. Shopify cart contains identifying attributes.
4. Simulated or real paid order webhook updates internal billing rows.
5. Store entitlement row becomes active.
6. Renewal event extends period end.

## Acceptance Criteria

The next AI should consider the work complete only when all of the following are true:

1. [x] The homepage contains a working login entrypoint. → `Sign in` nav button → `/login`
2. [x] Registration accepts username, email, and password. → `portal.js` + `api/auth/[action].js`
3. [x] Login accepts username or email plus password. → username resolution + Supabase signIn
4. [x] Admin route exists and is protected. → `/admin` guarded by `requireAdmin()`
5. Admin can edit:
   - [x] salon name → PATCH `/api/admin/stores/:slug`
   - [x] keywords → PUT `/api/admin/stores/:slug/keywords`
   - [x] staff list → PUT `/api/admin/stores/:slug/staff`
6. [ ] Admin can import menu updates from image or text. → **Phase 3, not started**
7. [ ] Menu update requires extraction review before publish. → **Phase 3, not started**
8. [ ] Published menu updates create a new snapshot version. → **Phase 3, not started**
9. [ ] Existing `uqid` values are preserved where services still match. → **Phase 3, not started**
10. [ ] Shopify checkout can be associated back to an authenticated app user and store. → **Phase 4, not started**
11. [ ] Internal billing and entitlement tables exist and are updated from Shopify events. → **Phase 4, not started**
12. [ ] Admin users bypass billing entitlements. → **Phase 4/5, not started**
13. [ ] The repo documentation is updated after implementation. → partial (README updated, this doc now audited)

## Important Implementation Warnings

### Do not put private secrets into tracked frontend files

Allowed in frontend:

- Shopify Storefront public token
- Supabase anon key if the user approves that simple approach

Never expose in frontend:

- `SUPABASE_SERVICE_ROLE_KEY`
- Shopify Admin API token
- Shopify webhook secret
- OpenAI API key

### Do not overwrite menu snapshots blindly

The whole point of the new flow is:

- review before publish
- preserve identifiers
- keep historical versions

### Do not self-assign admin on public registration

Admin must remain internal-only.

### Do not gate admin by customer billing

Admin is operator access, not customer access.

### Do not block v1 on Shopify SSO

OIDC, Multipass, and customer-account SSO are future options, not required for this approved version.

## Open Questions For The User If Blocked During Implementation

Only ask these if the next AI cannot discover or infer the answer safely:

1. Should public registration be visible now, or should it be hidden until the user portal exists?
2. Should non-admin authenticated users see a placeholder portal page or be told access is not yet enabled?
3. Is a store subscription always one store per paying customer in v1?
4. Is one uploaded image enough for menu import v1, or should multi-image upload be supported immediately?
5. Should admin be allowed to edit the store slug in v1?

## Recommended Immediate Next Move For The Next AI

The next AI should start with Phase 1 and Phase 2 only:

1. add schema for profiles and memberships
2. add browser auth and protected admin shell
3. add admin store edit APIs and UI

After those are working, proceed to:

4. menu import flow
5. Shopify billing bridge

This order gives the user something visible quickly while keeping the long-term architecture aligned with the approved plan.

## References

Official references relevant to the approved approach:

- Shopify customer authentication overview:
  - https://shopify.dev/docs/api/customer-authentication
- Shopify webhooks overview:
  - https://shopify.dev/docs/api/webhooks/2025-07
- Shopify Storefront `cartCreate`:
  - https://shopify.dev/docs/api/storefront/latest/mutations/cartCreate
- Shopify Storefront `CartInput`:
  - https://shopify.dev/docs/api/storefront/latest/input-objects/cartinput
- Shopify Storefront `CartBuyerIdentity.email`:
  - https://shopify.dev/docs/api/storefront/latest/objects/CartBuyerIdentity
- Shopify Admin `LineItem` and `sellingPlan`:
  - https://shopify.dev/docs/api/admin-graphql/latest/objects/LineItem
- Shopify selling plan category:
  - https://shopify.dev/docs/api/admin-graphql/latest/enums/sellingplancategory
- Shopify subscription contract status enum:
  - https://shopify.dev/docs/api/admin-graphql/latest/enums/SubscriptionContractSubscriptionStatus
- Supabase third-party auth overview:
  - https://supabase.com/docs/guides/auth/third-party/overview

