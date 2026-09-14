# 0.11.4 — cyclic staff schedules

Employees can use a weekly schedule or a cycle of N work days followed by M days off. CRM offers 2/2, 2/4, 3/3, 4/2 and custom cycles (each count is an integer from 1 to 366). The anchor date is the first work day; before it there are no cyclic shifts. Each work day repeats 1–8 intervals, including overnight shifts.

Weekly data is retained when switching to cyclic mode. Saved cycle settings are retained when switching back. Calendar-date exceptions and holidays override either mode, including spillover from the previous night's shift. Existing documents without `mode` remain weekly.

The server resolves cyclic shifts for both availability and booking validation. Optional staff never gates a free room slot. Mini App selects the recommended working, qualified employee initially; the client can switch or clear it. A null staff ID now remains unassigned instead of silently assigning the first candidate. Required staff still requires a working, qualified employee. Services with `none` do not use staff. Existing studio-wide locks and conflict checks remain in place: there is one physical booking space.

## Migration

`supabase/migrations/20260914083041_cyclic_staff_schedules.sql`

Adds a private day resolver and replaces schedule validation, on-duty evaluation and the v4 booking function. No tables, stored schedules, bookings or permissions on public endpoints are removed. The new helper has no public/anon/authenticated execution grant. Apply this migration before deploying the CRM UI. Existing schedule RPC signatures and optimistic version checks remain compatible.

Example schedule:

```json
{
  "mode": "cyclic",
  "weekly": {},
  "exceptions": {"2030-01-05": []},
  "cycle": {
    "workDays": 2,
    "offDays": 4,
    "startDate": "2030-01-02",
    "intervals": [{"start": "22:00", "end": "02:00"}]
  }
}
```

## Validation

- Existing Mini App tests: 24 passed.
- Existing API tests, including cyclic schedule RPC payload: 31 passed.
- All five legacy CRM test files passed (data, finance, hourly pricing, notifications, settings).
- Full migration chain executed using PGlite 0.3.14, the project's CI engine. SQL tests cover presets/custom boundaries, dates before the anchor, leap/year transitions, breaks, overnight shifts, overrides, invalid inputs, saved profile roundtrip, qualification, staff modes, assignment, retries, shared room conflicts, RLS and grants.
- CRM browser contract passed at 390 and 1100 px: presets, custom cycle, overnight intervals, holidays, save/reopen, switching back without losing schedules, cancel and overflow checks.
- Mini App browser flow passed at 390 and 900 px: recommended employee, switching, clearing, booking, server price, history, cancellation and auth recovery. Browser HTTP writes are mocked.
- CRM integration syntax checks and changed runtime script syntax checks passed.

CI now also runs the legacy CRM tests and both browser contracts. Local browser verification uses Edge; CI uses Chromium. The SQL fixture intentionally mocks legacy password hashing because PGlite does not provide pgcrypto; production authentication cryptography is outside this test.

## Changed files

- `.github/workflows/tests.yml`
- `api/crm-auth.js`
- `apps/miniapp/app.js`
- `apps/miniapp/tests/browser.cjs`
- `crm-staff-schedule.js`
- `supabase/migrations/20260914083041_cyclic_staff_schedules.sql`
- `supabase/tests/staff-schedule.test.cjs`
- `tests/api/crm-auth.test.cjs`
- `tests/staff-schedule-browser.cjs`
- `docs/PATCH-0.11.4.md`

Production migration and deployment are separate release steps. This patch does not retroactively change existing booking assignments.
