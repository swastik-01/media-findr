# AGBA Media Finder — Migration Progress

> **Rule:** Once a section is marked ✅ DONE, we do NOT touch it again.

---

## Phase 1: Backend API (100% AWS)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | `backend/requirements.txt` | ✅ DONE | fastapi, mangum, boto3, Pillow, python-jose, requests |
| 1.2 | `backend/auth.py` — Cognito token verification | ✅ DONE | JWT verification via Cognito JWKS, admin role check |
| 1.3 | `backend/db.py` — DynamoDB helpers | ✅ DONE | Users with is_admin, events, admin queries |
| 1.4 | `backend/main.py` — FastAPI multi-tenant API | ✅ DONE | User, event, search, and admin endpoints |

## Phase 2: Frontend Wiring (100% AWS)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | `src/integrations/aws/auth.ts` — Cognito Auth | ✅ DONE | Google Sign-In, email/password, JWT retrieval |
| 2.2 | `src/integrations/aws/api.ts` — API client | ✅ DONE | All endpoints including admin |
| 2.3 | `Register.tsx` — Cognito auth | ✅ DONE | Google + email/password via Amplify |
| 2.4 | `Dashboard.tsx` — Cognito auth | ✅ DONE | Real credits, event creation, upload |
| 2.5 | `Results.tsx` — real search | ✅ DONE | Selfie → Rekognition search → presigned URLs |
| 2.6 | `ImageLightbox.tsx` — real images | ✅ DONE | S3 presigned URLs, individual download |
| 2.7 | `Admin.tsx` — real admin dashboard | ✅ DONE | Role-gated, live stats, delete/reindex events |
| 2.8 | `App.tsx` — routes + admin | ✅ DONE | /admin route restored |

## Phase 3: Cleanup

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | `.env` — Cognito config | ✅ DONE | Firebase vars removed, Cognito vars added |
| 3.2 | `package.json` — aws-amplify | ✅ DONE | Replaced firebase, removed supabase/lovable |
| 3.3 | `vite.config.ts` — clean | ✅ DONE | No lovable-tagger |
| 3.4 | `AI_RULES.md` — updated | ✅ DONE | AWS Cognito + Backend references |
| 3.5 | `App.css` — emptied | ✅ DONE | Can be deleted |
| 3.6 | `firebase/client.ts` — no-op stub | ✅ DONE | Can be deleted |
| 3.7 | Delete `supabase/` | ✅ DONE | User deleted manually |
| 3.8 | Delete `src/integrations/supabase/` | ✅ DONE | User deleted manually |
| 3.9 | Delete `src/integrations/lovable/` | ✅ DONE | User deleted manually |

---

## AWS Setup Required

| Step | Details |
|------|---------|
| 1. Create Cognito User Pool | Region: `ap-south-1`, enable Google IdP, create app client |
| 2. Create DynamoDB tables | `agba-users` (PK: user_id), `agba-events` (PK: event_id, GSI: user_id-index) |
| 3. Create S3 bucket | `agba-event-images` in `ap-south-1` |
| 4. Update .env | Fill in `VITE_COGNITO_*`, `COGNITO_*`, and `ADMIN_USER_IDS` |
| 5. Run `npm install` | Sync frontend dependencies |
| 6. Delete cleanup files | `src/App.css`, `src/integrations/firebase/` |
| 7. Deploy backend | Lambda + API Gateway, update `VITE_AWS_API_URL` |

---

## Architecture Summary

```
Frontend (React/Vite)
  ├── Auth: AWS Cognito (aws-amplify)
  ├── API Client: src/integrations/aws/api.ts
  └── Routes: /, /register, /dashboard, /results, /admin, /pricing

Backend (FastAPI on Lambda)
  ├── Auth: Cognito JWT verification
  ├── Storage: S3 (agba-event-images) with category prefixes
  ├── AI: Rekognition (1 collection per event)
  ├── Database: DynamoDB (agba-users, agba-events)
  └── Admin: role-based, controlled via ADMIN_USER_IDS
```

---

