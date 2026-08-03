/* =========================================================
   Z.charts — Chart.js wrappers + custom heatmap (Growth Grid)
   ========================================================= */
window.Z = window.Z || {};

Z.charts = (function () {
  const registry = {}; // canvas id -> Chart instance (so we can destroy/rebuild on update)

  function themeColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: dark ? '#AEB6AC' : '#63685F',
      grid: dark ? '#2C4238' : '#E8E4D6',
      pine: dark ? '#4C7F6E' : '#2F5D50',
      gold: dark ? '#E0B35C' : '#C9962E',
      rust: dark ? '#D97A64' : '#A8452F',
      sky: dark ? '#6FA7C4' : '#3E6E8E',
    };
  }

  function destroy(canvasId) {
    if (registry[canvasId]) { registry[canvasId].destroy(); delete registry[canvasId]; }
  }

  function chartLibAvailable() { return typeof Chart !== 'undefined'; }
  function offlineFallback(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (ctx && ctx.parentElement) {
      ctx.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-faint);font-size:12px;text-align:center;padding:12px">نمودار نیاز به اتصال اینترنت (برای بارگذاری Chart.js) دارد</div>';
    }
  }

  function weeklyActivityBar(canvasId, labels, datasets) {
    if (!chartLibAvailable()) { offlineFallback(canvasId); return; }
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const c = themeColors();
    registry[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: datasets.map((ds) => ({ ...ds, borderRadius: 6, maxBarThickness: 26 })) },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: datasets.length > 1, position: 'bottom', labels: { color: c.text, font: { family: 'Vazirmatn', size: 11 }, usePointStyle: true, boxWidth: 8 } } },
        scales: {
          x: { stacked: datasets.length > 1, grid: { display: false }, ticks: { color: c.text, font: { family: 'Vazirmatn', size: 11 } } },
          y: { stacked: datasets.length > 1, beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text, precision: 0, font: { family: 'Space Grotesk', size: 10 } } },
        },
      },
    });
  }

  function trendLine(canvasId, labels, datasets) {
    if (!chartLibAvailable()) { offlineFallback(canvasId); return; }
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const c = themeColors();
    registry[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: datasets.map(ds => ({ ...ds, tension: 0.35, fill: true, pointRadius: 3, pointHoverRadius: 5 })) },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: datasets.length > 1, position: 'bottom', labels: { color: c.text, font: { family: 'Vazirmatn', size: 11 }, usePointStyle: true, boxWidth: 8 } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.text, font: { family: 'Vazirmatn', size: 11 } } },
          y: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text, font: { family: 'Space Grotesk', size: 10 } } },
        },
      },
    });
  }

  function doughnut(canvasId, labels, data, colors) {
    if (!chartLibAvailable()) { offlineFallback(canvasId); return; }
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const c = themeColors();
    registry[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: getComputedStyle(document.body).getPropertyValue('--surface') || '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { color: c.text, font: { family: 'Vazirmatn', size: 11 }, usePointStyle: true, boxWidth: 8, padding: 12 } } },
      },
    });
  }

  /* ---- Growth Grid: signature heatmap, pure DOM (no chart lib) ---- */
  // Renders `weeks` columns x 7 rows, RTL-neutral (grid itself set to ltr via CSS so weeks read chronologically)
  function renderHeatGrid(container, valuesByISO, opts) {
    opts = opts || {};
    const days = opts.days || 91; // ~13 weeks
    const todayISO = Z.utils.todayISO();
    const cells = [];
    for (let i = days - 1; i >= 0; i--) {
      const iso = Z.utils.isoAddDays(todayISO, -i);
      const v = valuesByISO[iso] || 0;
      cells.push({ iso, v });
    }
    const max = Math.max(1, ...cells.map(c => c.v));
    container.innerHTML = cells.map(c => {
      const level = c.v === 0 ? 0 : c.v >= max * 0.75 ? 4 : c.v >= max * 0.5 ? 3 : c.v >= max * 0.25 ? 2 : 1;
      return `<div class="${opts.cellClass || 'growth-cell'}" data-level="${level}" title="${Z.utils.faDateFromISO(c.iso,{short:true})} — ${Z.utils.faNum(c.v)}"></div>`;
    }).join('');
  }

  return { weeklyActivityBar, trendLine, doughnut, renderHeatGrid, themeColors, destroy };
})();
