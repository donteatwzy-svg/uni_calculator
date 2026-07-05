/* ============ 工具函数 ============ */

function pad(n) { return String(n).padStart(2, '0'); }

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatHM(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${pad(h)}:${pad(m)}`;
}

// 计费时长取整规则：以 30 分钟为一段，段内前 15 分钟按段起点取整，
// 后 15 分钟按段终点（下一个 0.5 小时）取整。
// 例：30-45min→0.5h，45min-1h→1h，1h-1h15→1h，1h15-1h30→1.5h
function roundedBillingHours(ms) {
  const totalMinutes = ms / 60000;
  const base30 = Math.floor(totalMinutes / 30) * 30;
  const remainder = totalMinutes - base30;
  const hoursBase = base30 / 60;
  return remainder < 15 ? hoursBase : hoursBase + 0.5;
}

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDisplayDate(d = new Date()) {
  return `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDisplayTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ============ 本地存储 ============ */

const STORE_KEYS = {
  bosses: 'calc_bosses',
  monthly: 'calc_monthly',   // { month: 'YYYY-MM', income: number }
  today: 'calc_today',       // { date: 'YYYY-MM-DD', ms: number }
  records: 'calc_records'    // [{ id, ts, bossName, elapsedMs, aramSettled, aramAmount, rankSettled, rankAmount, total }]
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// boss: {
//   id, name,
//   settleType: 'simple' | 'formula',
//   aramRate, rankRate,                                   // 简单版字段
//   unitPrice, multiplier, bossDiscount, guildSplit        // 复合公式版字段
// }
let bosses = loadJSON(STORE_KEYS.bosses, null);
if (bosses === null) {
  bosses = [
    { id: 'blake', name: 'Blake', settleType: 'simple', aramRate: 13, rankRate: 16 },
    { id: 'puppy', name: 'Puppy', settleType: 'simple', aramRate: null, rankRate: null },
    { id: 'kiu', name: 'Kiu', settleType: 'simple', aramRate: null, rankRate: null },
    { id: 'anchovy', name: 'Anchovy', settleType: 'formula', rankRate: 16, unitPrice: 16, multiplier: 1.5, bossDiscount: 0.95, guildSplit: 0.78, aramTabLabel: '塔克夫' }
  ];
  saveJSON(STORE_KEYS.bosses, bosses);
} else {
  // 迁移：老存档里已有的 Anchovy 预设也补上默认塔克夫标签
  const anchovy = bosses.find(b => b.id === 'anchovy');
  if (anchovy && anchovy.aramTabLabel == null) {
    anchovy.aramTabLabel = '塔克夫';
    saveJSON(STORE_KEYS.bosses, bosses);
  }
}

let monthly = loadJSON(STORE_KEYS.monthly, { month: monthKey(), income: 0 });
if (monthly.month !== monthKey()) {
  monthly = { month: monthKey(), income: 0 };
  saveJSON(STORE_KEYS.monthly, monthly);
}

let today = loadJSON(STORE_KEYS.today, { date: todayKey(), ms: 0 });
if (today.date !== todayKey()) {
  today = { date: todayKey(), ms: 0 };
  saveJSON(STORE_KEYS.today, today);
}

let records = loadJSON(STORE_KEYS.records, []);

/* ============ 屏幕切换 ============ */

const screens = {
  home: document.getElementById('homeScreen'),
  timer: document.getElementById('timerScreen'),
  picker: document.getElementById('pickerScreen'),
  settle: document.getElementById('settleScreen'),
  records: document.getElementById('recordsScreen')
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('is-active'));
  screens[name].classList.add('is-active');
}

/* ============ 实时时钟 / 状态条（主界面） ============ */

const liveTimeEl = document.getElementById('liveTime');
const liveDateEl = document.getElementById('liveDate');
const bottomDateEl = document.getElementById('bottomDate');
const bottomTimeEl = document.getElementById('bottomTime');
const todayTotalEl = document.getElementById('todayTotal');
const monthlyIncomeEl = document.getElementById('monthlyIncome');

function tickClock() {
  const now = new Date();
  liveTimeEl.textContent = formatDisplayTime(now);
  liveDateEl.textContent = formatDisplayDate(now);
  bottomDateEl.textContent = formatDisplayDate(now);
  bottomTimeEl.textContent = formatDisplayTime(now);

  const key = todayKey(now);
  if (today.date !== key) {
    today = { date: key, ms: 0 };
    saveJSON(STORE_KEYS.today, today);
    renderToday();
  }

  const mKey = monthKey(now);
  if (monthly.month !== mKey) {
    monthly = { month: mKey, income: 0 };
    saveJSON(STORE_KEYS.monthly, monthly);
    renderMonthly();
  }
}
setInterval(tickClock, 1000);
tickClock();

function renderToday() { todayTotalEl.textContent = formatHM(today.ms); }
function renderMonthly() { monthlyIncomeEl.textContent = monthly.income.toFixed(2); }
renderToday();
renderMonthly();

document.getElementById('resetMonthlyBtn').addEventListener('click', () => {
  if (!confirm('确定要清空本月入账吗？清空后从 0 重新开始记录，此操作不可撤销。')) return;
  monthly = { month: monthKey(), income: 0 };
  saveJSON(STORE_KEYS.monthly, monthly);
  renderMonthly();
});

/* ============ 计时状态机 ============ */
// status: 'idle' | 'running' | 'paused' | 'stopped'

let timerStatus = 'idle';
let segmentStart = null;   // 当前运行片段的开始时间戳
let accumulatedMs = 0;     // 已累积的时长（不含当前运行中的片段）
let orderStartDate = null; // 首次点击播放时的真实时间（Starts From）
let tickHandle = null;
let pauseLog = [];         // [{ pausedAt: ms, resumedAt: ms|null }] 暂停/继续记录（停止也会产生一条）

const timerFaceValue = document.getElementById('timerFaceValue');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const startsFromValue = document.getElementById('startsFromValue');

function currentElapsedMs() {
  if (timerStatus === 'running' && segmentStart) {
    return accumulatedMs + (Date.now() - segmentStart);
  }
  return accumulatedMs;
}

function renderTimerFace() {
  timerFaceValue.textContent = formatElapsed(currentElapsedMs());
}

function updateControlStates() {
  pauseBtn.disabled = timerStatus !== 'running';
  stopBtn.disabled = timerStatus === 'idle';
}

function resetTimerState() {
  timerStatus = 'idle';
  segmentStart = null;
  accumulatedMs = 0;
  orderStartDate = null;
  pauseLog = [];
  clearInterval(tickHandle);
  timerFaceValue.textContent = '00:00';
  startsFromValue.textContent = '--:--';
  updateControlStates();
}

function startOrResumeTimer() {
  if (timerStatus === 'running') return;
  if (timerStatus === 'idle') {
    orderStartDate = new Date();
    startsFromValue.textContent = formatDisplayTime(orderStartDate);
  } else if (pauseLog.length > 0 && pauseLog[pauseLog.length - 1].resumedAt == null) {
    pauseLog[pauseLog.length - 1].resumedAt = Date.now();
  }
  timerStatus = 'running';
  segmentStart = Date.now();
  tickHandle = setInterval(renderTimerFace, 1000);
  renderTimerFace();
  updateControlStates();
}

function openTimerScreen() {
  resetTimerState();
  showScreen('timer');
  startOrResumeTimer(); // 点击闹钟卡片直接开始计时，无需再点播放
}

document.getElementById('openTimerBtn').addEventListener('click', openTimerScreen);

document.getElementById('timerCloseBtn').addEventListener('click', () => {
  if (timerStatus !== 'idle' && currentElapsedMs() > 0) {
    if (!confirm('当前计时还没有结算，确定要放弃本次计时吗？')) return;
  }
  clearInterval(tickHandle);
  showScreen('home');
});

playBtn.addEventListener('click', startOrResumeTimer);

function pauseSegment() {
  if (timerStatus !== 'running') return;
  accumulatedMs += Date.now() - segmentStart;
  segmentStart = null;
  timerStatus = 'paused';
  clearInterval(tickHandle);
  pauseLog.push({ pausedAt: Date.now(), resumedAt: null });
  renderTimerFace();
  updateControlStates();
}

pauseBtn.addEventListener('click', pauseSegment);

stopBtn.addEventListener('click', () => {
  if (timerStatus === 'idle') return;
  if (timerStatus === 'running') {
    pauseSegment();
  }
  timerStatus = 'stopped';
  renderTimerFace();
  updateControlStates();
  confirmEndModal.classList.add('is-open');
});

/* ============ 确认结束弹层 ============ */

const confirmEndModal = document.getElementById('confirmEndModal');

document.getElementById('confirmNoBtn').addEventListener('click', () => {
  // 返回计时：恢复为暂停状态，累计时长保留
  confirmEndModal.classList.remove('is-open');
  timerStatus = 'paused';
  updateControlStates();
});

document.getElementById('confirmYesBtn').addEventListener('click', () => {
  confirmEndModal.classList.remove('is-open');
  openPickerScreen();
});

/* ============ 选择接单老板界面 ============ */

const pickerGrid = document.getElementById('pickerGrid');
let sessionElapsedMs = 0;
let sessionStartClock = null;
let sessionEndClock = null;
let sessionPauseLog = []; // 真正的暂停区间（不含"结束"那一条）

function openPickerScreen() {
  sessionElapsedMs = currentElapsedMs();
  sessionStartClock = orderStartDate;
  sessionEndClock = pauseLog.length > 0 ? new Date(pauseLog[pauseLog.length - 1].pausedAt) : new Date();
  sessionPauseLog = pauseLog.slice(0, -1);
  renderPickerGrid();
  showScreen('picker');
}

function renderPickerGrid() {
  pickerGrid.innerHTML = '';

  bosses.forEach(boss => {
    const wrap = document.createElement('div');
    wrap.className = 'picker-tile-wrap';

    const btn = document.createElement('button');
    btn.className = 'picker-tile';
    btn.type = 'button';
    let sub = '';
    if (boss.settleType === 'formula') {
      sub = '复合公式';
    } else {
      sub = `${boss.aramRate != null ? '$' + boss.aramRate + '/时' : ''}${boss.aramRate != null && boss.rankRate != null ? ' · ' : ''}${boss.rankRate != null ? '$' + boss.rankRate + '/局' : ''}`;
    }
    btn.innerHTML = `${escapeHtml(boss.name)}<span class="picker-tile-sub">${sub}</span>`;
    btn.addEventListener('click', () => openSettleScreen(boss));

    const delBtn = document.createElement('button');
    delBtn.className = 'picker-tile-delete';
    delBtn.type = 'button';
    delBtn.setAttribute('aria-label', `删除老板 ${boss.name}`);
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`确定要删除老板"${boss.name}"吗？已经结算过的记录不会受影响。`)) return;
      bosses = bosses.filter(b => b.id !== boss.id);
      saveJSON(STORE_KEYS.bosses, bosses);
      renderPickerGrid();
    });

    wrap.appendChild(btn);
    wrap.appendChild(delBtn);
    pickerGrid.appendChild(wrap);
  });

  const addTile = document.createElement('button');
  addTile.className = 'picker-tile picker-tile--add';
  addTile.textContent = '+';
  addTile.addEventListener('click', () => {
    newBossNameInput.value = '';
    newBossAramRateInput.value = '';
    newBossRankRateInput.value = '';
    newBossUnitPriceInput.value = '';
    newBossMultiplierInput.value = '';
    newBossDiscountInput.value = '';
    newBossGuildSplitInput.value = '';
    setAddBossType('simple');
    addBossModal.classList.add('is-open');
    newBossNameInput.focus();
  });
  pickerGrid.appendChild(addTile);

  const specialTiles = [
    { name: '私单', settleType: 'simple', aramRate: null, rankRate: null },
    { name: '工会单', settleType: 'formula', rankRate: null, unitPrice: null, multiplier: null, bossDiscount: null, guildSplit: null }
  ];
  specialTiles.forEach(special => {
    const tile = document.createElement('button');
    tile.className = 'picker-tile picker-tile--special';
    tile.textContent = special.name;
    tile.addEventListener('click', () => openSettleScreen(special));
    pickerGrid.appendChild(tile);
  });
}

