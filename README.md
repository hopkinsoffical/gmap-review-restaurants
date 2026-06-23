# RankMyRestaurant Review Studio - AI Agent Handoff

This README is for AI agents, not end users.

## AI Agent Rules

These are iron laws. Follow them every time you touch this repo.

1. This README is written for AI agents only. Every sentence should optimize for agent handoff, execution speed, exact file discovery, debugging context, and operational clarity.
2. The newest update must always be at the top. Older updates stay below it in reverse chronological order.
3. Every new top update must include a `NEXT AI TODO` section if anything is still pending, blocked, awaiting approval, or not yet re-verified.
4. When the next AI finishes the current top update's `NEXT AI TODO`, delete that old TODO block instead of preserving stale TODOs. Then add a newer update above it if more work was done.
5. If you change behavior, deployment, data model, local dev flow, testing assets, or known issues, update this README in the same change set before handoff.
6. Prefer exact paths, exact commands, exact error messages, and exact root causes. Do not write vague summaries if a future agent would need to rediscover the same facts.
7. Preserve historical updates below the newest entry. Do not reorder older entries except to keep newest-first ordering.

## Update - 2026-06-23 - Restaurant Store Review Booster Prompts

Status:

- `/stores/{slug}` AI review booster prompts and validation were rewritten for restaurant Google Maps reviews:
  - [app.js](app.js)
    - changed review focus rules from salon/service-result wording to restaurant food/drink, staff/service, and atmosphere wording
    - replaced salon-oriented dish profile anchors with restaurant menu anchors for noodles, rice, buns, dumplings, seafood, soup, tofu, fried/braised dishes, drinks, and desserts
    - updated receipt/menu mismatch text, Google review generation hard rules, service-praise injection, and review validation regexes to use diner/server/host/dining-room vocabulary
    - kept internal `service` focus key and `salon_*` backend field names unchanged where they are part of existing contracts

Verification planned:

- `node --check app.js`

## Update - 2026-06-23 - Restaurant Marketing UI Refactor

Status:

- Homepage and marketing surfaces were refactored from salon-facing copy/visuals to restaurant-facing UX:
  - [app.js](app.js)
    - updated the overview hero, brief-report form, trust points, Ryan/AI advisor section, services page copy, leaderboard/report copy, store review studio prompts, and user-facing error messages for restaurants/diners
    - kept existing internal `salon` route/API/table identifiers intact where changing them would break current backend contracts
  - [styles.css](styles.css), [theme.css](theme.css), [marketing-surfaces.css](marketing-surfaces.css)
    - moved the visual system from navy/purple salon styling to warm restaurant colors: cream backgrounds, espresso dark surfaces, tomato CTA accents, and saffron highlights
    - added `brand-part-myrestaurant` support to brand gradient selectors that previously only targeted `brand-part-mysalon`
  - [index.html](index.html), [package.json](package.json)
    - updated remaining static salon-facing description text to restaurant-facing wording

Verification completed:

- `node --check app.js`

## Update - 2026-04-23 - Homepage Hero CTA Aligned To Benefit List Left Edge

Status:

- Homepage hero CTA button now aligns to the far-left edge of the benefit list:
  - [styles.css](styles.css)
    - removed the `padding-left: 22px` offset from `.marketing-actions-hero`
    - preserved the controlled CTA width and centered text from the previous update
    - left all visible text and the right-side Google Maps audit/report card unchanged

Verification completed:

- Static syntax check passed:
  - `node --check app.js`

## Update - 2026-04-23 - Homepage Hero CTA Text Centered

Status:

- Homepage hero CTA now keeps the button left-aligned while centering the text inside the button:
  - [styles.css](styles.css)
    - changed `.marketing-hero-primary-cta` to explicit `inline-flex`
    - set controlled CTA width to `min(100%, 320px)`
    - added `align-items: center`, `justify-content: center`, and `text-align: center`
    - added mobile override so the global `.cta { width: 100%; }` rule does not stretch this hero CTA
    - left all visible text and the right-side Google Maps audit/report card unchanged

Verification completed:

- Static syntax check passed:
  - `node --check app.js`

## Update - 2026-04-23 - Homepage Hero CTA Width Reduced

Status:

- Homepage hero CTA button adjusted to better align with the benefit list:
  - [styles.css](styles.css)
    - reduced `.marketing-hero-primary-cta` from a wide `320px` minimum to `270px`
    - reduced CTA padding from `18px 28px` to `16px 26px`
    - added `padding-left: 22px` to `.marketing-actions-hero` so the button starts at the benefit text column instead of the checkmark column
    - kept all visible text and the right-side Google Maps audit/report card unchanged

Verification completed:

- Static syntax check passed:
  - `node --check app.js`

Known verification note:

- A local `python3 -m http.server 3000` visual-check attempt did not respond to `curl` and the listening process could not be killed from this sandbox (`kill: 44577: Operation not permitted`). No code changes depend on that local server.

## Update - 2026-04-23 - Homepage Hero CTA And Benefits Left-Aligned

Status:

- Homepage hero CTA and benefit list now align to the same left edge as the left-column content:
  - [styles.css](styles.css)
    - changed `.marketing-actions-hero` from centered to `flex-start`
    - changed `.marketing-hero-support` from centered auto margins to left-aligned margins
    - gave `.marketing-hero-primary-cta` a stable desktop width while keeping it responsive
    - left all visible text and the right-side Google Maps audit/report card unchanged

Verification completed:

- Static syntax check passed:
  - `node --check app.js`

## Update - 2026-04-23 - Homepage Hero Title Overflow Fixed

Status:

- Homepage hero title no longer overflows into the right-side report card:
  - [app.js](app.js)
    - changed the large title split to `50% to 70% People` / `Find You Through` / `Google Maps.`
    - preserved the requested visible text order and wording
  - [styles.css](styles.css)
    - removed the desktop `white-space: nowrap` rule from `.marketing-title-report > span`
    - restored the title max width to the safer `34rem`
    - left the right-side Google Maps audit/report card unchanged

Verification completed:

- Static syntax check passed:
  - `node --check app.js`

## Update - 2026-04-23 - Homepage Hero Title And CTA Spacing Tightened

Status:

- Homepage hero left-column layout tightened without changing visible copy:
  - [app.js](app.js)
    - changed the large title split to `50% to 70% People` / `Find You Through Google Maps.` to remove the short orphan `Find You` line
  - [styles.css](styles.css)
    - widened the title line box and prevented desktop wrapping inside each explicit title line
    - reduced the CTA/benefit group top margin so it reads as part of the same hero message
    - kept mobile wrapping safe by restoring normal wrapping under `640px`
    - left the right-side Google Maps audit/report card unchanged

Verification completed:

- Static syntax check passed:
  - `node --check app.js`

## Update - 2026-04-23 - Homepage Hero Left Layout Refined

Status:

- Homepage hero left-column layout refined without changing the requested visible text:
  - [app.js](app.js)
    - split the large title into `50% to 70% People` / `Find You` / `Through Google Maps.` so `You` no longer renders as an orphan line
    - wrapped the CTA and benefit list in `marketing-hero-support`
  - [styles.css](styles.css)
    - centered the CTA/benefit group within the left column
    - moved the CTA/benefit group lower with responsive spacing
    - left the right-side Google Maps audit/report card unchanged

Verification completed:

- Static syntax check passed:
  - `node --check app.js`

## Update - 2026-04-23 - Homepage Hero Copy Hierarchy Fixed

Status:

- Homepage hero left-column copy hierarchy now matches the requested annotated design:
  - [app.js](app.js)
    - removed the small `heroProof` line from the rendered hero
    - moved `50% to 70% People Find You` / `Through Google Maps.` into the large hero title
    - replaced the old `But how many are finding YOU?...` paragraph with `You Might Be Losing Clients on Google Right Now`
    - left the right-side Google Maps audit/report card unchanged

Verification completed:

- Static syntax check passed:
  - `node --check app.js`
- Source verification passed:
  - `rg -n "heroProof|But how many are finding YOU|50% to 70% People Find You|You Might Be Losing Clients on Google Right Now" app.js`

## Update - 2026-04-17 - Homepage Hero Arrow Removed Before GitHub Sync

Status:

- Homepage marketing hero no longer renders the red pointer next to the primary CTA:
  - [app.js](app.js)
    - removed the `marketing-report-pointer` element from the hero actions row
  - [styles.css](styles.css)
    - removed the corresponding pointer styles and responsive hide rule
- GitHub target confirmed before publishing:
  - owner: `hopkinsoffical`
  - repo: `gmap-reivew-salon`
  - branch: `main`

Verification completed:

- Static syntax check passed:
  - `node --check app.js`
- GitHub repo metadata check passed:
  - `gh repo view --json owner,name,nameWithOwner,defaultBranchRef`
- Local dev server response check passed:
  - `curl -s -I http://127.0.0.1:3000/`
  - returned `HTTP/1.1 200 OK`

## Update - 2026-04-17 - Hero Arrow Simplified And Ryan Section Rewritten

Status:

- Homepage hero pointer is no longer the bent arrow:
  - [styles.css](styles.css)
    - `.marketing-report-pointer` now renders as a clean horizontal single-line right-arrow
    - mobile hide behavior remains unchanged
- Homepage Ryan section now follows the latest annotated copy:
  - [app.js](app.js)
    - removed the `DIGITAL HUMAN` kicker from the overview section only
    - changed section title to `Meet Ryan, Your Growth Advisor`
    - changed supporting headline to `You Might Be Losing Clients on Google Right Now`
    - changed body copy to explain Ryan will show what is missing and how to fix it
    - added a secondary phone CTA: `Or Call/Text 877-600-3082`
- Ryan section styling updated for the revised CTA block:
  - [styles.css](styles.css)
    - added compact section-head spacing
    - added `marketing-digital-actions`
    - added `marketing-digital-alt-link`

Verification completed:

- Static syntax check passed:
  - `node --check app.js`
- Local served script verification passed:
  - `curl -s http://127.0.0.1:3000/app.js | rg -n "Meet Ryan, Your Growth Advisor|You Might Be Losing Clients on Google Right Now|Or Call/Text 877-600-3082"`
- Local served stylesheet verification passed:
  - `curl -s http://127.0.0.1:3000/styles.css | rg -n "marketing-report-pointer|marketing-digital-alt-link|marketing-section-head-compact"`

NEXT AI TODO - delete this block when finished:

- Visually verify in a browser that:
  - the new arrow reads as a straight right-pointing pointer into the report card
  - the Ryan section CTA stack looks intentional on desktop
  - the phone CTA still reads cleanly on mobile
  - there is no leftover `DIGITAL HUMAN` label on the homepage section

## Update - 2026-04-16 - Marketing Hero Reframed Around Google Maps Rank Report

Status:

- Homepage marketing hero now tells a clearer Google Maps ranking story instead of the old generic SaaS story:
  - [app.js](app.js)
    - replaced the hero headline with a two-step Google Maps urgency message
    - CTA copy now reads `Get your Rank`
    - removed the old `2-minute demo` CTA helper
    - trust list now matches the higher-intent benefits requested in the design note
- Homepage hero media is no longer the previous Localo GIF mock:
  - [app.js](app.js)
    - right-side hero visual now renders an in-code sample Google Maps audit/report card
    - includes sample position, rating benchmark, review count benchmark, and nearby competitors
- Homepage hero styling updated to support the new report presentation:
  - [styles.css](styles.css)
    - adjusted left/right hero balance
    - added the red directional pointer beside the CTA
    - added responsive report-card styling for desktop and mobile

Verification completed:

- Static syntax check passed:
  - `node --check app.js`
- Local dev server started successfully with:
  - `npm run dev:vercel`
- Local HTTP verification passed:
  - `curl -s -I http://127.0.0.1:3000/`
  - returned `HTTP/1.1 200 OK`
- Local served script verification passed:
  - `curl -s http://127.0.0.1:3000/app.js | rg -n "Get your Rank|You Might Be Losing Clients|Sample Google Maps Audit"`
  - confirmed the updated marketing hero copy is in the served bundle

NEXT AI TODO - delete this block when finished:

- Visually verify the updated homepage at `/` in a browser and confirm:
  - CTA alignment
  - red pointer direction
  - report-card spacing on desktop
  - mobile stacking under `980px`

