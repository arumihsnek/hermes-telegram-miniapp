/**
 * HERMES Mini App — SPA Router
 * Hash-based client-side router with parameterized routes,
 * navigation history, back button integration, loading/error states.
 */
const Router = {
  routes: [],
  history: [],
  currentRoute: null,
  _transitioning: false,

  // Register a route handler
  // path can include :param segments, e.g. "/kanban/:boardId"
  // handler({ content, title, backBtn, params, query, path }) => void
  register(path, handler, options = {}) {
    const paramNames = [];
    const pattern = path.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp('^' + pattern + '$');
    this.routes.push({ path, regex, paramNames, handler, options });
  },

  // Navigate to a path
  navigate(path, replace = false) {
    if (this._transitioning) return;
    if (replace && this.history.length > 0) {
      this.history.pop();
    } else if (this.currentRoute && !replace) {
      this.history.push(this.currentRoute);
    }
    window.location.hash = path;
  },

  canGoBack() {
    return this.history.length > 0;
  },

  goBack() {
    if (this.history.length > 0) {
      const previous = this.history.pop();
      this.navigate(previous, true);
    }
  },

  // Get current path from hash, normalizing malformed URLs
  _getPath() {
    let path = window.location.hash.slice(1) || '';
    // Normalize: if path is / or query-string-like (tgWebAppData=...), default to /kanban
    if (!path || path === '/') {
      path = '/kanban';
    } else if (path.includes('=') && !path.startsWith('/')) {
      path = '/kanban';
    }
    const [cleanPath, query] = path.split('?');
    return { path: cleanPath, query };
  },

  // Match a path against registered routes
  _matchRoute(path) {
    for (const route of this.routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        return { handler: route.handler, params, options: route.options };
      }
    }
    return null;
  },

  async _handleRoute() {
    if (this._transitioning) return;
    this._transitioning = true;

    const { path, query } = this._getPath();
    const matched = this._matchRoute(path);
    const content = document.getElementById('app-content');
    const title = document.getElementById('page-title');
    const backBtn = document.getElementById('btn-back');
    const navButtons = document.querySelectorAll('#bottom-nav button');

    // Show loading state
    content.innerHTML = '<div class="loading">Loading...</div>';

    // Update bottom nav active state
    navButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.route === path);
    });

    // Update back button
    if (this.history.length > 0 || matched?.options?.showBack) {
      backBtn.classList.remove('hidden');
    } else {
      backBtn.classList.add('hidden');
    }

    // Handle redirect routes
    if (matched?.options?.redirect) {
      window.location.href = matched.options.redirect;
      this._transitioning = false;
      return;
    }

    if (!matched) {
      content.innerHTML = `<div class="error">
        <h2>404</h2>
        <p>Page not found: ${path}</p>
        <button class="tg-button" onclick="Router.navigate('/kanban')">Go to Kanban</button>
      </div>`;
      this._transitioning = false;
      return;
    }

    this.currentRoute = path;

    try {
      await matched.handler({
        content,
        title,
        backBtn,
        params: matched.params || {},
        query: query ? Object.fromEntries(new URLSearchParams(query)) : {},
        path,
      });
    } catch (err) {
      console.error('Route error:', path, err);
      content.innerHTML = `<div class="error">
        <h2>Error</h2>
        <p>${err.message || 'Something went wrong'}</p>
        <button class="tg-button" onclick="Router.navigate(window.location.hash.slice(1) || '/kanban')">Retry</button>
      </div>`;
    }

    this._transitioning = false;
  },

  // Default fallback: empty path redirects to /kanban
  // (implemented via _getPath normalization above)

  init() {
    window.addEventListener('hashchange', () => this._handleRoute());

    document.querySelectorAll('#bottom-nav button[data-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        const route = btn.dataset.route;
        if (route && route !== window.location.hash.slice(1)) {
          this.navigate(route);
        }
      });
    });

    document.getElementById('btn-back').addEventListener('click', () => {
      this.goBack();
    });

    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.onClick(() => {
        if (this.canGoBack()) {
          this.goBack();
        }
      });
    }

    window.addEventListener('popstate', () => {
      this._handleRoute();
    });

    this._handleRoute();
  },
};
