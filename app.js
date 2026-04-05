// ===== Constants =====
const TX_KEY = 'budget_transactions';
const FIXED_KEY = 'budget_fixed_expenses';
const LAST_RUN_KEY = 'budget_last_fixed_run';

const EXPENSE_CATEGORIES = [
  { name: '食費', icon: '🍚' },
  { name: '日用品', icon: '🧴' },
  { name: '光熱費', icon: '💡' },
  { name: '通信費', icon: '📱' },
  { name: '家賃', icon: '🏠' },
  { name: '交通費', icon: '🚃' },
  { name: '娯楽', icon: '🎮' },
  { name: '医療', icon: '💊' },
  { name: '衣服', icon: '👕' },
  { name: '教育費', icon: '📚' },
  { name: 'ペット費用', icon: '🐾' },
  { name: 'お小遣い', icon: '💴' },
  { name: 'その他', icon: '📦' }
];
const INCOME_CATEGORIES = [
  { name: '給与', icon: '💰' },
  { name: '賞与', icon: '🎁' },
  { name: '副業', icon: '💼' },
  { name: 'その他', icon: '📥' }
];

const CATEGORY_COLORS = [
  '#1976d2', '#c62828', '#2e7d32', '#ef6c00', '#6a1b9a',
  '#00838f', '#ad1457', '#5d4037', '#455a64', '#827717'
];

// ===== Data =====
function loadTx() { try { return JSON.parse(localStorage.getItem(TX_KEY)) || []; } catch { return []; } }
function saveTx(data) { localStorage.setItem(TX_KEY, JSON.stringify(data)); }
function loadFixed() { try { return JSON.parse(localStorage.getItem(FIXED_KEY)) || []; } catch { return []; } }
function saveFixed(data) { localStorage.setItem(FIXED_KEY, JSON.stringify(data)); }

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getCategoryIcon(name, type) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find(c => c.name === name)?.icon || '📦';
}

