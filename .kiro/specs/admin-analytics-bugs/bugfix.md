# Bugfix Requirements Document

## Introduction

Three bugs affect the admin analytics page (`/admin/analytics`). Together they degrade the reliability and usefulness of the analytics dashboard for administrators:

1. **Filter state not updating without page refresh** — Clicking sidebar navigation items (e.g. "Events", "Technology") or changing filter dropdowns does not consistently re-fetch data; the displayed content stays stale until the page is refreshed or the item is clicked again.

2. **"Unknown" values in Technology breakdown** — The OS and Browser columns in the Technology section show `Unknown` for some users because `detectDevice` leaves `os` and `browser` undefined when the user-agent doesn't match any pattern, and the frontend renders `undefined` as the string `"Unknown"`.

3. **Demographics showing "Development Env" instead of country name** — The country column in the Demographics report shows `"Development Env"` because `resolveGeoFromIp` returns a hard-coded development label for local/private IP addresses, and this label is stored in the database and surfaced directly to the UI without any filtering or display override.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 – Filter state not updating**

1.1 WHEN the user clicks a sidebar item that calls both `setActiveReport` and `fetchReport` directly (e.g. "Events", "Technology", "Flow") THEN the system fetches data using the stale `filters` state captured in the `useCallback` closure at the time of the click, ignoring any filter changes made since the last render.

1.2 WHEN the user changes a filter dropdown value via `updateFilter` THEN the system calls `fetchReport` immediately inside `updateFilter` using the old `filters` value (before the `setFilters` state update has been applied), so the request is sent with the previous filter parameters.

1.3 WHEN `activeReport` changes to a report type that is handled by the `useEffect` dependency on `[activeReport, fetchReport, fetchUsers, filters]` THEN the system does not re-fetch for sidebar items that bypass the `useEffect` by calling `fetchReport` directly in their `onClick` handler, causing the `useEffect` to not fire a second time for the same `activeReport` value.

**Bug 2 – "Unknown" values in Technology breakdown**

1.4 WHEN a user's user-agent string does not match any OS pattern in `detectDevice` THEN the system stores `undefined` for `device.os` in the `AnalyticsUser` document, and the Technology report returns `{ _id: null, count: N }` for that group.

1.5 WHEN a user's user-agent string does not match any browser pattern in `detectDevice` THEN the system stores `undefined` for `device.browser` in the `AnalyticsUser` document, and the Technology report returns `{ _id: null, count: N }` for that group.

1.6 WHEN the Technology breakdown renders a group with `_id: null` THEN the system displays the string `"Unknown"` as the label (via `item._id || 'Unknown'`), providing no actionable information about the unrecognised user-agents.

**Bug 3 – Demographics showing "Development Env"**

1.7 WHEN a visitor accesses the site from a local or private IP address (e.g. `127.0.0.1`, `::1`, `192.168.x.x`, `10.x.x.x`) THEN the system stores `{ country: 'Development Env', countryCode: 'DEV', city: 'Localhost' }` in the `AnalyticsUser` and `AnalyticsEvent` documents.

1.8 WHEN the Demographics report aggregates users by `geo.country` THEN the system includes the `"Development Env"` entry as if it were a real country, surfacing it in the country breakdown table alongside legitimate country names.

---

### Expected Behavior (Correct)

**Bug 1 – Filter state not updating**

2.1 WHEN the user clicks any sidebar item THEN the system SHALL update `activeReport` state and rely solely on the reactive `useEffect` (which depends on `activeReport` and `filters`) to trigger the correct data fetch, ensuring the latest filter values are always used.

2.2 WHEN the user changes a filter dropdown value THEN the system SHALL update `filters` state first and allow the `useEffect` (which depends on `filters`) to re-fetch data reactively, so the fetch always uses the newly applied filter values.

2.3 WHEN `activeReport` or `filters` changes THEN the system SHALL fetch data exactly once using the current values of both, with no duplicate or stale fetches caused by direct `fetchReport` calls in `onClick` handlers.

**Bug 2 – "Unknown" values in Technology breakdown**

2.4 WHEN a user's user-agent string does not match any OS pattern THEN the system SHALL store `"Other"` (or a similarly descriptive fallback string) for `device.os` instead of `undefined`, so the Technology report groups unrecognised OSes under a meaningful label.

2.5 WHEN a user's user-agent string does not match any browser pattern THEN the system SHALL store `"Other"` for `device.browser` instead of `undefined`, so the Technology report groups unrecognised browsers under a meaningful label.

2.6 WHEN the Technology breakdown renders a group THEN the system SHALL display the stored label directly without needing a `|| 'Unknown'` fallback, because all stored values SHALL be non-null strings.

**Bug 3 – Demographics showing "Development Env"**

2.7 WHEN a visitor accesses the site from a local or private IP address THEN the system SHALL return `null` from `resolveGeoFromIp` (or omit the geo fields) instead of storing a synthetic development label, so that no fake country entry is written to the database.

2.8 WHEN the Demographics report aggregates users by `geo.country` THEN the system SHALL exclude records where `geo.country` is `null`, `undefined`, `"Development Env"`, or `"DEV"`, so that only real country names appear in the breakdown table.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user navigates between sidebar items that do not require a report fetch (e.g. "Dashboard", "Realtime", "Users") THEN the system SHALL CONTINUE TO display the correct view without triggering unnecessary API calls.

3.2 WHEN a visitor accesses the site from a real public IP address THEN the system SHALL CONTINUE TO resolve and store accurate geo data (country, city, countryCode) via the `ip-api.com` lookup.

3.3 WHEN a user's user-agent string matches a known OS or browser pattern in `detectDevice` THEN the system SHALL CONTINUE TO store and display the correct OS and browser name (e.g. `"Windows"`, `"Chrome"`).

3.4 WHEN the user changes the date range filter on the Dashboard (snapshot) view THEN the system SHALL CONTINUE TO re-fetch the dashboard data with the new range applied.

3.5 WHEN the Technology report renders device type data (desktop/mobile/tablet) THEN the system SHALL CONTINUE TO display device type breakdowns correctly, as device type detection is unaffected by the OS/browser fallback fix.

3.6 WHEN the Demographics report is viewed with a `dimension` other than `Country` (e.g. City, Platform/Devices) THEN the system SHALL CONTINUE TO aggregate and display data correctly for those dimensions.