## Phase 4: Enhancements (Rebranding & Pricing)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | `backend/db.py` — Restrict free credits | ✅ DONE | 0 credits for `.edu` and org custom domains |
| 4.2 | `Index.tsx` — Rebranding & Chatbot | ✅ DONE | Renamed to Media Findr, added lead capture chatbot |
| 4.3 | `Dashboard.tsx` — UI overhaul | ✅ DONE | Better visual cards, avatar, user info, clear credit display |
| 4.4 | `Pricing.tsx` — Custom pricing | ✅ DONE | Defined clear tiers + custom enterprise contact button |
| 4.5 | `Register.tsx` / `index.html` — Branding | ✅ DONE | "Powered by The AI Product Factory" branding applied |

---

## Phase 5: Razorpay, Fractional Credits & Admin UI

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | `backend/db.py` & `main.py` — Fractional Credits | ✅ DONE | Event creation is free. Deduction of `0.01` credits exactly per image uploaded instead of 1 flat credit. Decimals used to prevent float drift. |
| 5.2 | `backend/main.py` — Razorpay Backend | ✅ DONE | `razorpay` integration, `/payments/create-order`, `/payments/verify` |
| 5.3 | `src/pages/Pricing.tsx` — Razorpay Checkout | ✅ DONE | Native Razorpay modal launched on "Buy Credits" button, automated verification and redirection |
| 5.4 | `src/pages/Admin.tsx` — Users Tab | ✅ DONE | Added "Users" tab with data table for admin to track total spend, credits remaining, usage, and join dates |
| 5.5 | `src/pages/Dashboard.tsx` — UI Cleanup | ✅ DONE | Removed "Copy ID" button, fixed ImageUploadZone stretching, display credits up to 2 decimal places |

---

## Phase 6: Bug Fixes & Quality Improvements

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | **Dark mode persistence across pages** | ✅ DONE | Root cause: `ThemeToggle` initialized state from DOM class check (`classList.contains`) which runs before the `useEffect` that reads localStorage, causing every page navigation to flash light-mode first. **Fix:** (1) Added inline `<script>` in `index.html` that applies `dark` class from `localStorage` before React mounts, eliminating FOUC. (2) Rewrote `ThemeToggle.tsx` to initialize state from `localStorage` directly via `getInitialTheme()` helper, removing the racy second `useEffect`. |
| 6.2 | **Google Sign-In shows email initials instead of name** | ✅ DONE | Root cause: Cognito's Google IdP puts the user's name into `given_name`/`family_name` JWT claims, NOT the `name` claim. Both frontend (`auth.ts`) and backend (`auth.py`) only read `payload.name`, which was empty. **Fix:** (1) `auth.ts` `cognitoGetUserAttributes()` now reads `given_name`, `family_name`, and `name`, composing a proper display name. (2) `auth.py` `verify_cognito_token()` mirrors this logic server-side. (3) `db.py` `get_or_create_user()` now auto-updates the stored name if the DB has a blank/email-prefix name and a proper one is provided on subsequent logins. (4) `Dashboard.tsx` simplified to prefer `profile.name` (backend), then `attrs.name` (JWT), then email prefix. |
| 6.3 | **"Custom Event" type rejected by backend** | ✅ DONE | Root cause: Frontend defines 6 event types including "custom", but `db.py` `VALID_EVENT_TYPES` only had 5 (missing "custom"). Selecting "Custom Event" on the Dashboard would return HTTP 400. **Fix:** Added `"custom"` to `VALID_EVENT_TYPES` set. |
| 6.4 | **Stale Lovable/third-party meta tags** | ✅ DONE | Removed leftover `og:image` and `twitter:site` referencing `lovable.dev` from `index.html`. |
| 6.5 | **Stale docstring in `main.py`** | ✅ DONE | `/events/create` endpoint docstring still said "Deducts 1 credit". Updated to reflect current 0.01/image model. |
| 6.6 | **OAuth `profile` scope missing** | ✅ DONE | Root cause: `auth.ts` Cognito OAuth config had scopes `["openid", "email", "phone"]` — the `profile` scope was missing, so Google never sent `name`/`given_name`/`family_name` in the JWT at all. **Fix:** Changed to `["openid", "email", "profile"]`. **⚠️ Important:** The Cognito App Client in AWS Console must also have the `profile` scope allowed under "Allowed OAuth Scopes". |
| 6.7 | **Razorpay 500 error (`.env` spacing)** | ✅ DONE | Root cause: `.env` had `Razorpay_Api_Key = value` (spaces around `=`). Python's `os.getenv()` via uvicorn's `--env-file` may include the leading space, causing Razorpay auth to fail. **Fix:** (1) Removed spaces from `.env`. (2) Added `.strip()` to `os.getenv()` calls in `main.py` as safety. |
| 6.8 | **My Events dashboard** | ✅ DONE | Users now see a tab bar with "My Events" (default) and "New Event". My Events shows all past events with type icon, image/face counts, status badge, and a click-to-search action. Empty state shows a prompt to create the first event. |
| 6.9 | **Admin "Unknown" name display** | ✅ DONE | Changed Admin.tsx user table to show `email.split("@")[0]` instead of "Unknown" when name is empty — more informative for admins. |