function formatYen(n) {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

function ymKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseYm(str) {
  const [y, m] = str.split('-').map(Number);
  return { year: y, month: m };
}

// ===== State =====
let transactions = loadTx();
let fixedExpenses = loadFixed();
let currentYm = ymKey(new Date());
let currentTab = 'home';
let editingTxId = null;
let editingFixedId = null;
let formType = 'expense';
let selectedDate = null; // yyyy-mm-dd or null (= show all)

// ===== Fixed expense auto-add =====
function runFixedExpenseAutoAdd() {
  const lastRun = localStorage.getItem(LAST_RUN_KEY) || '';
  const now = new Date();
  const thisYm = ymKey(now);

  // Get all months from lastRun to current, inclusive
  const monthsToProcess = [];
  if (!lastRun) {
    monthsToProcess.push(thisYm);
  } else {
    const { year: ly, month: lm } = parseYm(lastRun);
    let y = ly, m = lm;
    // Start from month AFTER lastRun
    m++;
    if (m > 12) { m = 1; y++; }
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
      monthsToProcess.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }

  if (monthsToProcess.length === 0) return;

  let added = 0;
  monthsToProcess.forEach(ym => {
    fixedExpenses.forEach(fx => {
      // Check if already added for this month
      const existing = transactions.find(t =>
        t.fixedId === fx.id && t.date.startsWith(ym)
      );
      if (existing) return;

      // Add on the 1st of the month
      const date = `${ym}-01`;
      transactions.push({
        id: generateId(),
        type: 'expense',
        category: fx.category,
        amount: fx.amount,
        memo: fx.name,
        date,
        fixedId: fx.id
      });
      added++;
    });
  });

  if (added > 0) saveTx(transactions);
  localStorage.setItem(LAST_RUN_KEY, thisYm);
}

// ===== DOM helpers =====
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ===== Rendering =====
function render() {
  renderMonthLabel();
  renderCalendar();
  renderHome();
  renderChart();
  renderFixedList();
}

function renderCalendar() {
  const grid = $('#calendar-grid');
  const { year, month } = parseYm(currentYm);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();

  // JS getDay: 0=Sun..6=Sat. Convert to Mon-first: 月=0..日=6
  const firstWeekday = (firstDay.getDay() + 6) % 7;

  // Today
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Aggregate by date
  const byDate = {};
  transactions.filter(t => t.date.startsWith(currentYm)).forEach(t => {
    if (!byDate[t.date]) byDate[t.date] = { income: 0, expense: 0 };
    byDate[t.date][t.type] += t.amount;
  });

  // Build cells (always 42 = 6 weeks)
  let html = '';
  // Leading blanks (previous month)
  const prevMonthLast = new Date(year, month - 1, 0).getDate();
  for (let i = firstWeekday - 1; i >= 0; i--) {
    html += `<div class="cal-cell other-month"><div class="cal-date">${prevMonthLast - i}</div></div>`;
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYm}-${String(d).padStart(2, '0')}`;
    const dayDate = new Date(year, month - 1, d);
    const weekday = (dayDate.getDay() + 6) % 7; // 0=Mon..6=Sun
    const cls = ['cal-cell'];
    if (weekday === 5) cls.push('sat');
    if (weekday === 6) cls.push('sun');
    if (dateStr === todayStr) cls.push('today');
    if (dateStr === selectedDate) cls.push('selected');

    const agg = byDate[dateStr];
    let amountHtml = '';
    if (agg) {
      if (agg.income > 0) amountHtml += `<div class="cal-income">+${formatShort(agg.income)}</div>`;
      if (agg.expense > 0) amountHtml += `<div class="cal-expense">-${formatShort(agg.expense)}</div>`;
    }

    html += `<div class="${cls.join(' ')}" data-date="${dateStr}">
      <div class="cal-date">${d}</div>
      ${amountHtml}
    </div>`;
  }
  // Trailing blanks to complete 6 weeks
  const totalCells = firstWeekday + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    html += `<div class="cal-cell other-month"><div class="cal-date">${i}</div></div>`;
  }

  grid.innerHTML = html;

  // Attach click handlers to current-month cells
  grid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      const d = cell.dataset.date;
      selectedDate = (selectedDate === d) ? null : d;
      renderCalendar();
      renderHome();
    });
  });
}

function formatShort(n) {
  if (n >= 10000) return Math.round(n / 1000) + 'k';
  return n.toLocaleString('ja-JP');
}

function renderMonthLabel() {
  const { year, month } = parseYm(currentYm);
  $('#current-month').textContent = `${year}年${month}月`;
}

function getMonthTransactions(ym = currentYm) {
  return transactions.filter(t => t.date.startsWith(ym));
}

function renderHome() {
  const monthTx = getMonthTransactions();
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  $('#sum-income').textContent = formatYen(income);
  $('#sum-expense').textContent = formatYen(expense);
  const balEl = $('#sum-balance');
  balEl.textContent = formatYen(balance);
  balEl.className = 'cal-sum-value ' + (balance >= 0 ? 'income' : 'expense');

  // Filter by selected date if any
  const listTx = selectedDate ? monthTx.filter(t => t.date === selectedDate) : monthTx;

  const container = $('#tx-list');
  if (listTx.length === 0) {
    const msg = selectedDate ? 'この日の記録はありません' : 'この月の記録はまだありません';
    container.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><p>${msg}</p></div>`;
    return;
  }

  const grouped = {};
  listTx.forEach(t => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  container.innerHTML = dates.map(date => {
    const items = grouped[date];
    const d = new Date(date);
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()} (${'日月火水木金土'[d.getDay()]})`;
    const itemsHtml = items.map(t => {
      const icon = getCategoryIcon(t.category, t.type);
      const amountClass = t.type === 'income' ? 'income' : 'expense';
      const sign = t.type === 'income' ? '+' : '-';
      const fixedBadge = t.fixedId ? '<span class="fixed-badge">固定</span>' : '';
      return `
        <div class="transaction-item" onclick="openEditTxModal('${t.id}')">
          <div class="transaction-left">
            <div class="category-icon">${icon}</div>
            <div class="transaction-info">
              <div class="transaction-category">${escapeHtml(t.category)}${fixedBadge}</div>
              ${t.memo ? `<div class="transaction-memo">${escapeHtml(t.memo)}</div>` : ''}
            </div>
          </div>
          <div class="transaction-amount amount ${amountClass}">${sign}${formatYen(t.amount)}</div>
        </div>`;
    }).join('');
    return `
      <div class="transaction-group">
        <div class="transaction-date">${dateLabel}</div>
        <div>${itemsHtml}</div>
      </div>`;
  }).join('');
}

function renderChart() {
  renderBarChart();
  renderPieChart();
}

function renderBarChart() {
  // Last 6 months expense bar chart
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(ymKey(d));
  }

  const data = months.map(ym => {
    const tx = transactions.filter(t => t.date.startsWith(ym));
    return {
      ym,
      expense: tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      income: tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    };
  });

  const max = Math.max(...data.map(d => Math.max(d.expense, d.income)), 1);

  const html = data.map(d => {
    const { month } = parseYm(d.ym);
    const expH = (d.expense / max) * 100;
    const incH = (d.income / max) * 100;
    return `
      <div class="bar-column">
        ${d.expense > 0 ? `<div class="bar-value">${Math.round(d.expense / 1000)}k</div>` : ''}
        <div class="bar" style="height:${expH}%"></div>
        <div class="bar-label">${month}月</div>
      </div>`;
  }).join('');

  $('#bar-chart').innerHTML = html;
}

function renderPieChart() {
  // Current month expense by category
  const monthTx = getMonthTransactions().filter(t => t.type === 'expense');
  const byCategory = {};
  monthTx.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (total === 0) {
    $('#pie-container').innerHTML = '<div class="empty" style="width:100%"><p>支出の記録がありません</p></div>';
    return;
  }

  // Build SVG pie
  const size = 140;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  let currentAngle = -Math.PI / 2;
  const paths = entries.map(([cat, val], i) => {
    const ratio = val / total;
    const angle = ratio * Math.PI * 2;
    const x1 = cx + r * Math.cos(currentAngle);
    const y1 = cy + r * Math.sin(currentAngle);
    const x2 = cx + r * Math.cos(currentAngle + angle);
    const y2 = cy + r * Math.sin(currentAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    currentAngle += angle;
    if (entries.length === 1) {
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
    }
    return `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z" fill="${color}"/>`;
  }).join('');

  const svg = `<svg class="pie-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;

  const legend = entries.map(([cat, val], i) => {
    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    const pct = Math.round((val / total) * 100);
    return `
      <div class="legend-item">
        <div class="legend-color" style="background:${color}"></div>
        <div class="legend-label">${escapeHtml(cat)} (${pct}%)</div>
        <div class="legend-value">${formatYen(val)}</div>
      </div>`;
  }).join('');

  $('#pie-container').innerHTML = `${svg}<div class="pie-legend">${legend}</div>`;
}

function renderFixedList() {
  const container = $('#fixed-list');
  if (fixedExpenses.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🔁</div><p>固定費が登録されていません<br>右下の＋から追加してください</p></div>`;
    return;
  }
  container.innerHTML = fixedExpenses.map(fx => {
    const icon = getCategoryIcon(fx.category, 'expense');
    return `
      <div class="fixed-item" onclick="openEditFixedModal('${fx.id}')">
        <div class="transaction-left">
          <div class="category-icon">${icon}</div>
          <div class="fixed-item-left">
            <div class="fixed-item-name">${escapeHtml(fx.name)}</div>
            <div class="fixed-item-meta">${escapeHtml(fx.category)} ・ 毎月1日に自動計上</div>
          </div>
        </div>
        <div class="fixed-item-amount">${formatYen(fx.amount)}</div>
      </div>`;
  }).join('');
}

