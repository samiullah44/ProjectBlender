# Admin Analytics Bugs — Implementation Tasks

## Tasks

- [x] 1. Fix Bug 2: Add "Other" fallback in detectDevice
  - [x] 1.1 Add `else { info.os = 'Other'; }` after the final OS detection branch in `backend/main/src/utils/deviceDetect.ts`
  - [x] 1.2 Add `else { info.browser = 'Other'; }` after the final browser detection branch in `backend/main/src/utils/deviceDetect.ts`

- [x] 2. Fix Bug 3: Return null for local IPs in resolveGeoFromIp
  - [x] 2.1 Replace the synthetic dev object return with `return null;` for local/private IPs in `backend/main/src/utils/geoIp.ts`

- [x] 3. Fix Bug 3: Exclude dev/null country entries from demographics aggregation
  - [x] 3.1 Add a `$match` exclusion for `geo.country` null, `"Development Env"`, and `"DEV"` in the `advancedGeoAggregation` pipeline inside `getReportData` in `backend/main/src/controllers/AnalyticsController.ts`

- [x] 4. Fix Bug 1: Remove direct fetchReport calls from sidebar onClick handlers
  - [x] 4.1 Remove `fetchReport('dimensions')` from the Technology sidebar item `onClick` in `frontend/src/pages/admin/Analytics.tsx` — leave only `setActiveReport('tech')`
  - [x] 4.2 Remove `fetchReport('engagement')` from the Events sidebar item `onClick` — leave only `setActiveReport('events')`
  - [x] 4.3 Remove `fetchReport('flow')` from the Flow sidebar item `onClick` — leave only `setActiveReport('flow')`

- [x] 5. Fix Bug 1: Remove direct fetchReport/fetchUsers calls from updateFilter
  - [x] 5.1 Remove the `if (activeReport === 'users') { fetchUsers(1); } else if (...) { fetchReport(reqType); }` block from `updateFilter` in `frontend/src/pages/admin/Analytics.tsx`

- [x] 6. Fix Bug 1: Ensure useEffect handles all report type mappings
  - [x] 6.1 Add `'tech'` → `'dimensions'` and `'events'` → `'engagement'` mappings to the `useEffect` report-type switch in `Analytics.tsx` so the reactive effect correctly fetches when these reports become active