## Update - 2026-04-15 - Admin Store Creation Added To `/admin/stores`

Status:

- Admin can now create a new store from the existing store-list screen:
  - [portal.js](portal.js)
    - `/admin/stores` now shows an `Add store` button
    - clicking it opens an inline create form
    - successful creation redirects straight into `/admin/stores/:slug`
- Store creation is now supported by the existing list API route:
  - [api/admin/stores/index.js](api/admin/stores/index.js)
    - route now supports `GET` and `POST`
    - `POST` remains admin-only and writes an audit log entry
- Store repo now supports admin-side creation and active-state updates:
  - [lib/server/store-repo.js](lib/server/store-repo.js)
    - added slug normalization and validation
    - added duplicate-slug guard returning `STORE_SLUG_TAKEN`
    - added `createStoreForAdmin(...)`
    - `updateStoreIdentity(...)` now accepts `isActive`
- Existing store editor now exposes active/inactive state:
  - [portal.js](portal.js)
    - store identity form now includes `Store is active`
    - UI note explains that public store routes still need a published menu snapshot

Behavior details:

- New store creation fields:
  - `slug`
  - `nameZh`
  - `nameEn`
  - `googleReviewUrl`
  - `googleReviewFallbackUrl`
  - `isActive`
- Slug behavior:
  - incoming slug is normalized to lowercase
  - non-alphanumeric separators collapse to `-`
  - slug editing is still not exposed after creation
- Safety default:
  - new stores default to `inactive` unless explicitly checked active in the create form
  - this avoids exposing half-configured stores because the public bootstrap route still requires a published menu snapshot

Verification completed:

- Static syntax checks passed:
  - `node --check portal.js`
  - `node --check lib/server/store-repo.js`
  - `node --check api/admin/stores/index.js`
  - `node --check api/admin/stores/[slug].js`
  - `node --check api/admin/stores/[slug]/keywords.js`
  - `node --check api/admin/stores/[slug]/staff.js`
- Local dev server started successfully with:
  - `npm run dev:vercel`
- Local HTTP verification passed:
  - `curl -s -I http://127.0.0.1:3000/admin/stores`
  - returned `HTTP/1.1 200 OK`

NEXT AI TODO - delete this block when finished:

- Manually log into the local admin UI in a browser and verify:
  - `/login`
  - `/admin/stores`
  - open create-store form
  - create a real test store
  - confirm redirect into `/admin/stores/:slug`
- Do not activate a newly created store in production until its published menu snapshot exists, otherwise:
  - [api/stores/[slug]/bootstrap.js](api/stores/[slug]/bootstrap.js)
  - will still return `MENU_SNAPSHOT_NOT_FOUND`

## Update - 2026-04-14 - New Registrations Now Default To Admin

Status:

- Registration behavior changed in:
  - [lib/server/auth.js](lib/server/auth.js)
    - `registerUser(...)` now inserts `public.user_profiles.global_role = 'admin'`
- Login/admin portal copy updated in:
  - [portal.js](portal.js)
    - `/login` now states that new registrations are created as admin accounts
    - legacy non-admin accounts now see a more accurate role-mismatch message instead of the old client-portal placeholder
- Runtime access model is still enforced by:
  - [lib/server/admin-guard.js](lib/server/admin-guard.js)
    - admin routes still require `global_role = 'admin'`
    - this turn did not relax route authorization for legacy non-admin rows
- Intent of this change:
  - any newly created account through `/login` should immediately have admin access without a separate manual promotion step
- Existing profile update completed via Supabase service-role query:
  - `info@hopkinsmedtech.com`
  - username: `admin`
  - `global_role` is now `admin`
  - status: `active`

Verification completed:

- Static syntax checks passed after the role-default change:
  - `node --check lib/server/auth.js`
  - `node --check portal.js`
- Supabase profile verification/update result:
  - `info@hopkinsmedtech.com` exists in `public.user_profiles`
  - resulting row:
    - `username = 'admin'`
    - `global_role = 'admin'`
    - `status = 'active'`

NEXT AI TODO - delete this block when finished:

- Verify the live login flow for `info@hopkinsmedtech.com` on:
  - `/login`
  - `/admin`
- Confirm the latest commit is deployed on the real Vercel project:
  - `rankmysalon-site`

## Update - 2026-04-14 - Phase 1/2 Admin Auth And Store Editor Implemented

Status:

- Phase 1 and Phase 2 from the approved implementation plan are now implemented in code:
  - auth foundation
  - protected admin routes
  - admin store identity editor
  - admin review-keyword editor
  - admin staff editor
  - audit log writes for admin mutations
- New SQL migrations added:
  - [sql/005_auth_profiles_and_memberships.sql](sql/005_auth_profiles_and_memberships.sql)
  - [sql/006_admin_audit_logs.sql](sql/006_admin_audit_logs.sql)
- New server auth/admin files added:
  - [lib/server/auth.js](lib/server/auth.js)
  - [lib/server/admin-guard.js](lib/server/admin-guard.js)
  - [api/runtime-config.js](api/runtime-config.js)
  - [api/auth/[action].js](api/auth/[action].js)
  - [api/admin/stores/index.js](api/admin/stores/index.js)
  - [api/admin/stores/[slug].js](api/admin/stores/[slug].js)
  - [api/admin/stores/[slug]/keywords.js](api/admin/stores/[slug]/keywords.js)
  - [api/admin/stores/[slug]/staff.js](api/admin/stores/[slug]/staff.js)
- Existing frontend shell now routes these SPA entrypoints to `index.html`:
  - `/login`
  - `/admin`
  - `/admin/stores`
  - `/admin/stores/:slug`
- New browser-side portal script added:
  - [portal.js](portal.js)
- Existing frontend shell changes:
  - [index.html](index.html)
    - added `#portalContent`
    - added Supabase browser client CDN script
    - now loads `portal.js`
  - [app.js](app.js)
    - now recognizes login/admin routes
    - homepage marketing nav now exposes `Sign in`
    - existing store-review flow remains separate
  - [styles.css](styles.css)
    - added auth/admin portal styling
- Environment example updated:
  - [.env.example](.env.example)
    - added `SUPABASE_ANON_KEY`

Important runtime notes:

- The new browser auth flow depends on `SUPABASE_ANON_KEY`.
- Current local `.env.local` now contains:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Supabase verification already confirmed these tables now exist in the active project:
  - `user_profiles`
  - `store_memberships`
  - `audit_logs`
- Current DB state:
  - `public.user_profiles` is still empty
  - there is no admin account yet
- Admin access still requires manually promoting a user profile to:
  - `global_role = 'admin'`
  - public registration never self-assigns admin.
- Important deployment mismatch:
  - the actual online project the user is managing is `rankmysalon-site`
  - local `.vercel/project.json` still points to `gmap-reivew-salon`
  - because `.vercel` is gitignored, that relink is a local machine concern and was not changed in this commit
  - before relying on Vercel CLI deploys or env inspection from this repo, relink local Vercel project config to the real target project
- Important Vercel Hobby-plan constraint discovered after first push:
  - Vercel rejected the first deployment of commit `e408c01`
  - exact platform error:
    - `No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan`
  - root cause:
    - repo had `14` files under `api/`
  - fix applied:
    - merged `api/auth/register.js`, `api/auth/resolve-identifier.js`, and `api/auth/session.js`
    - into single dynamic route:
      - [api/auth/[action].js](api/auth/[action].js)
  - resulting function count:
    - `12`

Verification completed:

- Static syntax checks passed:
  - `node --check app.js`
  - `node --check portal.js`
  - `node --check lib/server/auth.js`
  - `node --check lib/server/admin-guard.js`
  - `node --check lib/server/store-repo.js`
  - `node --check api/runtime-config.js`
  - `node --check api/auth/[action].js`
  - `node --check api/admin/stores/index.js`
  - `node --check api/admin/stores/[slug].js`
  - `node --check api/admin/stores/[slug]/keywords.js`
  - `node --check api/admin/stores/[slug]/staff.js`
  - `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json ok')"`
  - `find api -type f | wc -l`
    - returns `12`
- Supabase service-role verification confirmed:
  - `user_profiles`, `store_memberships`, `audit_logs` all exist
  - `user_profiles` currently has zero rows
- Local `vercel dev` starts successfully on:
  - `http://localhost:3000`
- Full login/admin flow verification is still pending because there is no registered admin user yet.

NEXT AI TODO - delete this block when finished:

- Register the first real app user through `/login`, or create one via Supabase Auth admin tooling
- Promote that user in `public.user_profiles`:
  - `global_role = 'admin'`
- Re-run end-to-end browser verification for:
  - `/login`
  - `/admin`
  - `/admin/stores`
  - `/admin/stores/angel-tips-garwood`
- Relink local Vercel project config if CLI operations should target the true online project:
  - `rankmysalon-site`
- Continue with Phase 3 and Phase 4 from:
  - [docs/admin-auth-shopify-billing-implementation-plan.md](docs/admin-auth-shopify-billing-implementation-plan.md)

## Update - 2026-04-14 - Admin Auth, Shopify Billing Bridge, and Menu Import Plan Documented

Status:

- No runtime behavior changed in this turn.
- Added a detailed implementation handoff document for the approved account-system direction:
  - [docs/admin-auth-shopify-billing-implementation-plan.md](docs/admin-auth-shopify-billing-implementation-plan.md)
- The approved direction captured in that document is now:
  - Supabase Auth is the app login system in v1
  - Shopify remains billing and checkout only in v1
  - app-side billing rows and entitlements are the runtime source of truth for access
  - `admin` bypasses customer billing entitlements
  - only admin UI is in current scope, but user and membership data model must be added now
  - menu or price-list updates require a new extract -> diff -> review -> publish workflow
  - existing `uqid` values in published menu snapshots must be preserved whenever the service still matches
- This plan exists specifically so the next AI can implement without re-arguing architecture or rediscovering current repo constraints.

## Update - 2026-04-14 - Frontend Migration Complete, Backend Migration Blocked Pending Supabase Access Clarification

Status:

- Frontend ownership migration is now complete:
  - canonical GitHub repo:
    - `https://github.com/hopkinsoffical/gmap-reivew-salon`
  - canonical Vercel deployment target:
    - company-owned Vercel project imported from `hopkinsoffical/gmap-reivew-salon`
  - frontend smoke test result:
    - basic functionality is working on the new company-owned Vercel deployment
- Backend migration to company-owned Supabase is not complete yet.
- Current blocker:
  - the available Supabase access path led into an existing organization / project set, but creating a new dedicated project for this product failed in the dashboard UI
  - observed failures included:
    - project-list retrieval failure under the existing organization
    - client-side dashboard exception when attempting to continue project creation
  - migration was paused pending clarification from teammates on the correct Supabase entrypoint and/or the correct way to create a dedicated project for this product
- Until that Supabase issue is resolved:
  - keep the new frontend deployment status documented as ready
  - do not switch `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in production to a company project that has not been created and verified yet
  - do not delete the currently working backend configuration yet

NEXT AI TODO - delete this block when finished:

- Confirm with teammates which Supabase access path is canonical:
  - official Supabase dashboard
  - or the company-provided `supabase.360ai.link` gateway
- Create a dedicated Supabase project for this product under the company account
- Re-run backend setup in the new company-owned Supabase project:
  - [sql/001_schema.sql](sql/001_schema.sql)
  - [sql/002_seed_store_example.sql](sql/002_seed_store_example.sql)
  - [sql/003_add_store_review_keywords.sql](sql/003_add_store_review_keywords.sql)
  - [sql/004_seed_store_staff.sql](sql/004_seed_store_staff.sql)
  - [scripts/seed-menu-snapshot.js](scripts/seed-menu-snapshot.js)
- Replace Vercel production env vars only after the new Supabase project is ready:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Then continue the deferred domain cutover work for:
  - `rankmysalon.ai`
  - `www.rankmysalon.ai`

## Update - 2026-04-14 - Company Ownership Is Canonical Going Forward

Status:

- Company-owned GitHub account now holds the canonical repo used for ongoing development and deployment:
  - `https://github.com/hopkinsoffical/gmap-reivew-salon`
- Company-owned Vercel account now holds the canonical deployment target for this repo.
- Future maintenance should use company identity only:
  - Git author / committer:
    - `Hopkins MedTech <info@hopkinsmedtech.com>`
  - GitHub repo owner:
    - `hopkinsoffical`
  - company-owned Vercel project:
    - use this as the only target for future production updates, env changes, and domain cutover work
