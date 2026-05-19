# GA4 Event Tracking Spec

## Scope

This document defines GA4 events currently instrumented in `app.js` and the shared parameters attached to each event.

## Shared Parameters

All custom events are sent via `trackEvent()` with `analyticsParams()`, which attaches:

- `page_type`: current app route key (example: `store`, `price`, `leaderboard-list`)
- `locale`: UI language (`en` or `zh`)
- `store_slug`: store slug from route when present

`page_view` also includes:

- `page_path`
- `page_title`

## Event Map

| Event Name | Trigger | Extra Params |
| --- | --- | --- |
| `page_view` | Route render in SPA (`renderRouteView`) | `page_path`, `page_title` |
| `language_toggled` | Language switch action | - |
| `upload_picker_opened` | Click upload/retake buttons | `source` (`upload_btn`, `retake_btn`, `retake_inline_btn`) |
| `receipt_selected` | Receipt file input changed | `has_file`, `file_type` |
| `write_review_clicked` | Click "write own review" CTA | - |
| `reviews_regenerate_clicked` | Click "another set" button | - |
| `visit_sheet_opened` | Open visit context sheet from summary button | `source` |
| `visit_tier_confirmed` | Confirm visit tier in sheet | `visit_tier`, `changed` |
| `service_praise_applied` | Apply service praise options | `staff_label`, `praise_key` |
| `service_praise_cleared` | Clear service praise options | - |
| `manual_review_link_clicked` | Click manual fallback review link | `has_attempted_auto_open` |
| `session_reset` | Reset review-writing session | `keep_language` |
| `pricing_summary_opened` | Open pricing summary modal | - |
| `pricing_summary_closed` | Close pricing summary modal | - |
| `checkout_config_missing` | Checkout blocked by missing config | - |
| `checkout_started` | User starts checkout | - |
| `checkout_redirect` | Checkout URL resolved; redirect begins | - |
| `checkout_failed` | Checkout API flow failed | `message` |

## Recommended GA4 Setup

- Mark `checkout_started` as a key event (conversion).
- Mark `checkout_redirect` as a key event if redirect is your checkout handoff KPI.
- Register custom dimensions for:
  - `page_type`
  - `locale`
  - `store_slug`
  - `visit_tier`
  - `source`

## Notes

- Instrumentation is no-op when `window.gtag` is unavailable.
- `page_view` is deduplicated by pathname + search to avoid repeated firing during re-renders.
