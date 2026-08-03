/* =========================================================
   Z.views.settings — profile, theme, AI key, currency, backup
   ========================================================= */
window.Z = window.Z || {};
Z.views = Z.views || {};

Z.views.settings = (function () {
  const U = Z.utils;
  function pid() { return Z.store.getActiveProfileId(); }
  function data() { return Z.store.loadData(pid()); }
  function save() { Z.store.touch(pid()); }
  function profile() { return Z.store.getProfiles().find(p => p.id === pid()); }

  const MODEL_OPTIONS = [
    { id:'claude-haiku-4-5-20251001', label:'Haiku — سریع و مقرون‌به‌صرفه (پیشنهادی)' },
    { id:'claude-sonnet-5', label:'Sonnet 5 — تحلیل عمیق‌تر' },
  ];

  function render(root) {
    const d = data();
    const p = profile();
    root.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">پروفایل</div>
          <div class="flex-gap" style="margin:14px 0">
            <div class="profile-avatar" style="width:48px;height:48px;font-size:17px;background:${p?p.avatarColor:'var(--brand)'}">${p?p.name.charAt(0):'؟'}</div>
            <div>
              <input class="input" id="f-profile-name" value="${U.escapeHtml(p?p.name:'')}" style="font-weight:700">
            </div>
          </div>
          <button class="btn btn-ghost btn-block" id="btn-save-name">ذخیره اسم</button>
          <div class="divider"></div>
          <button class="btn btn-ghost btn-block" id="btn-switch-profile">${U.icon('logout')} تعویض پروفایل</button>
        </div>

        <div class="card">
          <div class="card-title">ظاهر برنامه</div>
          <div class="card-sub" style="margin-bottom:12px">تم روشن یا تیره رو انتخاب کن</div>
          <div class="chip-select">
            <div class="chip ${d.settings.theme!=='dark'?'selected':''}" id="theme-light">${U.icon('sun')} روشن</div>
            <div class="chip ${d.settings.theme==='dark'?'selected':''}" id="theme-dark">${U.icon('moon')} تیره</div>
          </div>
          <div class="divider"></div>
          <div class="card-title" style="font-size:13px">واحد پول</div>
          <input class="input" id="f-currency" value="${U.escapeHtml(d.settings.currency)}" style="margin-top:8px" placeholder="تومان">
          <button class="btn btn-ghost btn-block" id="btn-save-currency" style="margin-top:8px">ذخیره واحد پول</button>
        </div>

        <div class="card">
          <div class="card-title">${U.icon('sparkle')} دستیار هوشمند (جوانه)</div>
          <div class="card-sub" style="margin-bottom:10px">این اپ سرور نداره؛ برای فعال شدن چت هوشمند، کلید API خودت رو از
            <a href="https://console.anthropic.com" target="_blank" rel="noopener" style="color:var(--brand);font-weight:700">console.anthropic.com</a>
            بساز و اینجا وارد کن. کلید فقط روی همین دستگاه ذخیره و مستقیماً به Anthropic ارسال میشه.</div>
          <div class="field"><label>کلید API</label><input class="input" type="password" id="f-apikey" value="${U.escapeHtml(d.settings.apiKey||'')}" placeholder="sk-ant-…"></div>
          <div class="field"><label>مدل</label>
            <select class="select" id="f-model">${MODEL_OPTIONS.map(m => `<option value="${m.id}" ${d.settings.aiModel===m.id?'selected':''}>${m.label}</option>`).join('')}</select>
          </div>
          <button class="btn btn-primary btn-block" id="btn-save-key">ذخیره</button>
          <button class="btn btn-danger btn-block" id="btn-clear-chat" style="margin-top:8px">پاک کردن تاریخچه گفتگو</button>
        </div>

        <div class="card">
          <div class="card-title">پشتیبان‌گیری و انتقال داده</div>
          <div class="card-sub" style="margin-bottom:12px">همه‌ی اطلاعاتت (وظایف، عادت‌ها، یادداشت‌ها، مالی) فقط روی این دستگاهه. برای انتقال به دستگاه دیگه یا نگه‌داشتن نسخه‌ی پشتیبان، از این گزینه‌ها استفاده کن.</div>
          <button class="btn btn-ghost btn-block" id="btn-export">${U.icon('download')} دریافت فایل پشتیبان (JSON)</button>
          <button class="btn btn-ghost btn-block" id="btn-import" style="margin-top:8px">${U.icon('upload')} بازیابی از فایل پشتیبان</button>
          <input type="file" id="import-file" accept="application/json" style="display:none">
        </div>

        <div class="card" style="border-color:var(--danger)">
          <div class="card-title" style="color:var(--danger)">منطقه‌ی خطر</div>
          <div class="card-sub" style="margin-bottom:12px">حذف پروفایل، همه‌ی اطلاعات این پروفایل رو برای همیشه پاک می‌کنه.</div>
          <button class="btn btn-danger btn-block" id="btn-delete-profile">${U.icon('trash')} حذف این پروفایل</button>
        </div>

        <div class="card">
          <div class="card-title">درباره</div>
          <div class="card-sub">Zenith — دفترچه‌ی شخصی رشد · نسخه ۱٫۰</div>
          <div class="card-sub" style="margin-top:6px">همه‌ی داده‌ها به‌صورت محلی و بدون سرور ذخیره می‌شن.</div>
        </div>
      </div>
    `;

    root.querySelector('#btn-save-name').onclick = () => {
      const name = root.querySelector('#f-profile-name').value.trim();
      if (name) { Z.store.renameProfile(pid(), name); Z.app.boot(); U.toast('اسم به‌روزرسانی شد'); }
    };
    root.querySelector('#btn-switch-profile').onclick = () => Z.auth.logout();
    root.querySelector('#theme-light').onclick = () => setTheme('light');
    root.querySelector('#theme-dark').onclick = () => setTheme('dark');
    root.querySelector('#btn-save-currency').onclick = () => {
      d.settings.currency = root.querySelector('#f-currency').value.trim() || 'تومان'; save(); U.toast('ذخیره شد');
    };
    root.querySelector('#btn-save-key').onclick = () => {
      d.settings.apiKey = root.querySelector('#f-apikey').value.trim();
      d.settings.aiModel = root.querySelector('#f-model').value;
      save(); U.toast('تنظیمات دستیار ذخیره شد'); Z.app.refreshView();
    };
    root.querySelector('#btn-clear-chat').onclick = () => { Z.ai.clearHistory(); U.toast('تاریخچه پاک شد'); };
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
        try { Z.store.importBackup(pid(), reader.result); U.toast('بازیابی شد'); Z.app.boot(); }
        catch (err) { U.toast('فایل پشتیبان معتبر نیست'); }
      };
      reader.readAsText(file);
    };
    root.querySelector('#btn-delete-profile').onclick = () => {
      const overlay = U.openModal(`
        <div class="modal-head"><div class="modal-title">حذف پروفایل</div></div>
        <p style="font-size:13.5px">مطمئنی می‌خوای پروفایل «${U.escapeHtml(p.name)}» و همه‌ی اطلاعاتش رو برای همیشه حذف کنی؟ این کار برگشت‌ناپذیره.</p>
        <div class="modal-actions"><button class="btn btn-ghost" id="c-cancel">انصراف</button><button class="btn btn-danger" id="c-confirm">حذف برای همیشه</button></div>
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
