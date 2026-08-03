/* =========================================================
   Z.auth — local profile onboarding & switching
   No server: "accounts" are local profiles stored on-device.
   ========================================================= */
window.Z = window.Z || {};

Z.auth = (function () {
  const U = Z.utils;

  function initial(name) { return (name || '؟').trim().charAt(0).toUpperCase(); }

  function render(root) {
    const profiles = Z.store.getProfiles();
    if (profiles.length === 0) return renderCreate(root, { first: true });
    return renderPicker(root, profiles);
  }

  function renderPicker(root, profiles) {
    root.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          <img src="icons/icon-128.png" class="auth-logo" alt="Zenith">
          <div class="auth-title">خوش برگشتی 👋</div>
          <div class="auth-sub">پروفایل خودت رو انتخاب کن</div>
          <div class="profile-pick-list">
            ${profiles.map(p => `
              <div class="profile-pick-item" data-id="${p.id}">
                <div class="profile-avatar" style="width:40px;height:40px;font-size:15px;background:${p.avatarColor}">${U.escapeHtml(initial(p.name))}</div>
                <div style="flex:1">
                  <div style="font-weight:700;font-size:14px">${U.escapeHtml(p.name)}</div>
                  <div style="font-size:11.5px;color:var(--text-muted)">${p.pinHash ? 'دارای پین امنیتی' : 'بدون پین'}</div>
                </div>
                <div style="color:var(--text-faint)">${U.icon('chevronDown')}</div>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-ghost btn-block" id="btn-add-profile">${U.icon('plus')} افزودن پروفایل جدید</button>
        </div>
      </div>`;
    root.querySelectorAll('.profile-pick-item').forEach(el => {
      el.addEventListener('click', () => {
        const profile = profiles.find(p => p.id === el.dataset.id);
        if (profile.pinHash) promptPin(root, profile);
        else login(profile.id);
      });
    });
    root.querySelector('#btn-add-profile').addEventListener('click', () => renderCreate(root, { first: false, profiles }));
  }

  function promptPin(root, profile) {
    const overlay = U.openModal(`
      <div class="modal-head"><div class="modal-title">ورود پین — ${U.escapeHtml(profile.name)}</div>
        <button class="icon-btn" id="pin-close">${U.icon('x')}</button></div>
      <div class="field"><label>پین ۴ رقمی</label>
        <input type="password" inputmode="numeric" maxlength="8" class="input" id="pin-input" autofocus placeholder="••••"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="pin-cancel">انصراف</button>
        <button class="btn btn-primary" id="pin-submit">ورود</button>
      </div>`);
    overlay.querySelector('#pin-close').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#pin-cancel').onclick = () => U.closeModal(overlay);
    const submit = async () => {
      const val = overlay.querySelector('#pin-input').value;
      const ok = await Z.store.verifyPin(profile.id, val);
      if (ok) { U.closeModal(overlay); login(profile.id); }
      else U.toast('پین اشتباهه، دوباره امتحان کن');
    };
    overlay.querySelector('#pin-submit').onclick = submit;
    overlay.querySelector('#pin-input').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }

  function renderCreate(root, { first, profiles }) {
    root.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          <img src="icons/icon-128.png" class="auth-logo" alt="Zenith">
          <div class="auth-title">${first ? 'به Zenith خوش اومدی 🌱' : 'پروفایل جدید'}</div>
          <div class="auth-sub">${first ? 'دستیار شخصی رشد، وظایف، عادت‌ها و مالی‌ات' : 'یک اسم برای پروفایل جدید انتخاب کن'}</div>
          <div class="field"><label>اسمت چیه؟</label>
            <input class="input" id="name-input" placeholder="مثلاً سارا" autofocus></div>
          <div class="field"><label>پین امنیتی (اختیاری، ۴ رقم)</label>
            <input class="input" id="pin-input" type="password" inputmode="numeric" maxlength="8" placeholder="اگه چند نفر از این دستگاه استفاده می‌کنید پیشنهاد میشه"></div>
          <button class="btn btn-primary btn-block" id="btn-create">${U.icon('sprout')} شروع کن</button>
          ${!first ? `<button class="btn btn-ghost btn-block" id="btn-back" style="margin-top:8px">بازگشت</button>` : ''}
          <div class="auth-sub" style="margin-top:16px;font-size:11.5px">
            همه‌ی اطلاعاتت فقط روی همین دستگاه ذخیره میشه؛ هیچ سروری در کار نیست. از تنظیمات می‌تونی بعداً پشتیبان بگیری.
          </div>
        </div>
      </div>`;
    root.querySelector('#btn-create').addEventListener('click', async () => {
      const name = root.querySelector('#name-input').value.trim();
      if (!name) { U.toast('لطفاً یه اسم وارد کن'); return; }
      const pin = root.querySelector('#pin-input').value.trim();
      const profile = await Z.store.createProfile({ name, pin: pin || null });
      login(profile.id);
    });
    if (!first) root.querySelector('#btn-back').addEventListener('click', () => renderPicker(root, profiles || Z.store.getProfiles()));
  }

  function login(profileId) {
    Z.store.setActiveProfileId(profileId);
    Z.app.boot();
  }
  function logout() {
    Z.store.setActiveProfileId(null);
    Z.app.boot();
  }

  return { render, login, logout };
})();