- Production env vars currently recreated in the company-owned Vercel project:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `OPENAI_BASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APP_BASE_URL=https://rankmysalon.ai`
  - `TAVUS_API_KEY`
  - `PIPECAT_BACKEND_URL`
- User-reported smoke test result on the company-owned Vercel deployment:
  - basic functionality is working on the temporary Vercel deployment before custom-domain cutover
- Custom-domain cutover was intentionally deferred for now:
  - `rankmysalon.ai`
  - `www.rankmysalon.ai`
  - AWS Route 53 has not yet been updated to point production traffic at the new Vercel project
- Local Git remote should point at the company-owned repo:
  - `origin -> https://github.com/hopkinsoffical/gmap-reivew-salon.git`

NEXT AI TODO - delete this block when finished:

- Update AWS Route 53 records to the DNS values shown by the new company-owned Vercel project for:
  - `rankmysalon.ai`
  - `www.rankmysalon.ai`
- Verify production on the final domains:
  - `https://rankmysalon.ai/`
  - `https://rankmysalon.ai/stores/angel-tips-garwood`
  - `https://rankmysalon.ai/s/angel-tips-garwood`
- Remove the production domains from the previous Vercel project after the new project is serving traffic correctly
- Confirm whether the previous Vercel project should be deleted or retained as a temporary rollback target
- Repoint any remaining local clones or deployment notes that still reference pre-migration GitHub repo URLs

## Update - 2026-04-13 - Digital Human Video Poster Fixed

Status:

- The wrong image flash under the `Digital Human` section during page load was caused by the video poster pointing at the Localo hero poster instead of a digital-human-specific poster.
- Root cause in:
  - [app.js](app.js)
  - previous behavior:
    - `front_desk.mp4` used `LOCALO_HERO_POSTER_PATH`
    - Safari showed that poster before the video was ready
    - result:
      - the Localo search-results image flashed inside the `Meet Ryan, Your AI Voice Agent` block during load
- Fix applied:
  - added dedicated poster asset:
    - [assets/marketing/front_desk-poster.png](assets/marketing/front_desk-poster.png)
  - added:
    - `DIGITAL_HUMAN_POSTER_PATH`
  - `front_desk.mp4` now uses that dedicated poster instead of the Localo poster
- Cache-busting updated in:
  - [index.html](index.html)
  - current marketing bundle:
    - `/app.js?v=20260413-3`
- Verification completed:
  - `node --check app.js`
    - passed

NEXT AI TODO - delete this block when finished:

- Visually confirm on Safari and Chrome that the `Digital Human` block no longer flashes the Localo image before the video loads
- Complete Shopify Payments setup so checkout can actually accept payment

## Update - 2026-04-13 - Pricing CTA Now Opens In-Site Order Summary Before Shopify Checkout

Status:

- The pricing CTA no longer sends visitors straight to Shopify checkout on the first click.
- Active files for this interaction update:
  - [app.js](app.js)
  - [styles.css](styles.css)
  - [index.html](index.html)
- Current user flow is now:
  - visitor clicks pricing CTA on `/`
  - or visitor clicks pricing CTA on `/price`
  - app opens an in-site order-summary dialog first
  - dialog shows:
    - `RankMySalon Monthly Plan`
      - `Subscription · Deliver every month`
      - `$25 / month`
    - `Professional Setup`
      - `One-time launch fee`
      - `$199`
    - `Due today`
      - `$224`
    - `Recurring after checkout`
      - `$25 / month`
  - only after clicking:
    - `Continue to Secure Checkout`
    - does the app call Shopify `cartCreate` and redirect to checkout
- Implementation details:
  - shared CTA click now calls:
    - `openPricingSummary()`
  - the actual checkout trigger remains:
    - `handlePricingBuy()`
  - dialog render / state lives in:
    - `renderPricingSummary()`
    - `state.isPricingSummaryOpen`
  - dialog can be closed by:
    - backdrop click
    - `Back`
    - close button
    - `Escape`
- Cache-busting updated again in:
  - [index.html](index.html)
  - current asset versions:
    - `/styles.css?v=20260413-2`
    - `/app.js?v=20260413-2`
- Verification completed:
  - `node --check app.js`
    - passed

NEXT AI TODO - delete this block when finished:

- Run local browser verification of the new order-summary dialog on:
  - `/`
  - `/price`
- Confirm the dialog copy and totals match the live Shopify cart contents
- Complete Shopify Payments setup so the checkout no longer shows:
  - `This store can't accept payments right now`

## Update - 2026-04-13 - Shopify Pricing CTA Moved to Storefront API Cart Flow

Status:

- The pricing CTA implementation no longer depends on Shopify Buy SDK.
- Active files for this checkout update:
  - [config.js](config.js)
  - [app.js](app.js)
  - [index.html](index.html)
- Real Shopify storefront values are now configured in:
  - [config.js](config.js)
  - configured fields now are:
    - `domain`
    - `storefrontApiVersion`
    - `setupVariantId`
    - `monthlyVariantId`
    - `monthlySellingPlanId`
  - server-only secret:
    - `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (env only)
- Merchant-side Shopify setup completed before this code change:
  - storefront domain:
    - `y6y1hf-45.myshopify.com`
  - product handles discovered from Storefront API:
    - monthly subscription product:
      - `rankmysalon-monthly-plan`
    - one-time setup product:
      - `professional-setup`
  - monthly subscription selling plan name:
    - `Deliver every month`
- Pricing CTA behavior is now:
  - homepage pricing block CTA on `/`
  - dedicated pricing CTA on `/price`
  - both still share the same handler in:
    - `initShopify()`
    - `createPricingCheckoutUrl()`
    - `handlePricingBuy()`
    - `bindPricingEvents()`
  - clicking the CTA now creates a Shopify cart with exactly two lines:
    - `Professional Setup`
      - one-time line using `setupVariantId`
    - `RankMySalon Monthly Plan`
      - subscription line using `monthlyVariantId`
      - plus `monthlySellingPlanId`
  - the browser then redirects to the returned Shopify `checkoutUrl`
- Frontend dependency cleanup:
  - removed the legacy external Shopify Buy SDK script from:
    - [index.html](index.html)
  - current cache-busted assets are:
    - `/config.js?v=20260413-1`
    - `/app.js?v=20260413-1`
- Important security note:
  - only the Shopify public storefront token is stored in tracked frontend config
  - do not place the private storefront token in tracked files or browser code
- Verification completed:
  - `node --check app.js`
    - passed
  - `curl -s https://y6y1hf-45.myshopify.com/api/2026-04/graphql.json ...`
    - returned `cartCreate.cart.checkoutUrl` successfully
    - `userErrors = []`
    - `warnings = []`
- Repository state when this entry was added:
  - `git status --short --branch`
    - `## main...origin/main`
    - working tree had only the intended Shopify pricing files modified

NEXT AI TODO - delete this block when finished:

- Live-verify the Shopify checkout redirect from both user-facing CTA surfaces:
  - homepage pricing block CTA on `/`
  - dedicated pricing CTA on `/price`
- Confirm the Shopify checkout contains exactly:
  - one `Professional Setup` one-time line
  - one `RankMySalon Monthly Plan` subscription line
- If checkout creation fails in browser, inspect the Storefront API response body and confirm whether the store needs any additional headless publication / sales-channel availability changes for either product
- Run one real Tavus-backed `/talk` verification with secrets present in local `.env.local` or deployment env:
  - confirm `/api/tavus/create-persona` no longer fails with:
    - `Missing required environment variable: TAVUS_API_KEY`
  - confirm `/api/tavus/create-conversation` still succeeds after persona creation
  - confirm the left status rail visibly advances:
    - `Initialize`
    - `Connect`
    - `Live`
- Live-verify the review duplication guard with a real OpenAI-backed run:
  - use the screenshot-like path already documented below:
    - `visitTier = regular`
    - `servicePraise.staffLabel = MK`
    - `servicePraise.praiseKey = detailed`
    - `dishIds = [15,23,25]`
  - confirm the `3` generated reviews do not:
    - share the same visit lead
    - repeat an internal clause strongly enough to trigger `DUPLICATE_REVIEW_FRAGMENT`
    - trip `REVIEWS_TOO_SIMILAR`

## Update - 2026-04-10 - README Synced to Latest GitHub Main Through `fc9543c`

Status:

- Verified latest remote GitHub `main` on `2026-04-10` with:
  - `git ls-remote origin refs/heads/main`
  - returned:
    - `fc9543c79ef9e6faf3c70c91a742dce13dff039c refs/heads/main`
- This entry covers the commits shipped after the previous README progress-log sync commit `863f3e7`:
  - `fbbffcd`
    - `Fix duplicate review phrasing`
  - `3b03fe5`
    - `Document secure Tavus environment setup`
  - `bbc7cb6`
    - `Refine landing hero CTA`
  - `23db58e`
    - `Load local env for server functions`
  - `27d3f3a`
    - `Refine hero CTA layout`
  - `fc9543c`
    - `Stabilize assistant conversation layout`
- Review-generation follow-up now on GitHub:
  - active file:
    - [lib/server/reviews.js](lib/server/reviews.js)
  - single-card remote attempts increased to:
    - `SINGLE_REVIEW_REMOTE_ATTEMPTS = 2`
  - assigned visit prefixes now strip repeated visit wording across the whole text before reinserting the assigned prefix:
    - `stripVisitContextEverywhere(...)`
    - this replaced the old behavior that only trimmed the leading visit sentence
  - internal self-repetition is now rejected by:
    - `reviewHasInternalDuplication(...)`
    - error:
      - `DUPLICATE_REVIEW_FRAGMENT`
  - prompt rules now explicitly ban repeating:
    - the same clause
    - visit wording
    - the same opening idea inside one review
  - cosmetic surface randomness was reduced:
    - `buildSurfaceAssignments(...)` now always uses:
      - `startKey = normal_start`
      - `endKey = standard`
    - variation now comes from card planning plus validator / retry logic instead of random lowercase starts or punctuation removal
- Tavus / local env loading state now on GitHub:
  - active files:
    - [lib/server/env.js](lib/server/env.js)
    - [lib/server/tavus.js](lib/server/tavus.js)
    - [.env.example](.env.example)
  - local server functions now lazily read:
    - `.env.local`
    - `.env`
  - load rules:
    - only once per process via `localEnvLoaded`
    - never overwrite already exported shell env vars
    - quoted values are supported through `parseEnvValue(...)`
  - Tavus server helpers now call `ensureLocalEnvLoaded()` before reading:
    - `TAVUS_API_KEY`
    - `PIPECAT_BACKEND_URL`
  - practical effect:
    - local calls such as `/api/tavus/create-persona` and `/api/tavus/create-conversation` can resolve secrets from local env files during dev instead of requiring manual shell export first
  - secrets policy remains:
    - keep real Tavus values only in `.env.local` or deployment environment variables
    - never write them into tracked files or README text
- Landing / hero CTA state now on GitHub:
  - active files:
    - [app.js](app.js)
    - [styles.css](styles.css)
  - homepage hero primary CTA now points to the default store flow:
    - `getStorePath(config.defaultStoreSlug || "angel-tips-garwood")`
  - the prior hero CTA to `/talk` was removed from the main hero
  - CTA chrome was refined across `bbc7cb6` and `27d3f3a`:
    - button text:
      - `See How It Works`
    - meta note:
      - `2-minute demo`
    - inline arrow:
      - `→`
  - active styling for that CTA now lives in:
    - `.marketing-actions-hero`
    - `.marketing-hero-primary-cta`
    - `.marketing-hero-cta-note`
- Tavus assistant conversation layout state now on GitHub:
  - active files:
    - [app.js](app.js)
    - [styles.css](styles.css)
  - assistant status now tracks an explicit step index:
    - `state.assistant.statusStep`
  - the `/talk` panel now renders a stable status rail in:
    - `#assistantStatusRail`
    - steps:
      - `Initialize`
      - `Connect`
      - `Live`
  - visible transcript behavior changed:
    - `renderAssistantMessages()` now filters to `assistant` and `user` roles only
    - `system` events are still pushed into state but are not rendered into the visible conversation stack
  - initial empty state changed:
    - no spinner-only loading card
    - stable placeholder text remains until the first visible message arrives
  - layout support now lives in:
    - `.assistant-status-rail*`
    - `.assistant-empty-state*`
    - `.assistant-panel`
    - `.assistant-messages`
