/* =========================================================
   Z.views.calendar — month grid: tasks due + activity, per day
   ========================================================= */
window.Z = window.Z || {};
Z.views = Z.views || {};

Z.views.calendar = (function () {
  const U = Z.utils;
  const T = Z.i18n.t;

  function pid() { return Z.store.getActiveProfileId(); }
  function data() { return Z.store.loadData(pid()); }

  let view = null; // { y, m, lang }
  let selectedISO = null;

  function todayYM() {
    const iso = U.todayISO();
    const d = new Date(iso + 'T00:00:00');
    if (Z.i18n.isFa()) { const [jy,jm] = U.gregorianToJalali(d.getFullYear(), d.getMonth()+1, d.getDate()); return { y: jy, m: jm }; }
    return { y: d.getFullYear(), m: d.getMonth()+1 };
  }
  function ensureViewState() {
    const lang = Z.i18n.getLang();
    if (!view || view.lang !== lang) { const t = todayYM(); view = { y: t.y, m: t.m, lang }; }
  }

  function isoOf(y, m, d) {
    if (Z.i18n.isFa()) { const [gy,gm,gd] = U.jalaliToGregorian(y, m, d); return U.dateToISO(new Date(gy, gm-1, gd)); }
    return U.dateToISO(new Date(y, m-1, d));
  }
  function monthLength(y, m) {
    const startIso = isoOf(y, m, 1);
    let ny = m===12 ? y+1 : y, nm = m===12 ? 1 : m+1;
    const nextIso = isoOf(ny, nm, 1);
    return U.isoDiffDays(nextIso, startIso);
  }
  function monthLabel(y, m) {
    if (Z.i18n.isFa()) return `${U.JALALI_MONTHS[m-1]} ${U.faNum(y)}`;
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${names[m-1]} ${y}`;
  }
  function shiftMonth(delta) {
    let { y, m } = view;
    m += delta;
    if (m > 12) { m = 1; y++; } else if (m < 1) { m = 12; y--; }
    view = { y, m, lang: Z.i18n.getLang() };
  }

  function render(root) {
    ensureViewState();
    const d = data();
    const today = U.todayISO();
    const len = monthLength(view.y, view.m);
    const weekdayLabels = T('cal.weekdaysShort').split(',');

    // Build a flat list of cells: leading blanks (from previous month) + this month's days + trailing blanks
    const firstIso = isoOf(view.y, view.m, 1);
    const jsDow = new Date(firstIso + 'T00:00:00').getDay(); // 0 Sun..6 Sat
    const leadCount = Z.i18n.isFa() ? ((jsDow + 1) % 7) : jsDow; // align to Sat-start (fa) or Sun-start (en)

    const cells = [];
    for (let i=0;i<leadCount;i++) cells.push(null);
    for (let day=1; day<=len; day++) cells.push(isoOf(view.y, view.m, day));

    root.innerHTML = `
      <div class="cal-head">
        <div class="cal-nav">
          <button class="icon-btn" id="cal-prev">${U.icon(Z.i18n.isFa() ? 'chevronRight' : 'chevronLeft')}</button>
          <button class="btn btn-ghost btn-sm" id="cal-today">${T('cal.today')}</button>
          <button class="icon-btn" id="cal-next">${U.icon(Z.i18n.isFa() ? 'chevronLeft' : 'chevronRight')}</button>
        </div>
        <div class="cal-month-label">${monthLabel(view.y, view.m)}</div>
      </div>
      <div class="cal-grid" style="margin-bottom:6px">
        ${weekdayLabels.map(w => `<div class="cal-weekday-head">${w}</div>`).join('')}
      </div>
      <div class="cal-grid" id="cal-cells"></div>
    `;
    root.querySelector('#cal-prev').onclick = () => { shiftMonth(-1); render(root); };
    root.querySelector('#cal-next').onclick = () => { shiftMonth(1); render(root); };
    root.querySelector('#cal-today').onclick = () => { view = { ...todayYM(), lang: Z.i18n.getLang() }; selectedISO = today; render(root); };

    const cellsHolder = root.querySelector('#cal-cells');
    cellsHolder.innerHTML = cells.map(iso => {
      if (!iso) return `<div class="cal-cell outside"></div>`;
      const dayTasks = d.tasks.filter(t => t.dueDate === iso);
      const act = d.activity[iso];
      const dayNum = Z.i18n.isFa() ? U.gregorianToJalali(...isoParts(iso))[2] : new Date(iso+'T00:00:00').getDate();
      const dots = dayTasks.slice(0,4).map(t => {
        const cat = d.taskCategories.find(c => c.name === t.category);
        const col = t.status==='done' ? 'var(--pine-300)' : (cat ? cat.color : 'var(--sky-500)');
        return `<span class="cal-dot" style="background:${col}"></span>`;
      }).join('');
      const extra = dayTasks.length > 4 ? `<span class="cal-more">+${U.faNum(dayTasks.length-4)}</span>` : '';
      const isToday = iso === today;
      const isSelected = iso === selectedISO;
      return `
        <div class="cal-cell ${isToday?'today':''} ${isSelected?'selected':''}" data-iso="${iso}">
          <div class="cal-day-num">${U.faNum(dayNum)}</div>
          ${act && (act.habits||act.pomodoros||act.notes) ? `<div class="cal-habit-tick">🌱</div>` : ''}
          <div class="cal-dots">${dots}${extra}</div>
        </div>`;
    }).join('');

    cellsHolder.querySelectorAll('.cal-cell[data-iso]').forEach(cell => cell.addEventListener('click', () => {
      selectedISO = cell.dataset.iso;
      openDayDetail(selectedISO);
      cellsHolder.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
    }));
  }

  function isoParts(iso) {
    const d = new Date(iso + 'T00:00:00');
    return [d.getFullYear(), d.getMonth()+1, d.getDate()];
  }

  function openDayDetail(iso) {
    const d = data();
    const dayTasks = d.tasks.filter(t => t.dueDate === iso).sort((a,b) => (a.status==='done')-(b.status==='done'));
    const act = d.activity[iso] || { habits:0, pomodoros:0, notes:0, tx:0 };
    const tx = d.finance.transactions.filter(t => t.date === iso);
    const net = tx.reduce((s,t) => s + (t.type==='income'?t.amount:-t.amount), 0);
    const isPast = iso <= U.todayISO();

    const overlay = U.openModal(`
      <div class="modal-head"><div class="modal-title">${U.faWeekdayFromISO(iso)} · ${U.faDateFromISO(iso)}</div><button class="icon-btn" id="m-close">${U.icon('x')}</button></div>
      <div class="flex-between" style="margin-bottom:10px">
        <div class="section-title" style="font-size:13.5px">${T('cal.dayTasks')}</div>
        <button class="btn btn-ghost btn-sm" id="btn-add-day-task">${U.icon('plus')} ${T('cal.addTask')}</button>
      </div>
      <div id="day-task-list" style="margin-bottom:16px">
        ${dayTasks.length ? dayTasks.map(t => `
          <div class="task-list-row" data-id="${t.id}" style="margin-bottom:6px;cursor:pointer">
            <div class="task-checkbox ${t.status==='done'?'checked':''}" data-id="${t.id}">${U.icon('check')}</div>
            <div class="task-row-body"><div class="task-row-title ${t.status==='done'?'done':''}">${U.escapeHtml(t.title)}</div></div>
          </div>`).join('') : `<div class="text-muted" style="font-size:12.5px">${T('cal.noTasks')}</div>`}
      </div>
      ${isPast ? `
      <div class="divider"></div>
      <div class="section-title" style="font-size:13.5px;margin-bottom:10px">${T('cal.activity')}</div>
      <div class="grid grid-2">
        <div class="stat-card"><div class="stat-value" style="font-size:18px">${U.faNum(act.habits||0)}</div><div class="stat-label">${T('cal.habitsChecked')}</div></div>
        <div class="stat-card"><div class="stat-value" style="font-size:18px">${U.faNum(act.pomodoros||0)}</div><div class="stat-label">${T('cal.pomodoros')}</div></div>
        <div class="stat-card"><div class="stat-value" style="font-size:18px">${U.faNum(act.notes||0)}</div><div class="stat-label">${T('cal.notesCreated')}</div></div>
        <div class="stat-card"><div class="stat-value" style="font-size:18px;color:${net<0?'var(--danger)':'var(--pine-600)'}">${U.formatCurrency(net, d.settings.currency)}</div><div class="stat-label">${T('cal.netFinance')}</div></div>
      </div>` : ''}
    `, { className:'modal-lg' });

    overlay.querySelector('#m-close').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#btn-add-day-task').onclick = () => { U.closeModal(overlay); Z.views.tasks.openTaskModal(null, iso); };
    overlay.querySelectorAll('#day-task-list .task-checkbox').forEach(cb => cb.onclick = (e) => {
      e.stopPropagation();
      const t = data().tasks.find(t => t.id === cb.dataset.id);
      const wasDone = t.status === 'done';
      t.status = wasDone ? 'todo' : 'done';
      if (!wasDone) { t.completedAt = Date.now(); Z.store.bumpActivity(pid(), 'tasks', U.todayISO(), 1); Z.gamification.checkAndUnlock(pid()); }
      Z.store.touch(pid());
      U.closeModal(overlay);
      Z.app.refreshView();
      openDayDetail(iso);
    });
    overlay.querySelectorAll('#day-task-list .task-list-row').forEach(row => row.addEventListener('click', (e) => {
      if (e.target.closest('.task-checkbox')) return;
      U.closeModal(overlay);
      Z.views.tasks.openTaskModal(row.dataset.id);
    }));
  }

  return { render };
})();
