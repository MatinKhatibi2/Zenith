/* =========================================================
   Z.views.habits — Habit Tracker + Pomodoro + Alarms — bilingual
   Also exports: Z.pomodoro (timer engine), Z.alarmEngine (background checker)
   ========================================================= */
window.Z = window.Z || {};
Z.views = Z.views || {};

function pidH() { return Z.store.getActiveProfileId(); }
function dataH() { return Z.store.loadData(pidH()); }

/* ---------------------------------------------------------
   Z.pomodoro — timer engine, independent of view lifecycle
--------------------------------------------------------- */
Z.pomodoro = (function () {
  const U = Z.utils;
  let onTickUI = null;

  let state = {
    phase: 'focus', running: false, remainingMs: 25 * 60000, endTimestamp: null,
    round: 0, linkedTaskId: null, linkedHabitId: null,
  };

  function settings() {
    const d = dataH();
    return d ? d.pomodoro.settings : { focusMin:25, shortBreakMin:5, longBreakMin:15, roundsBeforeLongBreak:4 };
  }
  function phaseDurationMs(phase) {
    const s = settings();
    if (phase === 'focus') return s.focusMin * 60000;
    if (phase === 'short') return s.shortBreakMin * 60000;
    return s.longBreakMin * 60000;
  }
  function setOnTickUI(fn) { onTickUI = fn; }

  function start() {
    if (state.running) return;
    state.running = true;
    state.endTimestamp = Date.now() + state.remainingMs;
    ensureNotifPermission();
  }
  function pause() {
    if (!state.running) return;
    state.remainingMs = Math.max(0, state.endTimestamp - Date.now());
    state.running = false;
    state.endTimestamp = null;
  }
  function reset() {
    state.running = false;
    state.endTimestamp = null;
    state.remainingMs = phaseDurationMs(state.phase);
  }
  function skip() { completePhase(true); }
  function setLink(taskId, habitId) { state.linkedTaskId = taskId; state.linkedHabitId = habitId; }

  function completePhase(silent) {
    const wasFocus = state.phase === 'focus';
    if (wasFocus && !silent) {
      logSession();
      Z.store.bumpActivity(pidH(), 'pomodoros', U.todayISO(), 1);
      Z.gamification.checkAndUnlock(pidH());
      playBeep(2);
      notify('🍅', Z.i18n.t('pomo.focus'));
    }
    if (wasFocus) state.round += 1;
    const s = settings();
    if (state.phase === 'focus') state.phase = (state.round % s.roundsBeforeLongBreak === 0) ? 'long' : 'short';
    else state.phase = 'focus';
    state.remainingMs = phaseDurationMs(state.phase);
    state.running = false;
    state.endTimestamp = null;
    if (onTickUI) onTickUI();
  }

  function logSession() {
    const d = dataH();
    if (!d) return;
    d.pomodoro.sessions.push({ id: U.genId(), date: U.todayISO(), durationMin: settings().focusMin, linkedTaskId: state.linkedTaskId, linkedHabitId: state.linkedHabitId, ts: Date.now() });
    Z.store.touch(pidH());
  }

  function tick() {
    if (!pidH()) return;
    if (state.running && state.endTimestamp) {
      const remaining = state.endTimestamp - Date.now();
      if (remaining <= 0) completePhase(false);
      else { state.remainingMs = remaining; if (onTickUI) onTickUI(); }
    }
  }

  function playBeep(times) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let t = ctx.currentTime;
      for (let i = 0; i < (times||1); i++) {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = 740;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.35);
        t += 0.42;
      }
    } catch (e) {}
  }
  function ensureNotifPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
  }
  function notify(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') { try { new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch(e){} }
  }

  return { get state() { return state; }, settings, phaseDurationMs, start, pause, reset, skip, setLink, tick, setOnTickUI, playBeep, notify, ensureNotifPermission };
})();