- Verification completed while adding this README sync:
  - `node --check app.js`
    - passed
  - `node --check lib/server/reviews.js`
    - passed
  - `node --check lib/server/env.js`
    - passed
  - `node --check lib/server/tavus.js`
    - passed
- Repository state when this top entry was added:
  - `git status --short --branch`
    - `## main...origin/main`
    - clean before this README edit
  - `git log --reverse --format='%H %s' 863f3e7..HEAD`
    - used to enumerate the exact six GitHub commits above
- The previous top-entry TODOs were carried forward into the new block below, and the stale duplicate TODO block in that older entry was removed.

NEXT AI TODO - delete this block when finished:

- Run one real Tavus-backed `/talk` verification with secrets present in local `.env.local` or deployment env:
  - confirm `/api/tavus/create-persona` no longer fails with:
    - `Missing required environment variable: TAVUS_API_KEY`
  - confirm `/api/tavus/create-conversation` still succeeds after persona creation
  - confirm the left status rail visibly advances:
    - `Initialize`
    - `Connect`
    - `Live`
- Live-verify the review duplication guard with a real OpenAI-backed run:
  - use the screenshot-like path already documented below:
    - `visitTier = regular`
    - `servicePraise.staffLabel = MK`
    - `servicePraise.praiseKey = detailed`
    - `dishIds = [15,23,25]`
  - confirm the `3` generated reviews do not:
    - share the same visit lead
    - repeat an internal clause strongly enough to trigger `DUPLICATE_REVIEW_FRAGMENT`
    - trip `REVIEWS_TOO_SIMILAR`

## Update - 2026-04-10 - Consolidated Handoff Sync for Current GitHub State

Status:

- This top entry is a same-day consolidation update so the next AI does not need to reconstruct `2026-04-10` work from scattered commits or multiple README sections.
- Current `origin/main` work now reflected in this README spans these shipped commits:
  - `52e4595`
    - `Consolidate README handoff updates`
  - `84f9db1`
    - `Refactor review generation per card`
  - `acffa2b`
    - `Reduce repetitive review phrasing`
  - `f8edac4`
    - `Redesign dedicated pricing page`
  - `01b0d12`
    - `Restore homepage pricing block and redesign price page`
  - `9a31f05`
    - `Remove redundant setup note from price page`
  - `0c250b8`
    - `Document price page setup note cleanup`
- Backend review generation state now on GitHub:
  - per-card generation is active in:
    - [lib/server/reviews.js](lib/server/reviews.js)
  - OpenAI timeout handling is active in:
    - [lib/server/openai.js](lib/server/openai.js)
  - repetition mitigation is already included:
    - per-card visit-prefix assignment
    - per-card dish emphasis assignment
    - per-card voice-angle directives
    - group-level similarity detection
    - targeted regeneration of only the similar cards
    - expanded fallback templates with additional phrasing variation
- Pricing / marketing state now on GitHub:
  - homepage pricing block under the `Digital Human` section is restored
  - dedicated `/price` exists as a distinct layout instead of mirroring the homepage block
  - the dedicated `/price` setup card no longer repeats:
    - `(* $199 One-time Professional Setup)`
  - active UI files for the pricing work remain:
    - [app.js](app.js)
    - [styles.css](styles.css)
    - [index.html](index.html)
- Repository state when this consolidation entry was added:
  - `git status --short`
    - clean before this README-only handoff update
  - `git log --oneline -8`
    - used to verify the shipped commit sequence above
- Reason this consolidation entry was added:
  - the project had multiple same-day updates across backend review generation and pricing page work
  - a new AI should be able to see the currently shipped state from the top of the README without reading the full history first

## Update - 2026-04-10 - Redundant Setup Note Removed from Dedicated `/price` Card

Status:

- The dedicated `/price` setup card already shows all key setup information directly:
  - badge:
    - `One-time`
  - title:
    - `Professional Setup`
  - amount:
    - `$199`
- The extra repeated line:
  - `(* $199 One-time Professional Setup)`
  - was removed from the dedicated `/price` setup card because it duplicated the same information and made the card visually heavier without adding meaning
- Homepage behavior was intentionally not changed in this follow-up:
  - the homepage pricing block under the `Digital Human` section still keeps the smaller setup-note style
- Files updated:
  - [app.js](app.js)
  - [styles.css](styles.css)
- Verification completed:
  - `node --check app.js`
    - passed

## Update - 2026-04-10 - Review Repetition Fix Applied to Backend Review Generation

Status:

- The repetitive-review regression in the active backend path was caused by two concrete issues in:
  - [lib/server/reviews.js](lib/server/reviews.js)
- Root cause 1:
  - `finalizeReviewCard(...)` was calling `applyVisitContextToReviews([review], ...)`
  - because each card was finalized one-by-one, the internal index was always `0`
  - result:
    - all three cards kept receiving the same visit prefix family
    - examples:
      - `这家我常来，还是放心。`
      - or the first English return-visit prefix
- Root cause 2:
  - the per-card architecture introduced on `2026-04-09` removed the old whole-batch phrasing awareness
  - each card had its own prompt, but there was no final validator checking whether the `3` generated reviews were too similar to each other
  - result:
    - same opening rhythm
    - same visit-context framing
    - overlapping sentence shapes inside the same set
- Fixes now applied:
  - added per-card visit prefix assignments:
    - `buildVisitPrefixAssignments(...)`
    - `getVisitPrefixAssignment(...)`
  - added explicit per-card dish emphasis assignments:
    - `buildDishSelectionAssignments(...)`
  - added per-card voice-angle directives:
    - `CARD_VOICE_DIRECTIVES`
    - each card now gets a different phrasing goal instead of only a different style label
  - stopped using batch-style visit prefix injection for single-card finalize
    - `finalizeReviewCard(...)` now applies an assigned visit prefix directly with:
      - `applyAssignedVisitPrefix(...)`
  - added group-level similarity detection:
    - `getSimilarReviewStyleKeys(...)`
    - `areReviewsTooSimilar(...)`
  - added targeted regeneration for only the similar cards:
    - `GROUP_DIVERSITY_ATTEMPTS = 2`
    - similar cards are regenerated with the other cards passed in as extra avoid text
  - expanded fallback generation:
    - more style-specific candidate templates
    - extra spice variants from `REVIEW_SPICE_BANK`
    - guaranteed last-resort templates per `styleKey + focus`
    - similarity checks also run against fallback output before it is accepted
- Current intent of the backend path:
  - keep the latency benefit of per-card generation
  - but reintroduce whole-set diversity at the validator / retry layer
  - so the `3` reviews should not share the same visit prefix or read like light rewrites of one another

Verification completed locally in this change set:

- Static parse check passed:
  - `node --check lib/server/reviews.js`
- Randomized regression test passed:
  - `250` iterations across `4` scenarios
  - scenarios included:
    - `zh + regular + MK + detailed + [15,23,25]`
    - `en + few_times + Karla + friendly + [15,23,25]`
    - `zh + few_times + [1,4,7]`
    - `en + first_time + [1,4,7]`
  - failure count:
    - `0`
- Duplicate-avoidance regression re-check passed after the repetition fix:
  - `100` repeated two-pass generations on:
    - `zh + regular + MK + detailed + [15,23,25]`
  - procedure:
    - generate one set
    - feed its `3` texts back into `recentTexts`
    - generate again
  - failure count:
    - `0`
- Local spot-check output after the fix showed the intended visit-prefix split:
  - `算常客了，还是很稳。`
  - `平时就会来，这次也满意。`
  - `这家我常来，还是放心。`
  - i.e. the three cards no longer all inherit the same return-visit lead

Local workspace note for the next AI:

- Unrelated local edits still exist in:
  - `app.js`
  - `styles.css`
  - do not include them in backend review commits unless explicitly requested

NEXT AI TODO - delete this block when finished:

- Run one live end-to-end verification against the real OpenAI path after deployment or with a valid local `OPENAI_API_KEY`
  - confirm the same screenshot-like path:
    - `visitTier = regular`
    - `servicePraise.staffLabel = MK`
    - `servicePraise.praiseKey = detailed`
    - `dishIds = [15,23,25]`
  - no longer returns a set whose three reviews share the same visit lead
- Inspect runtime logs for:
  - `REVIEWS_TOO_SIMILAR`
  - `[reviews] using fallback review`
  - quantify whether similarity retries are happening frequently enough to justify tuning the thresholds

## Update - 2026-04-10 - Homepage Pricing Block Restored and `/price` Redesigned as a Distinct Layout

Status:

- This update corrects the previous same-day pricing change:
  - the homepage overview route `/`
  - must keep its pricing block below the `Digital Human` section
  - the dedicated `/price` page must exist separately and must not reuse the same visual treatment as the homepage block
- Homepage pricing block is now restored in:
  - [app.js](app.js)
    - `getOverviewPricingSectionHtml()`
  - render position:
    - overview hero
    - digital human section
    - homepage pricing block
    - footer
- Homepage pricing block now again shows:
  - `Simple Pricing:`
  - `* $25 / Month`
  - `NO Contract | NO Hidden Fees | CANCEL Anytime`
  - CTA:
    - `Start attracting new customers today!`
  - setup note remains de-emphasized on the homepage:
    - `(* $199 One-time Professional Setup)`
- Dedicated `/price` page was redesigned into a visually distinct layout:
  - main left pricing area for the monthly plan
  - separate right-side setup card for the one-time fee
  - this page no longer looks like the homepage pricing block duplicated onto its own route
- `/price` now emphasizes setup as its own element instead of only a footnote:
  - setup badge:
    - `One-time`
  - setup card title:
    - `Professional Setup`
  - setup amount:
    - `$199`
  - the original note string is still present in smaller supporting text:
    - `(* $199 One-time Professional Setup)`
- Shared pricing behavior:
  - both homepage pricing block and `/price` CTA use the same Shopify storefront checkout handler:
    - `initShopify()`
    - `handlePricingBuy()`
    - `bindPricingEvents()`
  - both surfaces still depend on real values in:
    - [config.js](config.js)
- Cache-busting updated again in:
  - [index.html](index.html)
  - current script tag:
    - `/app.js?v=20260410-2`
- Local workspace note for the next AI:
  - there is an unrelated existing worktree edit in:
    - `lib/server/reviews.js`
  - do not include that file when working on pricing / marketing commits unless the user explicitly asks for it

NEXT AI TODO - delete this block when finished:

- Replace the placeholder Shopify values in:
  - [config.js](config.js)
  - required:
    - `domain`
    - `storefrontApiVersion`
    - `setupVariantId`
    - `monthlyVariantId`
    - `monthlySellingPlanId`
  - and set server env:
    - `SHOPIFY_STOREFRONT_ACCESS_TOKEN`
- Re-test both CTAs after real Shopify config is added:
  - homepage pricing block CTA on `/`
  - dedicated pricing CTA on `/price`
- If the product owner wants different copy for the `/price` setup card, update:
  - `pricingSetupTitle`
  - `pricingSetupAmount`
  - `pricingSetupBadge`
  - supporting setup-card sentence in [app.js](app.js)

## Update - 2026-04-10 - `/price` Rebuilt as Single-Plan Shopify Pricing Page

Status:

- The dedicated marketing pricing route:
  - `/price`
  - no longer renders the old placeholder 3-card package layout
- Current committed implementation is now a single-plan pricing page in:
  - [app.js](app.js)
  - [styles.css](styles.css)
  - [index.html](index.html)
- The new `/price` page now shows exactly:
  - `Simple Pricing:`
  - `* $25 / Month`
  - `NO Contract | NO Hidden Fees | CANCEL Anytime`
  - CTA button text:
    - `Start attracting new customers today!`
  - setup note:
    - `(* $199 One-time Professional Setup)`
- The CTA button on `/price` is wired to the existing Shopify storefront checkout logic again:
  - `initShopify()`
  - `handlePricingBuy()`
  - `bindPricingEvents()`
