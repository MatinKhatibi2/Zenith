/* =========================================================
   Z.store — local persistence layer
   Profiles (local accounts) + namespaced per-profile data.
   Everything lives in localStorage — fully offline, on-device.
   ========================================================= */
window.Z = window.Z || {};

Z.store = (function () {
  const PROFILES_KEY = 'zenith:profiles';
  const ACTIVE_KEY = 'zenith:active-profile';
  const DATA_PREFIX = 'zenith:data:';

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { console.error('storage write failed', e); return false; }
  }

  /* ---------------- Profiles ---------------- */
  function getProfiles() { return readJSON(PROFILES_KEY, []); }
  function saveProfiles(list) { writeJSON(PROFILES_KEY, list); }

  async function createProfile({ name, pin, avatarColor }) {
    const profiles = getProfiles();
    const profile = {
      id: Z.utils.genId(),
      name: name.trim(),
      avatarColor: avatarColor || pickColor(profiles.length),
      pinHash: pin ? await Z.utils.sha256('zenith::' + pin) : null,
      createdAt: Date.now(),
    };
    profiles.push(profile);
    saveProfiles(profiles);
    saveData(profile.id, defaultData());
    return profile;
  }
  function pickColor(i) {
    const palette = ['#2F5D50','#C9962E','#3E6E8E','#A8452F','#4C7F6E','#B07E1F'];
    return palette[i % palette.length];
  }
  async function verifyPin(profileId, pin) {
    const p = getProfiles().find(p => p.id === profileId);
    if (!p) return false;
    if (!p.pinHash) return true;
    const h = await Z.utils.sha256('zenith::' + pin);
    return h === p.pinHash;
  }
  function deleteProfile(profileId) {
    saveProfiles(getProfiles().filter(p => p.id !== profileId));
    localStorage.removeItem(DATA_PREFIX + profileId);
    if (getActiveProfileId() === profileId) setActiveProfileId(null);
  }
  function renameProfile(profileId, name) {
    const profiles = getProfiles();
    const p = profiles.find(p => p.id === profileId);
    if (p) { p.name = name; saveProfiles(profiles); }
  }

  function getActiveProfileId() { return localStorage.getItem(ACTIVE_KEY); }
  function setActiveProfileId(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }

  /* ---------------- Per-profile data ---------------- */
  function defaultData() {
    const fa = !(window.Z && Z.i18n && !Z.i18n.isFa());
    return {
      version: 1,
      tasks: [],
      taskCategories: fa ? [
        { name: 'کار', color: '#3E6E8E' },
        { name: 'شخصی', color: '#C9962E' },
        { name: 'درس', color: '#2F5D50' },
        { name: 'سلامتی', color: '#A8452F' },
        { name: 'خانه', color: '#7A5C2E' },
      ] : [
        { name: 'Work', color: '#3E6E8E' },
        { name: 'Personal', color: '#C9962E' },
        { name: 'Study', color: '#2F5D50' },
        { name: 'Health', color: '#A8452F' },
        { name: 'Home', color: '#7A5C2E' },
      ],
      habits: [],
      notes: [],
      finance: {
        transactions: [], budgets: [],
        expenseCategories: fa
          ? ['خوراک','حمل‌ونقل','خرید','قبض‌ها','سرگرمی','سلامت','مسکن','متفرقه']
          : ['Food','Transport','Shopping','Bills','Entertainment','Health','Housing','Other'],
        incomeCategories: fa
          ? ['حقوق','فریلنس','هدیه','سرمایه‌گذاری','متفرقه']
          : ['Salary','Freelance','Gift','Investment','Other'],
      },
      pomodoro: { sessions: [], settings: { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, roundsBeforeLongBreak: 4 } },
      alarms: [],
      settings: { theme: 'light', apiKey: '', aiModel: 'claude-haiku-4-5-20251001', currency: fa ? 'تومان' : '$', notifPermAsked: false },
      activity: {}, // { "YYYY-MM-DD": {tasks:0,habits:0,pomodoros:0,notes:0,tx:0} }
      gamification: { xp: 0, unlockedBadges: [] },
      chatHistory: [], // [{role,content,ts}]
    };
  }
  function migrate(data) {
    const d = defaultData();
    // shallow-merge to fill any missing keys added in later versions
    const merged = { ...d, ...data };
    merged.taskCategories = (data.taskCategories && data.taskCategories.length) ? data.taskCategories : d.taskCategories;
    merged.finance = { ...d.finance, ...(data.finance || {}) };
    merged.finance.expenseCategories = (data.finance && data.finance.expenseCategories && data.finance.expenseCategories.length) ? data.finance.expenseCategories : d.finance.expenseCategories;
    merged.finance.incomeCategories = (data.finance && data.finance.incomeCategories && data.finance.incomeCategories.length) ? data.finance.incomeCategories : d.finance.incomeCategories;
    merged.pomodoro = { ...d.pomodoro, ...(data.pomodoro || {}), settings: { ...d.pomodoro.settings, ...((data.pomodoro||{}).settings || {}) } };
    merged.settings = { ...d.settings, ...(data.settings || {}) };
    merged.gamification = { ...d.gamification, ...(data.gamification || {}) };
    return merged;
  }

  let cache = {}; // profileId -> data (in-memory, synced to localStorage)

  function loadData(profileId) {
    if (cache[profileId]) return cache[profileId];
    const data = migrate(readJSON(DATA_PREFIX + profileId, defaultData()));
    cache[profileId] = data;
    return data;
  }
  const persist = Z.utils.debounce((profileId) => {
    writeJSON(DATA_PREFIX + profileId, cache[profileId]);
  }, 250);

  function saveData(profileId, data) {
    cache[profileId] = data;
    writeJSON(DATA_PREFIX + profileId, data); // immediate write for explicit saves (e.g. new profile)
  }
  function touch(profileId) {
    // call after mutating the object returned by loadData() to schedule a debounced write
    persist(profileId);
  }

  /* ---------------- Activity log (feeds Growth Grid + charts + evaluation) ---------------- */
  const XP_TABLE = { tasks: 10, habits: 8, pomodoros: 15, notes: 5, tx: 3 };
  function bumpActivity(profileId, key, dateISO, delta) {
    delta = delta == null ? 1 : delta;
    const data = loadData(profileId);
    const day = dateISO || Z.utils.todayISO();
    if (!data.activity[day]) data.activity[day] = { tasks:0, habits:0, pomodoros:0, notes:0, tx:0 };
    data.activity[day][key] = Math.max(0, (data.activity[day][key] || 0) + delta);
    if (delta > 0 && XP_TABLE[key]) {
      data.gamification.xp = (data.gamification.xp || 0) + XP_TABLE[key] * delta;
    }
    touch(profileId);
  }

  /* ---------------- Export / Import ---------------- */
  function exportBackup(profileId) {
    const profile = getProfiles().find(p => p.id === profileId);
    const data = loadData(profileId);
    return JSON.stringify({
      app: 'zenith', exportedAt: new Date().toISOString(),
      profileName: profile ? profile.name : 'کاربر',
      data,
    }, null, 2);
  }
  function importBackup(profileId, jsonStr) {
    const parsed = JSON.parse(jsonStr);
    const incoming = parsed.data || parsed; // tolerate raw-data-only backups
    const merged = migrate(incoming);
    saveData(profileId, merged);
    return merged;
  }

  return {
    getProfiles, createProfile, verifyPin, deleteProfile, renameProfile,
    getActiveProfileId, setActiveProfileId,
    loadData, saveData, touch, bumpActivity,
    exportBackup, importBackup, defaultData,
  };
})();