document.getElementById('pickerCloseBtn').addEventListener('click', () => {
  if (!confirm('确定要放弃本次计时，不进行结算吗？')) return;
  showScreen('home');
});

/* ============ 添加老板弹层 ============ */

const addBossModal = document.getElementById('addBossModal');
const newBossNameInput = document.getElementById('newBossName');
const newBossAramRateInput = document.getElementById('newBossAramRate');
const newBossRankRateInput = document.getElementById('newBossRankRate');
const newBossUnitPriceInput = document.getElementById('newBossUnitPrice');
const newBossMultiplierInput = document.getElementById('newBossMultiplier');
const newBossDiscountInput = document.getElementById('newBossDiscount');
const newBossGuildSplitInput = document.getElementById('newBossGuildSplit');
const newBossSimpleFields = document.getElementById('newBossSimpleFields');
const newBossFormulaFields = document.getElementById('newBossFormulaFields');
const typeSimpleBtn = document.getElementById('typeSimpleBtn');
const typeFormulaBtn = document.getElementById('typeFormulaBtn');

let addBossType = 'simple';

function setAddBossType(type) {
  addBossType = type;
  typeSimpleBtn.classList.toggle('is-active', type === 'simple');
  typeFormulaBtn.classList.toggle('is-active', type === 'formula');
  newBossSimpleFields.classList.toggle('is-hidden', type !== 'simple');
  newBossFormulaFields.classList.toggle('is-hidden', type !== 'formula');
}