- Current checkout behavior:
  - if real Shopify config exists in:
    - [config.js](config.js)
  - clicking the pricing CTA will:
    - call backend endpoint `/api/shopify/create-checkout`
    - server creates Shopify cart with setup + monthly plan lines
    - browser redirects to returned checkout URL
  - if placeholder Shopify config is still present:
    - the page stays usable
    - clicking the CTA shows the guardrail alert instead of attempting a broken checkout
- Cache-busting updated for the new marketing JS bundle in:
  - [index.html](index.html)
  - current script tag:
    - `/app.js?v=20260410-1`
- Local verification completed:
  - `node --check app.js`
    - passed
  - `npm run dev:vercel -- --listen 3006`
    - local dev server started successfully
  - `curl -I -s http://127.0.0.1:3006/price`
    - returned `HTTP/1.1 200 OK`

NEXT AI TODO - delete this block when finished:

- Replace the placeholder Shopify values in:
  - [config.js](config.js)
  - required:
    - `domain`
    - `storefrontApiVersion`
    - `setupVariantId`
    - `monthlyVariantId`
    - `monthlySellingPlanId`
  - and set server env:
    - `SHOPIFY_STOREFRONT_ACCESS_TOKEN`
- Re-test the `/price` CTA against a real Shopify product after config is added and verify the redirect lands on the correct checkout
- If the product owner wants the old pricing block removed from README history, do not rewrite history; add a newer update explaining that pricing moved from the overview page into the dedicated `/price` route

## Update - 2026-04-09 - Review Generation Re-architected for Lower Tail Latency and Higher Pass Rate

Status:

- The active backend review path in:
  - [lib/server/reviews.js](lib/server/reviews.js)
  - no longer uses the old `1 large prompt -> 3 reviews -> batch retry up to 4 times` architecture
- The active backend path now does:
  - build one shared assignment set per request:
    - `focusAssignments`
    - `lengthAssignments`
    - `keywordAssignments`
    - `patternAssignments`
    - `surfaceAssignments`
  - fan out into `3` independent card generations with `Promise.all(...)`
  - each card now has its own:
    - compact single-card prompt
    - strict single-card JSON schema
    - local post-processing
      - `applyVisitContextToReviews(...)`
      - `applyServicePraiseToReviews(...)`
      - `applySurfaceStyleToReviews(...)`
    - local validator pass before the card is accepted
  - if the remote card generation fails or returns invalid content:
    - the server now falls back immediately to deterministic local templates for that card
    - it does not re-run a whole 3-review batch anymore
- Remote generation knobs now used by the active path:
  - `SINGLE_REVIEW_REMOTE_ATTEMPTS = 1`
  - `SINGLE_REVIEW_TIMEOUT_MS = 3500`
  - `SINGLE_REVIEW_TEMPERATURE = 0.55`
  - `SINGLE_REVIEW_MAX_TOKENS = 180`
- OpenAI chat calls now support request-scoped timeouts in:
  - [lib/server/openai.js](lib/server/openai.js)
  - timeout failures surface as:
    - `OPENAI_TIMEOUT`
- This change was made specifically because the old architecture was amplifying latency:
  - same payload could succeed in roughly `2.2s` to `4.4s`
  - but a bad first attempt could trigger full-batch retries and push total latency into `8.9s` to `10.4s`

Current review-pass criteria in code:

- Request-level input must be valid:
  - menu snapshot must not be empty
    - `MENU_EMPTY`
  - `visitTier` must resolve to one of:
    - `first_time`
    - `few_times`
    - `regular`
    - invalid input throws:
      - `INVALID_VISIT_TIER`
  - at least one supplied `dishId` must exist in the menu snapshot
    - invalid input throws:
      - `INVALID_DISH_IDS`
- Final response must contain exactly `3` review objects
  - otherwise:
    - `INVALID_REVIEW_COUNT`
- Each review text must be non-empty
  - otherwise:
    - `EMPTY_REVIEW_TEXT`
- Focus validation is strict:
  - `focus = none`
    - may mention only the result / finish / shape / color / wear
    - must not mention staff
    - must not mention salon environment
    - otherwise:
      - `INVALID_REVIEW_FOCUS`
  - `focus = service`
    - must mention staff / care / communication / technique
    - must not mention environment / decor / atmosphere / salon space
    - otherwise:
      - `INVALID_REVIEW_FOCUS`
  - `focus = environment`
    - must mention environment / cleanliness / comfort / atmosphere / salon setting
    - must not mention staff / attentiveness / named person
    - otherwise:
      - `INVALID_REVIEW_FOCUS`
- Length validation is strict and happens after visit-prefix / staff-praise / surface-style post-processing:
  - English:
    - `6` to `48` words
  - Chinese:
    - `16` to `78` effective characters after stripping whitespace / punctuation
  - otherwise:
    - `INVALID_REVIEW_LENGTH`
- Chinese punctuation validation is strict:
  - Chinese review text must not contain:
    - `:`
    - `：`
    - em/en dash variants
    - ASCII hyphen `-`
  - otherwise:
    - `BANNED_ZH_PUNCTUATION`
- Keyword realization validation is strict:
  - each review must naturally realize the assigned keyword concept if one was assigned
  - matching is accepted against:
    - `primaryKeyword`
    - `naturalPhrases`
    - ranked `candidates`
  - otherwise:
    - `MISSING_STORE_KEYWORD`
- Duplicate protection against recent history is strict:
  - if a generated review normalizes to one of `recentTexts`
    - it fails with:
      - `DUPLICATE_REVIEW_TEXT`
- Important non-goals of the current validator:
  - there is still no explicit validator that checks internal duplication across the `3` newly generated reviews
  - there is still no explicit validator that forces a review to mention a concrete dish name
  - the per-card length profile assignment is prompt guidance only; pass/fail is based on the global language bounds above

Verification completed locally in this change set:

- Static parse checks passed:
  - `node --check lib/server/reviews.js`
  - `node --check lib/server/openai.js`
- Offline fallback-path verification passed with a local harness:
  - English
    - `visitTier = few_times`
    - `servicePraise = { staffLabel: "Karla", praiseKey: "friendly" }`
    - `dishIds = [15, 23, 25]`
  - Chinese
    - `visitTier = regular`
    - `dishIds = [1, 4, 7]`
- Randomized local stress verification passed:
  - `250` iterations across `4` scenarios
  - total generated review sets validated:
    - `1000`
  - failure count:
    - `0`
  - this was run without an OpenAI key, so it exercises the new local fallback path and the full validator, not live model behavior
- Duplicate-avoidance regression check also passed locally:
  - English complex path:
    - `visitTier = few_times`
    - `servicePraise.staffLabel = Karla`
    - `servicePraise.praiseKey = friendly`
  - procedure:
    - generate one review set
    - feed the returned `3` texts back into `recentTexts`
    - generate again
  - repeated:
    - `100` times
  - failure count:
    - `0`

Local workspace note for the next AI:

- Unrelated local edits already existed and were not touched:
  - `app.js`
  - `styles.css`

NEXT AI TODO - delete this block when finished:

- Re-run live latency verification against the real OpenAI path after deployment or with a valid local `OPENAI_API_KEY`
  - target:
    - confirm the complex path with:
      - `visitTier = few_times`
      - `servicePraise.staffLabel = Karla`
      - `servicePraise.praiseKey = friendly`
    - now stays near the single-call envelope instead of drifting into old `8s` to `10s` tail latency
- Inspect Vercel logs for the new fallback warning:
  - `[reviews] using fallback review`
  - quantify how often the remote model still misses validator requirements by card / focus
- Decide whether to remove now-unused legacy batch helpers in:
  - [lib/server/reviews.js](lib/server/reviews.js)
    - `reviewSchema()`
    - `buildReviewMessages(...)`
    - `normalizeGeneratedReviews(...)`
  - they are currently dead code left in place during the architecture swap for safety

## Update - 2026-04-09 - Marketing Overview, Shopify Pricing, and Setup Guide Synced with GitHub

Status:

- Reviewed the recent GitHub commits that were not reflected in this README:
  - `1cf0e2e` through `3cf1d79`
    - iterative redesigns of the RankMySalon overview hero
  - `b765ffd`
    - added Shopify-backed pricing block and storefront checkout wiring
  - `c9820a2`
    - added root-level `shopify-setup-guide.pdf` for store-owner handoff
- Current committed marketing-route behavior at `HEAD`:
  - `/`
    - no longer serves the temporary landing placeholder from the 2026-04-08 route-split update
    - now renders the real RankMySalon overview page from:
      - [app.js](app.js)
  - `/price`
    - remains a distinct marketing route in the router / nav
  - `/about-us`
    - remains the about placeholder route
  - `/talk-to-assistant`
    - is the current assistant / Tavus-facing route
  - `/stores/:slug`
    - remains the canonical live store-review route
- Current committed overview-page structure:
  - the final hero returned to a left-right grid layout
  - left column is the finalized Google Maps acquisition framing:
    - `Did you know?`
    - `50–70% of New Nail Salon Clients Come from Google Maps`
    - `But how many are coming to YOU?`
  - the black competitor line plus gold italic solution line are the final committed state
  - earlier boxed warning / banner variants from the intermediate hero commits were transitional only and are not the current committed UI
  - the hero now has a single centered CTA:
    - label:
      - `See How It Works`
    - target:
      - `getStorePath(config.defaultStoreSlug)`
    - current effective path from the committed default config:
      - `/stores/angel-tips-garwood`
  - right-column hero media asset:
    - `assets/marketing/localo-header.gif`
- The digital-human section now lives directly below the hero on `/`:
  - section kicker / title:
    - `Digital Human`
    - `Meet Ryan, Your AI Voice Agent`
  - autoplay looping asset:
    - `assets/marketing/front_desk.mp4`
  - poster:
    - `assets/marketing/localo-header-poster.png`
  - CTA:
    - `Talk to Ryan`
    - `/talk-to-assistant`
- Shopify pricing integration added to the overview flow:
  - external Shopify Buy SDK is now loaded in:
    - [index.html](index.html)
  - pricing block is rendered by:
    - [app.js](app.js)
      - `getPricingSectionHtml()`
  - committed offer copy:
    - `$25 / Month`
    - `NO Contract`
    - `NO Hidden Fees`
    - `CANCEL Anytime`
    - `$199 One-time Professional Setup`
  - current checkout implementation is client-side only:
    - reads `config.shopify.domain`
  - reads variant + selling plan IDs from `config.shopify`
  - calls backend checkout API
  - server uses `SHOPIFY_STOREFRONT_ACCESS_TOKEN`
  - redirects the browser to Shopify checkout URL
  - placeholder-config guardrails are intentionally present:
    - missing / placeholder Shopify values trigger `alert(...)` messages instead of attempting a broken checkout
  - committed placeholder config location:
    - [config.js](config.js)
- Store-owner handoff asset now committed at repo root:
  - [shopify-setup-guide.pdf](shopify-setup-guide.pdf)
    - intended as the manual Shopify setup guide for the owner handoff
- Local workspace note for the next AI:
  - the worktree already had unrelated uncommitted edits in:
    - `app.js`
    - `styles.css`
  - this README update is intentionally based on committed Git history / `HEAD`, not those local-only edits

NEXT AI TODO - delete this block when finished:

- Populate the placeholder Shopify config in:
  - [config.js](config.js)
  - required values:
    - `domain`
    - `storefrontApiVersion`
    - `setupVariantId`
    - `monthlyVariantId`
    - `monthlySellingPlanId`
  - and set server env:
    - `SHOPIFY_STOREFRONT_ACCESS_TOKEN`
- Re-verify the pricing buy button end-to-end on the deployed marketing site after real Shopify config is added
- If the store owner will manage Shopify directly from the repo handoff, keep:
  - [shopify-setup-guide.pdf](shopify-setup-guide.pdf)
  - [README.md](README.md)
  - in sync whenever the Shopify setup steps change

## Update - 2026-04-09 - Latency Investigation and Failure Taxonomy Documented

Status:

