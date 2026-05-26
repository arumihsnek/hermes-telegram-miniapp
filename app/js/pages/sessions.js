/**
 * Sessions page — session list with filter checkboxes, type badges,
 * status indicators, inline rename, and formatted message detail view.
 */
const sessionsPage = {
  _filters: { ...CONFIG.sessionFilters },
  _allSessions: [],

  async handler({ content, title, backBtn }) {
    title.textContent = 'Sessions';
    backBtn.classList.add('hidden');

    try {
      await this._loadWithFilters();
      this._render(content);
    } catch (err) {
      content.innerHTML = '<div class="error">Failed to load sessions: ' + this._escape(err.message) + '</div>';
    }
  },

  // Build ?source= param from active filters, then fetch
  async _loadWithFilters() {
    const included = [];
    if (!this._filters.cron) included.push('cron');
    if (!this._filters.background) included.push('background');
    if (!this._filters.kanban) included.push('kanban');
    if (!this._filters.messaging) {
      included.push('telegram', 'discord', 'messaging');
    }
    // Always include these other sources (webui, api_server, cli, etc.)
    let url = '/sessions?limit=100';
    if (included.length > 0) {
      url += '&source=' + included.join(',');
    }
    const data = await API.get(url);
    this._allSessions = data.sessions || [];
    this._totalCount = data.total || 0;
  },

  _render(container) {
    // Only client-side filter remaining: 'untitled'
    const filtered = this._allSessions.filter(s => {
      if (this._filters.untitled && !s.title) return false;
      return true;
    });

    container.innerHTML = `
      <div class="sessions-page">
        <div class="sessions-filters">
          ${this._filterCheckbox('cron', 'Crones')}
          ${this._filterCheckbox('background', 'Background')}
          ${this._filterCheckbox('kanban', 'Kanban')}
          ${this._filterCheckbox('messaging', 'Mensajería')}
          ${this._filterCheckbox('untitled', 'Sin título')}
        </div>
        <div class="sessions-list">
          ${filtered.length === 0
            ? '<div class="empty-state"><div class="icon">💬</div><p>No sessions match the current filters</p></div>'
            : filtered.map(s => this._sessionCard(s)).join('')}
        </div>
      </div>`;

    // Bind filter toggles
    container.querySelectorAll('.sessions-filters input').forEach(input => {
      input.addEventListener('change', async (e) => {
        this._filters[e.target.dataset.key] = !e.target.checked;
        await this._loadWithFilters();
        this._render(container);
      });
    });
  },

  _filterCheckbox(key, label) {
    const checked = !this._filters[key]; // checked = show
    return `<label class="${checked ? 'active-filter' : ''}">
      <input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}>
      ${label}
    </label>`;
  },

  // Removed _getFilteredSessions — now server-side via ?source= param

  _sessionCard(s) {
    const source = (s.source || '').toLowerCase();
    const badge = this._sourceBadge(source);
    const status = this._sessionStatus(s);

      return `
      <div class="card session-card" onclick="sessionsPage._openSession('${sessionsPage._escape(s.id)}')">
        <div class="session-title">${sessionsPage._escape(s.title || 'session ' + (s.id || '').substring(0, 16))}
          <span class="session-badge session-badge-${badge.cls}">${badge.label}</span>
        </div>
        <div class="session-meta">
          <span class="session-status session-status-${status.cls}">
            <span class="session-status-dot"></span>${status.label}
          </span>
          <span>·</span>
          <span>💬 ${s.message_count || 0}</span>
          <span>·</span>
          <span>${sessionsPage._formatDate(s.started_at || s.ended_at)}</span>
        </div>
        <button class="tg-button" style="margin-top:6px;padding:4px 8px;font-size:11px;width:auto" onclick="event.stopPropagation();sessionsPage._renameSessionPrompt('${sessionsPage._escape(s.id)}', '${sessionsPage._escape(s.title || '')}')">✏️ Rename</button>
      </div>`;
  },

  _sourceBadge(source) {
    const map = {
      cron: { cls: 'cron', label: 'CRON' },
      kanban: { cls: 'kanban', label: 'KANBAN' },
      board: { cls: 'kanban', label: 'KANBAN' },
      telegram: { cls: 'msg', label: 'MSG' },
      discord: { cls: 'msg', label: 'MSG' },
      messaging: { cls: 'msg', label: 'MSG' },
      background: { cls: 'bg', label: 'BG' },
      fork: { cls: 'fork', label: 'FORK' },
    };
    for (const [key, val] of Object.entries(map)) {
      if (source.includes(key)) return val;
    }
    return { cls: 'default', label: 'SES' };
  },

  _sessionStatus(s) {
    if (s.end_reason === 'error' || s.end_reason === 'interrupted') return { cls: 'error', label: s.end_reason };
    if (!s.ended_at) return { cls: 'running', label: 'Working' };
    return { cls: 'finish', label: 'Done' };
  },

  async _openSession(sessionId) {
    Router.navigate('/sessions/' + sessionId);
  },

  async _renameSessionPrompt(sessionId, currentTitle) {
    const newTitle = prompt('Rename session:', currentTitle);
    if (newTitle === null) return; // cancelled
    try {
      await API.patch('/sessions/' + sessionId, { title: newTitle.trim() || null });
      TG.haptic('success');
      // Refresh the current view
      Router.navigate('/sessions', true);
    } catch (err) {
      TG.showAlert('Failed to rename: ' + err.message);
    }
  },

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  _formatDate(dateStr) {
    try {
      if (!dateStr) return '';
      const d = typeof dateStr === 'number' ? new Date(dateStr * 1000) : new Date(dateStr);
      if (Number.isNaN(d.getTime())) return '';
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
      return d.toLocaleDateString();
    } catch(e) { return ''; }
  },
};

