// Dashboard embed + WebUI external redirect
(function () {
  'use strict';

  const DASHBOARD_EMBED_URL = 'https://dashboard.hermesinthenight.duckdns.org/kanban?embed=1';
  const WEBUI_URL = 'https://cloudinthenight.duckdns.org/webui/';

  Router.register('/dashboard', async ({ content, title, backBtn }) => {
    title.textContent = 'dashboard';
    backBtn.classList.add('hidden');
    document.body.classList.add('fullscreen-page');
    document.querySelector('.app-shell')?.classList.add('fullscreen-page');

    content.innerHTML = `
      <div class="iframe-page dashboard-embed-page">
        <iframe
          class="app-embed-frame"
          src="${DASHBOARD_EMBED_URL}"
          title="Hermes Dashboard Kanban"
          loading="eager"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="clipboard-read; clipboard-write; cross-origin-isolated"
        ></iframe>
      </div>
    `;
  });

  Router.register('/webui', async ({ content, title, backBtn }) => {
    title.textContent = 'webui';
    backBtn.classList.add('hidden');
    content.innerHTML = `
      <div class="redirect-page">
        <div class="empty-state">
          <div class="icon">&#128279;</div>
          <p>Open in external browser</p>
          <a href="${WEBUI_URL}" target="_blank" rel="noopener" class="tg-button" style="display:inline-block;margin-top:12px;text-decoration:none">
            Open webui
          </a>
        </div>
      </div>
    `;
  });
})();
