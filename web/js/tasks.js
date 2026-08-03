/* =========================================================
   Z.views.tasks — Task Manager (list + kanban board)
   ========================================================= */
window.Z = window.Z || {};
Z.views = Z.views || {};

Z.views.tasks = (function () {
  const U = Z.utils;
  let state = { mode: 'list', filter: 'all', q: '' };

  function pid() { return Z.store.getActiveProfileId(); }
  function data() { return Z.store.loadData(pid()); }
  function save() { Z.store.touch(pid()); }

  function catColor(name) {
    const c = data().taskCategories.find(c => c.name === name);
    return c ? c.color : 'var(--text-faint)';
  }

  const PRIORITY_LABEL = { low: 'کم', med: 'متوسط', high: 'بالا', urgent: 'فوری' };
  const PRIORITY_BADGE = { low: 'badge-low', med: 'badge-med', high: 'badge-high', urgent: 'badge-urgent' };

  function render(root) {
    const d = data();
    root.innerHTML = `
      <div class="section-head" style="margin-bottom:10px">
        <div class="filter-tabs" id="view-toggle" style="margin:0">
          <div class="filter-tab ${state.mode==='list'?'active':''}" data-mode="list">لیست</div>
          <div class="filter-tab ${state.mode==='board'?'active':''}" data-mode="board">بورد</div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-task">${U.icon('plus')} وظیفه جدید</button>
      </div>
      <div class="input-row" style="margin-bottom:14px">
        <input class="input" id="task-search" placeholder="جستجوی وظیفه…" value="${U.escapeHtml(state.q)}">
      </div>
      ${state.mode === 'list' ? `
        <div class="filter-tabs" id="filter-tabs">
          ${['all','today','week','overdue','done'].map(f => `<div class="filter-tab ${state.filter===f?'active':''}" data-filter="${f}">${filterLabel(f)}</div>`).join('')}
        </div>
        <div id="task-list-holder"></div>
      ` : `<div class="task-board" id="task-board"></div>`}
    `;

    root.querySelector('#btn-add-task').onclick = () => openTaskModal();
    root.querySelectorAll('#view-toggle .filter-tab').forEach(el => el.onclick = () => { state.mode = el.dataset.mode; render(root); });
    root.querySelector('#task-search').oninput = U.debounce((e) => { state.q = e.target.value; renderBody(root); }, 200);
    if (state.mode === 'list') {
      root.querySelectorAll('#filter-tabs .filter-tab').forEach(el => el.onclick = () => { state.filter = el.dataset.filter; render(root); });
    }
    renderBody(root);
  }

  function filterLabel(f) {
    return { all:'همه', today:'امروز', week:'این هفته', overdue:'دیرکرد', done:'انجام‌شده' }[f];
  }

  function matchesQuery(t) { return !state.q || t.title.includes(state.q) || (t.notes||'').includes(state.q); }

  function filteredTasks() {
    const d = data();
    const today = U.todayISO();
    let list = d.tasks.filter(matchesQuery);
    if (state.filter === 'today') list = list.filter(t => t.dueDate === today && t.status !== 'done');
    else if (state.filter === 'week') list = list.filter(t => t.dueDate && U.isoDiffDays(t.dueDate, today) >= 0 && U.isoDiffDays(t.dueDate, today) <= 7 && t.status !== 'done');
    else if (state.filter === 'overdue') list = list.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
    else if (state.filter === 'done') list = list.filter(t => t.status === 'done');
    else list = list.filter(t => t.status !== 'done' || true); // 'all' shows everything, sorted below
    return list.sort((a,b) => {
      if (state.filter === 'all') { if ((a.status==='done') !== (b.status==='done')) return a.status==='done' ? 1 : -1; }
      const ad = a.dueDate || '9999', bd = b.dueDate || '9999';
      return ad.localeCompare(bd);
    });
  }

  function renderBody(root) {
    if (state.mode === 'list') renderList(root.querySelector('#task-list-holder'));
    else renderBoard(root.querySelector('#task-board'));
  }

  function renderList(holder) {
    if (!holder) return;
    const list = filteredTasks();
    if (list.length === 0) { holder.innerHTML = emptyState(); return; }
    holder.innerHTML = list.map(rowHtml).join('');
    holder.querySelectorAll('.task-checkbox').forEach(cb => cb.onclick = (e) => { e.stopPropagation(); toggleDone(cb.dataset.id); });
    holder.querySelectorAll('.task-list-row').forEach(row => row.addEventListener('click', (e) => {
      if (e.target.closest('.task-checkbox')) return;
      openTaskModal(row.dataset.id);
    }));
  }

  function emptyState() {
    return `<div class="empty-state">${U.icon('tasks')}<div class="empty-state-title">فعلاً وظیفه‌ای نیست</div><div>یه وظیفه جدید اضافه کن تا شروع کنی</div></div>`;
  }

  function rowHtml(t) {
    const done = t.status === 'done';
    const subDone = (t.subtasks||[]).filter(s=>s.done).length;
    const subTotal = (t.subtasks||[]).length;
    return `
      <div class="task-list-row" data-id="${t.id}">
        <div class="task-checkbox ${done?'checked':''}" data-id="${t.id}">${U.icon('check')}</div>
        <div class="task-row-body">
          <div class="task-row-title ${done?'done':''}">${U.escapeHtml(t.title)}</div>
          <div class="task-row-meta">
            ${t.category ? `<span class="badge" style="background:${catColor(t.category)}22;color:${catColor(t.category)}"><span class="dot" style="background:${catColor(t.category)}"></span>${U.escapeHtml(t.category)}</span>` : ''}
            <span class="badge ${PRIORITY_BADGE[t.priority]}">${PRIORITY_LABEL[t.priority]}</span>
            ${t.dueDate ? `<span class="text-muted" style="font-size:11.5px">${U.icon('bell')} ${U.relativeDayLabel(t.dueDate)}${t.dueTime ? ' · '+U.faTime(t.dueTime) : ''}</span>` : ''}
            ${subTotal ? `<span class="text-muted" style="font-size:11.5px">${U.faNum(subDone)}/${U.faNum(subTotal)} مرحله</span>` : ''}
          </div>
        </div>
      </div>`;
  }

  function renderBoard(holder) {
    if (!holder) return;
    const cols = [ ['todo','در انتظار'], ['doing','در حال انجام'], ['done','انجام‌شده'] ];
    const tasks = data().tasks.filter(matchesQuery);
    holder.innerHTML = cols.map(([status,label]) => {
      const items = tasks.filter(t => t.status === status);
      return `
        <div class="task-col" data-status="${status}">
          <div class="task-col-head"><div class="task-col-title">${label}</div><div class="task-count">${U.faNum(items.length)}</div></div>
          <div class="task-col-items">
            ${items.map(t => `
              <div class="task-card" draggable="true" data-id="${t.id}">
                <div class="task-card-title ${status==='done'?'done':''}">${U.escapeHtml(t.title)}</div>
                <div class="task-card-meta">
                  ${t.category ? `<span class="dot" style="background:${catColor(t.category)}"></span><span>${U.escapeHtml(t.category)}</span>` : ''}
                  <span class="badge ${PRIORITY_BADGE[t.priority]}">${PRIORITY_LABEL[t.priority]}</span>
                </div>
                ${t.dueDate ? `<div class="task-card-meta" style="margin-top:5px">${U.icon('bell')} ${U.relativeDayLabel(t.dueDate)}</div>` : ''}
              </div>
            `).join('') || `<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:12px">خالی</div>`}
          </div>
        </div>`;
    }).join('');

    holder.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', () => openTaskModal(card.dataset.id));
      card.addEventListener('dragstart', () => card.classList.add('dragging'));
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    holder.querySelectorAll('.task-col').forEach(col => {
      col.addEventListener('dragover', (e) => e.preventDefault());
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        const dragging = holder.querySelector('.dragging');
        if (!dragging) return;
        setStatus(dragging.dataset.id, col.dataset.status);
      });
    });
  }

  function toggleDone(id) {
    const t = data().tasks.find(t => t.id === id);
    if (!t) return;
    setStatus(id, t.status === 'done' ? 'todo' : 'done');
  }
  function setStatus(id, status) {
    const t = data().tasks.find(t => t.id === id);
    if (!t) return;
    const wasDone = t.status === 'done';
    t.status = status;
    if (status === 'done' && !wasDone) { t.completedAt = Date.now(); Z.store.bumpActivity(pid(), 'tasks', U.todayISO(), 1); }
    if (status !== 'done' && wasDone) { Z.store.bumpActivity(pid(), 'tasks', (t.completedAt ? U.dateToISO(new Date(t.completedAt)) : U.todayISO()), -1); }
    save();
    Z.app.refreshView();
  }

  function openTaskModal(id) {
    const d = data();
    const t = id ? d.tasks.find(t => t.id === id) : { id: null, title:'', notes:'', category: d.taskCategories[0].name, priority:'med', status:'todo', dueDate:'', dueTime:'', subtasks:[] };
    const overlay = U.openModal(`
      <div class="modal-head"><div class="modal-title">${id?'ویرایش وظیفه':'وظیفه جدید'}</div><button class="icon-btn" id="m-close">${U.icon('x')}</button></div>
      <div class="field"><label>عنوان</label><input class="input" id="f-title" value="${U.escapeHtml(t.title)}" placeholder="مثلاً تماس با مشتری"></div>
      <div class="field"><label>یادداشت (اختیاری)</label><textarea class="textarea" id="f-notes" placeholder="جزئیات بیشتر…">${U.escapeHtml(t.notes||'')}</textarea></div>
      <div class="field"><label>دسته‌بندی</label>
        <div class="chip-select" id="f-cats">
          ${d.taskCategories.map(c => `<div class="chip ${t.category===c.name?'selected':''}" data-name="${U.escapeHtml(c.name)}" style="${t.category===c.name?`background:${c.color};border-color:${c.color}`:''}">${U.escapeHtml(c.name)}</div>`).join('')}
          <div class="chip" id="chip-add-cat">+ جدید</div>
        </div>
      </div>
      <div class="field"><label>اولویت</label>
        <div class="chip-select" id="f-priority">
          ${Object.entries(PRIORITY_LABEL).map(([k,label]) => `<div class="chip ${t.priority===k?'selected':''}" data-p="${k}">${label}</div>`).join('')}
        </div>
      </div>
      <div class="input-row">
        <div class="field" style="flex:1"><label>تاریخ سررسید</label><input class="input" type="date" id="f-date" value="${t.dueDate||''}"></div>
        <div class="field" style="flex:1"><label>ساعت (اختیاری)</label><input class="input" type="time" id="f-time" value="${t.dueTime||''}"></div>
      </div>
      <div class="field"><label>مراحل فرعی</label>
        <div id="subtask-list">${(t.subtasks||[]).map(s => subtaskRowHtml(s)).join('')}</div>
        <button class="btn btn-ghost btn-sm" id="btn-add-subtask" style="margin-top:6px">${U.icon('plus')} افزودن مرحله</button>
      </div>
      <div class="modal-actions">
        ${id ? `<button class="btn btn-danger" id="btn-delete">${U.icon('trash')} حذف</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" id="btn-cancel">انصراف</button>
        <button class="btn btn-primary" id="btn-save">ذخیره</button>
      </div>
    `);

    let selectedCategory = t.category, selectedPriority = t.priority;
    let subtasks = JSON.parse(JSON.stringify(t.subtasks||[]));

    function refreshSubtasks() {
      overlay.querySelector('#subtask-list').innerHTML = subtasks.map(subtaskRowHtml).join('');
      wireSubtasks();
    }
    function wireSubtasks() {
      overlay.querySelectorAll('.subtask-row .task-checkbox').forEach(cb => cb.onclick = () => {
        const s = subtasks.find(s => s.id === cb.dataset.sid); s.done = !s.done; refreshSubtasks();
      });
      overlay.querySelectorAll('.subtask-row .sub-del').forEach(b => b.onclick = () => {
        subtasks = subtasks.filter(s => s.id !== b.dataset.sid); refreshSubtasks();
      });
      overlay.querySelectorAll('.subtask-row input[type=text]').forEach(inp => inp.oninput = () => {
        const s = subtasks.find(s => s.id === inp.dataset.sid); s.title = inp.value;
      });
    }
    wireSubtasks();

    overlay.querySelector('#btn-add-subtask').onclick = () => { subtasks.push({ id: U.genId(), title:'', done:false }); refreshSubtasks(); };
    overlay.querySelector('#m-close').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#btn-cancel').onclick = () => U.closeModal(overlay);
    function wireCatChips() {
      overlay.querySelectorAll('#f-cats .chip[data-name]').forEach(chip => chip.onclick = () => {
        selectedCategory = chip.dataset.name;
        overlay.querySelectorAll('#f-cats .chip[data-name]').forEach(c => { c.classList.remove('selected'); c.style.cssText=''; });
        const col = catColor(selectedCategory);
        chip.classList.add('selected'); chip.style.cssText = `background:${col};border-color:${col}`;
      });
      const addBtn = overlay.querySelector('#chip-add-cat');
      if (addBtn) addBtn.onclick = () => {
        const name = prompt('اسم دسته‌بندی جدید؟');
        if (!name || !name.trim()) return;
        const dd = data();
        const clean = name.trim();
        if (!dd.taskCategories.find(c => c.name === clean)) {
          const palette = ['#3E6E8E','#C9962E','#2F5D50','#A8452F','#7A5C2E','#B07E1F','#4C7F6E'];
          dd.taskCategories.push({ name: clean, color: palette[dd.taskCategories.length % palette.length] });
          save();
        }
        selectedCategory = clean;
        const col = catColor(clean);
        addBtn.insertAdjacentHTML('beforebegin', `<div class="chip selected" data-name="${U.escapeHtml(clean)}" style="background:${col};border-color:${col}">${U.escapeHtml(clean)}</div>`);
        overlay.querySelectorAll('#f-cats .chip[data-name]').forEach(c => { if (c.dataset.name !== clean) { c.classList.remove('selected'); c.style.cssText=''; } });
        wireCatChips();
      };
    }
    wireCatChips();
    overlay.querySelectorAll('#f-priority .chip').forEach(chip => chip.onclick = () => {
      selectedPriority = chip.dataset.p;
      overlay.querySelectorAll('#f-priority .chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
    if (id) overlay.querySelector('#btn-delete').onclick = () => {
      const dd = data(); dd.tasks = dd.tasks.filter(x => x.id !== id); save(); U.closeModal(overlay); Z.app.refreshView(); U.toast('وظیفه حذف شد');
    };
    overlay.querySelector('#btn-save').onclick = () => {
      const title = overlay.querySelector('#f-title').value.trim();
      if (!title) { U.toast('عنوان رو وارد کن'); return; }
      const dd = data();
      const payload = {
        title,
        notes: overlay.querySelector('#f-notes').value.trim(),
        category: selectedCategory,
        priority: selectedPriority,
        dueDate: overlay.querySelector('#f-date').value || '',
        dueTime: overlay.querySelector('#f-time').value || '',
        subtasks: subtasks.filter(s => s.title.trim()),
      };
      if (id) {
        Object.assign(t, payload);
      } else {
        dd.tasks.push({ id: U.genId(), status:'todo', createdAt: Date.now(), completedAt:null, ...payload });
      }
      save();
      U.closeModal(overlay);
      Z.app.refreshView();
      U.toast(id ? 'وظیفه به‌روزرسانی شد' : 'وظیفه اضافه شد');
    };
  }

  function subtaskRowHtml(s) {
    return `<div class="subtask-row">
      <div class="task-checkbox ${s.done?'checked':''}" data-sid="${s.id}">${U.icon('check')}</div>
      <input type="text" class="input" style="padding:5px 9px;font-size:12.5px" data-sid="${s.id}" value="${U.escapeHtml(s.title)}" placeholder="عنوان مرحله">
      <button class="icon-btn sub-del" data-sid="${s.id}" style="width:28px;height:28px">${U.icon('x')}</button>
    </div>`;
  }

  return { render };
})();
