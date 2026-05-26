/**
 * Agents page — background workers, delegate-task parent sessions, running kanban tasks.
 * bg_* sessions: standalone background agents (clickable → open session).
 * Parent sessions: sessions with active child delegates (expandable).
 * Running tasks: kanban board tasks currently executing.
 */
const tasksPage = {
  _refreshTimer: null,
  _content: null,
  _expanded: new Set(),  // session IDs with expanded children

  async handler({ content, title }) {
    title.textContent = 'Agents';
    this._content = content;
    clearInterval(this._refreshTimer);
    await this._render();
    this._refreshTimer = setInterval(() => this._render(), 30000);
  },

  async _render() {
    const content = this._content;
    if (!content) return;

    let data;
    try {
      data = await API.get('/agents');
    } catch (err) {
      content.innerHTML = `<div class="error">Failed to load agents: ${this._esc(err.message)}</div>`;
      return;
    }

    const { bg_agents = [], parent_agents = [], running_tasks = [] } = data;
    const isEmpty = bg_agents.length === 0 && parent_agents.length === 0 && running_tasks.length === 0;

    let html = `<div class="agents-page">
      <div class="agents-refresh-hint tg-text-hint" style="font-size:.72rem;text-align:right;padding:4px 12px">
        Auto-refresh 30s &nbsp;•&nbsp;
        <span style="cursor:pointer;color:var(--tg-theme-link-color,#4a9eff)" onclick="tasksPage._render()">↻ Now</span>
      </div>`;

    // Running kanban tasks
    if (running_tasks.length > 0) {
      html += `<div class="agents-section">
        <div class="agents-section-title">🏃 Running (${running_tasks.length})</div>
        ${running_tasks.map(t => `
          <div class="agent-card card">
            <div class="agent-header">
              <span class="agent-name">${this._esc(t.title)}</span>
              <span class="agent-badge badge-running">running</span>
            </div>
            <div class="agent-meta tg-text-hint">
              ${t.assignee ? `@${this._esc(t.assignee)} &nbsp;•&nbsp; ` : ''}
              ${this._uptime(t.elapsed_seconds)}
              &nbsp;•&nbsp; <span class="agent-id">${t.id}</span>
            </div>
          </div>`).join('')}
      </div>`;
    }

    // Parent sessions with delegate children
    if (parent_agents.length > 0) {
      html += `<div class="agents-section">
        <div class="agents-section-title">🌿 Delegate Tasks (${parent_agents.length})</div>
        ${parent_agents.map(a => this._parentCard(a)).join('')}
      </div>`;
    }

    // Background sessions
    if (bg_agents.length > 0) {
      html += `<div class="agents-section">
        <div class="agents-section-title">⚡ Background (${bg_agents.length})</div>
        ${bg_agents.map(a => this._bgCard(a)).join('')}
      </div>`;
    }

    if (isEmpty) {
      html += `<div class="empty-state"><div class="icon">😴</div><p>Sin tareas activas</p><p class="tg-text-hint">Todo en reposo</p></div>`;
    }

    html += '</div>';
    content.innerHTML = html;

    // Re-render expanded children
    for (const sid of this._expanded) {
      const el = content.querySelector(`[data-children-for="${sid}"]`);
      if (el) this._loadChildren(sid, el);
    }
  },

  _bgCard(a) {
    const id8 = a.session_id.slice(0, 12);
    const label = a.title || id8;
    const model = a.model ? `<span class="agent-model">${this._esc(a.model.split('/').pop())}</span>` : '';
    return `
      <div class="agent-card card" style="cursor:pointer" onclick="Router.navigate('/sessions/${a.session_id}')">
        <div class="agent-header">
          <span class="agent-name">${this._esc(label)}</span>
          <span class="agent-badge badge-active">bg</span>
        </div>
        <div class="agent-meta tg-text-hint">
          ${model}${model ? ' &nbsp;•&nbsp; ' : ''}${this._uptime(a.elapsed_seconds)}
          &nbsp;•&nbsp; 💬 ${a.message_count}
          &nbsp;•&nbsp; <code class="agent-id">${id8}</code>
        </div>
      </div>`;
  },

  _parentCard(a) {
    const label = a.title || a.session_id.slice(0, 16);
    const model = a.model ? `<span class="agent-model">${this._esc(a.model.split('/').pop())}</span>` : '';
    const expanded = this._expanded.has(a.session_id);
    const stats = [
      a.child_running > 0 ? `<span style="color:#4caf50">▶ ${a.child_running} running</span>` : '',
      a.child_done > 0 ? `<span style="color:var(--tg-theme-hint-color,#888)">✓ ${a.child_done} done</span>` : '',
      a.child_error > 0 ? `<span style="color:#ff6b6b">✗ ${a.child_error} error</span>` : '',
    ].filter(Boolean).join(' &nbsp;');

    return `
      <div class="agent-card card">
        <div class="agent-header" style="cursor:pointer" onclick="Router.navigate('/sessions/${a.session_id}')">
          <span class="agent-name">${this._esc(label)}</span>
          <span class="agent-badge badge-active">${this._esc(a.source)}</span>
        </div>
        <div class="agent-meta tg-text-hint" style="margin-bottom:6px">
          ${model}${model ? ' &nbsp;•&nbsp; ' : ''}${this._uptime(a.elapsed_seconds)}
          &nbsp;•&nbsp; ${stats}
        </div>
        <button class="tg-button tg-button-secondary"
          style="width:auto;padding:4px 10px;font-size:.72rem"
          onclick="tasksPage._toggleChildren('${a.session_id}', this)">
          ${expanded ? '▲ Ocultar hijos' : '▼ Ver hijos ('+a.child_total+')'}
        </button>
        <div data-children-for="${a.session_id}" style="margin-top:6px">
          ${expanded ? '<div class="tg-text-hint" style="font-size:.72rem;padding:4px">Cargando...</div>' : ''}
        </div>
      </div>`;
  },

  _toggleChildren(sessionId, btn) {
    const container = btn.nextElementSibling;
    if (this._expanded.has(sessionId)) {
      this._expanded.delete(sessionId);
      container.innerHTML = '';
      btn.textContent = '▼ Ver hijos';
    } else {
      this._expanded.add(sessionId);
      container.innerHTML = '<div class="tg-text-hint" style="font-size:.72rem;padding:4px">Cargando...</div>';
      btn.textContent = '▲ Ocultar hijos';
      this._loadChildren(sessionId, container);
    }
  },

  async _loadChildren(sessionId, container) {
    try {
      const data = await API.get(`/sessions/${sessionId}/children`);
      const children = data.children || [];
      if (children.length === 0) {
        container.innerHTML = '<div class="tg-text-hint" style="font-size:.72rem;padding:4px">Sin sesiones hijas</div>';
        return;
      }
      container.innerHTML = children.map(c => {
        const running = !c.ended_at;
        const status = running
          ? `<span style="color:#4caf50">▶ activo</span>`
          : (c.end_reason === 'error' || c.end_reason === 'interrupted')
            ? `<span style="color:#ff6b6b">✗ ${this._esc(c.end_reason)}</span>`
            : `<span style="color:var(--tg-theme-hint-color,#888)">✓ done</span>`;
        const label = c.title || c.id.slice(0, 16);
        return `<div style="padding:5px 0;border-top:1px solid var(--tg-theme-secondary-bg-color,#2a2a2a);cursor:pointer"
            onclick="Router.navigate('/sessions/${c.id}')">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:.78rem">${this._esc(label)}</span>
            ${status}
          </div>
          <div class="tg-text-hint" style="font-size:.68rem">
            💬 ${c.message_count || 0} &nbsp;•&nbsp; <code>${c.id.slice(0,12)}</code>
          </div>
        </div>`;
      }).join('');
    } catch (err) {
      container.innerHTML = `<div class="tg-text-hint" style="font-size:.72rem;padding:4px">Error: ${this._esc(err.message)}</div>`;
    }
  },

  _uptime(seconds) {
    if (!seconds || seconds < 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  },

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },
};

Router.register('/tasks', tasksPage.handler.bind(tasksPage));