typeSimpleBtn.addEventListener('click', () => setAddBossType('simple'));
typeFormulaBtn.addEventListener('click', () => setAddBossType('formula'));

document.getElementById('cancelAddBoss').addEventListener('click', () => {
  addBossModal.classList.remove('is-open');
});

function parseOrNull(v) { return v === '' ? null : parseFloat(v); }

document.getElementById('confirmAddBoss').addEventListener('click', () => {
  const name = newBossNameInput.value.trim();
  if (!name) { newBossNameInput.focus(); return; }
  const rankRate = parseOrNull(newBossRankRateInput.value);

  let boss;
  if (addBossType === 'formula') {
    boss = {
      id: Date.now().toString(36), name, settleType: 'formula', rankRate,
      unitPrice: parseOrNull(newBossUnitPriceInput.value),
      multiplier: parseOrNull(newBossMultiplierInput.value),
      bossDiscount: parseOrNull(newBossDiscountInput.value),
      guildSplit: parseOrNull(newBossGuildSplitInput.value)
    };
  } else {
    boss = {
      id: Date.now().toString(36), name, settleType: 'simple', rankRate,
      aramRate: parseOrNull(newBossAramRateInput.value)
    };
  }

  bosses.push(boss);
  saveJSON(STORE_KEYS.bosses, bosses);
  renderPickerGrid();
  addBossModal.classList.remove('is-open');
});

