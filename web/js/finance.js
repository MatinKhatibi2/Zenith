/* =========================================================
   Z.views.finance — income/expense tracking, budgets, charts
   ========================================================= */
window.Z = window.Z || {};
Z.views = Z.views || {};

Z.views.finance = (function () {
  const U = Z.utils;
  let sub = 'transactions';

  const CAT_ICON = {
    'خوراک':'🍔','حمل‌ونقل':'🚗','خرید':'🛍️','قبض‌ها':'🧾','سرگرمی':'🎮','سلامت':'🏥','مسکن':'🏠','متفرقه':'📦',
    'حقوق':'💼','فریلنس':'💻','هدیه':'🎁','سرمایه‌گذاری':'📈',
  };
  function catIcon(name) { return CAT_ICON[name] || (name && name[0]) || '💰'; }

  function pid() { return Z.store.getActiveProfileId(); }
  function data() { return Z.store.loadData(pid()); }
  function save() { Z.store.touch(pid()); }
  function currency() { return data().settings.currency || 'تومان'; }

  function monthKey(iso) { return iso.slice(0,7); }
  function thisMonthKey() { return U.todayISO().slice(0,7); }

  function totals() {
    const tx = data().finance.transactions;
    let income=0, expense=0, mIncome=0, mExpense=0;
    const mk = thisMonthKey();
    tx.forEach(t => {
      if (t.type==='income') { income+=t.amount; if (monthKey(t.date)===mk) mIncome+=t.amount; }
      else { expense+=t.amount; if (monthKey(t.date)===mk) mExpense+=t.amount; }
    });
    return { balance: income-expense, income, expense, mIncome, mExpense };
  }

  function render(root) {
    root.innerHTML = `
      <div class="filter-tabs" style="margin-bottom:16px">
        <div class="filter-tab ${sub==='transactions'?'active':''}" data-sub="transactions">تراکنش‌ها</div>
        <div class="filter-tab ${sub==='budgets'?'active':''}" data-sub="budgets">بودجه‌ها</div>
        <div class="filter-tab ${sub==='charts'?'active':''}" data-sub="charts">نمودارها</div>
      </div>
      <div id="fin-body"></div>
    `;
    root.querySelectorAll('.filter-tab[data-sub]').forEach(el => el.onclick = () => { sub = el.dataset.sub; render(root); });
    const body = root.querySelector('#fin-body');
    if (sub === 'transactions') renderTransactions(body);
    else if (sub === 'budgets') renderBudgets(body);
    else renderCharts(body);
  }

  /* ============ TRANSACTIONS ============ */
  function renderTransactions(root) {
    const t = totals();
    root.innerHTML = `
      <div class="balance-hero" style="margin-bottom:16px">
        <div class="balance-label">موجودی کل</div>
        <div class="balance-value">${U.formatCurrency(t.balance, currency())}</div>
        <div class="balance-sub">
          <div class="balance-sub-item">درآمد این ماه<b>${U.formatCurrency(t.mIncome, currency())}</b></div>
          <div class="balance-sub-item">هزینه این ماه<b>${U.formatCurrency(t.mExpense, currency())}</b></div>
        </div>
      </div>
      <div class="flex-between" style="margin-bottom:10px">
        <div class="section-title">تراکنش‌های اخیر</div>
        <button class="btn btn-primary btn-sm" id="btn-add-tx">${U.icon('plus')} تراکنش جدید</button>
      </div>
      <div class="card" id="tx-list" style="padding:8px 14px"></div>
    `;
    root.querySelector('#btn-add-tx').onclick = () => openTxModal();
    const list = data().finance.transactions.slice().sort((a,b) => b.date.localeCompare(a.date) || b.ts - a.ts);
    const holder = root.querySelector('#tx-list');
    if (list.length === 0) { holder.innerHTML = emptyTx(); return; }
    holder.innerHTML = list.map(txRow).join('');
    holder.querySelectorAll('.tx-row').forEach(r => r.addEventListener('click', () => openTxModal(r.dataset.id)));
  }
  function emptyTx() { return `<div class="empty-state">${U.icon('finance')}<div class="empty-state-title">هنوز تراکنشی ثبت نشده</div></div>`; }
  function txRow(t) {
    const isIncome = t.type === 'income';
    return `
      <div class="tx-row" data-id="${t.id}" style="cursor:pointer">
        <div class="tx-icon" style="background:${isIncome?'var(--pine-100)':'var(--rust-100)'}">${catIcon(t.category)}</div>
        <div class="tx-body">
          <div class="tx-title">${U.escapeHtml(t.note || t.category)}</div>
          <div class="tx-cat">${U.escapeHtml(t.category)} · ${U.relativeDayLabel(t.date)}</div>
        </div>
        <div class="tx-amount ${isIncome?'income':'expense'}">${isIncome?'+':'−'}${U.formatCurrency(Math.abs(t.amount), currency())}</div>
      </div>`;
  }

  function openTxModal(id) {
    const d = data();
    const t = id ? d.finance.transactions.find(t=>t.id===id) : { id:null, type:'expense', amount:'', category:d.finance.expenseCategories[0], note:'', date:U.todayISO() };
    let type = t.type;
    function categoriesFor(ty) { return ty==='income' ? d.finance.incomeCategories : d.finance.expenseCategories; }
    const overlay = U.openModal(`
      <div class="modal-head"><div class="modal-title">${id?'ویرایش تراکنش':'تراکنش جدید'}</div><button class="icon-btn" id="m-close">${U.icon('x')}</button></div>
      <div class="chip-select" id="f-type" style="margin-bottom:16px">
        <div class="chip ${type==='expense'?'selected':''}" data-t="expense" style="${type==='expense'?'background:var(--danger);border-color:var(--danger)':''}">هزینه</div>
        <div class="chip ${type==='income'?'selected':''}" data-t="income" style="${type==='income'?'background:var(--pine-600);border-color:var(--pine-600)':''}">درآمد</div>
      </div>
      <div class="field"><label>مبلغ (${currency()})</label><input class="input num" type="number" id="f-amount" value="${t.amount}" placeholder="۰"></div>
      <div class="field"><label>دسته‌بندی</label><div class="chip-select" id="f-cat">${categoriesFor(type).map(c => `<div class="chip ${t.category===c?'selected':''}" data-c="${U.escapeHtml(c)}">${catIcon(c)} ${U.escapeHtml(c)}</div>`).join('')}</div></div>
      <div class="field"><label>توضیح (اختیاری)</label><input class="input" id="f-note" value="${U.escapeHtml(t.note||'')}" placeholder="مثلاً ناهار با دوستان"></div>
      <div class="field"><label>تاریخ</label><input class="input" type="date" id="f-date" value="${t.date}"></div>
      <div class="modal-actions">
        ${id ? `<button class="btn btn-danger" id="btn-delete">${U.icon('trash')} حذف</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" id="btn-cancel">انصراف</button>
        <button class="btn btn-primary" id="btn-save">ذخیره</button>
      </div>
    `);
    let selCat = t.category;
    function refreshCatChips() {
      overlay.querySelector('#f-cat').innerHTML = categoriesFor(type).map(c => `<div class="chip ${selCat===c?'selected':''}" data-c="${U.escapeHtml(c)}">${catIcon(c)} ${U.escapeHtml(c)}</div>`).join('');
      overlay.querySelectorAll('#f-cat .chip').forEach(c => c.onclick = () => { selCat = c.dataset.c; refreshCatChips(); });
    }
    refreshCatChips();
    overlay.querySelectorAll('#f-type .chip').forEach(c => c.onclick = () => {
      type = c.dataset.t;
      overlay.querySelectorAll('#f-type .chip').forEach(x => { x.classList.remove('selected'); x.style.cssText=''; });
      c.classList.add('selected'); c.style.cssText = type==='expense' ? 'background:var(--danger);border-color:var(--danger)' : 'background:var(--pine-600);border-color:var(--pine-600)';
      selCat = categoriesFor(type)[0];
      refreshCatChips();
    });
    overlay.querySelector('#m-close').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#btn-cancel').onclick = () => U.closeModal(overlay);
    if (id) overlay.querySelector('#btn-delete').onclick = () => {
      const dd = data(); dd.finance.transactions = dd.finance.transactions.filter(x=>x.id!==id); save(); U.closeModal(overlay); Z.app.refreshView();
    };
    overlay.querySelector('#btn-save').onclick = () => {
      const amount = Math.abs(+overlay.querySelector('#f-amount').value || 0);
      if (!amount) { U.toast('مبلغ رو وارد کن'); return; }
      const payload = { type, amount, category: selCat, note: overlay.querySelector('#f-note').value.trim(), date: overlay.querySelector('#f-date').value || U.todayISO() };
      const dd = data();
      const wasNew = !id;
      if (id) Object.assign(t, payload);
      else dd.finance.transactions.push({ id:U.genId(), ts:Date.now(), ...payload });
      if (wasNew) Z.store.bumpActivity(pid(), 'tx', payload.date, 1);
      save(); U.closeModal(overlay); Z.app.refreshView();
      U.toast(id?'تراکنش ذخیره شد':'تراکنش ثبت شد');
    };
  }

  /* ============ BUDGETS ============ */
  function spentThisMonth(category) {
    const mk = thisMonthKey();
    return data().finance.transactions.filter(t => t.type==='expense' && t.category===category && monthKey(t.date)===mk).reduce((s,t)=>s+t.amount,0);
  }
  function renderBudgets(root) {
    const d = data();
    root.innerHTML = `
      <div class="flex-between" style="margin-bottom:14px">
        <div class="text-muted" style="font-size:12.5px">بودجه ماهانه برای هر دسته‌بندی هزینه</div>
        <button class="btn btn-primary btn-sm" id="btn-add-budget">${U.icon('plus')} بودجه جدید</button>
      </div>
      <div class="grid grid-2" id="budget-list"></div>
    `;
    root.querySelector('#btn-add-budget').onclick = () => openBudgetModal();
    const holder = root.querySelector('#budget-list');
    if (d.finance.budgets.length===0) { holder.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${U.icon('finance')}<div class="empty-state-title">بودجه‌ای تعریف نشده</div></div>`; return; }
    holder.innerHTML = d.finance.budgets.map(b => {
      const spent = spentThisMonth(b.category);
      const pct = U.clamp((spent/b.monthlyLimit)*100, 0, 100);
      const over = spent > b.monthlyLimit;
      return `
      <div class="card" data-cat="${U.escapeHtml(b.category)}">
        <div class="flex-between"><div style="font-weight:800;font-size:13.5px">${catIcon(b.category)} ${U.escapeHtml(b.category)}</div><div class="text-muted" style="font-size:11.5px">${U.faNum(Math.round(pct))}٪</div></div>
        <div class="budget-bar-track"><div class="budget-bar-fill ${over?'over':''}" style="width:${pct}%"></div></div>
        <div class="flex-between" style="margin-top:8px;font-size:12px">
          <span class="${over?'tx-amount expense':'text-muted'}">${U.formatCurrency(spent, currency())}</span>
          <span class="text-muted">از ${U.formatCurrency(b.monthlyLimit, currency())}</span>
        </div>
      </div>`;
    }).join('');
    holder.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => openBudgetModal(c.dataset.cat)));
  }
  function openBudgetModal(existingCat) {
    const d = data();
    const existing = existingCat ? d.finance.budgets.find(b=>b.category===existingCat) : null;
    const overlay = U.openModal(`
      <div class="modal-head"><div class="modal-title">${existing?'ویرایش بودجه':'بودجه جدید'}</div><button class="icon-btn" id="m-close">${U.icon('x')}</button></div>
      <div class="field"><label>دسته‌بندی</label>
        <div class="chip-select" id="f-cat">${d.finance.expenseCategories.map(c => `<div class="chip ${ (existing?existing.category:d.finance.expenseCategories[0])===c?'selected':''}" data-c="${U.escapeHtml(c)}">${catIcon(c)} ${U.escapeHtml(c)}</div>`).join('')}</div>
      </div>
      <div class="field"><label>سقف ماهانه (${currency()})</label><input class="input num" type="number" id="f-limit" value="${existing?existing.monthlyLimit:''}"></div>
      <div class="modal-actions">
        ${existing ? `<button class="btn btn-danger" id="btn-delete">${U.icon('trash')} حذف</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" id="btn-cancel">انصراف</button>
        <button class="btn btn-primary" id="btn-save">ذخیره</button>
      </div>
    `);
    let selCat = existing ? existing.category : d.finance.expenseCategories[0];
    overlay.querySelectorAll('#f-cat .chip').forEach(c => c.onclick = () => { selCat=c.dataset.c; overlay.querySelectorAll('#f-cat .chip').forEach(x=>x.classList.remove('selected')); c.classList.add('selected'); });
    overlay.querySelector('#m-close').onclick = () => U.closeModal(overlay);
    overlay.querySelector('#btn-cancel').onclick = () => U.closeModal(overlay);
    if (existing) overlay.querySelector('#btn-delete').onclick = () => {
      const dd = data(); dd.finance.budgets = dd.finance.budgets.filter(b=>b.category!==existing.category); save(); U.closeModal(overlay); Z.app.refreshView();
    };
    overlay.querySelector('#btn-save').onclick = () => {
      const limit = +overlay.querySelector('#f-limit').value || 0;
      if (!limit) { U.toast('سقف بودجه رو وارد کن'); return; }
      const dd = data();
      dd.finance.budgets = dd.finance.budgets.filter(b=>b.category!==selCat);
      dd.finance.budgets.push({ category: selCat, monthlyLimit: limit });
      save(); U.closeModal(overlay); Z.app.refreshView();
      U.toast('بودجه ذخیره شد');
    };
  }

  /* ============ CHARTS ============ */
  function renderCharts(root) {
    root.innerHTML = `
      <div class="grid grid-2">
        <div class="card"><div class="card-title">هزینه‌ها به تفکیک دسته (این ماه)</div><div style="height:230px;margin-top:10px"><canvas id="chart-expense-pie"></canvas></div></div>
        <div class="card"><div class="card-title">روند ۶ ماه اخیر</div><div style="height:230px;margin-top:10px"><canvas id="chart-trend"></canvas></div></div>
      </div>
    `;
    const mk = thisMonthKey();
    const tx = data().finance.transactions;
    const byCat = {};
    tx.filter(t=>t.type==='expense' && monthKey(t.date)===mk).forEach(t => byCat[t.category] = (byCat[t.category]||0)+t.amount);
    const labels = Object.keys(byCat);
    const palette = ['#2F5D50','#C9962E','#3E6E8E','#A8452F','#4C7F6E','#B07E1F','#8a6d3b','#63685F'];
    if (labels.length) Z.charts.doughnut('chart-expense-pie', labels, labels.map(l=>byCat[l]), labels.map((_,i)=>palette[i%palette.length]));
    else document.getElementById('chart-expense-pie').parentElement.innerHTML = `<div class="empty-state" style="padding:20px">${U.icon('finance')}<div>این ماه هزینه‌ای ثبت نشده</div></div>`;

    const months = [];
    for (let i=5;i>=0;i--) { const d=new Date(); d.setMonth(d.getMonth()-i); months.push(d.toISOString().slice(0,7)); }
    const incomeData = months.map(m => tx.filter(t=>t.type==='income'&&monthKey(t.date)===m).reduce((s,t)=>s+t.amount,0));
    const expenseData = months.map(m => tx.filter(t=>t.type==='expense'&&monthKey(t.date)===m).reduce((s,t)=>s+t.amount,0));
    const monthLabels = months.map(m => { const [y,mm]=m.split('-').map(Number); const [,jm]=U.gregorianToJalali(y,mm,1); return U.JALALI_MONTHS[jm-1]; });
    Z.charts.trendLine('chart-trend', monthLabels, [
      { label:'درآمد', data: incomeData, borderColor:'#2F5D50', backgroundColor:'rgba(47,93,80,0.12)' },
      { label:'هزینه', data: expenseData, borderColor:'#A8452F', backgroundColor:'rgba(168,69,47,0.12)' },
    ]);
  }

  return { render, totals, thisMonthKey, monthKey };
})();