// ===== Tab =====
function switchTab(tab) {
  currentTab = tab;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $$('.section').forEach(s => s.classList.toggle('active', s.id === 'section-' + tab));

  // Toggle FAB visibility depending on tab
  const fab = $('#fab');
  fab.style.display = (tab === 'home' || tab === 'fixed') ? 'flex' : 'none';
}

// ===== Month navigation =====
function changeMonth(delta) {
  const { year, month } = parseYm(currentYm);
  const d = new Date(year, month - 1 + delta, 1);
  currentYm = ymKey(d);
  selectedDate = null;
  render();
}

// ===== Modals =====
function setFormType(type) {
  formType = type;
  $$('#type-toggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
    b.classList.remove('expense', 'income');
    if (b.dataset.type === type) b.classList.add(type);
  });
  // Populate category options
  const select = $('#tx-form-category');
  select.innerHTML = '';
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  list.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = `${c.icon} ${c.name}`;
    select.appendChild(opt);
  });
}

function openAddTxModal() {
  editingTxId = null;
  $('#tx-modal-title').textContent = '記録を追加';
  $('#tx-submit-btn').textContent = '追加する';
  $('#tx-delete-btn').style.display = 'none';
  setFormType('expense');
  $('#tx-form-amount').value = '';
  $('#tx-form-memo').value = '';
  $('#tx-form-date').value = new Date().toISOString().slice(0, 10);
  $('#tx-modal').classList.add('show');
}

