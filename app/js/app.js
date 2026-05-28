/**
 * HERMES Mini App — Application entry point
 * Route registration and Telegram WebApp SDK initialization.
 */
(function () {
  'use strict';

  console.log('[HERMES] Mini App loaded');

  // Telegram WebApp SDK initialization
  const webapp = window.Telegram && window.Telegram.WebApp;
  if (webapp) {
    webapp.ready();
    webapp.expand();
    console.log('[HERMES] Telegram WebApp SDK initialized');
    console.log('[HERMES] Platform:', webapp.platform);
    console.log('[HERMES] Theme:', webapp.colorScheme);

    // Apply Telegram theme colors
    if (typeof Theme !== 'undefined' && webapp.themeParams) {
      Theme.apply(webapp.themeParams);
    }

    // Enable closing confirmation
    if (webapp.enableClosingConfirmation) {
      webapp.enableClosingConfirmation();
    }

    // Disable vertical swipes to prevent accidental app close
    if (webapp.disableVerticalSwipes) {
      webapp.disableVerticalSwipes();
    }
  } else {
    console.log('[HERMES] Telegram WebApp SDK not available — running outside Telegram');
  }

  // Default route: / -> kanban
  Router.register('/', async ({ content, ...ctx }) => {
    Router.navigate('/kanban', true);
  });

  // Initialize Router
  Router.init();

  // Debug: log all hash changes
  window.addEventListener('hashchange', () => {
    console.log('[HERMES] Hash changed to:', window.location.hash);
    console.trace('[HERMES] Hash change trace');
  });

  // Post-init: apply theme if not already done
  if (webapp && webapp.themeParams && typeof Theme === 'undefined') {
    const root = document.documentElement;
    const mapping = {
      bg_color: '--tg-theme-bg-color',
      text_color: '--tg-theme-text-color',
      hint_color: '--tg-theme-hint-color',
      link_color: '--tg-theme-link-color',
      button_color: '--tg-theme-button-color',
      button_text_color: '--tg-theme-button-text-color',
      secondary_bg_color: '--tg-theme-secondary-bg-color',
    };
    for (const [key, cssVar] of Object.entries(mapping)) {
      if (webapp.themeParams[key]) {
        root.style.setProperty(cssVar, webapp.themeParams[key]);
      }
    }
  }

  // Listen for Telegram theme changes
  if (webapp) {
    webapp.onEvent('themeChanged', function () {
      console.log('[HERMES] Theme changed to:', webapp.colorScheme);
      if (typeof Theme !== 'undefined' && webapp.themeParams) {
        Theme.apply(webapp.themeParams);
      }
    });

    webapp.onEvent('viewportChanged', function () {
      const vh = webapp.viewportHeight || window.innerHeight;
      document.documentElement.style.setProperty('--tg-viewport-height', vh + 'px');
      document.documentElement.style.setProperty('--tg-viewport-stable-height', (webapp.viewportStableHeight || vh) + 'px');
    });
  }
})();
