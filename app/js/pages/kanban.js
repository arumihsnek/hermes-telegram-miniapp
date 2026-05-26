/**
 * Kanban page — single-column layout
 * Column containers by status, session cards inside each.
 * Long-press (500ms) to activate drag mode for touch devices.
 */
const kanbanPage = {
  async handler({ content, title, backBtn }) {
    title.textContent = 'Kanban Boards';
    backBtn.classList.add('hidden');

    try {
      const { boards } = await API.get('/boards');
      const boardList = boards.map(b => ({
        id: b.slug,
        name: b.name,
        task_count: b.total || 0,
      }));

      if (boardList.length === 0) {
        content.innerHTML = `
          <div class="empty-state">
            <div class="icon">📋</div>
            <p>No boards yet</p>
            <p class="tg-text-hint">Create your first board in the web dashboard</p>
          </div>`;
        return;
      }

      content.innerHTML = `
        <div class="kanban-boards">
          <h2>Your Boards</h2>
          ${boardList.map(b => `
            <div class="card kanban-board-card" onclick="kanbanPage.openBoard('${b.id}')">
              <div class="board-name">${kanbanPage._escape(b.name)}</div>
              <div class="tg-text-hint">${b.task_count || 0} tasks</div>
            </div>
          `).join('')}
          <button class="tg-button" id="btn-new-kanban-task" style="margin-top:8px">+ Add Task</button>
        </div>`;

      document.getElementById('btn-new-kanban-task')?.addEventListener('click', () => {
        kanbanForm.show();
      });

    } catch (err) {
      content.innerHTML = `<div class="error">Failed to load boards: ${err.message}</div>`;
    }
  },

  async openBoard(boardId) {
    Router.navigate(`/kanban/${boardId}`);
  },

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};

