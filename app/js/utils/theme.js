// Telegram theme color mapping
const Theme = {
  apply(params) {
    if (!params) return;
    const root = document.documentElement;
    const map = {
      bg_color: '--tg-theme-bg-color',
      text_color: '--tg-theme-text-color',
      hint_color: '--tg-theme-hint-color',
      link_color: '--tg-theme-link-color',
      button_color: '--tg-theme-button-color',
      button_text_color: '--tg-theme-button-text-color',
      secondary_bg_color: '--tg-theme-secondary-bg-color',
      header_bg_color: '--tg-theme-header-bg-color',
      accent_text_color: '--tg-theme-accent-text-color',
      section_bg_color: '--tg-theme-section-bg-color',
      section_header_text_color: '--tg-theme-section-header-text-color',
      subtitle_text_color: '--tg-theme-subtitle-text-color',
      destructive_text_color: '--tg-theme-destructive-text-color',
      section_separator_color: '--tg-theme-section-separator-color',
      bottom_bar_bg_color: '--tg-theme-bottom-bar-bg-color',
    };
    for (const [key, cssVar] of Object.entries(map)) {
      if (params[key]) {
        root.style.setProperty(cssVar, params[key]);
      }
    }
  },
};