/* ============ 结算界面 ============ */

const settleBossNameEl = document.getElementById('settleBossName');
const settleProjectNameInput = document.getElementById('settleProjectName');
const aramTabLabelInput = document.getElementById('aramTabLabelInput');
const rankTabLabelInput = document.getElementById('rankTabLabelInput');
const settleTimeEl = document.getElementById('settleTime');
const settleBilledHintEl = document.getElementById('settleBilledHint');
const settleSimpleFields = document.getElementById('settleSimpleFields');
const settleFormulaFields = document.getElementById('settleFormulaFields');
const aramRateInput = document.getElementById('aramRateInput');
const formulaUnitPriceInput = document.getElementById('formulaUnitPriceInput');
const formulaMultiplierInput = document.getElementById('formulaMultiplierInput');
const formulaBossDiscountInput = document.getElementById('formulaBossDiscountInput');
const formulaGuildSplitInput = document.getElementById('formulaGuildSplitInput');
const rankRateInput = document.getElementById('rankRateInput');
const rankCountEl = document.getElementById('rankCount');
const rankManualPriceInput = document.getElementById('rankManualPrice');
const settleAramBtn = document.getElementById('settleAramBtn');
const settleRankBtn = document.getElementById('settleRankBtn');
const settleTotalAmountEl = document.getElementById('settleTotalAmount');
const finishSettleBtn = document.getElementById('finishSettleBtn');
const countDownBtn = document.getElementById('countDownBtn');
const countUpBtn = document.getElementById('countUpBtn');