/* ---------------------------------------------------------
   Z.alarmEngine — background alarm checker
--------------------------------------------------------- */
Z.alarmEngine = (function () {
  const U = Z.utils;
  let firedThisMinute = new Set();
  let lastMinuteKey = '';

  function tick() {
    const pid = pidH();
    if (!pid) return;
    const d = dataH();
    if (!d || !d.alarms || !d.alarms.length) return;
    const now = new Date();
    const hm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const minuteKey = U.todayISO() + 'T' + hm;
    if (minuteKey !== lastMinuteKey) { firedThisMinute.clear(); lastMinuteKey = minuteKey; }
    const dow = Z.utils.isoWeekdayIrIndex(U.todayISO());

    d.alarms.forEach(a => {
      if (!a.enabled) return;
      if (a.time !== hm) return;
      if (a.days && a.days.length && !a.days.includes(dow)) return;
      if (firedThisMinute.has(a.id)) return;
      firedThisMinute.add(a.id);
      Z.pomodoro.playBeep(1);
      Z.pomodoro.notify('⏰ ' + (a.label || Z.i18n.t('alarms.newTitle')), Z.i18n.t('common.today'));
      Z.utils.toast('⏰ ' + (a.label || Z.i18n.t('alarms.newTitle')));
    });
  }
  return { tick };
})();

