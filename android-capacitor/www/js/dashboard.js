/* =========================================================
   Z.views.dashboard — home: greeting, quick stats, growth grid, weekly chart
   ========================================================= */
window.Z = window.Z || {};
Z.views = Z.views || {};

Z.views.dashboard = (function () {
  const U = Z.utils;
  function pid() { return Z.store.getActiveProfileId(); }
  function data() { return Z.store.loadData(pid()); }

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'شب بخیر';
    if (h < 12) return 'صبح بخیر';
    if (h < 17) return 'ظهر بخیر';
    if (h < 20) return 'عصر بخیر';
    return 'شب بخیر';
  }

  function render(root) {
    const d = data();
    const profile = Z.store.getProfiles().find(p => p.id === pid());
    const today = U.todayISO();
    const todaysTasks = d.tasks.filter(t => t.dueDate === today && t.status !== 'done');
    const overdueTasks = d.tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
    const habitsToday = d.habits.filter(h => h.frequency === 'daily');
    const habitsDoneToday = habitsToday.filter(h => h.checkins[today]).length;
    const pomodorosToday = d.pomodoro.sessions.filter(s => s.date === today).length;
    const fin = Z.views.finance.totals();

    root.innerHTML = `
      <div class="greeting-hero">
        <div class="greeting-text">
          <h2>${greeting()}${profile ? '، ' + U.escapeHtml(profile.name) : ''} 👋</h2>
          <p>${U.faWeekdayFromISO(today)} ${U.faDateFromISO(today)}</p>
        </div>
        <div class="flex-gap">
          <button class="btn btn-accent btn-sm" id="btn-quick-pomo">🍅 شروع تمرکز</button>
        </div>
      </div>

      <div class="grid grid-4" style="margin-bottom:18px">
        ${statCard('tasks', 'وظایف امروز', U.faNum(todaysTasks.length), overdueTasks.length ? `${U.faNum(overdueTasks.length)} دیرکرد` : null, 'var(--sky-500)')}
        ${statCard('habit', 'عادت‌های امروز', `${U.faNum(habitsDoneToday)}/${U.faNum(habitsToday.length)}`, null, 'var(--gold-500)')}
        ${statCard('flame', 'پومودورو امروز', U.faNum(pomodorosToday), null, 'var(--rust-500)')}
        ${statCard('finance', 'موجودی', U.formatCompact(fin.balance), null, 'var(--pine-600)')}
      </div>

      <div class="grid" style="grid-template-columns:1.4fr 1fr;margin-bottom:18px" id="dash-grid-2col">
        <div class="card">
          <div class="section-head"><div class="section-title">فعالیت هفتگی</div></div>
          <div style="height:220px"><canvas id="chart-weekly"></canvas></div>
        </div>
        <div class="card growth-grid-card">
          <div class="section-head"><div class="section-title">مسیر رشد</div></div>
          <div class="growth-grid" id="growth-grid" style="grid-template-rows:repeat(7,11px)"></div>
          <div class="growth-legend"><span>کم</span>
            <div class="growth-cell" data-level="1" style="width:10px;height:10px"></div>
            <div class="growth-cell" data-level="2" style="width:10px;height:10px"></div>
            <div class="growth-cell" data-level="3" style="width:10px;height:10px"></div>
            <div class="growth-cell" data-level="4" style="width:10px;height:10px"></div>
            <span>زیاد</span>
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="section-head"><div class="section-title">وظایف پیش‌رو</div><div class="section-link" id="link-tasks">مشاهده همه</div></div>
          ${renderTaskPreview(todaysTasks.concat(overdueTasks).slice(0,4))}
        </div>
        <div class="card">
          <div class="section-head"><div class="section-title">عادت‌های امروز</div><div class="section-link" id="link-habits">مشاهده همه</div></div>
          ${renderHabitPreview(habitsToday.slice(0,4), today)}
        </div>
      </div>
    `;
    root.querySelector('#dash-grid-2col').style.gridTemplateColumns = window.innerWidth < 900 ? '1fr' : '1.4fr 1fr';

    root.querySelector('#btn-quick-pomo').onclick = () => Z.app.navigate('habits');
    root.querySelector('#link-tasks').onclick = () => Z.app.navigate('tasks');
    root.querySelector('#link-habits').onclick = () => Z.app.navigate('habits');
    root.querySelectorAll('#dash-grid-2col .task-list-row, #dash-grid-2col .task-checkbox').forEach(el => el.addEventListener('click', () => Z.app.navigate('tasks')));

    // Weekly activity chart (last 7 days, stacked)
    const days = []; for (let i=6;i>=0;i--) days.push(U.isoAddDays(today,-i));
    const labels = days.map(iso => U.faWeekdayFromISO(iso, true));
    const seriesFor = (key) => days.map(iso => (d.activity[iso] && d.activity[iso][key]) || 0);
    Z.charts.weeklyActivityBar('chart-weekly', labels, [
      { label:'وظایف', data: seriesFor('tasks'), backgroundColor:'#3E6E8E' },
      { label:'عادت‌ها', data: seriesFor('habits'), backgroundColor:'#C9962E' },
      { label:'پومودورو', data: seriesFor('pomodoros'), backgroundColor:'#A8452F' },
      { label:'یادداشت', data: seriesFor('notes'), backgroundColor:'#2F5D50' },
    ]);

    // Growth grid: combined daily activity score
    const combined = {};
    Object.entries(d.activity).forEach(([iso, v]) => { combined[iso] = (v.tasks||0)+(v.habits||0)+(v.pomodoros||0)+(v.notes||0)+(v.tx||0); });
    Z.charts.renderHeatGrid(root.querySelector('#growth-grid'), combined, { days: 91 });
  }

  function statCard(iconName, label, value, trend, color) {
    return `
      <div class="card stat-card">
        <div class="stat-icon" style="background:${color}22;color:${color}">${U.icon(iconName)}</div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
        ${trend ? `<div class="stat-trend trend-down">${trend}</div>` : ''}
      </div>`;
  }

  function renderTaskPreview(list) {
    if (!list.length) return `<div class="text-muted" style="font-size:12.5px;padding:14px 0">وظیفه‌ای برای امروز نیست، عالیه! ✨</div>`;
    return list.map(t => `
      <div class="task-list-row" style="margin-bottom:6px">
        <div class="task-checkbox" data-id="${t.id}">${U.icon('check')}</div>
        <div class="task-row-body"><div class="task-row-title">${U.escapeHtml(t.title)}</div>
          <div class="task-row-meta"><span class="text-muted" style="font-size:11px">${U.relativeDayLabel(t.dueDate)}</span></div>
        </div>
      </div>`).join('');
  }
  function renderHabitPreview(list, today) {
    if (!list.length) return `<div class="text-muted" style="font-size:12.5px;padding:14px 0">هنوز عادت روزانه‌ای اضافه نکردی</div>`;
    return list.map(h => `
      <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--surface-border)">
        <div class="flex-gap"><div class="habit-icon-badge" style="width:30px;height:30px;font-size:14px;background:${h.color}22">${h.icon}</div><span style="font-size:13px;font-weight:700">${U.escapeHtml(h.name)}</span></div>
        <span class="badge ${h.checkins[today]?'badge-done':''}" style="background:${h.checkins[today]?'':'var(--bg-sunken)'}">${h.checkins[today]?'انجام شد':'باقی‌مانده'}</span>
      </div>`).join('');
  }

  return { render };
})();
