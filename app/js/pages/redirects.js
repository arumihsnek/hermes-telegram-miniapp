// Redirect pages (Dashboard, WebUI — open as external links)
(function () {
  'use strict';

  const redirectUrl = {
    '/dashboard': 'https://hermes.cloudinthenight.duckdns.org/',
    '/webui': 'https://cloudinthenight.duckdns.org/webui/',
  };

  for (const [route, url] of Object.entries(redirectUrl)) {
    Router.register(route, async ({ content, title, backBtn }) => {
      title.textContent = route.slice(1);
      backBtn.classList.add('hidden');
      content.innerHTML = `
        <div class="redirect-page">
          <div class="empty-state">
            <div class="icon">&#128279;</div>
            <p>Open in external browser</p>
            <a href="${url}" target="_blank" rel="noopener" class="tg-button" style="display:inline-block;margin-top:12px;text-decoration:none">
              Open ${route.slice(1)}
            </a>
          </div>
        </div>
      `;
    });
  }
})();