// Board detail — single column with long-press drag
const kanbanBoard = {
  draggedTaskId: null,
  draggedTaskEl: null,
  sourceColumnId: null,
  _longPressTimer: null,
  _isDragging: false,

  // Long-press drag for mobile — better touch handling
  onTouchStart(event, taskId, colId) {
    this._touchStartX = event.touches[0].clientX;
    this._touchStartY = event.touches[0].clientY;
    this._touchMoved = false;
    this.draggedTaskId = taskId;
    this.sourceColumnId = colId;
    this.draggedTaskEl = event.currentTarget;

    this._longPressTimer = setTimeout(() => {
      if (this._touchMoved) return;
      this._isDragging = true;
      this.draggedTaskEl.classList.add('dragging-active');
      TG.haptic?.('light');

      // Clone the card for visual drag feedback
      const clone = this.draggedTaskEl.cloneNode(true);
      clone.className = 'kanban-task drag-clone';
      clone.style.position = 'fixed';
      clone.style.width = this.draggedTaskEl.offsetWidth + 'px';
      clone.style.pointerEvents = 'none';
      clone.style.zIndex = '1001';
      clone.style.opacity = '0.9';
      clone.style.transform = 'scale(1.05) rotate(2deg)';
      clone.id = 'drag-clone';
      document.body.appendChild(clone);

      // Position clone at finger
      const rect = this.draggedTaskEl.getBoundingClientRect();
      clone.style.left = (this._touchStartX - rect.width / 2) + 'px';
      clone.style.top = (this._touchStartY - 20) + 'px';
      this._dragClone = clone;

      TG.haptic?.('medium');
    }, 400);
  },

  onTouchMove(event) {
    const touch = event.touches[0];
    const dx = touch.clientX - this._touchStartX;
    const dy = touch.clientY - this._touchStartY;

    // Cancel long-press if finger moved more than 10px before activation
    if (!this._isDragging) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        this._touchMoved = true;
        clearTimeout(this._longPressTimer);
      }
      return;
    }

    event.preventDefault();
    // Move the drag clone with finger
    if (this._dragClone) {
      this._dragClone.style.left = (touch.clientX - this._dragClone.offsetWidth / 2) + 'px';
      this._dragClone.style.top = (touch.clientY - 20) + 'px';
    }

    // Highlight column under finger
    document.querySelectorAll('.column-tasks').forEach(col => col.style.background = '');
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const col = el.closest('.column-tasks');
      if (col) col.style.background = 'rgba(74, 108, 247, 0.08)';
    }
  },

  onTouchEnd(event, colId) {
    clearTimeout(this._longPressTimer);

    // Remove clone
    const clone = document.getElementById('drag-clone');
    if (clone) clone.remove();
    this._dragClone = null;

    if (this.draggedTaskEl) {
      this.draggedTaskEl.classList.remove('dragging-active', 'long-press-ready');
    }

    if (!this._isDragging) {
      this._reset();
      return;
    }

    const touch = event.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    let dropColumnId = colId;
    if (el) {
      const colEl = el.closest('.column-tasks');
      if (colEl?.dataset.columnId) dropColumnId = colEl.dataset.columnId;
    }

    if (dropColumnId !== this.sourceColumnId) {
      this._moveTask(this.draggedTaskId, dropColumnId, 0);
    }

    document.querySelectorAll('.column-tasks').forEach(col => col.style.background = '');
    this._reset();
  },

  onDragStart(event, taskId) {
    this.draggedTaskId = taskId;
    this.draggedTaskEl = event.target;
    this.draggedTaskEl.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
  },

  onDragEnd() {
    if (this.draggedTaskEl) this.draggedTaskEl.classList.remove('dragging');
    this._reset();
  },

  onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  },

  async onDrop(event, targetColumnId) {
    event.preventDefault();
    const taskId = this.draggedTaskId || event.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const targetColumn = event.target.closest('.column-tasks');
    if (!targetColumn) return;

    const tasks = [...targetColumn.querySelectorAll('.kanban-task')];
    const dropY = event.clientY;
    let position = tasks.length;
    for (let i = 0; i < tasks.length; i++) {
      const rect = tasks[i].getBoundingClientRect();
      if (dropY < rect.top + rect.height / 2) { position = i; break; }
    }

    await this._moveTask(taskId, targetColumnId, position);
    this._reset();
  },

  async _moveTask(taskId, toColumnId, position) {
    if (toColumnId === 'running') {
      TG.showAlert('Only the dispatcher can move tasks to Running.');
      const boardId = Router.history[Router.history.length - 1]?.split('/')[2];
      if (boardId) Router.navigate('/kanban/' + boardId, true);
      return;
    }
    try {
      await API.patch('/tasks/' + taskId + '/move', {
        to_column_id: toColumnId,
        position: position,
      });
      const boardId = Router.history[Router.history.length - 1]?.split('/')[2];
      if (boardId) Router.navigate('/kanban/' + boardId, true);
      TG.haptic('success');
    } catch (err) {
      TG.showAlert('Cannot move task: ' + err.message);
      const boardId = Router.history[Router.history.length - 1]?.split('/')[2];
      if (boardId) Router.navigate('/kanban/' + boardId, true);
    }
  },

  _reset() {
    this.draggedTaskId = null;
    this.draggedTaskEl = null;
    this._isDragging = false;
    this._longPressTimer = null;
    this._touchMoved = false;
    this._dragClone = null;
  },

  async onTaskClick(event, taskId) {
    // Don't navigate if clicking on buttons
    if (event.target.tagName === 'BUTTON') return;

    try {
      const task = await API.get('/tasks/' + taskId);
      const sessions = task.sessions || [];

      if (sessions.length === 0) {
        Toast.show('No sessions for this task');
        return;
      }

      if (sessions.length === 1) {
        Router.navigate('/sessions/' + sessions[0].id);
        return;
      }

      // Multiple sessions - show selector
      kanbanBoard._showSessionSelector(taskId, sessions);
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  },

  _showSessionSelector(taskId, sessions) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
    `;
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:12px;padding:16px;max-width:90%;max-height:80vh;overflow-y:auto">
        <h3 style="margin:0 0 12px 0;font-size:16px">Select Session</h3>
        ${sessions.map((s, idx) => {
          const running = !s.ended_at;
          const dot = running ? '🟢' : (s.end_reason === 'error' ? '🔴' : '⚪');
          const label = s.title || s.id.slice(0, 20);
          return `
            <div onclick="Router.navigate('/sessions/${s.id}');document.body.lastChild.remove()"
                 style="padding:10px;border:1px solid var(--section-separator-color);border-radius:8px;margin-bottom:8px;cursor:pointer;display:flex;align-items:center;gap:6px">
              ${dot} <span>${kanbanPage._escape(label)}</span>
            </div>
          `;
        }).join('')}
      </div>`;
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
    document.body.appendChild(modal);
  },

  async _applyFilters(boardId) {
    try {
      const boardFilter = document.getElementById('filter-board')?.value;
      const tenantFilter = document.getElementById('filter-tenant')?.value;

      const data = await API.get(`/boards/${boardId}`);
      const columns = data.columns || [];

      // Filter tasks based on board and tenant
      const filteredColumns = columns.map(col => ({
        ...col,
        tasks: (col.tasks || []).filter(task => {
          const boardMatch = !boardFilter || task.board === boardFilter;
          const tenantMatch = !tenantFilter || task.tenant === tenantFilter;
          return boardMatch && tenantMatch;
        })
      }));

      // Update the tasks container
      const container = document.getElementById('kanban-tasks-container');
      if (container) {
        container.innerHTML = filteredColumns.map(col => {
          const colId = col.name.toLowerCase().replace(/\s+/g, '_');
          return `
            <div class="kanban-column-single" data-column-id="${colId}">
              <div class="column-header">
                <h3>${kanbanPage._escape(col.name)}</h3>
                <span class="tg-badge">${(col.tasks || []).length}</span>
              </div>
              <div class="column-tasks"
                   data-column-id="${colId}"
                   ondragover="kanbanBoard.onDragOver(event)"
                   ondrop="kanbanBoard.onDrop(event, '${colId}')">
                ${(col.tasks || []).map((task, idx) => kanbanBoard._renderTaskCard(task, idx, colId)).join('')}
              </div>
            </div>`;
        }).join('');
      }
    } catch (err) {
      Toast.error('Filter failed: ' + err.message);
    }
  },

  async _moveTask(taskId, toColumnId) {
    try {
      await API.patch('/tasks/' + taskId + '/move', {
        to_column_id: toColumnId,
        position: 0,
      });
      const boardId = Router.history[Router.history.length - 1]?.split('/')[2];
      if (boardId) {
        const boardFilter = document.getElementById('filter-board')?.value;
        const tenantFilter = document.getElementById('filter-tenant')?.value;
        await kanbanBoard._applyFilters(boardId);
      }
      TG.haptic('success');
    } catch (err) {
      Toast.error('Failed to move task: ' + err.message);
    }
  },
};

