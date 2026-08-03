/* =========================================================
   Z.views.notes — Notebook with search, tags, pin, simple rich text
   ========================================================= */
window.Z = window.Z || {};
Z.views = Z.views || {};

Z.views.notes = (function () {
  const U = Z.utils;
  let q = '', activeTag = null;

  function pid() { return Z.store.getActiveProfileId(); }
  function data() { return Z.store.loadData(pid()); }
  function save() { Z.store.touch(pid()); }

  function allTags() {
    const set = new Set();
    data().notes.forEach(n => (n.tags||[]).forEach(t => set.add(t)));
    return [...set];
  }
  function stripHtml(html) {
    const div = document.createElement('div'); div.innerHTML = html || '';
    return div.textContent || '';
  }

  function render(root) {
    const tags = allTags();
    root.innerHTML = `
      <div class="notes-toolbar">
        <input class="input" id="note-search" placeholder="جستجو در یادداشت‌ها…" value="${U.escapeHtml(q)}" style="max-width:260px">
        <div class="chip-select" id="tag-filters">
          <div class="chip ${activeTag===null?'selected':''}" data-tag="">همه</div>
          ${tags.map(t => `<div class="chip ${activeTag===t?'selected':''}" data-tag="${U.escapeHtml(t)}">${U.escapeHtml(t)}</div>`).join('')}
        </div>
        <div style="flex:1"></div>
        <button class="btn btn-primary btn-sm" id="btn-add-note">${U.icon('plus')} یادداشت جدید</button>
      </div>
      <div class="grid grid-3" id="notes-grid"></div>
    `;
    root.querySelector('#note-search').oninput = U.debounce(e => { q = e.target.value; renderGrid(root); }, 200);
    root.querySelector('#btn-add-note').onclick = () => openNoteEditor();
    root.querySelectorAll('#tag-filters .chip').forEach(c => c.onclick = () => { activeTag = c.dataset.tag || null; render(root); });
    renderGrid(root);
  }

  function renderGrid(root) {
    const holder = root.querySelector('#notes-grid');
    let list = data().notes.filter(n => {
      const text = (n.title + ' ' + stripHtml(n.bodyHtml)).toLowerCase();
      const matchQ = !q || text.includes(q.toLowerCase());
      const matchTag = !activeTag || (n.tags||[]).includes(activeTag);
      return matchQ && matchTag;
    }).sort((a,b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));

    if (list.length === 0) { holder.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${U.icon('notes')}<div class="empty-state-title">یادداشتی پیدا نشد</div><div>یه یادداشت جدید بنویس</div></div>`; return; }
    holder.innerHTML = list.map(n => `
      <div class="card note-card ${n.pinned?'pinned':''}" data-id="${n.id}">
        <div class="note-card-title">${U.escapeHtml(n.title || 'بدون عنوان')}</div>
        <div class="note-card-body">${U.escapeHtml(stripHtml(n.bodyHtml))}</div>
        <div class="note-card-tags">${(n.tags||[]).map(t => `<span class="tag-pill">${U.escapeHtml(t)}</span>`).join('')}</div>
      </div>
    `).join('');
    holder.querySelectorAll('.note-card').forEach(c => c.addEventListener('click', () => openNoteEditor(c.dataset.id)));
  }

  function openNoteEditor(id) {
    const d = data();
    const n = id ? d.notes.find(n => n.id === id) : { id:null, title:'', bodyHtml:'', tags:[], pinned:false };
    const overlay = U.openModal(`
      <div class="modal-head"><div class="modal-title">${id?'ویرایش یادداشت':'یادداشت جدید'}</div>
        <div class="flex-gap">
          <button class="icon-btn" id="btn-pin" title="سنجاق">${U.icon('pin')}</button>
          <button class="icon-btn" id="m-close">${U.icon('x')}</button>
        </div>
      </div>
      <input class="input" id="f-title" value="${U.escapeHtml(n.title)}" placeholder="عنوان یادداشت" style="font-weight:800;font-size:16px;margin-bottom:10px">
      <div class="editor-toolbar">
        <button data-cmd="bold" title="ضخیم"><b>B</b></button>
        <button data-cmd="italic" title="کج"><i>I</i></button>
        <button data-cmd="insertUnorderedList" title="لیست">•≡</button>
        <button data-cmd="insertOrderedList" title="لیست شماره‌دار">۱≡</button>
      </div>
      <div class="note-editor-area" id="f-body" contenteditable="true">${n.bodyHtml || ''}</div>
      <div class="field" style="margin-top:14px"><label>برچسب‌ها (با کاما جدا کن)</label>
        <input class="input" id="f-tags" value="${U.escapeHtml((n.tags||[]).join('، '))}" placeholder="مثلاً کار، ایده"></div>
      <div class="modal-actions">
        ${id ? `<button class="btn btn-danger" id="btn-delete">${U.icon('trash')} حذف</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" id="btn-cancel">انصراف</button>
        <button class="btn btn-primary" id="btn-save">ذخیره</button>
      </div>
    `, { className: 'modal-lg' });

    let pinned = !!n.pinned;
    const pinBtn = overlay.querySelector('#btn-pin');
    function refreshPinBtn() { pinBtn.style.color = pinned ? 'var(--accent-strong)' : ''; }
    refreshPinBtn();
    pinBtn.onclick = () => { pinned = !pinned; refreshPinBtn(); };

    overlay.querySelectorAll('.editor-toolbar button').forEach(b => b.onclick = () => {
      document.execCommand(b.dataset.cmd, false, null);
      overlay.querySelector('#f-body').focus();
    });
    overlay.querySelector('#m-close').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#btn-cancel').onclick = () => U.closeModal(overlay);
    if (id) overlay.querySelector('#btn-delete').onclick = () => {
      const dd = data(); dd.notes = dd.notes.filter(x=>x.id!==id); save(); U.closeModal(overlay); Z.app.refreshView(); U.toast('یادداشت حذف شد');
    };
    overlay.querySelector('#btn-save').onclick = () => {
      const title = overlay.querySelector('#f-title').value.trim();
      const bodyHtml = overlay.querySelector('#f-body').innerHTML;
      const tags = overlay.querySelector('#f-tags').value.split(/[،,]/).map(t=>t.trim()).filter(Boolean);
      const dd = data();
      const wasNew = !id;
      if (id) Object.assign(n, { title, bodyHtml, tags, pinned, updatedAt: Date.now() });
      else dd.notes.push({ id:U.genId(), title, bodyHtml, tags, pinned, createdAt: Date.now(), updatedAt: Date.now() });
      if (wasNew) Z.store.bumpActivity(pid(), 'notes', U.todayISO(), 1);
      save(); U.closeModal(overlay); Z.app.refreshView();
      U.toast(id?'یادداشت ذخیره شد':'یادداشت اضافه شد');
    };
  }

  return { render };
})();