// Session detail sub-route
Router.register('/sessions/:sessionId', async ({ content, title, backBtn, params }) => {
  title.textContent = 'Session';
  backBtn.classList.remove('hidden');

  try {
    const { session, messages } = await API.get('/sessions/' + params.sessionId);
    title.textContent = session.title || 'Session';

    // Rename button in detail header
    const renameBtn = `<button class="tg-button" style="margin-bottom:12px;padding:6px 12px;font-size:12px;width:auto" onclick="sessionsPage._renameSessionPrompt('${params.sessionId}', '${sessionsPage._escape(session.title || '')}')">✏️ Rename this session</button>`;

    content.innerHTML = `
      <div class="session-detail" id="session-messages">
        ${renameBtn}
        ${(messages || []).map(msg => {
          const role = msg.role || 'user';
          const isUser = role === 'user';
          const isTool = role === 'tool' || msg.tool_name;
          const isAssistant = role === 'assistant';

          let contentClass = 'message message-' + (isTool ? 'tool' : (isUser ? 'user' : 'assistant'));

          let formattedContent = '';
          if (isTool && typeof msg.content === 'string') {
            // Tool calls: show just the command/name, collapse details
            const toolName = msg.tool_name || 'tool';
            const preview = msg.content.substring(0, 200);
            formattedContent = `<span class="message-tool-name">🔧 ${toolName}</span>\n${sessionsPage._escape(preview)}${msg.content.length > 200 ? '...' : ''}`;
          } else if (typeof msg.content === 'object' && msg.content !== null) {
            formattedContent = sessionsPage._escape(JSON.stringify(msg.content, null, 2));
          } else {
            formattedContent = sessionsPage._escape(String(msg.content || ''));
          }

          return `
            <div class="message ${contentClass}">
              <div class="message-role">${isUser ? '👤 You' : (isTool ? '🔧 Tool' : '🤖 HERMES')}</div>
              <div class="message-content">${formattedContent}</div>
              <div class="message-time">${sessionsPage._formatDate(msg.timestamp || msg.created_at)}</div>
            </div>`;
        }).join('')}
        ${(messages || []).length === 0 ? '<div class="empty-state"><p>No messages in this session</p></div>' : ''}
      </div>`;

    const msgContainer = document.getElementById('session-messages');
    if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;

  } catch (err) {
    content.innerHTML = '<div class="error">Failed to load session: ' + sessionsPage._escape(err.message) + '</div>';
  }
});

Router.register('/sessions', sessionsPage.handler.bind(sessionsPage));