let rankCount = 1;
let aramSettled = false;
let aramAmount = 0;
let aramFormulaDetail = null;
let rankSettled = false;
let rankAmount = 0;
let rankFormulaDetail = null;

let currentSettleType = 'simple';

function openSettleScreen(boss) {
  currentSettleType = boss.settleType || 'simple';

  settleBossNameEl.textContent = boss.name;
  settleTimeEl.textContent = formatElapsed(sessionElapsedMs).slice(-5); // 显示 mm:ss
  settleBilledHintEl.textContent = `计费 ${roundedBillingHours(sessionElapsedMs)} 小时`;

  settleSimpleFields.classList.toggle('is-hidden', currentSettleType !== 'simple');
  settleFormulaFields.classList.toggle('is-hidden', currentSettleType !== 'formula');

  if (currentSettleType === 'formula') {
    formulaUnitPriceInput.value = boss.unitPrice != null ? boss.unitPrice : '';
    formulaMultiplierInput.value = boss.multiplier != null ? boss.multiplier : '';
    formulaBossDiscountInput.value = boss.bossDiscount != null ? boss.bossDiscount : '';
    formulaGuildSplitInput.value = boss.guildSplit != null ? boss.guildSplit : '';
  } else {
    aramRateInput.value = boss.aramRate != null ? boss.aramRate : '';
  }

  rankRateInput.value = boss.rankRate != null ? boss.rankRate : '';
  rankManualPrice_reset();
  rankCount = 1;
  rankCountEl.textContent = pad(rankCount);
  settleProjectNameInput.value = '';
  aramTabLabelInput.value = boss.aramTabLabel || '匹配 / Aram';
  rankTabLabelInput.value = boss.rankTabLabel || 'Flex / Rank';

  aramSettled = false;
  aramAmount = 0;
  aramFormulaDetail = null;
  rankSettled = false;
  rankAmount = 0;
  rankFormulaDetail = null;
  settleAramBtn.textContent = '结算';
  settleAramBtn.classList.remove('is-settled');
  settleRankBtn.textContent = '结算';
  settleRankBtn.classList.remove('is-settled');
  updateSettleTotal();

  showScreen('settle');
}

function rankManualPrice_reset() {
  rankManualPriceInput.value = '';
}

countDownBtn.addEventListener('click', () => {
  rankCount = Math.max(1, rankCount - 1);
  rankCountEl.textContent = pad(rankCount);
});
countUpBtn.addEventListener('click', () => {
  rankCount += 1;
  rankCountEl.textContent = pad(rankCount);
});

function updateSettleTotal() {
  const total = (aramSettled ? aramAmount : 0) + (rankSettled ? rankAmount : 0);
  settleTotalAmountEl.textContent = `$${total.toFixed(2)}`;
}