function openEditTxModal(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  editingTxId = id;
  $('#tx-modal-title').textContent = '記録を編集';
  $('#tx-submit-btn').textContent = '更新する';
  $('#tx-delete-btn').style.display = 'block';
  setFormType(t.type);
  $('#tx-form-category').value = t.category;
  $('#tx-form-amount').value = t.amount;
  $('#tx-form-memo').value = t.memo || '';
  $('#tx-form-date').value = t.date;
  $('#tx-modal').classList.add('show');
}

function closeTxModal() {
  $('#tx-modal').classList.remove('show');
  editingTxId = null;
}

function submitTx(e) {
  e.preventDefault();
  const category = $('#tx-form-category').value;
  const amount = parseInt($('#tx-form-amount').value, 10);
  const memo = $('#tx-form-memo').value.trim();
  const date = $('#tx-form-date').value;

  if (!amount || amount <= 0 || !date) return;

  if (editingTxId) {
    transactions = transactions.map(t =>
      t.id === editingTxId ? { ...t, type: formType, category, amount, memo, date } : t
    );
  } else {
    transactions.push({ id: generateId(), type: formType, category, amount, memo, date });
  }
  saveTx(transactions);
  closeTxModal();
  render();
}

function deleteTx() {
  if (!editingTxId) return;
  if (!confirm('この記録を削除しますか？')) return;
  transactions = transactions.filter(t => t.id !== editingTxId);
  saveTx(transactions);
  closeTxModal();
  render();
}

// --- Fixed modal ---
function openAddFixedModal() {
  editingFixedId = null;
  $('#fixed-modal-title').textContent = '固定費を追加';
  $('#fixed-submit-btn').textContent = '追加する';
  $('#fixed-delete-btn').style.display = 'none';
  $('#fixed-form-name').value = '';
  $('#fixed-form-amount').value = '';
  $('#fixed-modal').classList.add('show');

  // Populate category dropdown
  const select = $('#fixed-form-category');
  if (select.options.length === 0) {
    EXPENSE_CATEGORIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = `${c.icon} ${c.name}`;
      select.appendChild(opt);
    });
  }
  select.value = EXPENSE_CATEGORIES[0].name;
}

function openEditFixedModal(id) {
  const fx = fixedExpenses.find(x => x.id === id);
  if (!fx) return;
  openAddFixedModal();
  editingFixedId = id;
  $('#fixed-modal-title').textContent = '固定費を編集';
  $('#fixed-submit-btn').textContent = '更新する';
  $('#fixed-delete-btn').style.display = 'block';
  $('#fixed-form-name').value = fx.name;
  $('#fixed-form-category').value = fx.category;
  $('#fixed-form-amount').value = fx.amount;
}

function closeFixedModal() {
  $('#fixed-modal').classList.remove('show');
  editingFixedId = null;
}

function submitFixed(e) {
  e.preventDefault();
  const name = $('#fixed-form-name').value.trim();
  const category = $('#fixed-form-category').value;
  const amount = parseInt($('#fixed-form-amount').value, 10);
  if (!name || !amount || amount <= 0) return;

  if (editingFixedId) {
    fixedExpenses = fixedExpenses.map(f =>
      f.id === editingFixedId ? { ...f, name, category, amount } : f
    );
  } else {
    const newFx = { id: generateId(), name, category, amount };
    fixedExpenses.push(newFx);
    // Immediately add for current month if not yet added
    const thisYm = ymKey(new Date());
    const exists = transactions.find(t => t.fixedId === newFx.id && t.date.startsWith(thisYm));
    if (!exists) {
      transactions.push({
        id: generateId(),
        type: 'expense',
        category,
        amount,
        memo: name,
        date: `${thisYm}-01`,
        fixedId: newFx.id
      });
      saveTx(transactions);
    }
  }
  saveFixed(fixedExpenses);
  closeFixedModal();
  render();
}

function deleteFixed() {
  if (!editingFixedId) return;
  if (!confirm('この固定費を削除しますか？\n※過去に自動計上された記録は残ります')) return;
  fixedExpenses = fixedExpenses.filter(f => f.id !== editingFixedId);
  saveFixed(fixedExpenses);
  closeFixedModal();
  render();
}