- The user asked why prompt generation can still feel slow around `~7s` and why some requests appear to fail multiple times before succeeding.
- Live timing was measured directly against the current production endpoint using the exact higher-complexity request shape:
  - visit tier:
    - `few_times`
  - explicit staff mention:
    - `Karla`
  - praise key:
    - `friendly`
  - dish ids:
    - `15`
    - `23`
    - `25`
  - exact request:
    - `curl -s -o /tmp/review_timing_1.json -w "run=1 code=%{http_code} total=%{time_total}s connect=%{time_connect}s starttransfer=%{time_starttransfer}s\n" -X POST https://gmap-reivew-salon.vercel.app/api/stores/angel-tips-garwood/reviews -H 'Content-Type: application/json' --data '{"dishIds":[15,23,25],"lang":"en","recentTexts":[],"visitTier":"few_times","servicePraise":{"staffLabel":"Karla","praiseKey":"friendly"}}'`
- Measured production timings from 5 runs:
  - `4.428915s`
  - `10.448221s`
  - `2.208628s`
  - `2.770163s`
  - `8.954866s`
- Important inference from the timing data:
  - `connect` time stayed around `0.01s`
  - `starttransfer` was essentially the same as total time
  - therefore the latency is dominated by backend processing before first byte, not browser/network setup
  - because the same payload can succeed in `2.2s` to `4.4s`, the `8.9s` and `10.4s` runs are very likely tail-latency caused by internal retry attempts rather than a uniformly slow single generation