---

## Technical Notes for Reviewers

### Credit System (Phase 5 + 6)
- **Event creation = FREE**. No credit is deducted on `/events/create`.
- **Image upload = 0.01 credits per image**. Deduction happens atomically in `/events/{event_id}/upload` AFTER the images are successfully uploaded to S3, so failed uploads aren't charged.
- **Precision:** All credit arithmetic uses `decimal.Decimal` in Python and DynamoDB stores as `Number`. Frontend displays `.toFixed(2)`.
- **Balance check:** Before upload, the backend verifies `user.credits >= 0.01 * len(files)`. Returns HTTP 402 with a clear message if insufficient.

### Payment Flow (Phase 5)
1. Frontend calls `POST /payments/create-order` with `{ amount: 499, credits: 3 }`.
2. Backend creates a Razorpay order and returns `{ id, amount, currency, key_id }`.
3. Frontend opens the Razorpay checkout modal using the returned `key_id` and `order.id`.
4. On successful payment, Razorpay calls the `handler` callback with `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.
5. Frontend sends these to `POST /payments/verify`. Backend verifies the signature via Razorpay SDK, then atomically adds credits and records `total_spent` in DynamoDB.

### Name Resolution Logic (Phase 6.2)
```
Priority (frontend): profile.name > JWT.name > JWT.given_name + family_name > email prefix
Priority (backend):  JWT.name > JWT.given_name + family_name > email prefix
DB auto-update:      If stored name is blank or matches email prefix, overwrite with better name on next login.
```

### Theme Persistence (Phase 6.1)
```
1. index.html inline <script>: reads localStorage('theme'), applies 'dark' class to <html> BEFORE React hydration
2. ThemeToggle.tsx: initializes useState from localStorage (matching the DOM state set in step 1)
3. On toggle: updates both DOM class and localStorage synchronously
```

### Files Modified in Phase 6
| File | What Changed |
|------|-------------|
| `index.html` | Added inline theme script, removed Lovable meta tags |
| `src/components/ThemeToggle.tsx` | Rewrote initialization to read localStorage directly, removed racy second useEffect |
| `src/integrations/aws/auth.ts` | `cognitoGetUserAttributes()` now extracts `given_name` + `family_name` from JWT |
| `backend/auth.py` | `verify_cognito_token()` now composes display name from `given_name`/`family_name` |
| `backend/db.py` | `get_or_create_user()` auto-updates stale names; added `"custom"` to `VALID_EVENT_TYPES` |
| `src/pages/Dashboard.tsx` | Simplified name display logic to prefer backend profile name |
| `backend/main.py` | Fixed stale docstring on `/events/create` |

---

## Phase 7: UI Consistency & Production Hardening

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | **Razorpay Receipt Length Error** | ✅ DONE | Razorpay strictly enforces a 40-character limit on the `receipt` field. Truncated the UUID portion and generated a short hex hash (e.g. `rcpt_{user_id_suffix}_{short_hex}`) in `main.py` to prevent HTTP 500 errors during order creation. |
| 7.2 | **BrandLogo & LeadChatbot Extraction** | ✅ DONE | Extracted inline SVG and Chatbot components from `Index.tsx` into shared reusable files (`BrandLogo.tsx` and `LeadChatbot.tsx`) to enforce UI consistency across all views. |
| 7.3 | **UI Consistency (Admin & Results)** | ✅ DONE | The global `BrandLogo` was missing from the Admin panel and Results page headers, leading to a "broken UI" feel when navigating away from the Dashboard. Replaced default lucide icons with `BrandLogo` across `Admin.tsx` and `Results.tsx`. |
| 7.4 | **Pricing Page Overhaul** | ✅ DONE | Integrated `BrandLogo`, replaced "Contact Us" with dynamic `LeadChatbot` scrolling, and added a comprehensive accordion FAQ to address billing and credit questions proactively. |
| 7.5 | **Strict Admin Credits** | ✅ DONE | Removed the backend logic in `db.py` that automatically granted 10 free credits to admins to ensure strict tracking and accurate billing states for all users. |

## Phase 8: Comprehensive Bug Fixes (Production Readiness)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8.1 | **Double Increment Fix** | ✅ DONE | Fixed `main.py` double incrementing of `guest_search_count` when Rekognition cache hits. |
| 8.2 | **Cache Count Reset Fix** | ✅ DONE | Fixed `db.py` `set_search_cache` to use `update_item` instead of `put_item` so that the search count isn't overwritten. |
| 8.3 | **Results Page Rewrite** | ✅ DONE | Results page now generates a persistent `guest_id` in localStorage, passes it on search, and gracefully handles HTTP 429 errors when the limit is exceeded. |
| 8.4 | **Dynamic DB Tables (No Hardcoding)** | ✅ DONE | `db.py` and `create_tables.py` now read table names from environment variables (`DYNAMODB_USERS_TABLE`, etc.) with safe defaults (`agba-users`, `agba-events`) preventing data loss. |
| 8.5 | **Event Expiry Exposure** | ✅ DONE | API endpoints `/user/events` and `/admin/events` now expose `expires_at` to the frontend. |
| 8.6 | **Dashboard Credit Check Fix** | ✅ DONE | Removed improper credit check on event creation in `Dashboard.tsx` (creation is free, uploads cost credits). |

---

## Phase 9: Admin Dashboard Enhancements & Lifecycle Cleanup

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.1 | **Dynamic Admin UI Rewrite** | ✅ DONE | Completely rewrote `Admin.tsx` to remove all hardcoded values. Data is populated entirely by AWS Lambda. |
| 9.2 | **System Configuration View** | ✅ DONE | Live AWS config (Region, Bucket, Auth provider) is fetched securely from the backend to display on the Admin dashboard. |
| 9.3 | **Cleanup Endpoint** | ✅ DONE | `DELETE /admin/cleanup-expired` implemented. Removes S3 files, Rekognition Collections, and DynamoDB data for expired events. |
| 9.4 | **System Statistics** | ✅ DONE | Real-time counts for images, faces, and users. |

---

## Phase 10: Frontend QR + Sharing (Dashboard Polish)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10.1 | **QR Code Integration** | ✅ DONE | Integrated `api.qrserver.com` directly into the Dashboard UI to avoid sandboxing/build errors with external libraries. |
| 10.2 | **Share Modal** | ✅ DONE | Added "Share" button in `Dashboard.tsx` event cards → opens modal. Modal has: QR code image and copyable link. |
| 10.3 | **Expiration Visibility** | ✅ DONE | Show `expires_at` date on event cards in Dashboard. |
| 10.4 | **Expired Status Guard** | ✅ DONE | Show `Expired` badge when event is past expiry; disable Share + Search buttons. |

---

## Phase 11: Guest Flow in Results

| # | Task | Status | Notes |
|---|------|--------|-------|
| 11.1 | **Guest Identification** | ✅ DONE | `Results.tsx` generates/retrieves `guest_id` from `localStorage` on mount and passes to `searchByImage`. |
| 11.2 | **Privacy-First Search** | ✅ DONE | Search is now fully anonymous. Removed name/email/phone capture forms. |
| 11.3 | **Rate Limit UX** | ✅ DONE | Handles HTTP 429 gracefully — shows "You've used all 3 searches for this event" message instead of generic error. |

---

## Phase 12: Privacy & Stability Cleanup (Hotfix)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12.1 | **Privacy Strip** | ✅ DONE | Deleted all guest lead collection, storage, and export features globally (Frontend & Backend). |
| 12.2 | **DB Table Dynamic Names** | ✅ DONE | Fixed `ResourceNotFoundException` by ensuring environment variables map to existing `Users`/`Events`/`SearchCache` tables. |
| 12.3 | **Media Findr Rebranding** | ✅ DONE | Finalized naming across all implementation plans and UI components. |
