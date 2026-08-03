/* =========================================================
   Z.views.reports — evaluation & deeper analytics
   ========================================================= */
window.Z = window.Z || {};
Z.views = Z.views || {};

Z.views.reports = (function () {
  const U = Z.utils;
  let period = 'week'; // 'week' (7d) | 'month' (30d)

  function pid() { return Z.store.getActiveProfileId(); }
  function data() { return Z.store.loadData(pid()); }

  function windowDays() { return period === 'week' ? 7 : 30; }
  function isoRange() {
    const today = U.todayISO();
    const days = [];
    for (let i = windowDays()-1; i >= 0; i--) days.push(U.isoAddDays(today, -i));
    return days;
  }

  function computeSummary() {
    const d = data();
    const days = isoRange();
    const daySet = new Set(days);

    const tasksCreated = d.tasks.filter(t => daySet.has(U.dateToISO(new Date(t.createdAt))));
    const tasksCompleted = d.tasks.filter(t => t.status==='done' && t.completedAt && daySet.has(U.dateToISO(new Date(t.completedAt))));
    const allRelevantTasks = d.tasks.filter(t => (t.dueDate && daySet.has(t.dueDate)) || (t.completedAt && daySet.has(U.dateToISO(new Date(t.completedAt)))));
    const taskRate = allRelevantTasks.length ? Math.round(100 * allRelevantTasks.filter(t=>t.status==='done').length / allRelevantTasks.length) : null;

    const dailyHabits = d.habits.filter(h => h.frequency === 'daily');
    let habitConsistency = null;
    if (dailyHabits.length) {
      let doneCount = 0, total = 0;
      dailyHabits.forEach(h => days.forEach(iso => { total++; if (h.checkins[iso]) doneCount++; }));
      habitConsistency = total ? Math.round(100 * doneCount / total) : null;
    }

    const pomoSessions = d.pomodoro.sessions.filter(s => daySet.has(s.date));
    const pomoMinutes = pomoSessions.reduce((s,x)=>s+x.durationMin, 0);
    const pomoGoal = windowDays() * 2; // rough heuristic: 2 sessions/day baseline
    const pomoScore = Math.round(U.clamp(100 * pomoSessions.length / pomoGoal, 0, 100));

    const tx = d.finance.transactions.filter(t => daySet.has(t.date));
    const income = tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const expense = tx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    let budgetAdherence = null;
    if (d.finance.budgets.length) {
      const scaledLimit = (b) => b.monthlyLimit * (windowDays()/30);
      const scores = d.finance.budgets.map(b => {
        const spent = tx.filter(t=>t.type==='expense'&&t.category===b.category).reduce((s,t)=>s+t.amount,0);
        const limit = scaledLimit(b);
        return limit > 0 ? U.clamp(100 * (1 - Math.max(0, spent-limit)/limit), 0, 100) : 100;
      });
      budgetAdherence = Math.round(scores.reduce((s,x)=>s+x,0)/scores.length);
    }

    const notesCreated = d.notes.filter(n => daySet.has(U.dateToISO(new Date(n.createdAt)))).length;

    // Weighted overall score — components with no data are excluded & weight redistributed
    const components = [
      { key:'task', value: taskRate, weight: 30 },
      { key:'habit', value: habitConsistency, weight: 30 },
      { key:'pomo', value: pomoScore, weight: 20 },
      { key:'budget', value: budgetAdherence, weight: 20 },
    ].filter(c => c.value != null);
    let score = null;
    if (components.length) {
      const totalW = components.reduce((s,c)=>s+c.weight,0);
      score = Math.round(components.reduce((s,c)=>s + c.value*(c.weight/totalW), 0));
    }

    return { taskRate, habitConsistency, pomoScore, pomoSessions: pomoSessions.length, pomoMinutes, budgetAdherence, income, expense, notesCreated, score, tasksCompletedCount: tasksCompleted.length };
  }

  function scoreLabel(score) {
    if (score == null) return { text:'داده کافی نیست', color:'var(--text-faint)' };
    if (score >= 85) return { text:'عالی 🌟', color:'var(--pine-600)' };
    if (score >= 70) return { text:'خوب 👍', color:'var(--gold-600)' };
    if (score >= 50) return { text:'متوسط', color:'var(--sky-600)' };
    return { text:'نیاز به تمرکز بیشتر', color:'var(--danger)' };
  }

  function tips(s) {
    const list = [];
    if (s.taskRate != null && s.taskRate < 60) list.push('چند وظیفه‌ی این دوره هنوز باز مونده — سعی کن هر روز فقط ۳ وظیفه‌ی مهم رو انتخاب و تمومشون کنی.');
    if (s.habitConsistency != null && s.habitConsistency < 60) list.push('قوام عادت‌هات کمی افت کرده — روی یکی از عادت‌ها متمرکز شو و بقیه رو موقتاً ساده‌تر بگیر.');
    if (s.pomoScore < 40) list.push('جلسات تمرکز کمی داشتی — امتحان کن یه پومودورو ۲۵ دقیقه‌ای رو همین الان شروع کنی.');
    if (s.budgetAdherence != null && s.budgetAdherence < 60) list.push('هزینه‌هات از بعضی بودجه‌ها فراتر رفته — بخش «مالی › بودجه‌ها» رو یه نگاه بنداز.');
    if (list.length === 0) list.push('روند خوبی داری، همینطور ادامه بده! 🌱');
    return list;
  }

  function render(root) {
    const s = computeSummary();
    const sl = scoreLabel(s.score);
    root.innerHTML = `
      <div class="filter-tabs" style="margin-bottom:18px">
        <div class="filter-tab ${period==='week'?'active':''}" data-p="week">۷ روز اخیر</div>
        <div class="filter-tab ${period==='month'?'active':''}" data-p="month">۳۰ روز اخیر</div>
      </div>
      <div class="grid" style="grid-template-columns:280px 1fr;gap:16px" id="report-top">
        <div class="card text-center" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
          <div class="pomo-ring-holder" style="width:150px;height:150px">
            <svg viewBox="0 0 220 220"><circle class="pomo-ring-bg" cx="110" cy="110" r="95"></circle>
              <circle class="pomo-ring-fg" cx="110" cy="110" r="95" style="stroke:${sl.color}" stroke-dasharray="${2*Math.PI*95}" stroke-dashoffset="${2*Math.PI*95*(1-(s.score||0)/100)}"></circle></svg>
            <div class="pomo-center"><div class="pomo-time" style="font-size:30px">${s.score!=null?U.faNum(s.score):'—'}</div><div class="pomo-mode">امتیاز</div></div>
          </div>
          <div style="font-weight:800;color:${sl.color}">${sl.text}</div>
          <button class="btn btn-accent btn-sm" id="btn-ai-review" style="margin-top:6px">${U.icon('sparkle')} ارزیابی هوشمند از دستیار</button>
        </div>
        <div class="grid grid-2">
          ${metricCard('وظایف انجام‌شده', s.taskRate!=null?U.faNum(s.taskRate)+'٪':'—', 'tasks','var(--sky-500)')}
          ${metricCard('قوام عادت‌ها', s.habitConsistency!=null?U.faNum(s.habitConsistency)+'٪':'—', 'habit','var(--gold-500)')}
          ${metricCard('جلسات پومودورو', U.faNum(s.pomoSessions)+' جلسه', 'flame','var(--rust-500)')}
          ${metricCard('پایبندی بودجه', s.budgetAdherence!=null?U.faNum(s.budgetAdherence)+'٪':'—', 'finance','var(--pine-600)')}
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">نکات این دوره</div>
        <ul style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
          ${tips(s).map(t => `<li style="font-size:13.5px;display:flex;gap:8px"><span>🌱</span><span>${t}</span></li>`).join('')}
        </ul>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">جمع مالی این دوره</div>
        <div class="grid grid-2" style="margin-top:10px">
          <div class="stat-card"><div class="stat-value" style="color:var(--pine-600)">${U.formatCurrency(s.income, data().settings.currency)}</div><div class="stat-label">درآمد</div></div>
          <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${U.formatCurrency(s.expense, data().settings.currency)}</div><div class="stat-label">هزینه</div></div>
        </div>
      </div>
    `;
    root.querySelectorAll('.filter-tab[data-p]').forEach(el => el.onclick = () => { period = el.dataset.p; render(root); });
    root.querySelector('#btn-ai-review').onclick = () => Z.ai.requestSmartReview(computeSummary(), period === 'week' ? '۷ روز اخیر' : '۳۰ روز اخیر');
  }

  function metricCard(label, value, iconName, color) {
    return `<div class="card stat-card">
      <div class="stat-icon" style="background:${color}22;color:${color}">${U.icon(iconName)}</div>
      <div class="stat-value" style="font-size:20px">${value}</div>
      <div class="stat-label">${label}</div>
    </div>`;
  }

  return { render, computeSummary };
})();
