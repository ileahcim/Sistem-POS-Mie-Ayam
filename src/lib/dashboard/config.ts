// Rolling window for every item/margin/channel breakdown on the dashboard
// (sections 3-5) — there's no date-range picker for these (only the omzet
// chart in section 2 has a switchable granularity, per the brief), so they
// all share one consistent, predictable window.
export const DASHBOARD_WINDOW_DAYS = 30;