settleAramBtn.addEventListener('click', () => {
  const hours = roundedBillingHours(sessionElapsedMs);

  if (currentSettleType === 'formula') {
    const unitPrice = parseFloat(formulaUnitPriceInput.value);
    const multiplier = formulaMultiplierInput.value === '' ? 1 : parseFloat(formulaMultiplierInput.value);
    const bossDiscount = formulaBossDiscountInput.value === '' ? 1 : parseFloat(formulaBossDiscountInput.value);
    const guildSplit = formulaGuildSplitInput.value === '' ? 1 : parseFloat(formulaGuildSplitInput.value);
    if (isNaN(unitPrice) || unitPrice < 0) { formulaUnitPriceInput.focus(); return; }
    aramAmount = hours * unitPrice * multiplier * bossDiscount * guildSplit;
    aramFormulaDetail = { type: 'formula', hours, unitPrice, multiplier, bossDiscount, guildSplit, tabLabel: aramTabLabelInput.value.trim() || '匹配 / Aram' };
  } else {
    const rate = parseFloat(aramRateInput.value);
    if (isNaN(rate) || rate < 0) { aramRateInput.focus(); return; }
    aramAmount = hours * rate;
    aramFormulaDetail = { type: 'simple', hours, rate, tabLabel: aramTabLabelInput.value.trim() || '匹配 / Aram' };
  }

  aramSettled = true;
  settleAramBtn.classList.add('is-settled');
  updateSettleTotal();
});

settleRankBtn.addEventListener('click', () => {
  const manual = rankManualPriceInput.value;
  if (manual !== '') {
    const manualVal = parseFloat(manual);
    if (isNaN(manualVal) || manualVal < 0) { rankManualPriceInput.focus(); return; }
    rankAmount = manualVal;
    rankFormulaDetail = { manual: true, tabLabel: rankTabLabelInput.value.trim() || 'Flex / Rank' };
  } else {
    const rate = parseFloat(rankRateInput.value);
    if (isNaN(rate) || rate < 0) { rankRateInput.focus(); return; }
    rankAmount = rate * rankCount;
    rankFormulaDetail = { manual: false, count: rankCount, rate, tabLabel: rankTabLabelInput.value.trim() || 'Flex / Rank' };
  }
  rankSettled = true;
  settleRankBtn.classList.add('is-settled');
  updateSettleTotal();
});

document.getElementById('settleCloseBtn').addEventListener('click', () => {
  if (!confirm('确定要放弃本次结算吗？收入不会被记录。')) return;
  showScreen('home');
});

finishSettleBtn.addEventListener('click', () => {
  if (!aramSettled && !rankSettled) {
    alert('请先点击至少一侧的结算按钮，再完成本单。');
    return;
  }
  const total = (aramSettled ? aramAmount : 0) + (rankSettled ? rankAmount : 0);

  monthly.income += total;
  saveJSON(STORE_KEYS.monthly, monthly);
  renderMonthly();

  today.ms += sessionElapsedMs;
  saveJSON(STORE_KEYS.today, today);
  renderToday();

  records.unshift({
    id: Date.now().toString(36),
    ts: Date.now(),
    bossName: settleBossNameEl.textContent,
    projectName: settleProjectNameInput.value.trim(),
    elapsedMs: sessionElapsedMs,
    startClock: sessionStartClock ? sessionStartClock.getTime() : null,
    endClock: sessionEndClock ? sessionEndClock.getTime() : null,
    pauses: sessionPauseLog.map(p => ({ pausedAt: p.pausedAt, resumedAt: p.resumedAt })),
    aramSettled, aramAmount, aramFormulaDetail,
    rankSettled, rankAmount, rankFormulaDetail,
    total
  });
  saveJSON(STORE_KEYS.records, records);

  showScreen('home');
});

/* ============ 接单记录界面 ============ */

const recordsList = document.getElementById('recordsList');

function formatRecordMeta(ts, elapsedMs) {
  const d = new Date(ts);
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `结算于 ${dateStr} · 时长 ${formatElapsed(elapsedMs)}`;
}

function formatClockTime(ms) {
  if (ms == null) return '--:--';
  return formatDisplayTime(new Date(ms));
}

function formatPauses(pauses) {
  if (!pauses || pauses.length === 0) return '';
  const parts = pauses.map(p => `${formatClockTime(p.pausedAt)}–${p.resumedAt ? formatClockTime(p.resumedAt) : '?'}`);
  return ` · 暂停 ${parts.join('，')}`;
}

