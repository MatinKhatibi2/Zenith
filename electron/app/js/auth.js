/* =========================================================
   Z.auth — local profile onboarding & switching — bilingual
   ========================================================= */
window.Z = window.Z || {};

Z.auth = (function () {
  const U = Z.utils;
  const T = Z.i18n.t;

  function initial(name) { return (name || '?').trim().charAt(0).toUpperCase(); }

  function langSwitcher() {
    return `<div class="chip-select" id="auth-lang-switch" style="justify-content:center;margin-bottom:18px">
      <div class="chip ${Z.i18n.isFa()?'selected':''}" data-l="fa">فارسی</div>
      <div class="chip ${!Z.i18n.isFa()?'selected':''}" data-l="en">English</div>
    </div>`;
  }
  function wireLangSwitcher(root, rerender) {
    const el = root.querySelector('#auth-lang-switch');
    if (!el) return;
    el.querySelectorAll('.chip').forEach(c => c.onclick = () => { Z.i18n.setLang(c.dataset.l); rerender(); });
  }

  function render(root) {
    const profiles = Z.store.getProfiles();
    if (profiles.length === 0) return renderCreate(root, { first: true });
    return renderPicker(root, profiles);
  }

  function renderPicker(root, profiles) {
    root.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          ${langSwitcher()}
          <img src="icons/icon-128.png" class="auth-logo" alt="Zenith">
          <div class="auth-title">${T('auth.welcomeBack')}</div>
          <div class="auth-sub">${T('auth.pickProfile')}</div>
          <div class="profile-pick-list">
            ${profiles.map(p => `
              <div class="profile-pick-item" data-id="${p.id}">
                <div class="profile-avatar" style="width:40px;height:40px;font-size:15px;background:${p.avatarColor}">${U.escapeHtml(initial(p.name))}</div>
                <div style="flex:1">
                  <div style="font-weight:700;font-size:14px">${U.escapeHtml(p.name)}</div>
                  <div style="font-size:11.5px;color:var(--text-muted)">${p.pinHash ? T('auth.hasPin') : T('auth.noPin')}</div>
                </div>
                <div style="color:var(--text-faint)">${U.icon('chevronDown')}</div>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-ghost btn-block" id="btn-add-profile">${U.icon('plus')} ${T('auth.addProfile')}</button>
        </div>
      </div>`;
    wireLangSwitcher(root, () => renderPicker(root, profiles));
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
      <div class="modal-head"><div class="modal-title">${T('auth.enterPin')} — ${U.escapeHtml(profile.name)}</div>
        <button class="icon-btn" id="pin-close">${U.icon('x')}</button></div>
      <div class="field"><label>${T('auth.pin4')}</label>
        <input type="password" inputmode="numeric" maxlength="8" class="input" id="pin-input" autofocus placeholder="••••"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="pin-cancel">${T('common.cancel')}</button>
        <button class="btn btn-primary" id="pin-submit">${T('auth.login')}</button>
      </div>`);
    overlay.querySelector('#pin-close').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#pin-cancel').onclick = () => U.closeModal(overlay);
    const submit = async () => {
      const val = overlay.querySelector('#pin-input').value;
      const ok = await Z.store.verifyPin(profile.id, val);
      if (ok) { U.closeModal(overlay); login(profile.id); }
      else U.toast(T('auth.wrongPin'));
    };
    overlay.querySelector('#pin-submit').onclick = submit;
    overlay.querySelector('#pin-input').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }

  function renderCreate(root, { first, profiles }) {
    root.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          ${langSwitcher()}
          <img src="icons/icon-128.png" class="auth-logo" alt="Zenith">
          <div class="auth-title">${first ? T('auth.welcomeTitle') : T('auth.newProfileTitle')}</div>
          <div class="auth-sub">${first ? T('auth.welcomeSub') : T('auth.newProfileSub')}</div>
          <div class="field"><label>${T('auth.whatsYourName')}</label>
            <input class="input" id="name-input" placeholder="${T('auth.namePlaceholder')}" autofocus></div>
          <div class="field"><label>${T('auth.pinOptional')}</label>
            <input class="input" id="pin-input" type="password" inputmode="numeric" maxlength="8" placeholder="${T('auth.pinHint')}"></div>
          <button class="btn btn-primary btn-block" id="btn-create">${U.icon('sprout')} ${T('auth.getStarted')}</button>
          ${!first ? `<button class="btn btn-ghost btn-block" id="btn-back" style="margin-top:8px">${T('auth.back')}</button>` : ''}
          <div class="auth-sub" style="margin-top:16px;font-size:11.5px">${T('auth.privacyNote')}</div>
        </div>
      </div>`;
    wireLangSwitcher(root, () => renderCreate(root, { first, profiles }));
    root.querySelector('#btn-create').addEventListener('click', async () => {
      const name = root.querySelector('#name-input').value.trim();
      if (!name) { U.toast(T('auth.enterName')); return; }
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
