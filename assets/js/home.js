/* OUKEI HUB Home UI — Ver1.5.8.18 */
let homeCalView = { y: new Date().getFullYear(), m: new Date().getMonth() };

function ensureRevenueLog() {
  if (!settings.revenueLog || typeof settings.revenueLog !== 'object') settings.revenueLog = {};
}

function revenueDateKey(y, m, d) {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function todayKey() {
  let t = new Date();
  return revenueDateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatCalLabel(y, m) {
  return y + '年' + (m + 1) + '月';
}

function defaultRevenueEntry() {
  let s = allOrgSummary();
  return {
    total: s.daily,
    ram: s.daily,
    orca: 0,
    genesis: 0,
    cary: 0,
    savedAt: new Date().toLocaleString()
  };
}

function getRevenueEntry(key) {
  ensureRevenueLog();
  return settings.revenueLog[key] || null;
}

function saveRevenueEntry(key, entry) {
  ensureRevenueLog();
  settings.revenueLog[key] = entry;
  settings.lastUpdate = new Date().toLocaleString();
  markActivity();
}

function renderHomeCalendar() {
  if (typeof homeCalendar === 'undefined') return;
  ensureRevenueLog();
  let y = homeCalView.y;
  let m = homeCalView.m;
  let first = new Date(y, m, 1);
  let start = first.getDay();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let today = new Date();
  let weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  let cells = weekdays.map(w => '<div class="homeCalDayLabel">' + w + '</div>').join('');

  for (let i = 0; i < start; i++) cells += '<div class="homeCalDay homeCalDay--blank"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    let key = revenueDateKey(y, m, d);
    let entry = getRevenueEntry(key);
    let isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
    let cls = ['homeCalDay'];
    if (isToday) cls.push('isToday');
    if (entry) cls.push('isFilled');
    else cls.push('isEmpty');
    cells += '<button type="button" class="' + cls.join(' ') + '" onclick="showRevenueDayDetail(\'' + key + '\')" aria-label="' + (m + 1) + '月' + d + '日">' + d + '</button>';
  }

  homeCalendar.innerHTML =
    '<div class="homeCalShell">' +
    '<div class="homeCalHead">' +
    '<button type="button" class="homeCalNavBtn" onclick="homeCalPrevMonth()" aria-label="前の月">‹</button>' +
    '<div class="homeCalTitle">' + formatCalLabel(y, m) + '</div>' +
    '<button type="button" class="homeCalNavBtn" onclick="homeCalNextMonth()" aria-label="次の月">›</button>' +
    '</div>' +
    '<div class="homeCalGrid">' + cells + '</div>' +
    '</div>';
}

function homeCalPrevMonth() {
  homeCalView.m--;
  if (homeCalView.m < 0) { homeCalView.m = 11; homeCalView.y--; }
  renderHomeCalendar();
}

function homeCalNextMonth() {
  homeCalView.m++;
  if (homeCalView.m > 11) { homeCalView.m = 0; homeCalView.y++; }
  renderHomeCalendar();
}

function showRevenueDayDetail(key) {
  let entry = getRevenueEntry(key);
  let parts = key.split('-');
  let label = parts[0] + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日';
  modalTitle.textContent = label + ' の収益';
  if (!entry) {
    modalContent.innerHTML = '<div class="lineBox"><b>未入力</b><p class="help">この日付の実績はまだ記録されていません。</p></div>';
  } else {
    modalContent.innerHTML =
      '<div class="lineBox"><b>合計</b><div class="amount">' + money(entry.total) + '</div><div class="help">' + yen(entry.total) + '</div></div>' +
      '<div class="homeSummaryList" style="margin-top:10px">' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot ram"></span>RAM</span><b>' + money(entry.ram || 0) + '</b></div>' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot orca"></span>ORCA</span><b>' + money(entry.orca || 0) + '</b></div>' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot genesis"></span>Genesis</span><b>' + money(entry.genesis || 0) + '</b></div>' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot cary"></span>Cary Pact</span><b>' + money(entry.cary || 0) + '</b></div>' +
      '</div>' +
      (entry.savedAt ? '<p class="help" style="margin-top:10px">記録：' + entry.savedAt + '</p>' : '');
  }
  modalBg.style.display = 'flex';
}

function openRevenueInput() {
  let key = todayKey();
  let existing = getRevenueEntry(key);
  let base = existing || defaultRevenueEntry();
  modalTitle.textContent = '実績入力';
  modalContent.innerHTML =
    '<p class="help">今日の収益を記録します（参考シミュレーション用）。</p>' +
    '<label>合計収益（USD）</label>' +
    '<input id="revenueInputTotal" type="number" step="0.01" value="' + (Math.round((base.total || 0) * 100) / 100) + '">' +
    '<label>RAM</label><input id="revenueInputRam" type="number" step="0.01" value="' + (Math.round((base.ram || base.total || 0) * 100) / 100) + '">' +
    '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">' +
    '<button class="btn2" onclick="closeModal()">キャンセル</button>' +
    '<button onclick="saveTodayRevenue()">保存</button></div>';
  modalBg.style.display = 'flex';
  setTimeout(() => { let el = document.getElementById('revenueInputTotal'); if (el) el.focus(); }, 80);
}

function saveTodayRevenue() {
  let total = Number(document.getElementById('revenueInputTotal')?.value) || 0;
  let ram = Number(document.getElementById('revenueInputRam')?.value) || 0;
  saveRevenueEntry(todayKey(), {
    total: total,
    ram: ram,
    orca: 0,
    genesis: 0,
    cary: 0,
    savedAt: new Date().toLocaleString()
  });
  closeModal();
  render();
  showToast('✅ 今日の実績を記録しました');
}

function syncMobileNav(page) {
  let nav = document.getElementById('mobileBottomNav');
  if (!nav) return;
  let map = { home: 'home', ram: 'ram', settings: 'settings', accountManage: 'ram' };
  let active = map[page] || '';
  nav.querySelectorAll('[data-nav]').forEach(btn => {
    btn.classList.toggle('isActive', btn.getAttribute('data-nav') === active);
  });
}

function openPortfolioNav() {
  alert('ポートフォリオは今後実装予定です');
}

function updateHomeLastInput() {
  if (typeof homeLastInput === 'undefined') return;
  ensureRevenueLog();
  let keys = Object.keys(settings.revenueLog).sort().reverse();
  if (!keys.length) {
    homeLastInput.textContent = settings.lastUpdate && settings.lastUpdate !== '-' ? settings.lastUpdate : '-';
    return;
  }
  let last = settings.revenueLog[keys[0]];
  homeLastInput.textContent = last.savedAt || keys[0];
}
