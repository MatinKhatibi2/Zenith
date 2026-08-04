/* =========================================================
   Z.ai — AI assistant chat, powered directly by the Anthropic API — bilingual
   BYOK: the user's key lives only on their device and is sent
   straight to api.anthropic.com — there is no backend here.
   ========================================================= */
window.Z = window.Z || {};

Z.ai = (function () {
  const U = Z.utils;
  const T = Z.i18n.t;
  let pendingAutoPrompt = null;

  function pid() { return Z.store.getActiveProfileId(); }
  function data() { return Z.store.loadData(pid()); }
  function save() { Z.store.touch(pid()); }
  function apiKey() { return (data().settings.apiKey || '').trim(); }
  function model() { return data().settings.aiModel || 'claude-haiku-4-5-20251001'; }

  function buildContextSummary() {
    const d = data();
    const today = U.todayISO();
    const last7 = []; for (let i=6;i>=0;i--) last7.push(U.isoAddDays(today,-i));

    const openTasks = d.tasks.filter(t=>t.status!=='done');
    const overdue = openTasks.filter(t=>t.dueDate && t.dueDate<today);
    const doneThisWeek = d.tasks.filter(t=>t.completedAt && last7.includes(U.dateToISO(new Date(t.completedAt))));

    const habitLines = d.habits.map(h => {
      const streak = h.frequency==='daily' ? (function(){ let s=0,c=today; if(!h.checkins[c]) c=U.isoAddDays(c,-1); while(h.checkins[c]){s++;c=U.isoAddDays(c,-1);} return s; })() : null;
      return `${h.name} (${h.frequency==='daily'?'daily streak '+streak+'d':'target '+h.targetPerWeek+'x/week'})`;
    });

    const fin = Z.views.finance.totals();
    const overBudget = d.finance.budgets.filter(b => {
      const mk = Z.views.finance.thisMonthKey();
      const spent = d.finance.transactions.filter(t=>t.type==='expense'&&t.category===b.category&&Z.views.finance.monthKey(t.date)===mk).reduce((s,t)=>s+t.amount,0);
      return spent > b.monthlyLimit;
    }).map(b=>b.category);

    const pomoToday = d.pomodoro.sessions.filter(s=>s.date===today).length;
    const xp = Z.gamification.xpProgress(d.gamification.xp);

    return [
      `Today's date: ${U.faDateFromISO(today)}`,
      `Open tasks: ${openTasks.length} (${overdue.length} overdue). Completed this week: ${doneThisWeek.length}.`,
      `Habits: ${habitLines.length ? habitLines.join(', ') : 'none yet'}`,
      `Pomodoros today: ${pomoToday}`,
      `Finance this month: income ${Math.round(fin.mIncome)} ${d.settings.currency}, expense ${Math.round(fin.mExpense)} ${d.settings.currency}, total balance ${Math.round(fin.balance)} ${d.settings.currency}.`,
      overBudget.length ? `Over-budget categories this month: ${overBudget.join(', ')}` : `All budgets on track this month.`,
      `Notes count: ${d.notes.length}`,
      `Level ${xp.level} (${d.gamification.xp} XP).`,
    ].join('\n');
  }

  function systemPrompt() {
    const langLine = Z.i18n.isFa()
      ? 'با کاربر فقط به زبان فارسی و با لحنی گرم، مختصر و دوستانه صحبت کن (نه رسمی و خشک).'
      : 'Speak with the user only in English, in a warm, concise, friendly tone (not formal or stiff).';
    return `You are "Sprout" (جوانه), the AI assistant inside the Zenith app — a personal task, habit, notes and finance tracker.
${langLine}
Always base your answers on the real user-data summary below, not guesses.
If there isn't enough data to answer something, say so honestly.
Keep answers short and practical (usually under 150 words) unless the user asks for more detail.
Never give definitive medical, professional-financial, or legal advice; only coach based on the in-app data.

Current user status summary:
${buildContextSummary()}`;
  }

  function render(root) {
    const hasKey = !!apiKey();
    const history = data().chatHistory;
    root.innerHTML = `
      <div class="chat-wrap">
        ${!hasKey ? `
          <div class="api-key-banner">
            ${U.icon('key')}
            <div style="flex:1">${T('ai.keyBanner')}</div>
            <button class="btn btn-accent btn-sm" id="btn-goto-settings">${T('ai.gotoSettings')}</button>
          </div>` : ''}
        <div class="chat-messages" id="chat-messages">
          ${history.length === 0 ? emptyState() : history.map(msgHtml).join('')}
        </div>
        <div class="chat-input-bar">
          <textarea class="textarea" id="chat-input" placeholder="${hasKey ? T('ai.inputPlaceholder') : T('ai.inputDisabledPlaceholder')}" rows="1" ${hasKey?'':'disabled'}></textarea>
          <button class="btn btn-primary btn-icon-only" id="btn-send" ${hasKey?'':'disabled'}>${U.icon('send')}</button>
        </div>
      </div>
    `;
    if (root.querySelector('#btn-goto-settings')) root.querySelector('#btn-goto-settings').onclick = () => Z.app.navigate('settings');
    const messagesEl = root.querySelector('#chat-messages');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (history.length === 0) {
      root.querySelectorAll('.suggestion-chip').forEach(c => c.onclick = () => { if (hasKey) sendMessage(root, c.dataset.q); });
    }
    const input = root.querySelector('#chat-input');
    const sendBtn = root.querySelector('#btn-send');
    if (hasKey) {
      sendBtn.onclick = () => { const v = input.value.trim(); if (v) sendMessage(root, v); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v=input.value.trim(); if (v) sendMessage(root, v); } });
      input.addEventListener('input', () => { input.style.height='auto'; input.style.height = Math.min(120, input.scrollHeight)+'px'; });
    }
    if (pendingAutoPrompt) { const p = pendingAutoPrompt; pendingAutoPrompt = null; if (hasKey) sendMessage(root, p); }
  }

  function emptyState() {
    const suggestions = ['ai.suggestion1','ai.suggestion2','ai.suggestion3','ai.suggestion4'].map(k => T(k));
    return `
      <div class="chat-empty">
        <div class="sprout-icon">${U.icon('sprout')}</div>
        <div style="font-weight:800;font-size:15px;color:var(--text)">${T('ai.helloTitle')}</div>
        <div style="font-size:13px;max-width:320px">${T('ai.helloSub')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px">
          ${suggestions.map(s => `<div class="suggestion-chip" data-q="${U.escapeHtml(s)}">${s}</div>`).join('')}
        </div>
      </div>`;
  }

  function msgHtml(m) {
    if (m.role === 'user') return `<div class="msg msg-user">${U.escapeHtml(m.content)}</div>`;
    return `<div class="msg msg-ai">${renderMarkdownLite(m.content)}</div>`;
  }
  function renderMarkdownLite(text) {
    let safe = U.escapeHtml(text);
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    safe = safe.replace(/^- (.+)$/gm, '• $1');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
  }

  function requestSmartReview(summary, periodLabel) {
    const prompt = Z.i18n.isFa()
      ? `لطفاً بر اساس داده‌های ${periodLabel} من، یه ارزیابی کوتاه و شخصی‌سازی‌شده بنویس. امتیاز کلی: ${summary.score ?? 'نامشخص'}. نرخ انجام وظایف: ${summary.taskRate ?? 'نامشخص'}٪. قوام عادت‌ها: ${summary.habitConsistency ?? 'نامشخص'}٪. جلسات پومودورو: ${summary.pomoSessions}. پایبندی بودجه: ${summary.budgetAdherence ?? 'نامشخص'}٪. یک نقطه‌قوت و یک پیشنهاد عملی مشخص بده.`
      : `Please write a short, personalized review based on my ${periodLabel} data. Overall score: ${summary.score ?? 'unknown'}. Task completion rate: ${summary.taskRate ?? 'unknown'}%. Habit consistency: ${summary.habitConsistency ?? 'unknown'}%. Pomodoro sessions: ${summary.pomoSessions}. Budget adherence: ${summary.budgetAdherence ?? 'unknown'}%. Give me one strength and one concrete actionable suggestion.`;
    pendingAutoPrompt = prompt;
    Z.app.navigate('ai');
  }

  async function sendMessage(root, text) {
    const d = data();
    d.chatHistory.push({ role:'user', content:text, ts:Date.now() });
    save();
    renderMessages(root);
    appendTyping(root);

    try {
      const history = d.chatHistory.slice(-16).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: model(), max_tokens: 700, system: systemPrompt(), messages: history }),
      });
      const json = await res.json();
      removeTyping(root);
      if (!res.ok) {
        const errMsg = (json.error && json.error.message) || 'Unknown error from Anthropic';
        d.chatHistory.push({ role:'assistant', content:`⚠️ ${T('ai.genericError')}: ${errMsg}`, ts:Date.now() });
        save(); renderMessages(root);
        return;
      }
      const textOut = (json.content || []).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim() || '(empty response)';
      d.chatHistory.push({ role:'assistant', content: textOut, ts:Date.now() });
      save();
      renderMessages(root);
    } catch (e) {
      removeTyping(root);
      d.chatHistory.push({ role:'assistant', content: '⚠️ ' + T('ai.connectionError'), ts:Date.now() });
      save();
      renderMessages(root);
    }
  }

  function renderMessages(root) {
    const el = root.querySelector('#chat-messages');
    if (!el) return;
    const history = data().chatHistory;
    el.innerHTML = history.length === 0 ? emptyState() : history.map(msgHtml).join('');
    el.scrollTop = el.scrollHeight;
    const input = root.querySelector('#chat-input');
    if (input) input.value = '';
  }
  function appendTyping(root) {
    const el = root.querySelector('#chat-messages');
    const t = document.createElement('div');
    t.className = 'msg msg-ai'; t.id = 'typing-indicator';
    t.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    el.appendChild(t); el.scrollTop = el.scrollHeight;
  }
  function removeTyping(root) { const t = root.querySelector('#typing-indicator'); if (t) t.remove(); }

  function clearHistory() {
    const d = data(); d.chatHistory = []; save(); Z.app.refreshView();
  }

  return { render, requestSmartReview, clearHistory };
})();
