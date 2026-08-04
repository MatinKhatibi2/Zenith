/* =========================================================
   Z.views.settings — profile, language, theme, AI key, currency, backup — bilingual
   ========================================================= */
window.Z = window.Z || {};
Z.views = Z.views || {};

Z.views.settings = (function () {
  const U = Z.utils;
  const T = Z.i18n.t;
  function pid() { return Z.store.getActiveProfileId(); }
  function data() { return Z.store.loadData(pid()); }
  function save() { Z.store.touch(pid()); }
  function profile() { return Z.store.getProfiles().find(p => p.id === pid()); }

  const MODEL_OPTIONS = [
    { id:'claude-haiku-4-5-20251001', label: Z.i18n.isFa() ? 'Haiku — سریع و مقرون‌به‌صرفه (پیشنهادی)' : 'Haiku — fast & affordable (recommended)' },
    { id:'claude-sonnet-5', label: Z.i18n.isFa() ? 'Sonnet 5 — تحلیل عمیق‌تر' : 'Sonnet 5 — deeper analysis' },
  ];

  function render(root) {
    const d = data();
    const p = profile();
    root.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">${T('set.profile')}</div>
          <div class="flex-gap" style="margin:14px 0">
            <div class="profile-avatar" style="width:48px;height:48px;font-size:17px;background:${p?p.avatarColor:'var(--brand)'}">${p?p.name.charAt(0):'?'}</div>
            <div><input class="input" id="f-profile-name" value="${U.escapeHtml(p?p.name:'')}" style="font-weight:700"></div>
          </div>
          <button class="btn btn-ghost btn-block" id="btn-save-name">${T('set.saveName')}</button>
          <div class="divider"></div>
          <button class="btn btn-ghost btn-block" id="btn-switch-profile">${U.icon('logout')} ${T('set.switchProfile')}</button>
        </div>

        <div class="card">
          <div class="card-title">${T('set.language')}</div>
          <div class="card-sub" style="margin-bottom:12px">${T('set.languageHint')}</div>
          <div class="chip-select">
            <div class="chip ${Z.i18n.isFa()?'selected':''}" id="lang-fa">فارسی</div>
            <div class="chip ${!Z.i18n.isFa()?'selected':''}" id="lang-en">English</div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">${T('set.appearance')}</div>
          <div class="card-sub" style="margin-bottom:12px">${T('set.appearanceHint')}</div>
          <div class="chip-select">
            <div class="chip ${d.settings.theme!=='dark'?'selected':''}" id="theme-light">${U.icon('sun')} ${T('set.light')}</div>
            <div class="chip ${d.settings.theme==='dark'?'selected':''}" id="theme-dark">${U.icon('moon')} ${T('set.dark')}</div>
          </div>
          <div class="divider"></div>
          <div class="card-title" style="font-size:13px">${T('set.currency')}</div>
          <input class="input" id="f-currency" value="${U.escapeHtml(d.settings.currency)}" style="margin-top:8px">
          <button class="btn btn-ghost btn-block" id="btn-save-currency" style="margin-top:8px">${T('set.saveCurrency')}</button>
        </div>

        <div class="card">
          <div class="card-title">${U.icon('sparkle')} ${T('set.aiTitle')}</div>
          <div class="card-sub" style="margin-bottom:10px">${T('set.aiHint')}
            <a href="https://console.anthropic.com" target="_blank" rel="noopener" style="color:var(--brand);font-weight:700">console.anthropic.com</a>
            ${T('set.aiHintEnd')}</div>
          <div class="field"><label>${T('set.apiKeyLabel')}</label><input class="input" type="password" id="f-apikey" value="${U.escapeHtml(d.settings.apiKey||'')}" placeholder="sk-ant-…"></div>
          <div class="field"><label>${T('set.modelLabel')}</label>
            <select class="select" id="f-model">${MODEL_OPTIONS.map(m => `<option value="${m.id}" ${d.settings.aiModel===m.id?'selected':''}>${m.label}</option>`).join('')}</select>
          </div>
          <button class="btn btn-primary btn-block" id="btn-save-key">${T('common.save')}</button>
          <button class="btn btn-danger btn-block" id="btn-clear-chat" style="margin-top:8px">${T('set.clearChat')}</button>
        </div>

        <div class="card">
          <div class="card-title">${T('set.backupTitle')}</div>
          <div class="card-sub" style="margin-bottom:12px">${T('set.backupHint')}</div>
          <button class="btn btn-ghost btn-block" id="btn-export">${U.icon('download')} ${T('set.downloadBackup')}</button>
          <button class="btn btn-ghost btn-block" id="btn-import" style="margin-top:8px">${U.icon('upload')} ${T('set.restoreBackup')}</button>
          <input type="file" id="import-file" accept="application/json" style="display:none">
        </div>

        <div class="card" style="border-color:var(--danger)">
          <div class="card-title" style="color:var(--danger)">${T('set.dangerZone')}</div>
          <div class="card-sub" style="margin-bottom:12px">${T('set.dangerHint')}</div>
          <button class="btn btn-danger btn-block" id="btn-delete-profile">${U.icon('trash')} ${T('set.deleteProfile')}</button>
        </div>

        <div class="card">
          <div class="card-title">${T('set.about')}</div>
          <div class="card-sub">${T('set.aboutLine')}</div>
          <div class="card-sub" style="margin-top:6px">${T('set.aboutLine2')}</div>
        </div>
      </div>
    `;

    root.querySelector('#btn-save-name').onclick = () => {
      const name = root.querySelector('#f-profile-name').value.trim();
      if (name) { Z.store.renameProfile(pid(), name); Z.app.boot(); U.toast(T('set.nameUpdated')); }
    };
    root.querySelector('#btn-switch-profile').onclick = () => Z.auth.logout();
    root.querySelector('#lang-fa').onclick = () => { Z.i18n.setLang('fa'); Z.app.boot(); };
    root.querySelector('#lang-en').onclick = () => { Z.i18n.setLang('en'); Z.app.boot(); };
    root.querySelector('#theme-light').onclick = () => setTheme('light');
    root.querySelector('#theme-dark').onclick = () => setTheme('dark');
    root.querySelector('#btn-save-currency').onclick = () => {
      d.settings.currency = root.querySelector('#f-currency').value.trim() || (Z.i18n.isFa() ? 'تومان' : '$'); save(); U.toast(T('set.saved'));
    };
    root.querySelector('#btn-save-key').onclick = () => {
      d.settings.apiKey = root.querySelector('#f-apikey').value.trim();
      d.settings.aiModel = root.querySelector('#f-model').value;
      save(); U.toast(T('set.aiSaved')); Z.app.refreshView();
    };
    root.querySelector('#btn-clear-chat').onclick = () => { Z.ai.clearHistory(); U.toast(T('set.chatCleared')); };
    root.querySelector('#btn-export').onclick = () => {
      const json = Z.store.exportBackup(pid());
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `zenith-backup-${U.todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    root.querySelector('#btn-import').onclick = () => root.querySelector('#import-file').click();
    root.querySelector('#import-file').onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { Z.store.importBackup(pid(), reader.result); U.toast(T('set.restored')); Z.app.boot(); }
        catch (err) { U.toast(T('set.invalidBackup')); }
      };
      reader.readAsText(file);
    };
    root.querySelector('#btn-delete-profile').onclick = () => {
      const overlay = U.openModal(`
        <div class="modal-head"><div class="modal-title">${T('common.confirmDeleteTitle')}</div></div>
        <p style="font-size:13.5px">${T('set.deleteConfirm', { name: U.escapeHtml(p.name) })}</p>
        <div class="modal-actions"><button class="btn btn-ghost" id="c-cancel">${T('common.cancel')}</button><button class="btn btn-danger" id="c-confirm">${T('set.deleteForever')}</button></div>
      `);
      overlay.querySelector('#c-cancel').onclick = () => U.closeModal(overlay);
      overlay.querySelector('#c-confirm').onclick = () => { Z.store.deleteProfile(pid()); U.closeModal(overlay); Z.app.boot(); };
    };
  }

  function setTheme(theme) {
    const d = data();
    d.settings.theme = theme; save();
    document.documentElement.setAttribute('data-theme', theme);
    Z.app.refreshView();
  }

  return { render };
})();
