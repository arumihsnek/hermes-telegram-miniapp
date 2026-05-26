/**
 * Minimal markdown renderer for session messages.
 * Handles: code blocks, inline code, bold, italic, headers, lists, blockquotes.
 * No external dependencies.
 */
const Markdown = {
  render(text) {
    if (!text) return '';
    let s = text;

    // Fenced code blocks (``` ... ```)
    s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const cls = lang ? ` class="lang-${lang}"` : '';
      return `<pre${cls}><code>${this._esc(code.replace(/\n$/, ''))}</code></pre>`;
    });

    // Split on <pre> so we don't process markdown inside code blocks
    const parts = s.split(/(<pre[\s\S]*?<\/pre>)/);
    return parts.map((p, i) => i % 2 === 1 ? p : this._inline(p)).join('');
  },

  _inline(s) {
    // Escape HTML (outside pre blocks)
    s = this._esc(s);

    // Inline code
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Headers
    s = s.replace(/^######\s(.+)$/gm, '<strong>$1</strong>');
    s = s.replace(/^#{1,5}\s(.+)$/gm, (_, t) => `<strong>${t}</strong>`);

    // Bold + italic (order matters)
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^\s*][^*]*?[^\s*])\*/g, '<em>$1</em>');

    // Blockquotes
    s = s.replace(/^&gt;\s?(.*)$/gm, '<span class="md-blockquote">$1</span>');

    // Unordered lists
    s = s.replace(/((?:^[-*+]\s.+\n?)+)/gm, match => {
      const items = match.trim().split('\n').map(l => `<li>${l.replace(/^[-*+]\s/, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    });

    // Ordered lists
    s = s.replace(/((?:^\d+\.\s.+\n?)+)/gm, match => {
      const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s/, '')}</li>`).join('');
      return `<ol>${items}</ol>`;
    });

    // Horizontal rule
    s = s.replace(/^---+$/gm, '<hr>');

    // Paragraphs: double newline → break
    s = s.replace(/\n{2,}/g, '<br><br>');
    s = s.replace(/\n/g, '<br>');

    return s;
  },

  _esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
};