// ===== FAB =====
function handleFabClick() {
  if (currentTab === 'fixed') openAddFixedModal();
  else openAddTxModal();
}

// ===== Calculator =====
let calcExpression = '';
let calcTargetInputId = null;

function openCalculator(targetInputId) {
  calcTargetInputId = targetInputId;
  const currentVal = document.getElementById(targetInputId).value;
  calcExpression = currentVal && !isNaN(currentVal) ? String(currentVal) : '';
  updateCalcDisplay();
  $('#calc-modal').classList.add('show');
}

function closeCalculator() {
  $('#calc-modal').classList.remove('show');
  calcTargetInputId = null;
}

function evaluateExpression(expr) {
  if (!expr) return 0;
  // Replace display operators with JS operators
  const jsExpr = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  // Only allow digits, operators, parens, dot, spaces
  if (!/^[\d+\-*/.() ]+$/.test(jsExpr)) throw new Error('無効な式');
  // eslint-disable-next-line no-new-func
  const result = Function('"use strict"; return (' + jsExpr + ')')();
  if (typeof result !== 'number' || !isFinite(result)) throw new Error('計算エラー');
  return result;
}

function updateCalcDisplay() {
  const exprEl = $('#calc-expression');
  const resultEl = $('#calc-result');
  exprEl.textContent = calcExpression || '0';
  try {
    // Only evaluate if expression ends with a digit or closing paren
    if (!calcExpression || /[+\-*/×÷−(]$/.test(calcExpression)) {
      resultEl.textContent = '= ' + (calcExpression ? '...' : '0');
      resultEl.classList.remove('error');
      return;
    }
    const result = evaluateExpression(calcExpression);
    resultEl.textContent = '= ' + formatYen(result);
    resultEl.classList.remove('error');
  } catch (e) {
    resultEl.textContent = 'エラー';
    resultEl.classList.add('error');
  }
}

function handleCalcKey(key) {
  if (key === 'C') {
    calcExpression = '';
  } else if (key === '⌫') {
    calcExpression = calcExpression.slice(0, -1);
  } else {
    // Prevent multiple operators in a row
    const lastChar = calcExpression.slice(-1);
    const isOp = c => '+−×÷'.includes(c);
    if (isOp(key) && isOp(lastChar)) {
      calcExpression = calcExpression.slice(0, -1) + key;
    } else if (key === '.' && /\.\d*$/.test(calcExpression)) {
      // Prevent multiple dots in current number
      return;
    } else {
      calcExpression += key;
    }
  }
  updateCalcDisplay();
}

function confirmCalculator() {
  if (!calcExpression) { closeCalculator(); return; }
  try {
    const result = evaluateExpression(calcExpression);
    const rounded = Math.round(result);
    if (rounded <= 0) {
      alert('金額は1円以上にしてください');
      return;
    }
    document.getElementById(calcTargetInputId).value = rounded;
    closeCalculator();
  } catch (e) {
    alert('計算式にエラーがあります');
  }
}

// ===== Utils =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  runFixedExpenseAutoAdd();

  $$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  $('#prev-month').addEventListener('click', () => changeMonth(-1));
  $('#next-month').addEventListener('click', () => changeMonth(1));

  $('#fab').addEventListener('click', handleFabClick);

  $('#tx-form').addEventListener('submit', submitTx);
  $('#tx-delete-btn').addEventListener('click', deleteTx);
  $('#tx-modal-close').addEventListener('click', closeTxModal);
  $('#tx-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeTxModal(); });

  $$('#type-toggle button').forEach(b => {
    b.addEventListener('click', () => setFormType(b.dataset.type));
  });

  $('#fixed-form').addEventListener('submit', submitFixed);
  $('#fixed-delete-btn').addEventListener('click', deleteFixed);
  $('#fixed-modal-close').addEventListener('click', closeFixedModal);
  $('#fixed-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeFixedModal(); });

  // Calculator events
  $('#tx-calc-btn').addEventListener('click', () => openCalculator('tx-form-amount'));
  $('#fixed-calc-btn').addEventListener('click', () => openCalculator('fixed-form-amount'));
  $('#calc-modal-close').addEventListener('click', closeCalculator);
  $('#calc-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeCalculator(); });
  $('#calc-confirm-btn').addEventListener('click', confirmCalculator);
  $$('.calc-key').forEach(btn => {
    btn.addEventListener('click', () => handleCalcKey(btn.dataset.key));
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }

  render();
});
