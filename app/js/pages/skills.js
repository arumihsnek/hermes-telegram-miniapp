/**
 * Skills page — embedded iframe from native dashboard
 */
const skillsPage = {
  async handler({ content, title, backBtn }) {
    title.textContent = 'Skills';
    backBtn.classList.add('hidden');
    document.body.classList.add('fullscreen-page');
    document.querySelector('.app-shell')?.classList.add('fullscreen-page');

    content.innerHTML = `
      <div class="iframe-page">
        <iframe
          class="app-embed-frame"
          src="https://dashboard.hermesinthenight.duckdns.org/skills"
          title="Skills"
          loading="eager"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="clipboard-read; clipboard-write; cross-origin-isolated">
        </iframe>
      </div>
    `;

    // Inject CSS to hide dashboard header
    setTimeout(() => {
      const iframe = document.querySelector('.app-embed-frame');
      if (iframe && iframe.contentDocument) {
        const style = iframe.contentDocument.createElement('style');
        style.textContent = `
          body > div > div > header { display: none !important; }
          body > div > div > nav { display: none !important; }
        `;
        iframe.contentDocument.head.appendChild(style);
      }
    }, 500);
  }
};

Router.register('/skills', skillsPage.handler.bind(skillsPage));