- Current retry behavior on the backend is at:
  - [lib/server/reviews.js](lib/server/reviews.js#L1181)
  - current logic:
    - up to `4` attempts
    - each failed attempt regenerates a fresh assignment set and calls OpenAI again
- Current generation parameters relevant to latency:
  - [lib/server/reviews.js](lib/server/reviews.js#L1203)
  - model source:
    - [lib/server/env.js](lib/server/env.js#L31)
  - active defaults / settings:
    - model default env fallback:
      - `gpt-4.1-mini`
    - `temperature: 0.72`
    - `max_tokens: 500`
    - strict JSON schema response format enabled
- The user also asked where failed attempts fail. Current failure taxonomy from code:
  - OpenAI request / transport layer:
    - `OPENAI_REQUEST_FAILED`
    - [lib/server/openai.js](lib/server/openai.js#L35)
  - Empty or invalid JSON from model:
    - `OPENAI_EMPTY_RESPONSE`
    - `OPENAI_INVALID_JSON`
    - [lib/server/openai.js](lib/server/openai.js#L55)
    - [lib/server/openai.js](lib/server/openai.js#L59)
  - Review shape / count / text issues:
    - `INVALID_REVIEW_SHAPE`
    - `INVALID_REVIEW_COUNT`
    - `EMPTY_REVIEW_TEXT`
    - [lib/server/reviews.js](lib/server/reviews.js#L1056)
    - [lib/server/reviews.js](lib/server/reviews.js#L1077)
    - [lib/server/reviews.js](lib/server/reviews.js#L1096)
  - Focus validation failures:
    - `INVALID_REVIEW_FOCUS`
    - [lib/server/reviews.js](lib/server/reviews.js#L1111)
    - [lib/server/reviews.js](lib/server/reviews.js#L1115)
    - [lib/server/reviews.js](lib/server/reviews.js#L1119)
  - Length validation failures:
    - `INVALID_REVIEW_LENGTH`
    - [lib/server/reviews.js](lib/server/reviews.js#L1123)
  - Keyword / dedupe failures:
    - `MISSING_STORE_KEYWORD`
    - `DUPLICATE_REVIEW_TEXT`
    - [lib/server/reviews.js](lib/server/reviews.js#L1127)
    - [lib/server/reviews.js](lib/server/reviews.js#L1132)
- Important limitation of the current code:
  - failed attempts are swallowed and retried, but the code does not currently log which attempt failed for which exact `error.code`
  - exact per-attempt failure distribution is therefore still inferred from behavior, not yet directly instrumented
- Preliminary latency conclusion for future work:
  - the fast path is already around `2s` to `4.5s`
  - the tail path is what creates the user's `~7s` experience
  - the biggest lever is reducing or replacing remote retries, not micro-optimizing frontend code
- Most promising approved-next-step candidate, not implemented yet:
  - replace multi-call remote retry behavior with:
    - one OpenAI generation attempt
    - strict validation
    - local deterministic fallback review builder if validation fails
  - this should target lower tail latency while keeping output available even when the first model sample misses validation
- Local workspace note for the next AI:
  - there are unrelated user changes present in the worktree that were not touched in this turn:
    - `.env.example`
    - `app.js`
    - `index.html`
    - `vercel.json`
    - `assets/marketing/`

NEXT AI TODO - delete this block when finished:

- If the user approves deeper latency work, add attempt-level backend logging around:
  - attempt index
  - `error.code`
  - `error.message`
  - `visitTier`
  - whether `servicePraise` was present
  - `dishIds`
- Use those logs to measure the true failure distribution across:
  - `INVALID_REVIEW_FOCUS`
  - `INVALID_REVIEW_LENGTH`
  - `MISSING_STORE_KEYWORD`
  - transport / JSON failures
- If the user approves implementation, prototype the lower-tail-latency path:
  - single OpenAI generation attempt
  - no repeated remote retries on the request path
  - local fallback review synthesis on validation failure
- Re-benchmark the same live `Karla + friendly + few_times` request shape and compare:
  - median latency
  - p95 latency
  - success rate

## Update - 2026-04-09 - Intermittent Review Failures Reduced and Re-Verified on Production

Status:

- A new intermittent failure was reported from the live Angel Tips store UI while using:
  - visit tier: `few_times`
  - explicit staff mention: `Karla`
  - receipt matching fixture:
    - `assets/test-photos/angel-tips-garwood/receipts/04-classic-acrylic-set-tropical-french.jpg`
  - expected dish ids:
    - `15`
    - `23`
    - `25`
- The live request used for reproduction:
  - `curl -i -s -X POST https://gmap-reivew-salon.vercel.app/api/stores/angel-tips-garwood/reviews -H 'Content-Type: application/json' --data '{"dishIds":[15,23,25],"lang":"en","recentTexts":[],"visitTier":"few_times","servicePraise":{"staffLabel":"Karla","praiseKey":"friendly"}}'`
- The failure was intermittent, not constant:
  - before the fix, repeated production calls on the same payload produced both:
    - `INVALID_REVIEW_FOCUS`
    - `INVALID_REVIEW_LENGTH`
- Root causes in:
  - [lib/server/reviews.js](lib/server/reviews.js)
- Exact issues:
  - retry attempts were reusing one assignment set, so a bad random prompt combination could fail twice and still bubble out as a hard 502
  - English visit-prefix + service-praise post-processing could push some otherwise acceptable reviews over the hard 42-word max
  - focus directives were still too soft for the model on result-only cards, so some generations drifted into environment/service wording even after earlier fixes
- Repo fix implemented:
  - increased English review max length bound from `42` to `48`
  - tightened per-focus directives with explicit banned focus drift examples
  - shortened the English staff-praise append sentence from a longer shoutout clause to:
    - `"<staff> was <praise> too."`
  - moved prompt assignment generation inside the retry loop
  - increased retry attempts from `2` to `4`
- GitHub / deploy state:
  - commit pushed:
    - `f4b1830` - `Reduce intermittent review generation failures`
  - production deployment:
    - `dpl_C5Ba3T6nijUXqJKbFn1oMa8LDYFw`
    - state: `READY`
- Production verification after deployment:
  - the exact `Karla` request above was run `12` times consecutively
  - results:
    - `12 / 12` returned `HTTP 200`
    - `0 / 12` returned `INVALID_REVIEW_FOCUS`
    - `0 / 12` returned `INVALID_REVIEW_LENGTH`

## Update - 2026-04-09 - Staff-Praise Validation Gap Fixed After Live Retest

Status:

- After production deployment `dpl_wpb7tySR2sSx2GogSpQMDPZkhXfh` for commit `b6f3950`, the base English review-generation path was re-tested and returned `HTTP/2 200`.
- A second live retest then exposed a remaining failure only on the explicit staff-praise path:
  - `curl -s -X POST https://gmap-reivew-salon.vercel.app/api/stores/angel-tips-garwood/reviews -H 'Content-Type: application/json' --data '{"dishIds":[30,37,40],"lang":"en","recentTexts":[],"visitTier":"few_times","servicePraise":{"staffLabel":"Diana","praiseKey":"detailed"}}'`
  - live response returned:
    - `{"error":{"code":"INVALID_REVIEW_FOCUS","message":"Service review focus invalid"}}`
- Root cause in:
  - [lib/server/reviews.js](lib/server/reviews.js)
- Exact bug:
  - `applyServicePraiseToReviews(...)` could append a real staff name such as `Diana`
  - but `validateGeneratedReviews(...)` only recognized generic service/staff vocabulary and did not treat the chosen staff name itself as service-focus evidence
  - result:
    - service-praise requests could still fail validation even though the generated review clearly referenced the selected staff member
- Repo fix implemented:
  - added regex escaping helper for safe runtime staff-name matching
  - `validateGeneratedReviews(...)` now accepts the active `servicePraise` payload and treats the selected `staffLabel` as valid service-focus evidence
  - `applyServicePraiseToReviews(...)` now uses slightly more natural staff praise wording
- Verification completed:
  - `node --check lib/server/reviews.js`
    - passed
  - GitHub commit pushed:
    - `5c402ff` - `Fix staff praise review validation`
  - Vercel production deployment:
    - `dpl_FLXWn5hkH9cRYvq77B7d8V8CF41a`
    - target: `production`
    - state: `READY`
  - exact live retest after deployment:
    - `curl -i -s -X POST https://gmap-reivew-salon.vercel.app/api/stores/angel-tips-garwood/reviews -H 'Content-Type: application/json' --data '{"dishIds":[30,37,40],"lang":"en","recentTexts":[],"visitTier":"few_times","servicePraise":{"staffLabel":"Diana","praiseKey":"detailed"}}'`
    - returned:
      - `HTTP/2 200`

## Update - 2026-04-09 - Second Review Prompt Conflict Fixed After Production Recheck

Status:

- After commit `244c5f2` auto-deployed to Vercel production, the latest production deployment was confirmed as:
  - deployment id: `dpl_4ti87SNAEx11pQVKbipuqLcSTh55`
  - commit: `244c5f2c4b259ad0107c2284c15c5bd27ba01cd6`
  - commit message: `Fix review focus keyword assignment`
- Production was then re-tested directly and still failed:
  - `curl -i -s -X POST https://gmap-reivew-salon.vercel.app/api/stores/angel-tips-garwood/reviews -H 'Content-Type: application/json' --data '{"dishIds":[9,22,25],"lang":"en","recentTexts":[],"visitTier":"few_times","servicePraise":null}'`
  - production response:
    - `HTTP/2 502`
    - `{"error":{"code":"INVALID_REVIEW_FOCUS","message":"Results-only review mentioned staff or salon environment"}}`
- This proved the first keyword/focus fix was live, but not sufficient. There was still a second prompt-architecture conflict in:
  - [lib/server/reviews.js](lib/server/reviews.js)
- Exact second root cause:
  - `choosePatternKey(...)` could still assign `repeat_customer` to a `service` focus card when no explicit staff member was selected
  - `getProofTypeOptions(...)` could still assign `skill` proof to a `none` / result-only card
  - both cases produced per-card instructions that were weaker or contradictory relative to backend focus validation
- Repo fix implemented:
  - service-focus cards now always use `staff_led` pattern
  - result-only cards now only use `result` proof, never `skill`
- Static verification completed:
  - `node --check lib/server/reviews.js`
    - passed
  - 5000 randomized assignment simulations checking focus against keyword / proof / pattern compatibility:
    - incompatible combinations after this change: `0`

NEXT AI TODO - delete this block when finished:

- Push this second prompt-alignment fix to GitHub
- Wait for the next production deployment to reach `READY`
- Re-run the exact production `/api/stores/angel-tips-garwood/reviews` POST above
- If production still fails, instrument backend logging around normalized reviews and the failing focus classification path

## Update - 2026-04-09 - Review Failure Root Cause Fixed in Repo

Status:

- Reproduced the current failure path against the live production endpoint:
  - `curl -s -X POST https://gmap-reivew-salon.vercel.app/api/stores/angel-tips-garwood/reviews -H 'Content-Type: application/json' --data '{"dishIds":[9,22,25],"lang":"en","recentTexts":[],"visitTier":"few_times","servicePraise":null}'`
  - live response returned:
    - `{"error":{"code":"INVALID_REVIEW_FOCUS","message":"Service review focus invalid"}}`
- Root cause was in:
  - [lib/server/reviews.js](lib/server/reviews.js)
- Exact backend bug:
  - `buildKeywordAssignments(...)` was assigning keyword concepts independently of each card's already-assigned `focus`
  - that let the prompt issue contradictory instructions such as:
    - service-focus card + environment keyword like `clean`
    - environment-focus card + service keyword like `welcoming`
    - result-only card + service keyword like `gentle`
  - once the model followed either side of the contradiction, backend validation could reject the output with:
    - `INVALID_REVIEW_FOCUS`
- Repo fix implemented in:
  - [lib/server/reviews.js](lib/server/reviews.js)
- Fix details:
  - added `KEYWORD_FOCUS_COMPATIBILITY_MAP`
  - `buildKeywordAssignments(...)` now receives `focusAssignments`
  - keyword selection is now filtered to keywords compatible with the assigned review focus
  - if a future store lacks any compatible keyword for a given focus, that card now skips keyword assignment instead of forcing an incompatible one
- Static verification completed:
  - `node --check lib/server/reviews.js`
    - passed
  - compatibility simulation before the fix logic was updated:
    - 5000 randomized assignment runs
    - incompatible focus/keyword combinations occurred in `4707` runs (`94.14%`)
  - compatibility simulation after the fix:
    - 5000 randomized assignment runs
    - incompatible focus/keyword combinations occurred in `0` runs
- Important deployment note:
  - the live production endpoint was used only to reproduce the bug
  - this repository now contains the fix, but the production deployment will continue returning the old failure until this change is deployed

NEXT AI TODO - delete this block when finished:

- Deploy the current repo change to Vercel / production
- Re-run the exact live `/api/stores/angel-tips-garwood/reviews` POST above after deployment and confirm it no longer returns `INVALID_REVIEW_FOCUS`
- Re-test the store UI flow with at least these receipt fixtures:
  - `assets/test-photos/angel-tips-garwood/receipts/03-thermal-sns-design-extra-length.jpg`
  - `assets/test-photos/angel-tips-garwood/receipts/05-modern-regular-pedi-callus-gel.jpg`

## Update - 2026-04-09 - Review Prompt Architecture Replaced on Active Backend Path

Status:

- Active review-generation prompt path was replaced in:
  - [lib/server/reviews.js](lib/server/reviews.js)
- The active store flow still generates reviews through:
  - [api/stores/[slug]/reviews.js](api/stores/[slug]/reviews.js)
  - [lib/server/reviews.js](lib/server/reviews.js#L1123)
- Prompt architecture change on the backend:
  - removed the long instruction-block style prompt that mixed style, focus, full keyword lexicon, random flavor phrases, and full recent-review text into one large user message
  - replaced it with per-card directives built from:
    - pattern assignment
    - proof assignment
    - closing assignment
    - keyword concept + natural realization phrases
    - surface controls
- New pattern layer added to reflect the local review-pattern research in:
  - [output/research/nj-nail-salon-google-review-patterns.md](output/research/nj-nail-salon-google-review-patterns.md)
  - patterns now include:
    - `staff_led`
    - `repeat_customer`
    - `first_time_surprise`
    - `service_result`
- New keyword realization layer added:
  - keyword concepts are now translated toward natural customer phrasing instead of being pushed as literal keyword stuffing
  - examples:
    - `clean` -> `very clean`, `spotless`, `clean and welcoming`
    - `welcoming` -> `everyone was friendly`, `super welcoming`, `made me feel comfortable`
- New surface-style controls added on the backend:
  - random lowercase opening for some English reviews
  - random no-terminal-punctuation ending for some reviews
  - these are applied deterministically after generation so the effect does not depend entirely on model compliance
- Validation was updated to match the new wording patterns:
  - keyword validation now checks the assigned keyword concept / realization family per card
  - environment detection was expanded to allow more natural phrasing like `spotless`, `clean and welcoming`, `relaxing atmosphere`
  - `very clean result` / `very clean finish` style result phrases are partially guarded against false environment matches
- Generation parameters were tightened to reduce latency / retry amplification:
  - temperature changed from `0.95` to `0.72`
  - `max_tokens` changed from `1200` to `500`
- Supabase production keyword alignment was checked for:
  - store slug `angel-tips-garwood`
  - queried field:
    - `stores.review_keywords`
  - current production keyword keys returned:
    - `clean`
    - `detailed`
    - `gentle`
    - `polished`
    - `relaxing`
    - `natural`
    - `glossy`
    - `precise`
    - `lasting`
    - `welcoming`
  - result:
    - these keys already match the new backend keyword-realization map in [lib/server/reviews.js](lib/server/reviews.js)
    - no new Supabase migration is required for this prompt refactor
    - no production data patch is required for `angel-tips-garwood` at this time
- Static verification completed:
  - `node --check lib/server/reviews.js`
    - passed

NEXT AI TODO - delete this block when finished:

- Run at least one real end-to-end review generation call against `/api/stores/angel-tips-garwood/reviews` and verify:
  - the new prompt still satisfies focus validation
  - lowercase-start and no-terminal-punctuation styles appear at the intended low frequency
  - keyword concept realization is natural in actual outputs
- Decide whether to port the same prompt architecture into the legacy frontend fallback in:
  - [app.js](app.js)
  - current active store path uses backend generation, but the old frontend fallback prompt still exists
- Revisit receipt-prompt latency separately; this change only replaced the active backend review-generation prompt, not the receipt prompt
- Attach the custom domain `rankmysalon.ai` to this Vercel project and verify:
  - `https://rankmysalon.ai/`
  - `https://rankmysalon.ai/stores/angel-tips-garwood`
  - `https://rankmysalon.ai/s/angel-tips-garwood`
- Update env/config references that still use `https://gmap-reivew-salon.vercel.app` once the custom domain is the production primary
- Re-verify the final landing/store split visually in browser once the real marketing landing page replaces the placeholder

## Update - 2026-04-08 - Route Split Pushed and Live on Vercel

Status:

- Route-split implementation commit pushed to GitHub:
  - `5702592` - `Implement RankMySalon landing route split`
- Git remote remains:
  - pre-migration GitHub remote for this repo remained unchanged at that time
- The connected Vercel project picked up the new routing behavior on the live alias:
  - `https://gmap-reivew-salon.vercel.app`
- Production verification completed after push:
  - `curl -I https://gmap-reivew-salon.vercel.app`
    - returned `HTTP/2 200`
  - `curl -I https://gmap-reivew-salon.vercel.app/stores/angel-tips-garwood`
    - returned `HTTP/2 200`
  - `curl -I https://gmap-reivew-salon.vercel.app/s/angel-tips-garwood`
    - returned `HTTP/2 308`
    - `Location: /stores/angel-tips-garwood`
- Practical production result:
  - root alias now serves the shared shell intended for the RankMySalon landing entry
  - canonical store path is live under `/stores/angel-tips-garwood`
  - short-link compatibility path `/s/angel-tips-garwood` now redirects to the canonical store route in production
- Vercel MCP deployment inspection was not available in this environment because the connector required auth, so deployment verification here is based on observed live route behavior and live response headers rather than a deployment-id fetch.

NEXT AI TODO - delete this block when finished:

- Attach the custom domain `rankmysalon.ai` to this Vercel project and verify:
  - `https://rankmysalon.ai/`
  - `https://rankmysalon.ai/stores/angel-tips-garwood`
  - `https://rankmysalon.ai/s/angel-tips-garwood`
- Update env/config references that still use `https://gmap-reivew-salon.vercel.app` once the custom domain is the production primary
- Re-verify the final landing/store split visually in browser once the real marketing landing page replaces the placeholder

## Update - 2026-04-08 - Root Landing Placeholder and Canonical Store Routes Implemented

Status:

- Implemented the first pass of the RankMySalon site split across:
  - [app.js](app.js)
  - [index.html](index.html)
  - [styles.css](styles.css)
  - [vercel.json](vercel.json)
- New runtime route behavior:
  - `/`
    - now renders a temporary RankMySalon landing-page placeholder instead of immediately booting the single-store review flow
  - `/stores/:slug`
    - is now the canonical frontend route for the live store-specific review studio
  - `/s/:slug`
    - is preserved as the legacy short link and now permanently redirects to `/stores/:slug`
- Frontend routing changes in [app.js](app.js):
  - added explicit route modes:
    - `landing`
    - `store`
    - `legacy`
  - added route parser for:
    - `/`
    - `/stores/:slug`
    - `/s/:slug`
  - legacy short links are redirected client-side as a fallback even though Vercel now handles the redirect at the edge
  - store bootstrap no longer reads slug from only `/s/:slug`; it now uses the parsed canonical store route
  - root landing mode skips store bootstrap / menu loading entirely
- Landing placeholder behavior:
  - brand name switches to `RankMySalon`
  - hero copy and page title become route-aware
  - landing placeholder includes a primary CTA into the configured default store:
    - currently `/stores/angel-tips-garwood`
  - current placeholder intentionally stays light-weight; it is not the final marketing site
- Store-app behavior preserved:
  - all API calls remain rooted at `/api/stores/:slug/*`
  - the existing Angel Tips review studio still loads under the new canonical store route
  - existing `config.defaultStoreSlug` is still `angel-tips-garwood`, so the first live CTA target is aligned with the current backend store
- Vercel routing changes in [vercel.json](vercel.json):
  - added permanent redirect:
    - `/s/:slug` -> `/stores/:slug`
  - rewrote canonical store route:
    - `/stores/:slug` -> `/index.html`
  - favicon rewrite remains:
    - `/favicon.ico` -> `/favicon.svg`
- Local verification completed:
  - `node --check app.js`
    - passed
  - `npm run dev:vercel -- --listen 3003`
    - local dev server started successfully
  - `curl -I http://127.0.0.1:3003/`
    - returned `200 OK`
  - `curl -I http://127.0.0.1:3003/stores/angel-tips-garwood`
    - returned `200 OK`
  - `curl -I http://127.0.0.1:3003/s/angel-tips-garwood`
    - returned `308 Permanent Redirect`
    - `Location: /stores/angel-tips-garwood`
  - `curl -I http://127.0.0.1:3003/api/stores/angel-tips-garwood/bootstrap`
    - returned `405 Method Not Allowed`
    - `Allow: GET`
    - this confirms the root-scoped API function mount still exists while store routing moved to `/stores/:slug`

## Update - 2026-04-08 - Domain and Site Architecture Direction Confirmed

Status:

- Current live production deployment is still:
  - `https://gmap-reivew-salon.vercel.app`
- Product direction for the real custom domain is now:
  - `https://rankmysalon.ai/`
    - should become the main public-facing landing page for the RankMySalon product
  - `https://rankmysalon.ai/stores/angel-tips-garwood`
    - should become the canonical store-specific review studio URL for Angel Tips
- Recommended path convention:
  - use `/stores/:storeSlug`
  - not `/store/angeltips`
- Reason this is the better canonical structure:
  - plural `stores` reads as a scalable product information architecture, not a one-off hardcoded route
  - `angel-tips-garwood` already matches the current backend/store slug used by:
    - [app.js](app.js#L935)
    - [api/stores/[slug]/bootstrap.js](api/stores/[slug]/bootstrap.js)
    - [api/stores/[slug]/reviews.js](api/stores/[slug]/reviews.js)
    - Supabase `stores.slug`
  - keeping the canonical URL aligned with the actual store slug avoids translation layers, redirect bugs, and future multi-store ambiguity
  - a location-aware slug like `angel-tips-garwood` is safer than a short alias like `angeltips` because the product is clearly heading toward multi-store support
- Current route limitation:
  - the frontend currently only recognizes `/s/:slug` and otherwise falls back to `config.defaultStoreSlug`
  - exact current path parser:
    - [app.js](app.js#L935)
  - exact current rewrite:
    - [vercel.json](vercel.json)
- Recommended routing plan:
  - root `/` becomes the marketing/landing page
  - `/stores/:slug` becomes the canonical app path for store-specific review studios
  - existing `/s/:slug` should remain as a short-link alias and redirect or rewrite to `/stores/:slug`
  - API paths can stay as `/api/stores/:slug/*`
- Vercel / Git status as of this update:
  - GitHub repo is connected to the Vercel project
  - production env vars are present in Vercel
  - current production deploy is working

## Update - 2026-04-08 - Vercel Production Linked to GitHub

Status:

- GitHub remote is:
  - pre-migration GitHub remote for this repo
- Latest pushed commit at the time of connection:
  - `949b642` - `Fix review generation validation and favicon`
- Existing Vercel project link confirmed from:
  - [.vercel/project.json](.vercel/project.json)
  - project name: `gmap-reivew-salon`
  - project id: `prj_SqPTAsmTWDZm2F86u8aC63PnF7in`
  - org/team id: `team_bjRpCPGTuutZgXzvodrdA695`
- Git integration was connected from the CLI with:
  - `npx vercel git connect <repo-url>`
  - CLI returned:
    - `> Connected`
- Production env vars were missing in Vercel at first.
- Added / updated production env vars in the Vercel project:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `OPENAI_BASE_URL`
  - `APP_BASE_URL=https://gmap-reivew-salon.vercel.app`
- Production deploy rerun after env sync:
  - deployment id: `dpl_Bse5GoRNN86kjDcue5oKotZPYroA`
  - inspector URL was captured during that run
  - production alias: `https://gmap-reivew-salon.vercel.app`
- Live verification after redeploy:
  - homepage returned `HTTP/2 200`
  - `GET /api/stores/angel-tips-garwood/bootstrap` returned real store/staff/menu data

## Update - 2026-04-08 - Review Contrast and Focus Validation Fixed

Status:

- User approved immediate fixes for the two previously investigated issues:
  - low-contrast helper text in the review context controls
  - review generation failures caused by model-returned `focus` mismatches
- Review context readability fix applied in:
  - [styles.css](styles.css)
  - updated selectors:
    - `.context-pill-action`
    - `.context-pill-label`
    - `.service-toggle-label`
    - `.service-toggle-meta`
  - changes:
    - darker warm-brown text colors
    - stronger pill border/background for the `Optional` badge
    - higher label weight so `THIS VISIT`, `NICE EXTRA TOUCH`, `Change`, and `Optional` no longer wash out on the pale card background
- Review generation fix applied in:
  - [lib/server/reviews.js](lib/server/reviews.js)
  - [app.js](app.js)
  - exact behavior change:
    - response schema no longer requires model output field `focus`
    - `style_key` remains strict
    - final `focus` is always derived from server-side assignment
    - normalization no longer hard-fails on model-returned focus mismatch
  - validation cleanup:
    - removed restaurant-era wording from the `results-only` validation error
    - expanded service detection to catch salon phrasing like `patient`, `friendly`, `gentle`, `easy to communicate with`
    - narrowed environment detection so result phrases like `clean finish` are not incorrectly treated as salon-environment mentions
- Local verification completed:
  - bootstrap data loaded directly via `getStoreBootstrap("angel-tips-garwood")`
  - returned:
    - store slug `angel-tips-garwood`
    - `28` staff
    - menu snapshot version `1`
  - one end-to-end local review generation run completed successfully via `generateReviewsForStore(...)`
  - exact verification input:
    - `dishIds: [6, 27]`
    - `lang: "en"`
    - `visitTier: "few_times"`
    - `servicePraise: { staffLabel: "Amy", praiseKey: "patient" }`
  - successful output returned all 3 cards with normalized focuses:
    - `review_a` -> `none`
    - `review_b` -> `service`
    - `review_c` -> `environment`

## Update - 2026-04-08 - Localhost Placeholder Favicon Fixed

Status:

- Root cause of the odd icon shown beside `localhost` during local dev:
  - [index.html](index.html) previously set:
    - `<link rel="icon" href="data:," />`
  - Local runtime also returned:
    - `404 Not Found` for `http://127.0.0.1:3001/favicon.ico`
  - Result:
    - browsers were free to show a generated placeholder icon for the tab / address bar instead of a real site icon
- This was not app UI rendered by [app.js](app.js).
- Added a real salon-branded favicon asset:
  - [favicon.svg](favicon.svg)
- Updated favicon wiring in:
  - [index.html](index.html)
  - now uses explicit SVG favicon links instead of the empty `data:,` placeholder
- Updated local/static routing in:
  - [vercel.json](vercel.json)
  - `/favicon.ico` now rewrites to `/favicon.svg`
- Local verification after patch:
  - `curl -I http://127.0.0.1:3001/favicon.ico`
  - returned `200 OK`
  - `Content-Type: image/svg+xml`
- Practical effect:
  - local dev no longer emits a favicon 404
  - browsers should stop inventing the odd placeholder icon for this repo

## Update - 2026-04-08 - Pending Approval Investigation

Status:

- No code changes have been made yet for the two items below. User explicitly requested investigation first, then approval before modification.
- UI readability issue identified in the review context area:
  - The low-contrast text is coming from:
    - `styles.css` selectors at approximately lines `653-689`
    - `.context-pill-action`
    - `.context-pill-label`
    - `.service-toggle-label`
    - `.service-toggle-meta`
  - Current colors are too light for the current pale salon card background.
- Review generation failure root cause identified:
  - Local runtime error is:
    - `INVALID_REVIEW_FOCUS`
    - `Returned focus assignment mismatch`
  - Exact failing logic:
    - [lib/server/reviews.js](lib/server/reviews.js#L716)
    - [lib/server/reviews.js](lib/server/reviews.js#L736)
  - Root cause:
    - Server randomly assigns `focus` per `style_key` via `buildFocusAssignments()`.
    - Prompt also asks the model to echo `focus`.
    - Schema requires `focus` in the model output.
    - If the model returns correct `style_key` and usable text but mismatched `focus`, server hard-fails before using the text.
  - Exact assignment source:
    - [lib/server/reviews.js](lib/server/reviews.js#L370)
  - Exact schema requirement:
    - [lib/server/reviews.js](lib/server/reviews.js#L504)

Recommended fix after user approval:

- UI contrast:
  - Darken the helper label colors and the `Change` / `Optional` text so they read cleanly on the current pale background.
- Review generation:
  - Stop treating model-returned `focus` as a hard source of truth.
  - Keep `style_key` strict.
  - Derive final `focus` from the server-side assignment.
  - Keep post-generation content validation that checks whether each review actually behaves like service / environment / result-only content.
  - Also clean remaining restaurant-era wording in validation errors and regex comments where relevant.

## Update - 2026-04-08 - Receipt Test Fixtures Generated

Status:

- Generated 10 Angel Tips receipt testcases as PDFs first, then converted them to uploadable JPGs because the current upload flow accepts only images.
- Final image fixtures live at:
  - [assets/test-photos/angel-tips-garwood/receipts](assets/test-photos/angel-tips-garwood/receipts)
- Manifest and notes for the testcases live at:
  - [assets/test-photos/angel-tips-garwood/receipts/manifest.json](assets/test-photos/angel-tips-garwood/receipts/manifest.json)
  - [assets/test-photos/angel-tips-garwood/receipts/README.md](assets/test-photos/angel-tips-garwood/receipts/README.md)
- Original PDF files were intentionally deleted after image export.
- PDF output metadata remains at:
  - [output/pdf/angel-tips-receipt-testcases/README.md](output/pdf/angel-tips-receipt-testcases/README.md)
  - [output/pdf/angel-tips-receipt-testcases/manifest.json](output/pdf/angel-tips-receipt-testcases/manifest.json)

Scripts added:

- [scripts/generate-test-receipts.py](scripts/generate-test-receipts.py)
- [scripts/export-test-receipts-images.py](scripts/export-test-receipts-images.py)

Important constraint:

- Current upload input is image-only, not PDF:
  - [index.html](index.html#L37)
  - [lib/server/recognize.js](lib/server/recognize.js#L720)

## Update - 2026-04-08 - Local Dev Flow and Env Behavior

Status:

- Local Vercel project was linked to a new Vercel project named `gmap-reivew-salon`.
- `package.json` was changed so local dev uses:
  - `npm run dev:vercel`
  - not `npm run dev`
- Reason:
  - `npm run dev` originally called `vercel dev`
  - Vercel then tried to use the project's own dev command again
  - that caused recursive invocation

Important local-dev command:

```bash
cd "/path/to/gmap-reivew-salon"
set -a
source .env.local
set +a
npm run dev:vercel
```

Reason:

- In this environment, `vercel dev` did not reliably pick up `.env.local` for runtime requests.
- Explicitly exporting `.env.local` before launch fixed runtime access to:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`

Key fix already applied:

- `OPENAI_API_KEY` is no longer globally required for `bootstrap`.
- `bootstrap` now works without blocking on OpenAI.
- OpenAI key is required only when OpenAI-backed features are called.
- Relevant files:
  - [lib/server/env.js](lib/server/env.js)
  - [lib/server/openai.js](lib/server/openai.js)

Verified API:

```bash
curl -s "http://localhost:3000/api/stores/angel-tips-garwood/bootstrap"
```

Verified returned:

- store data
- 28 staff entries
- published `menuSnapshot`

## Update - 2026-04-08 - Supabase Setup Completed

Status:

- Shared existing Supabase project instead of creating a new one.
- Inserted Angel Tips store record.
- Added `review_keywords`.
- Added `store_staff` table.
- Seeded 28 staff names.
- Seeded published menu snapshot version `1`.

Store identity:

- Brand: `Angel Tips Nail Spa`
- Slug: `angel-tips-garwood`
- Google review URL: `https://maps.app.goo.gl/QgrQK51pSCoWfy5v7`

SQL files used:

- [sql/001_schema.sql](sql/001_schema.sql)
- [sql/002_seed_store_example.sql](sql/002_seed_store_example.sql)
- [sql/003_add_store_review_keywords.sql](sql/003_add_store_review_keywords.sql)
- [sql/004_seed_store_staff.sql](sql/004_seed_store_staff.sql)

Menu seed command used:

```bash
STORE_SLUG=angel-tips-garwood MENU_VERSION=1 MENU_FILE=./menu.json SOURCE_NOTE="Angel Tips initial salon catalog" npm run seed:menu
```

Current store data model:

- `stores`: store profile and review keywords
- `store_menu_snapshots`: published salon service catalog
- `store_staff`: staff directory for dropdown selection
- `scan_events`: recognition telemetry

Important architectural decision:

- `staff` is intentionally a separate table, linked by `store_id`.
- This is correct because one store has many staff.
- It supports sorting, activation/deactivation, future staff-level filtering, and multiple stores.

## Update - 2026-04-08 - Salon Fork Created from GmapFasterReview

Status:

- This repo was built as a salon adaptation of the sibling reference project `../GmapFasterReview`.
- Frontend, backend shape, and Supabase model were inherited, then adapted to salon review generation.

Major code changes already done:

- Brand and store configuration changed to Angel Tips Nail Spa.
- Review generation prompts changed from restaurant semantics to salon semantics.
- Receipt recognition was adapted to salon services.
- Staff mention UI was enabled.
- Staff input is now a database-backed dropdown instead of free text.
- Salon service catalog was generated from the provided Angel Tips configuration JSON.
- Theme was moved away from restaurant styling toward a softer salon look.

High-value files:

- Frontend:
  - [index.html](index.html)
  - [app.js](app.js)
  - [styles.css](styles.css)
  - [config.js](config.js)
  - [menu.json](menu.json)
- Backend:
  - [api/stores/[slug]/bootstrap.js](api/stores/[slug]/bootstrap.js)
  - [api/stores/[slug]/recognize.js](api/stores/[slug]/recognize.js)
  - [api/stores/[slug]/reviews.js](api/stores/[slug]/reviews.js)
  - [lib/server/store-repo.js](lib/server/store-repo.js)
  - [lib/server/recognize.js](lib/server/recognize.js)
  - [lib/server/reviews.js](lib/server/reviews.js)

## Stable Reference

Architecture:

- Frontend: static `index.html` + `app.js` + `styles.css`
- Backend: Vercel Functions under `api/stores/[slug]/*`
- Data: shared Supabase

Required env vars:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `TAVUS_API_KEY`
- `PIPECAT_BACKEND_URL`

Git / repo notes:

- Current branch is `main`.
- This repository started effectively as a fresh repo with no prior commits before the current work.
- `.env.local` and `.vercel` are ignored and must not be committed.
- Ryan / Tavus secrets must stay in `.env.local` or deployment environment variables, never in tracked docs.