function formatAramFormula(detail, amount) {
  if (!detail) return '';
  const label = detail.tabLabel || '匹配/Aram';
  if (detail.type === 'formula') {
    return `${label}：${detail.hours}h × $${detail.unitPrice} × ${detail.multiplier} × ${detail.bossDiscount} × ${detail.guildSplit} = $${amount.toFixed(2)}`;
  }
  return `${label}：${detail.hours}h × $${detail.rate} = $${amount.toFixed(2)}`;
}

function formatRankFormula(detail, amount) {
  if (!detail) return '';
  const label = detail.tabLabel || 'Flex/Rank';
  if (detail.manual) return `${label}：手动价格 = $${amount.toFixed(2)}`;
  return `${label}：${detail.count} 局 × $${detail.rate} = $${amount.toFixed(2)}`;
}

// 把一个 tab 文字归到四个游戏分类之一
function categorizeLabel(label) {
  if (!label) return '其他';
  const t = label.trim();
  if (t.includes('塔克夫')) return '塔克夫';
  const norm = t.toLowerCase().replace(/\s+/g, '');
  if (norm === '匹配/aram' || norm === 'aram') return '匹配/Aram';
  if (norm === 'flex/rank' || norm === 'rank/flex') return 'Rank/Flex';
  return '其他';
}

// 一条记录可能同时涉及两个分类（比如 aram 一个游戏、rank 另一个）
function recordCategories(record) {
  const cats = new Set();
  if (record.aramSettled) cats.add(categorizeLabel(record.aramFormulaDetail && record.aramFormulaDetail.tabLabel));
  if (record.rankSettled) cats.add(categorizeLabel(record.rankFormulaDetail && record.rankFormulaDetail.tabLabel));
  return cats;
}

const filterBossSelect = document.getElementById('filterBossSelect');
const filterGameSelect = document.getElementById('filterGameSelect');
const sortRecordsSelect = document.getElementById('sortRecordsSelect');

function populateBossFilterOptions() {
  const uniqueBossNames = [...new Set(records.map(r => r.bossName))].sort();
  const current = filterBossSelect.value;
  filterBossSelect.innerHTML = '<option value="all">全部老板</option>' +
    uniqueBossNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  if (uniqueBossNames.includes(current)) filterBossSelect.value = current;
}

function getFilteredSortedRecords() {
  let list = records.slice();

  const bossFilter = filterBossSelect.value;
  if (bossFilter !== 'all') list = list.filter(r => r.bossName === bossFilter);

  const gameFilter = filterGameSelect.value;
  if (gameFilter !== 'all') list = list.filter(r => recordCategories(r).has(gameFilter));

  const sortMode = sortRecordsSelect.value;
  if (sortMode === 'oldest') list.sort((a, b) => a.ts - b.ts);
  else if (sortMode === 'amountDesc') list.sort((a, b) => b.total - a.total);
  else if (sortMode === 'amountAsc') list.sort((a, b) => a.total - b.total);
  else list.sort((a, b) => b.ts - a.ts); // newest（默认）

  return list;
}

[filterBossSelect, filterGameSelect, sortRecordsSelect].forEach(select => {
  select.addEventListener('change', renderRecordsList);
});

function renderRecordsList() {
  recordsList.innerHTML = '';
  const list = getFilteredSortedRecords();

  if (list.length === 0 && records.length > 0) {
    recordsList.innerHTML = '<p class="records-empty-hint">没有符合筛选条件的记录</p>';
    return;
  }

  list.forEach(record => {
    const item = document.createElement('button');
    item.className = 'record-item';
    item.type = 'button';

    const titleLine = record.projectName
      ? `${escapeHtml(record.projectName)}<span class="record-item-sub"> · ${escapeHtml(record.bossName)}</span>`
      : escapeHtml(record.bossName);

    const timelineLine = `开始 ${formatClockTime(record.startClock)} → 结束 ${formatClockTime(record.endClock)}${formatPauses(record.pauses)}`;

    const formulaLines = [
      record.aramSettled ? formatAramFormula(record.aramFormulaDetail, record.aramAmount) : '',
      record.rankSettled ? formatRankFormula(record.rankFormulaDetail, record.rankAmount) : ''
    ].filter(Boolean);

    item.innerHTML = `
      <div class="record-item-main">
        <span class="record-item-boss">${titleLine}</span>
        <span class="record-item-meta">${formatRecordMeta(record.ts, record.elapsedMs)}</span>
        <span class="record-item-timeline">${timelineLine}</span>
        ${formulaLines.map(f => `<span class="record-item-formula">${escapeHtml(f)}</span>`).join('')}
      </div>
      <span class="record-item-amount">$${record.total.toFixed(2)}</span>
    `;
    item.addEventListener('click', () => openEditRecord(record.id));
    recordsList.appendChild(item);
  });
}