// ---------------------------------------------------------------------------
// Kanban "Add Task" Form — modal overlay
// ---------------------------------------------------------------------------
const kanbanForm = {
  _profiles: [],
  _boards: [],
  _tasks: [],
  _visible: false,

  async show() {
    this._editingTaskId = null;
    this._visible = true;
    // Ensure modal exists in DOM
    if (!document.getElementById('kf-modal')) {
      this._render();
    }
    document.getElementById('kf-modal').classList.remove('hidden');
    // Load data
    await Promise.all([this._loadBoards(), this._loadProfiles(), this._loadSkills()]);
    // Auto-select first board, load its tasks for dependency picker
    const boardSel = document.getElementById('kf-board');
    if (boardSel.options.length > 0 && !boardSel.value) {
      boardSel.value = boardSel.options[0].value;
    }
    this._loadDeps();
  },

  async editTask(taskId) {
    this._editingTaskId = taskId;
    this._visible = true;
    // Ensure modal exists in DOM
    if (!document.getElementById('kf-modal')) {
      this._render();
    }
    // Load task data
    try {
      const task = await API.get('/tasks/' + taskId);
      document.getElementById('kf-modal').classList.remove('hidden');

      // Populate form with task data
      document.getElementById('kf-title').value = task.title || '';
      document.getElementById('kf-body').value = task.body || '';
      document.getElementById('kf-assignee').value = task.assignee || '';
      document.getElementById('kf-priority').value = task.priority || '0';

      // Load boards and set current board
      await Promise.all([this._loadBoards(), this._loadProfiles(), this._loadSkills()]);
      const boardSel = document.getElementById('kf-board');
      if (task.board) boardSel.value = task.board;

      this._loadDeps();

      // Update header to show we're editing
      const header = document.querySelector('.kf-header h3');
      if (header) header.textContent = 'Edit Task';

    } catch (err) {
      Toast.error('Failed to load task: ' + err.message);
    }
  },

  async specify(taskId) {
    try {
      const task = await API.get('/tasks/' + taskId);
      // Open edit modal and set to specify mode
      this._editingTaskId = taskId;
      this._specifyMode = true;
      await this.editTask(taskId);

      // Update button label
      const btn = document.getElementById('kf-btn-specify');
      if (btn) btn.textContent = '✓ Submit Specification';
    } catch (err) {
      Toast.error('Failed to load task: ' + err.message);
    }
  },

  hide() {
    this._visible = false;
    this._editingTaskId = null;
    const el = document.getElementById('kf-modal');
    if (el) {
      el.classList.add('hidden');
      // Reset header
      const header = document.querySelector('.kf-header h3');
      if (header) header.textContent = 'New Kanban Task';
      // Reset form
      document.getElementById('kf-title').value = '';
      document.getElementById('kf-body').value = '';
      document.getElementById('kf-assignee').value = '';
      document.getElementById('kf-priority').value = '0';
    }
  },

  _render() {
    const modal = document.createElement('div');
    modal.id = 'kf-modal';
    modal.className = 'modal-overlay hidden';
    modal.innerHTML = `
      <div class="modal-content kf-content">
        <div class="kf-header">
          <h3>New Kanban Task</h3>
          <button class="kf-close" onclick="kanbanForm.hide()">&times;</button>
        </div>
        <div class="kf-body">
          <label>Board</label>
          <select id="kf-board" class="tg-input" onchange="kanbanForm._loadDeps()"></select>

          <label>Title *</label>
          <input id="kf-title" class="tg-input" placeholder="Task title">

          <label>Description</label>
          <textarea id="kf-body" class="tg-input" rows="3" placeholder="Optional description"></textarea>

          <label>Assignee</label>
          <select id="kf-assignee" class="tg-input" onchange="kanbanForm._updateTodoReadyLabel()">
            <option value="">— No assignee —</option>
          </select>

          <label>Skills <span class="tg-text-hint">(comma separated)</span></label>
          <input id="kf-skills" class="tg-input" list="kf-skills-list" placeholder="e.g. kanban-worker, github-code-review">
          <datalist id="kf-skills-list"></datalist>

          <label>Priority</label>
          <select id="kf-priority" class="tg-input" style="width:auto">
            <option value="0">0 — Normal</option>
            <option value="1">1 — Low</option>
            <option value="2">2 — Medium</option>
            <option value="3">3 — High</option>
            <option value="4">4 — Urgent</option>
            <option value="5">5 — Critical</option>
          </select>

          <label>Dependencies <span class="tg-text-hint">(tasks this depends on)</span></label>
          <div id="kf-deps" class="kf-deps-list"><p class="tg-text-hint">Select a board to load tasks</p></div>
        </div>
        <div class="kf-footer">
          <button id="kf-btn-save" class="tg-button" onclick="kanbanForm._submit('save')">💾 Save</button>
          <button id="kf-btn-specify" class="tg-button" onclick="kanbanForm._submit('specify')">🎯 Specify</button>
          <button id="kf-btn-todoready" class="tg-button tg-button-secondary" onclick="kanbanForm._submit('todoready')"></button>
          <button class="tg-button tg-button-cancel" onclick="kanbanForm.hide()">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  async _loadBoards() {
    try {
      const { boards } = await API.get('/boards');
      this._boards = boards;
      const sel = document.getElementById('kf-board');
      sel.innerHTML = boards.map(b =>
        '<option value="' + b.slug + '">' + kanbanPage._escape(b.name) + ' (' + (b.total || 0) + ' tasks)</option>'
      ).join('');
    } catch (err) {
      console.error('Failed to load boards:', err);
    }
  },

  async _loadProfiles() {
    try {
      const data = await API.get('/profiles');
      this._profiles = data.profiles || [];
      const sel = document.getElementById('kf-assignee');
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">— No assignee —</option>' +
        this._profiles
          .filter(p => !p.is_default)
          .map(p => '<option value="' + p.name + '">' + p.name + (p.model ? ' (' + p.model + ')' : '') + '</option>')
          .join('');
      if (currentVal) sel.value = currentVal;
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  },

  async _loadDeps() {
    const board = document.getElementById('kf-board')?.value;
    const depsEl = document.getElementById('kf-deps');
    if (!board) {
      depsEl.innerHTML = '<p class="tg-text-hint">Select a board first</p>';
      return;
    }
    depsEl.innerHTML = '<p class="tg-text-hint">Loading tasks...</p>';
    try {
      const data = await API.get('/boards/' + board);
      const columns = data.columns || [];
      const allTasks = [];
      columns.forEach(col => {
        (col.tasks || []).forEach(t => {
          // Only show active tasks (not done/archived)
          const status = t.status || col.name;
          if (status === 'done' || status === 'archived') return;
          allTasks.push({ id: t.id, title: t.title, status });
        });
      });
      // Sort: newest first by id (assuming id order = creation order)
      allTasks.reverse();
      this._tasks = allTasks;
      if (allTasks.length === 0) {
        depsEl.innerHTML = '<p class="tg-text-hint">No tasks in this board</p>';
        return;
      }
      depsEl.innerHTML = allTasks.map(t =>
        '<label class="kf-dep-item">' +
          '<input type="checkbox" class="kf-dep-cb" value="' + t.id + '"> ' +
          '<span>' + kanbanPage._escape(t.title.substring(0, 60)) + '</span> ' +
          '<span class="tg-badge">' + (t.status || '') + '</span>' +
        '</label>'
      ).join('');
    } catch (err) {
      depsEl.innerHTML = '<p class="tg-text-hint">Error: ' + err.message + '</p>';
    }
  },

  async _loadSkills() {
    try {
      const data = await API.get('/skills');
      const skills = data.skills || [];
      const datalist = document.getElementById('kf-skills-list');
      if (datalist) {
        datalist.innerHTML = skills.map(s => '<option value="' + s + '">').join('');
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
    }
  },

  _updateTodoReadyLabel() {
    const btn = document.getElementById('kf-btn-todoready');
    const assignee = document.getElementById('kf-assignee')?.value;
    btn.textContent = assignee ? '▶ Ready' : '▶ Todo';
  },

  _getSelectedParents() {
    const cbs = document.querySelectorAll('.kf-dep-cb:checked');
    return Array.from(cbs).map(cb => cb.value);
  },

  _getSkillsList() {
    const raw = document.getElementById('kf-skills')?.value || '';
    return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
  },

  async _submit(action) {
    const board = document.getElementById('kf-board')?.value;
    const title = document.getElementById('kf-title')?.value.trim();
    const body = document.getElementById('kf-body')?.value.trim();
    const assignee = document.getElementById('kf-assignee')?.value || undefined;
    const priority = parseInt(document.getElementById('kf-priority')?.value || '0', 10);
    const parents = this._getSelectedParents();
    const skills = this._getSkillsList();

    if (!board) { Toast.error('Select a board'); return; }
    if (!title) { Toast.error('Title is required'); return; }

    try {
      if (this._editingTaskId) {
        // Update existing task
        await API.patch('/tasks/' + this._editingTaskId, {
          title,
          body: body || '',
          assignee: assignee,
          priority,
          board,
        });
        TG.haptic('success');
        this.hide();
        const currentRoute = Router.history[Router.history.length - 1] || '';
        if (currentRoute.startsWith('/kanban/')) {
          Router.navigate(currentRoute, true);
        }
        Toast.success('Task updated');
      } else {
        // Create new task
        let triage = false;
        if (action === 'save') {
          triage = true;
        } else if (action === 'specify') {
          triage = true;
        } else if (action === 'todoready') {
          triage = false;
        }

        const payload = {
          title,
          body: body || '',
          board,
          assignee: assignee,
          priority,
          triage,
          parents: parents.length > 0 ? parents : undefined,
          skills: skills.length > 0 ? skills : undefined,
        };

        const result = await API.post('/tasks', payload);
        TG.haptic('success');
        this.hide();
        const currentRoute = Router.history[Router.history.length - 1] || '';
        if (currentRoute.startsWith('/kanban/')) {
          Router.navigate(currentRoute, true);
        }
        Toast.success('Task created: ' + (result.title || result.id || 'ok'));
      }
    } catch (err) {
      Toast.error('Failed: ' + err.message);
    }
  },
};

// Register routes
Router.register('/kanban', kanbanPage.handler.bind(kanbanPage));

Router.register('/kanban/:boardId', async ({ content, title, backBtn, params }) => {
  title.textContent = 'Loading...';
  backBtn.classList.remove('hidden');

  try {
    const data = await API.get(`/boards/${params.boardId}`);
    const columns = data.columns || [];
    const allBoards = data.boards || [];
    const allTenants = data.tenants || [];

    title.textContent = params.boardId;

    // Single-column layout with filters
    content.innerHTML = `
      <div class="kanban-board-single">
        <div style="display:flex;gap:8px;margin-bottom:12px;padding:8px;background:var(--secondary-bg);border-radius:8px;flex-wrap:wrap">
          <div style="flex:1;min-width:150px">
            <label style="font-size:.75rem;color:var(--tg-theme-hint-color,#888);display:block;margin-bottom:4px">Board</label>
            <select id="filter-board" class="tg-input" style="font-size:.85rem;width:100%" onchange="kanbanBoard._applyFilters('${params.boardId}')">
              <option value="">All Boards</option>
              ${allBoards.map(b => `<option value="${b.slug}">${b.name}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1;min-width:150px">
            <label style="font-size:.75rem;color:var(--tg-theme-hint-color,#888);display:block;margin-bottom:4px">Tenant</label>
            <select id="filter-tenant" class="tg-input" style="font-size:.85rem;width:100%" onchange="kanbanBoard._applyFilters('${params.boardId}')">
              <option value="">All Tenants</option>
              ${allTenants.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="kanban-tasks-container">
        ${columns.map(col => {
          const colId = col.name.toLowerCase().replace(/\s+/g, '_');
          return `
            <div class="kanban-column-single" data-column-id="${colId}">
              <div class="column-header">
                <h3>${kanbanPage._escape(col.name)}</h3>
                <span class="tg-badge">${(col.tasks || []).length}</span>
              </div>
              <div class="column-tasks"
                   data-column-id="${colId}"
                   ondragover="kanbanBoard.onDragOver(event)"
                   ondrop="kanbanBoard.onDrop(event, '${colId}')">
                ${(col.tasks || []).map((task, idx) => {
                  const columnMap = { 'triage': 0, 'todo': 1, 'ready': 2, 'blocked': 3, 'done': 4, 'completed': 5 };
                  let moveButtons = '';
                  if (colId === 'triage') {
                    moveButtons = `<button onclick="event.stopPropagation();kanbanBoard._moveTask('${task.id}', 'todo')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px" title="Move to Todo">⬇</button>`;
                  } else if (colId === 'todo') {
                    moveButtons = `<button onclick="event.stopPropagation();kanbanBoard._moveTask('${task.id}', 'ready')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px" title="Move to Ready">⬇</button>`;
                  } else if (colId === 'ready') {
                    moveButtons = `<button onclick="event.stopPropagation();kanbanBoard._moveTask('${task.id}', 'todo')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px" title="Move back">⬆</button>`;
                  } else if (colId === 'blocked') {
                    moveButtons = `<button onclick="event.stopPropagation();kanbanBoard._moveTask('${task.id}', 'todo')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px" title="Unblock">⬆</button>`;
                  } else if (colId === 'completed' || colId === 'done') {
                    moveButtons = `<button onclick="event.stopPropagation();kanbanBoard._moveTask('${task.id}', 'todo')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px" title="Reopen">↻</button>`;
                  }
                  return `
                  <div class="kanban-task card"
                       draggable="true"
                       data-task-id="${task.id}"
                       data-position="${idx}"
                       ondragstart="kanbanBoard.onDragStart(event, '${task.id}')"
                       ondragend="kanbanBoard.onDragEnd(event)"
                       ontouchstart="kanbanBoard.onTouchStart(event, '${task.id}', '${colId}')"
                       ontouchmove="kanbanBoard.onTouchMove(event)"
                       ontouchend="kanbanBoard.onTouchEnd(event, '${colId}')"
                       onclick="kanbanBoard.onTaskClick(event, '${task.id}')"
                       style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
                    <div style="flex:1;min-width:0">
                      <div class="task-title">${kanbanPage._escape(task.title)}</div>
                      ${task.assignee ? `<div class="tg-text-hint">@ ${kanbanPage._escape(task.assignee)}</div>` : ''}
                      ${task.priority ? `<span class="tg-badge">P${task.priority}</span>` : ''}
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                      ${moveButtons}
                      ${colId === 'triage' ? `
                        <button onclick="event.stopPropagation();kanbanForm.specify('${task.id}')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px" title="Specify">🎯</button>
                        <button onclick="event.stopPropagation();kanbanForm.editTask('${task.id}')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px" title="Edit">✏️</button>
                      ` : ''}
                    </div>
                  </div>
                `;}
                ).join('')}
              </div>
            </div>`;
        }).join('')}
        </div>
      </div>`;
  } catch (err) {
    content.innerHTML = `<div class="error">Failed to load board: ${err.message}</div>`;
  }
});