/* ---------------------------------------------------------
   Z.views.habits — the actual page (3 sub-tabs)
--------------------------------------------------------- */
Z.views.habits = (function () {
  const U = Z.utils;
  const T = Z.i18n.t;
  let sub = 'habits';
  const HABIT_ICONS = ['💧','📚','🏃','🧘','🍎','😴','✍️','🎯','🚭','💪','🧹','🎨','🎵','☀️','🚴','🥗'];
  const HABIT_COLORS = ['#2F5D50','#C9962E','#3E6E8E','#A8452F','#4C7F6E','#B07E1F'];
  const DOW_LABELS_KEY = 'cal.weekdaysShort';

  function pid() { return Z.store.getActiveProfileId(); }
  function data() { return Z.store.loadData(pid()); }
  function save() { Z.store.touch(pid()); }
  function dowLabels() { return T(DOW_LABELS_KEY).split(','); }

  function render(root) {
    root.innerHTML = `
      <div class="filter-tabs" style="margin-bottom:18px">
        <div class="filter-tab ${sub==='habits'?'active':''}" data-sub="habits">${U.icon('habit')} ${T('habits.tabHabits')}</div>
        <div class="filter-tab ${sub==='pomodoro'?'active':''}" data-sub="pomodoro">🍅 ${T('habits.tabPomodoro')}</div>
        <div class="filter-tab ${sub==='alarms'?'active':''}" data-sub="alarms">${U.icon('bell')} ${T('habits.tabAlarms')}</div>
      </div>
      <div id="habit-sub-body"></div>
    `;
    root.querySelectorAll('.filter-tab[data-sub]').forEach(el => el.onclick = () => { sub = el.dataset.sub; render(root); });
    const body = root.querySelector('#habit-sub-body');
    if (sub === 'habits') renderHabitsList(body);
    else if (sub === 'pomodoro') renderPomodoro(body);
    else renderAlarms(body);
  }

  /* ============ HABITS LIST ============ */
  function computeStreak(habit) {
    if (habit.frequency !== 'daily') return null;
    let streak = 0;
    let cursor = U.todayISO();
    if (!habit.checkins[cursor]) cursor = U.isoAddDays(cursor, -1);
    while (habit.checkins[cursor]) { streak++; cursor = U.isoAddDays(cursor, -1); }
    return streak;
  }
  function weeklyProgress(habit) {
    const today = U.todayISO();
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const iso = U.isoAddDays(today, -i);
      if (U.isoWeekdayIrIndex(iso) === 0 && i !== 0) break;
      if (habit.checkins[iso]) count++;
    }
    return count;
  }

  function renderHabitsList(root) {
    const d = data();
    root.innerHTML = `
      <div class="flex-between" style="margin-bottom:14px">
        <div class="text-muted" style="font-size:12.5px">${U.faNum(d.habits.length)} ${T('habits.activeCount')}</div>
        <button class="btn btn-primary btn-sm" id="btn-add-habit">${U.icon('plus')} ${T('habits.new')}</button>
      </div>
      <div class="grid grid-2" id="habit-cards"></div>
    `;
    root.querySelector('#btn-add-habit').onclick = () => openHabitModal();
    const holder = root.querySelector('#habit-cards');
    if (d.habits.length === 0) {
      holder.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${U.icon('habit')}<div class="empty-state-title">${T('habits.emptyTitle')}</div><div>${T('habits.emptySub')}</div></div>`;
      return;
    }
    holder.innerHTML = d.habits.map(h => {
      const today = U.todayISO();
      const doneToday = !!h.checkins[today];
      const streak = computeStreak(h);
      const heat = [];
      for (let i = 13; i >= 0; i--) {
        const iso = U.isoAddDays(today, -i);
        heat.push(`<div class="heat-cell" data-level="${h.checkins[iso] ? 4 : 0}" title="${U.faDateFromISO(iso,{short:true})}"></div>`);
      }
      return `
      <div class="card habit-card" data-id="${h.id}">
        <div class="habit-head">
          <div class="habit-title-row">
            <div class="habit-icon-badge" style="background:${h.color}22">${h.icon}</div>
            <div>
              <div style="font-weight:800;font-size:14px">${U.escapeHtml(h.name)}</div>
              <div class="text-muted" style="font-size:11px">${h.frequency==='daily' ? T('habits.daily') : `${U.faNum(h.targetPerWeek)} ${T('habits.timesPerWeek')}`}</div>
            </div>
          </div>
          ${streak != null ? `<div class="streak-tag">${U.icon('flame')} ${U.faNum(streak)}</div>` : `<div class="streak-tag">${U.faNum(weeklyProgress(h))}/${U.faNum(h.targetPerWeek)}</div>`}
        </div>
        <div class="heat-grid" style="grid-template-columns:repeat(14,1fr)">${heat.join('')}</div>
        <button class="checkin-btn ${doneToday?'done':''}" data-id="${h.id}">${doneToday ? U.icon('check')+' '+T('habits.checkedToday') : T('habits.checkin')}</button>
      </div>`;
    }).join('');

    holder.querySelectorAll('.habit-card').forEach(card => card.addEventListener('click', (e) => {
      if (e.target.closest('.checkin-btn')) return;
      openHabitModal(card.dataset.id);
    }));
    holder.querySelectorAll('.checkin-btn').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCheckin(btn.dataset.id);
    }));
  }

  function toggleCheckin(id) {
    const h = data().habits.find(h => h.id === id);
    if (!h) return;
    const today = U.todayISO();
    const was = !!h.checkins[today];
    if (was) delete h.checkins[today]; else h.checkins[today] = true;
    Z.store.bumpActivity(pid(), 'habits', today, was ? -1 : 1);
    save();
    Z.app.refreshView();
    if (!was) { U.toast(T('habits.loggedToast')); Z.gamification.checkAndUnlock(pid()); }
  }

  function openHabitModal(id) {
    const d = data();
    const h = id ? d.habits.find(h => h.id === id) : { id:null, name:'', icon:HABIT_ICONS[0], color:HABIT_COLORS[0], frequency:'daily', targetPerWeek:3, checkins:{} };
    const overlay = U.openModal(`
      <div class="modal-head"><div class="modal-title">${id?T('habits.editTitle'):T('habits.newTitle')}</div><button class="icon-btn" id="m-close">${U.icon('x')}</button></div>
      <div class="field"><label>${T('habits.nameLabel')}</label><input class="input" id="f-name" value="${U.escapeHtml(h.name)}" placeholder="${T('habits.namePlaceholder')}"></div>
      <div class="field"><label>${T('habits.iconLabel')}</label>
        <div class="chip-select" id="f-icons">${HABIT_ICONS.map(ic => `<div class="chip ${h.icon===ic?'selected':''}" data-icon="${ic}" style="font-size:16px">${ic}</div>`).join('')}</div>
      </div>
      <div class="field"><label>${T('habits.colorLabel')}</label>
        <div class="chip-select" id="f-colors">${HABIT_COLORS.map(c => `<div class="chip" data-color="${c}" style="background:${c};width:26px;height:26px;padding:0;border-color:${c};${h.color===c?'box-shadow:0 0 0 2px var(--surface),0 0 0 4px '+c:''}"></div>`).join('')}</div>
      </div>
      <div class="field"><label>${T('habits.freqLabel')}</label>
        <div class="chip-select" id="f-freq">
          <div class="chip ${h.frequency==='daily'?'selected':''}" data-f="daily">${T('habits.freqDaily')}</div>
          <div class="chip ${h.frequency==='weekly'?'selected':''}" data-f="weekly">${T('habits.freqWeekly')}</div>
        </div>
      </div>
      <div class="field" id="f-target-wrap" style="${h.frequency==='weekly'?'':'display:none'}">
        <label>${T('habits.targetLabel')}</label>
        <input class="input" type="number" min="1" max="7" id="f-target" value="${h.targetPerWeek||3}">
      </div>
      <div class="modal-actions">
        ${id ? `<button class="btn btn-danger" id="btn-delete">${U.icon('trash')} ${T('common.delete')}</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" id="btn-cancel">${T('common.cancel')}</button>
        <button class="btn btn-primary" id="btn-save">${T('common.save')}</button>
      </div>
    `);
    let selIcon = h.icon, selColor = h.color, selFreq = h.frequency;
    overlay.querySelectorAll('#f-icons .chip').forEach(c => c.onclick = () => { selIcon = c.dataset.icon; overlay.querySelectorAll('#f-icons .chip').forEach(x=>x.classList.remove('selected')); c.classList.add('selected'); });
    overlay.querySelectorAll('#f-colors .chip').forEach(c => c.onclick = () => {
      selColor = c.dataset.color;
      overlay.querySelectorAll('#f-colors .chip').forEach(x=>x.style.boxShadow='none');
      c.style.boxShadow = `0 0 0 2px var(--surface), 0 0 0 4px ${selColor}`;
    });
    overlay.querySelectorAll('#f-freq .chip').forEach(c => c.onclick = () => {
      selFreq = c.dataset.f;
      overlay.querySelectorAll('#f-freq .chip').forEach(x=>x.classList.remove('selected')); c.classList.add('selected');
      overlay.querySelector('#f-target-wrap').style.display = selFreq === 'weekly' ? '' : 'none';
    });
    overlay.querySelector('#m-close').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#btn-cancel').onclick = () => U.closeModal(overlay);
    if (id) overlay.querySelector('#btn-delete').onclick = () => {
      const dd = data(); dd.habits = dd.habits.filter(x=>x.id!==id); save(); U.closeModal(overlay); Z.app.refreshView(); U.toast(T('habits.deleted'));
    };
    overlay.querySelector('#btn-save').onclick = () => {
      const name = overlay.querySelector('#f-name').value.trim();
      if (!name) { U.toast(T('habits.enterName')); return; }
      const payload = { name, icon:selIcon, color:selColor, frequency:selFreq, targetPerWeek: +overlay.querySelector('#f-target').value || 3 };
      const dd = data();
      if (id) Object.assign(h, payload);
      else dd.habits.push({ id:U.genId(), checkins:{}, createdAt:Date.now(), ...payload });
      save(); U.closeModal(overlay); Z.app.refreshView();
      U.toast(id?T('habits.updated'):T('habits.added'));
    };
  }

  /* ============ POMODORO ============ */
  function fmtTime(ms) {
    const total = Math.max(0, Math.ceil(ms/1000));
    const m = String(Math.floor(total/60)).padStart(2,'0');
    const s = String(total%60).padStart(2,'0');
    return U.faNum(m) + ':' + U.faNum(s);
  }

  function maybeShowPomodoroIntro() {
    const d = data();
    if (d.settings.pomodoroIntroSeen) return;
    d.settings.pomodoroIntroSeen = true;
    Z.store.touch(pid());
    const overlay = U.openModal(`
      <div style="text-align:center;padding:6px 4px 0">
        <div style="font-size:46px;margin-bottom:6px">🍅</div>
        <div class="modal-title" style="margin-bottom:10px">${T('pomo.introTitle')}</div>
        <p style="font-size:13.5px;color:var(--text-muted);line-height:1.9;text-align:start">${T('pomo.introBody')}</p>
        <button class="btn btn-accent btn-block" id="btn-intro-ok" style="margin-top:16px">${T('pomo.introCta')}</button>
      </div>
    `);
    overlay.querySelector('#btn-intro-ok').onclick = () => U.closeModal(overlay);
  }

  function renderPomodoro(root) {
    maybeShowPomodoroIntro();
    const d = data();
    const st = Z.pomodoro.state;
    const dur = Z.pomodoro.phaseDurationMs(st.phase);
    const pct = 1 - (st.remainingMs / dur);
    const R = 100, C = 2*Math.PI*R;
    const phaseLabel = { focus:T('pomo.focus'), short:T('pomo.short'), long:T('pomo.long') }[st.phase];
    const todaysSessions = d.pomodoro.sessions.filter(s => s.date === U.todayISO()).length;

    root.innerHTML = `
      <div class="card pomo-wrap">
        <button class="icon-btn" id="btn-pomo-info" style="align-self:flex-end;margin-bottom:-8px">❔</button>
        <div class="pomo-ring-holder">
          <svg viewBox="0 0 220 220">
            <circle class="pomo-ring-bg" cx="110" cy="110" r="${R}"></circle>
            <circle class="pomo-ring-fg" cx="110" cy="110" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct)}"></circle>
          </svg>
          <div class="pomo-center">
            <div class="pomo-time">${fmtTime(st.remainingMs)}</div>
            <div class="pomo-mode">${phaseLabel}</div>
          </div>
        </div>
        <div class="pomo-sessions">
          ${Array.from({length: Z.pomodoro.settings().roundsBeforeLongBreak}).map((_,i) => `<div class="pomo-session-dot ${ (st.round % Z.pomodoro.settings().roundsBeforeLongBreak) > i ? 'filled':''}"></div>`).join('')}
        </div>
        <div class="pomo-controls">
          <button class="pomo-round-btn secondary" id="btn-reset">${U.icon('reset')}</button>
          <button class="pomo-round-btn" id="btn-toggle">${U.icon(st.running?'pause':'play')}</button>
          <button class="pomo-round-btn secondary" id="btn-skip">${U.icon('sparkle')}</button>
        </div>
        <div class="text-muted" style="font-size:12.5px">${U.faNum(todaysSessions)} ${T('pomo.todayCount')}</div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="flex-between" style="margin-bottom:10px">
          <div class="card-title" style="margin-bottom:0">${T('pomo.settingsTitle')}</div>
          <button class="btn btn-ghost btn-sm" id="btn-pomo-settings">${U.icon('settings')} ${T('pomo.editTimes')}</button>
        </div>
        <div class="card-sub">${T('pomo.summary', { focus:U.faNum(Z.pomodoro.settings().focusMin), short:U.faNum(Z.pomodoro.settings().shortBreakMin), long:U.faNum(Z.pomodoro.settings().longBreakMin) })}</div>
      </div>
    `;
    Z.pomodoro.setOnTickUI(() => { if (root.isConnected) renderPomodoro(root); });
    root.querySelector('#btn-toggle').onclick = () => { st.running ? Z.pomodoro.pause() : Z.pomodoro.start(); renderPomodoro(root); };
    root.querySelector('#btn-reset').onclick = () => { Z.pomodoro.reset(); renderPomodoro(root); };
    root.querySelector('#btn-skip').onclick = () => { Z.pomodoro.skip(); renderPomodoro(root); };
    root.querySelector('#btn-pomo-settings').onclick = () => openPomoSettingsModal(root);
    root.querySelector('#btn-pomo-info').onclick = () => {
      const d2 = data(); d2.settings.pomodoroIntroSeen = false; Z.store.touch(pid()); maybeShowPomodoroIntro();
    };
  }

  function openPomoSettingsModal(pomoRoot) {
    const s = Z.pomodoro.settings();
    const overlay = U.openModal(`
      <div class="modal-head"><div class="modal-title">${T('pomo.modalTitle')}</div><button class="icon-btn" id="m-close">${U.icon('x')}</button></div>
      <div class="input-row">
        <div class="field" style="flex:1"><label>${T('pomo.focusMin')}</label><input class="input" type="number" min="1" id="f-focus" value="${s.focusMin}"></div>
        <div class="field" style="flex:1"><label>${T('pomo.shortMin')}</label><input class="input" type="number" min="1" id="f-short" value="${s.shortBreakMin}"></div>
      </div>
      <div class="input-row">
        <div class="field" style="flex:1"><label>${T('pomo.longMin')}</label><input class="input" type="number" min="1" id="f-long" value="${s.longBreakMin}"></div>
        <div class="field" style="flex:1"><label>${T('pomo.roundsLabel')}</label><input class="input" type="number" min="1" id="f-rounds" value="${s.roundsBeforeLongBreak}"></div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" id="btn-cancel">${T('common.cancel')}</button><button class="btn btn-primary" id="btn-save">${T('common.save')}</button></div>
    `);
    overlay.querySelector('#m-close').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#btn-cancel').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#btn-save').onclick = () => {
      const d = data();
      d.pomodoro.settings = {
        focusMin: +overlay.querySelector('#f-focus').value || 25,
        shortBreakMin: +overlay.querySelector('#f-short').value || 5,
        longBreakMin: +overlay.querySelector('#f-long').value || 15,
        roundsBeforeLongBreak: +overlay.querySelector('#f-rounds').value || 4,
      };
      Z.store.touch(pid());
      Z.pomodoro.reset();
      U.closeModal(overlay);
      renderPomodoro(pomoRoot);
      U.toast(T('pomo.settingsSaved'));
    };
  }

  /* ============ ALARMS ============ */
  function renderAlarms(root) {
    const d = data();
    root.innerHTML = `
      <div class="flex-between" style="margin-bottom:14px">
        <div class="text-muted" style="font-size:12.5px">${T('alarms.hint')}</div>
        <button class="btn btn-primary btn-sm" id="btn-add-alarm">${U.icon('plus')} ${T('alarms.new')}</button>
      </div>
      <div id="alarm-list"></div>
    `;
    root.querySelector('#btn-add-alarm').onclick = () => openAlarmModal();
    const holder = root.querySelector('#alarm-list');
    if (d.alarms.length === 0) { holder.innerHTML = `<div class="empty-state">${U.icon('bell')}<div class="empty-state-title">${T('alarms.emptyTitle')}</div></div>`; return; }
    const labels = dowLabels();
    holder.innerHTML = d.alarms.map(a => `
      <div class="alarm-row" data-id="${a.id}">
        <div class="alarm-time">${U.faTime(a.time)}</div>
        <div class="alarm-meta">
          <div class="alarm-label">${U.escapeHtml(a.label||T('alarms.newTitle'))}</div>
          <div class="alarm-days">${a.days && a.days.length===7 ? T('alarms.everyDay') : (a.days||[]).map(i=>labels[i]).join(' ، ') || T('alarms.once')}</div>
        </div>
        <label class="switch"><input type="checkbox" data-id="${a.id}" ${a.enabled?'checked':''}><span class="switch-track"></span></label>
        <button class="icon-btn edit-alarm" data-id="${a.id}" style="width:32px;height:32px">${U.icon('edit')}</button>
      </div>
    `).join('');
    holder.querySelectorAll('.switch input').forEach(cb => cb.onchange = () => {
      const a = data().alarms.find(a=>a.id===cb.dataset.id); a.enabled = cb.checked; save();
      if (cb.checked) Z.pomodoro.ensureNotifPermission();
    });
    holder.querySelectorAll('.edit-alarm').forEach(b => b.onclick = () => openAlarmModal(b.dataset.id));
  }

  function openAlarmModal(id) {
    const d = data();
    const a = id ? d.alarms.find(a=>a.id===id) : { id:null, time:'08:00', label:'', days:[0,1,2,3,4,5,6], enabled:true };
    const labels = dowLabels();
    const overlay = U.openModal(`
      <div class="modal-head"><div class="modal-title">${id?T('alarms.editTitle'):T('alarms.newTitle')}</div><button class="icon-btn" id="m-close">${U.icon('x')}</button></div>
      <div class="field"><label>${T('alarms.timeLabel')}</label><input class="input" type="time" id="f-time" value="${a.time}"></div>
      <div class="field"><label>${T('alarms.titleLabel')}</label><input class="input" id="f-label" value="${U.escapeHtml(a.label)}" placeholder="${T('alarms.titlePlaceholder')}"></div>
      <div class="field"><label>${T('alarms.daysLabel')}</label>
        <div class="chip-select" id="f-days">${labels.map((lb,i) => `<div class="chip ${a.days.includes(i)?'selected':''}" data-i="${i}">${lb}</div>`).join('')}</div>
      </div>
      <div class="modal-actions">
        ${id ? `<button class="btn btn-danger" id="btn-delete">${U.icon('trash')} ${T('common.delete')}</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" id="btn-cancel">${T('common.cancel')}</button>
        <button class="btn btn-primary" id="btn-save">${T('common.save')}</button>
      </div>
    `);
    let selDays = [...a.days];
    overlay.querySelectorAll('#f-days .chip').forEach(c => c.onclick = () => {
      const i = +c.dataset.i;
      if (selDays.includes(i)) { selDays = selDays.filter(x=>x!==i); c.classList.remove('selected'); }
      else { selDays.push(i); c.classList.add('selected'); }
    });
    overlay.querySelector('#m-close').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#btn-cancel').onclick = () => U.closeModal(overlay);
    if (id) overlay.querySelector('#btn-delete').onclick = () => {
      const dd = data(); dd.alarms = dd.alarms.filter(x=>x.id!==id); save(); U.closeModal(overlay); Z.app.refreshView();
    };
    overlay.querySelector('#btn-save').onclick = () => {
      const payload = { time: overlay.querySelector('#f-time').value, label: overlay.querySelector('#f-label').value.trim(), days: selDays, enabled: a.enabled !== false };
      const dd = data();
      if (id) Object.assign(a, payload);
      else dd.alarms.push({ id:U.genId(), ...payload });
      save(); U.closeModal(overlay); Z.app.refreshView();
      Z.pomodoro.ensureNotifPermission();
      U.toast(id?T('alarms.updated'):T('alarms.added'));
    };
  }

  return { render };
})();