document.getElementById('openRecordsBtn').addEventListener('click', () => {
  populateBossFilterOptions();
  renderRecordsList();
  showScreen('records');
});

document.getElementById('recordsCloseBtn').addEventListener('click', () => {
  showScreen('home');
});

/* ============ 编辑接单记录弹层 ============ */

const editRecordModal = document.getElementById('editRecordModal');
const editRecordTitle = document.getElementById('editRecordTitle');
const editRecordMeta = document.getElementById('editRecordMeta');
const editProjectNameInput = document.getElementById('editProjectName');
const editAramField = document.getElementById('editAramField');
const editRankField = document.getElementById('editRankField');
const editAramAmountInput = document.getElementById('editAramAmount');
const editRankAmountInput = document.getElementById('editRankAmount');

let editingRecordId = null;

function openEditRecord(id) {
  const record = records.find(r => r.id === id);
  if (!record) return;
  editingRecordId = id;

  editRecordTitle.textContent = `编辑记录 · ${record.bossName}`;
  editRecordMeta.textContent = formatRecordMeta(record.ts, record.elapsedMs);
  editProjectNameInput.value = record.projectName || '';

  editAramField.classList.toggle('is-hidden', !record.aramSettled);
  editRankField.classList.toggle('is-hidden', !record.rankSettled);
  editAramAmountInput.value = record.aramSettled ? record.aramAmount.toFixed(2) : '';
  editRankAmountInput.value = record.rankSettled ? record.rankAmount.toFixed(2) : '';

  editRecordModal.classList.add('is-open');
}

document.getElementById('cancelEditRecord').addEventListener('click', () => {
  editRecordModal.classList.remove('is-open');
  editingRecordId = null;
});

document.getElementById('saveEditRecord').addEventListener('click', () => {
  const record = records.find(r => r.id === editingRecordId);
  if (!record) return;

  const oldTotal = record.total;
  record.projectName = editProjectNameInput.value.trim();

  if (record.aramSettled) {
    const v = parseFloat(editAramAmountInput.value);
    if (isNaN(v) || v < 0) { editAramAmountInput.focus(); return; }
    record.aramAmount = v;
  }
  if (record.rankSettled) {
    const v = parseFloat(editRankAmountInput.value);
    if (isNaN(v) || v < 0) { editRankAmountInput.focus(); return; }
    record.rankAmount = v;
  }
  record.total = (record.aramSettled ? record.aramAmount : 0) + (record.rankSettled ? record.rankAmount : 0);

  monthly.income += record.total - oldTotal;
  saveJSON(STORE_KEYS.monthly, monthly);
  renderMonthly();

  saveJSON(STORE_KEYS.records, records);
  renderRecordsList();

  editRecordModal.classList.remove('is-open');
  editingRecordId = null;
});

document.getElementById('deleteRecordBtn').addEventListener('click', () => {
  const record = records.find(r => r.id === editingRecordId);
  if (!record) return;
  if (!confirm('确定要删除这条接单记录吗？本月入账会相应减少，此操作不可撤销。')) return;

  monthly.income -= record.total;
  saveJSON(STORE_KEYS.monthly, monthly);
  renderMonthly();

  records = records.filter(r => r.id !== editingRecordId);
  saveJSON(STORE_KEYS.records, records);
  renderRecordsList();

  editRecordModal.classList.remove('is-open');
  editingRecordId = null;
});
