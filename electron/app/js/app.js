/* =========================================================
   Z.app — shell, router, navigation, global background timers
   ========================================================= */
window.Z = window.Z || {};

Z.app = (function () {
  const U = Z.utils;
  let route = 'dashboard';
  let globalTimersStarted = false;

  const NAV_ITEMS = [
    { id:'dashboard', label:'خانه', icon:'home' },
    { id:'tasks', label:'وظایف', icon:'tasks' },
    { id:'habits', label:'عادت‌ها', icon:'habit' },
    { id:'notes', label:'یادداشت‌ها', icon:'notes' },
    { id:'finance', label:'مالی', icon:'finance' },
    { id:'reports', label:'گزارش‌ها', icon:'reports' },
    { id:'ai', label:'دستیار هوشمند', icon:'ai' },
    { id:'settings', label:'تنظیمات', icon:'settings' },
  ];
  const MOBILE_TABS = ['dashboard','tasks','habits','finance'];
  const TITLES = { dashboard:'خانه', tasks:'وظایف', habits:'عادت‌ها', notes:'یادداشت‌ها', finance:'مالی', reports:'گزارش‌ها', ai:'دستیار هوشمند', settings:'تنظیمات' };

  function pid() { return Z.store.getActiveProfileId(); }
  function profile() { return Z.store.getProfiles().find(p => p.id === pid()); }

  function boot() {
    const root = document.getElementById('app');
    if (!pid()) { document.documentElement.removeAttribute('data-theme'); Z.auth.render(root); return; }
    const d = Z.store.loadData(pid());
    document.documentElement.setAttribute('data-theme', d.settings.theme === 'dark' ? 'dark' : 'light');
    renderShell(root);
    navigate(route);
    startGlobalTimers();
  }

  function renderShell(root) {
    const p = profile();
    root.innerHTML = `
      <div class="app-shell">
        <nav class="sidenav">
          <div class="brand">
            <img src="icons/icon-72.png" alt="Zenith">
            <div><div class="brand-name">Zenith</div><div class="brand-sub">دفترچه‌ی رشد شخصی</div></div>
          </div>
          ${NAV_ITEMS.map(n => `<button class="nav-item" data-route="${n.id}">${U.icon(n.icon)}<span>${n.label}</span></button>`).join('')}
          <div class="nav-spacer"></div>
          <div class="nav-foot">
            <div class="profile-chip" id="btn-profile-chip">
              <div class="profile-avatar" style="background:${p?p.avatarColor:'var(--brand)'}">${p?p.name.charAt(0):'؟'}</div>
              <div class="profile-meta"><div class="profile-name">${U.escapeHtml(p?p.name:'')}</div><div class="profile-sub">مشاهده و تعویض</div></div>
            </div>
          </div>
        </nav>
        <div class="main-col">
          <div class="topbar">
            <div class="topbar-title" id="topbar-title"></div>
            <div class="topbar-actions">
              <button class="icon-btn" id="btn-theme-toggle"></button>
            </div>
          </div>
          <div class="view" id="view-content"></div>
        </div>
        <div class="tabbar">
          ${MOBILE_TABS.map(id => `<button class="tab-item" data-route="${id}">${U.icon(NAV_ITEMS.find(n=>n.id===id).icon)}<span>${TITLES[id]}</span></button>`).join('')}
          <button class="tab-item" data-route="__more">${U.icon('dots')}<span>بیشتر</span></button>
        </div>
        <button class="fab" id="fab-add">${U.icon('plus')}</button>
      </div>
    `;
    root.querySelectorAll('[data-route]').forEach(el => el.addEventListener('click', () => {
      if (el.dataset.route === '__more') openMoreSheet();
      else navigate(el.dataset.route);
    }));
    root.querySelector('#btn-profile-chip').addEventListener('click', () => navigate('settings'));
    root.querySelector('#btn-theme-toggle').addEventListener('click', toggleTheme);
    root.querySelector('#fab-add').addEventListener('click', handleFab);
    refreshThemeIcon();
  }

  function openMoreSheet() {
    const items = NAV_ITEMS.filter(n => !MOBILE_TABS.includes(n.id));
    const overlay = U.openModal(`
      <div class="modal-head"><div class="modal-title">بیشتر</div><button class="icon-btn" id="m-close">${U.icon('x')}</button></div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${items.map(n => `<button class="nav-item" style="color:var(--text)" data-route="${n.id}">${U.icon(n.icon)}<span>${n.label}</span></button>`).join('')}
        <button class="nav-item" style="color:var(--danger)" id="m-logout">${U.icon('logout')}<span>تعویض پروفایل</span></button>
      </div>
    `);
    overlay.querySelector('#m-close').onclick = () => U.closeModal(overlay);
    overlay.querySelectorAll('[data-route]').forEach(el => el.onclick = () => { U.closeModal(overlay); navigate(el.dataset.route); });
    overlay.querySelector('#m-logout').onclick = () => { U.closeModal(overlay); Z.auth.logout(); };
  }

  function handleFab() {
    const buttonIdByRoute = { tasks:'#btn-add-task', habits:'#btn-add-habit', notes:'#btn-add-note', finance:'#btn-add-tx' };
    const sel = buttonIdByRoute[route];
    if (sel) { const b = document.querySelector(sel); if (b) b.click(); }
    else navigate('tasks');
  }

  function toggleTheme() {
    const d = Z.store.loadData(pid());
    const next = d.settings.theme === 'dark' ? 'light' : 'dark';
    d.settings.theme = next; Z.store.touch(pid());
    document.documentElement.setAttribute('data-theme', next);
    refreshThemeIcon();
  }
  function refreshThemeIcon() {
    const d = Z.store.loadData(pid());
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.innerHTML = U.icon(d.settings.theme === 'dark' ? 'sun' : 'moon');
  }

  function navigate(r) {
    route = r;
    document.querySelectorAll('[data-route]').forEach(el => el.classList.toggle('active', el.dataset.route === r));
    const title = document.getElementById('topbar-title');
    if (title) title.textContent = TITLES[r] || '';
    const content = document.getElementById('view-content');
    if (content && Z.views[r]) {
      content.classList.remove('view-enter');
      Z.views[r].render(content);
      void content.offsetWidth;
      content.classList.add('view-enter');
    }
    const fab = document.getElementById('fab-add');
    if (fab) fab.style.display = ['tasks','habits','notes','finance'].includes(r) ? 'flex' : 'none';
  }

  function refreshView() { if (Z.views[route]) navigate(route); }

  function startGlobalTimers() {
    if (globalTimersStarted) return;
    globalTimersStarted = true;
    setInterval(() => { try { Z.pomodoro.tick(); } catch(e){} }, 1000);
    setInterval(() => { try { Z.alarmEngine.tick(); } catch(e){} }, 1000);
  }

  return { boot, navigate, refreshView, get route() { return route; } };
})();

document.addEventListener('DOMContentLoaded', () => Z.app.boot());
