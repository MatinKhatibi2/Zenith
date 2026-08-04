/* =========================================================
   Z.gamification — XP, levels, and achievement badges.
   A light layer on top of the existing activity log; nothing
   here is required for the app to function, it's the "delight" layer.
   ========================================================= */
window.Z = window.Z || {};

Z.gamification = (function () {
  const U = Z.utils;

  function levelFromXp(xp) { return Math.floor(Math.sqrt(Math.max(0,xp) / 25)) + 1; }
  function xpForLevel(level) { return Math.round(25 * Math.pow(level - 1, 2)); }
  function xpProgress(xp) {
    const level = levelFromXp(xp);
    const floor = xpForLevel(level), ceil = xpForLevel(level + 1);
    const pct = ceil > floor ? (xp - floor) / (ceil - floor) : 1;
    return { level, pct: U.clamp(pct, 0, 1), xpToNext: Math.max(0, ceil - xp) };
  }

  const BADGES = [
    { id:'first_task', icon:'🌱', cond:(d)=> d.tasks.filter(t=>t.status==='done').length >= 1 },
    { id:'task_25', icon:'✅', cond:(d)=> d.tasks.filter(t=>t.status==='done').length >= 25 },
    { id:'task_100', icon:'🏆', cond:(d)=> d.tasks.filter(t=>t.status==='done').length >= 100 },
    { id:'habit_week', icon:'🔥', cond:(d)=> d.habits.some(h => longestStreak(h) >= 7) },
    { id:'habit_month', icon:'🌳', cond:(d)=> d.habits.some(h => longestStreak(h) >= 30) },
    { id:'pomo_10', icon:'🍅', cond:(d)=> d.pomodoro.sessions.length >= 10 },
    { id:'pomo_100', icon:'🧘', cond:(d)=> d.pomodoro.sessions.length >= 100 },
    { id:'notes_10', icon:'📝', cond:(d)=> d.notes.length >= 10 },
    { id:'budget_keeper', icon:'💰', cond:(d)=> {
      if (!d.finance.budgets.length) return false;
      const mk = Z.views.finance.thisMonthKey();
      return d.finance.budgets.every(b => {
        const spent = d.finance.transactions.filter(t=>t.type==='expense'&&t.category===b.category&&Z.views.finance.monthKey(t.date)===mk).reduce((s,t)=>s+t.amount,0);
        return spent <= b.monthlyLimit;
      });
    }},
    { id:'early_bird', icon:'🐦', cond:(d)=> d.pomodoro.sessions.some(s => new Date(s.ts).getHours() < 8) || d.tasks.some(t => t.completedAt && new Date(t.completedAt).getHours() < 8) },
    { id:'level_5', icon:'⭐', cond:(d)=> levelFromXp(d.gamification.xp) >= 5 },
    { id:'level_10', icon:'🌟', cond:(d)=> levelFromXp(d.gamification.xp) >= 10 },
  ];

  function longestStreak(habit) {
    if (habit.frequency !== 'daily') return 0;
    const dates = Object.keys(habit.checkins).filter(k => habit.checkins[k]).sort();
    if (!dates.length) return 0;
    let longest = 1, cur = 1;
    for (let i=1;i<dates.length;i++){
      if (Z.utils.isoDiffDays(dates[i], dates[i-1]) === 1) { cur++; longest = Math.max(longest, cur); }
      else cur = 1;
    }
    return longest;
  }

  function checkAndUnlock(profileId) {
    const data = Z.store.loadData(profileId);
    const prevLevel = levelFromXp(data.gamification._prevXp != null ? data.gamification._prevXp : data.gamification.xp);
    const newLevel = levelFromXp(data.gamification.xp);
    const events = [];

    BADGES.forEach(b => {
      if (!data.gamification.unlockedBadges.includes(b.id)) {
        try { if (b.cond(data)) { data.gamification.unlockedBadges.push(b.id); events.push({ type:'badge', badge:b }); } }
        catch(e) { /* ignore faulty condition */ }
      }
    });
    if (newLevel > prevLevel) events.push({ type:'levelup', level:newLevel });
    data.gamification._prevXp = data.gamification.xp;
    Z.store.touch(profileId);

    events.forEach((ev, i) => setTimeout(() => announce(ev), i * 900));
    return events;
  }

  function announce(ev) {
    Z.utils.celebrate({ originY: window.innerHeight * 0.25 });
    if (ev.type === 'levelup') {
      Z.utils.toast('🎉 ' + Z.i18n.t('gam.levelUp', { level: Z.utils.faNum(ev.level) }));
    } else if (ev.type === 'badge') {
      Z.utils.toast(ev.badge.icon + ' ' + Z.i18n.t('gam.newBadge') + ' — ' + Z.i18n.t('gam.badge.'+ev.badge.id+'.title'));
    }
  }

  function allBadgesWithState(data) {
    return BADGES.map(b => ({ ...b, unlocked: data.gamification.unlockedBadges.includes(b.id) }));
  }

  return { levelFromXp, xpForLevel, xpProgress, checkAndUnlock, allBadgesWithState, longestStreak, BADGES };
})();
