/* =========================================================
   Z.utils — shared helpers (namespaced global, no bundler needed)
   ========================================================= */
window.Z = window.Z || {};

Z.utils = (function () {

  /* ---------- IDs ---------- */
  function genId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  /* ---------- Persian digits ---------- */
  const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  function faNum(input) {
    return String(input).replace(/[0-9]/g, d => FA_DIGITS[+d]);
  }

  /* ---------- Jalali <-> Gregorian (public-domain astronomical algorithm) ---------- */
  function div(a, b) { return ~~(a / b); }

  function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
    let gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = 355666 + (365 * gy) + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + g_d_m[gm - 1];
    let jy = -1595 + (33 * div(days, 12053));
    days %= 12053;
    jy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) { jy += div(days - 1, 365); days = (days - 1) % 365; }
    let jm, jd;
    if (days < 186) { jm = 1 + div(days, 31); jd = 1 + (days % 31); }
    else { jm = 7 + div(days - 186, 30); jd = 1 + ((days - 186) % 30); }
    return [jy, jm, jd];
  }

  function jalaliToGregorian(jy, jm, jd) {
    jy += 1595;
    let days = -355668 + (365 * jy) + (div(jy, 33) * 8) + div(((jy % 33) + 3), 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * div(days, 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * div(--days, 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) { gy += div(days - 1, 365); days = (days - 1) % 365; }
    let gd = days + 1;
    const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
    const sal_a = [0,31, isLeap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
    let gm;
    for (gm = 1; gm <= 12; gm++) {
      if (gd <= sal_a[gm]) break;
      gd -= sal_a[gm];
    }
    return [gy, gm, gd];
  }

  const JALALI_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const WEEKDAYS_FA = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
  const WEEKDAYS_FA_SHORT = ['ی','د','س','چ','پ','ج','ش'];

  // ISO date string (YYYY-MM-DD) helpers — internal storage stays Gregorian/ISO for easy sorting/math
  function todayISO() { return dateToISO(new Date()); }
  function dateToISO(d) {
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function isoAddDays(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return dateToISO(d);
  }
  function isoDiffDays(isoA, isoB) {
    const a = new Date(isoA + 'T00:00:00'), b = new Date(isoB + 'T00:00:00');
    return Math.round((a - b) / 86400000);
  }
  // JS getDay(): 0=Sun..6=Sat. Iranian week starts Saturday(6) — convert to 0=Sat..6=Fri
  function isoWeekdayIrIndex(iso) {
    const jsDay = new Date(iso + 'T00:00:00').getDay(); // 0 Sun..6 Sat
    return (jsDay + 1) % 7; // 0=Sat,1=Sun,2=Mon,3=Tue,4=Wed,5=Thu,6=Fri
  }

  function faDateFromISO(iso, opts) {
    opts = opts || {};
    const d = new Date(iso + 'T00:00:00');
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth()+1, d.getDate());
    if (opts.short) return `${faNum(jd)} ${JALALI_MONTHS[jm-1]}`;
    if (opts.numeric) return `${faNum(jy)}/${faNum(String(jm).padStart(2,'0'))}/${faNum(String(jd).padStart(2,'0'))}`;
    return `${faNum(jd)} ${JALALI_MONTHS[jm-1]} ${faNum(jy)}`;
  }
  function faWeekdayFromISO(iso, short) {
    const idxIr = isoWeekdayIrIndex(iso); // 0=Sat..6=Fri
    const jsDay = new Date(iso+'T00:00:00').getDay();
    return short ? WEEKDAYS_FA_SHORT[jsDay] : WEEKDAYS_FA[jsDay];
  }
  function relativeDayLabel(iso) {
    const diff = isoDiffDays(iso, todayISO());
    if (diff === 0) return 'امروز';
    if (diff === 1) return 'فردا';
    if (diff === -1) return 'دیروز';
    if (diff > 1 && diff < 7) return faWeekdayFromISO(iso);
    return faDateFromISO(iso, { short: true });
  }
  function nowHM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  function faTime(hm) {
    return faNum(hm);
  }

  /* ---------- Formatting ---------- */
  function formatCurrency(n, currency) {
    currency = currency || 'تومان';
    const rounded = Math.round(n);
    const str = Math.abs(rounded).toLocaleString('en-US');
    return `${rounded < 0 ? '−' : ''}${faNum(str)} ${currency}`;
  }
  function formatCompact(n) {
    const abs = Math.abs(n);
    if (abs >= 1000000) return faNum((n/1000000).toFixed(1)) + ' م';
    if (abs >= 1000) return faNum((n/1000).toFixed(1)) + ' ه';
    return faNum(n);
  }
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /* ---------- Misc ---------- */
  function debounce(fn, ms) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function uniq(arr) { return [...new Set(arr)]; }

  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  /* ---------- Toasts ---------- */
  function ensureToastStack() {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }
  function toast(msg, opts) {
    opts = opts || {};
    const stack = ensureToastStack();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s ease, transform .25s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 260);
    }, opts.duration || 2600);
  }

  /* ---------- Modal ---------- */
  function openModal(innerHtml, opts) {
    opts = opts || {};
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal ${opts.className||''}" role="dialog" aria-modal="true">${innerHtml}</div>`;
    document.body.appendChild(overlay);
    if (opts.closeOnOverlay !== false) {
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(overlay); });
    }
    const escHandler = (e) => { if (e.key === 'Escape') { closeModal(overlay); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
    return overlay;
  }
  function closeModal(overlay) {
    if (!overlay) overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
  }

  /* ---------- Simple icon set (feather-like inline svg strings) ---------- */
  const ICONS = {
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>',
    tasks:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/><rect x="3" y="3" width="18" height="18" rx="4"/></svg>',
    habit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4-2 7-6 7-11a7 7 0 0 0-14 0c0 5 3 9 7 11Z"/><path d="M12 12v5"/></svg>',
    notes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5"/><path d="M6 3h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 13h8M8 17h5"/></svg>',
    finance:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 3 6 1.4 6 4.3 0 1.4-1.3 2.4-3 2.4s-3-1-3-2.4"/></svg>',
    reports:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="13" y="8" width="3" height="10"/><rect x="19" y="5" width="0" height="13"/></svg>',
    ai:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="4"/></svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.42.68.7 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>',
    trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
    edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
    sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    flame:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1.5 3 .5 4.5-1 6.5-2 2.7-2.5 4-2.5 6a5.5 5.5 0 0 0 11 0c0-3-1.5-4.5-3-7 1 3-1 4-1.5 2C14.5 7 13 4.5 12 2Z"/></svg>',
    bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
    play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    reset:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    sparkle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
    send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-8-8 18-2-8-8-2Z"/></svg>',
    sprout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M12 10c-4 0-6-2-6-6 4 0 6 2 6 6Z"/><path d="M12 10c4 0 6-2 6-6-4 0-6 2-6 6Z"/></svg>',
    pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M8 3h8l1 6 3 3H4l3-3 1-6Z"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M6 11l6 6 6-6"/><path d="M4 20h16"/></svg>',
    upload:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M6 13l6-6 6 6"/><path d="M4 20h16"/></svg>',
    logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
    key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m10.5 12.5 8-8M16 5l2 2M13 8l2 2"/></svg>',
    chevronDown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    dots:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  };
  function icon(name) { return ICONS[name] || ''; }

  return {
    genId, faNum, gregorianToJalali, jalaliToGregorian,
    JALALI_MONTHS, WEEKDAYS_FA, WEEKDAYS_FA_SHORT,
    todayISO, dateToISO, isoAddDays, isoDiffDays, isoWeekdayIrIndex,
    faDateFromISO, faWeekdayFromISO, relativeDayLabel, nowHM, faTime,
    formatCurrency, formatCompact, escapeHtml,
    debounce, clamp, uniq, sha256,
    toast, openModal, closeModal, icon,
  };
})();
