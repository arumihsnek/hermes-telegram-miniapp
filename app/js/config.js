// HERMES Mini App configuration
const CONFIG = {
  // API version for cache-busting
  version: 6,
  // Max items per page in listing views
  pageSize: 100,
  // Session source filter defaults (false = show, true = hide)
  // true = hidden by default (has its own tab)
  sessionFilters: {
    cron: true,
    background: true,
    kanban: false,
    messaging: false,
    untitled: false,
  },
};
