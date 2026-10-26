/* 数三雷达 · 考研数学三考频分析与复习优先级
   数据来自 data.js（window.MATH3_DATA），掌握度自评仅存于本机 localStorage。 */

const MASTERY_KEY = 'math3Radar.mastery.v1';
const DEFAULT_MASTERY = 3;

const SUBJECT_COLORS = {
  '高等数学': '#4F6EF2',
  '线性代数': '#10B981',
  '概率论与数理统计': '#F59E0B',
};
const SUBJECT_SHORT = {
  '高等数学': '高数',
  '线性代数': '线代',
  '概率论与数理统计': '概率统计',
};

let mastery = {};
let flatChapters = [];
const charts = {};

// ---------- 工具 ----------
const $ = (id) => document.getElementById(id);
function todayStr() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2000);
}

function getData() { return window.MATH3_DATA || null; }

function hasData() {
  const d = getData();
  return !!(d && Array.isArray(d.years) && d.years.length && Array.isArray(d.taxonomy) && d.taxonomy.length);
}

function loadMastery() {
  try { return JSON.parse(localStorage.getItem(MASTERY_KEY)) || {}; } catch (e) { return {}; }
}
function saveMastery() {
  try { localStorage.setItem(MASTERY_KEY, JSON.stringify(mastery)); } catch (e) { /* 隐私模式下静默 */ }
}

const W_KEY = 'math3Radar.weighted';
let weighted = false;   // 近3年加权模式开关

// ---------- 统计 ----------
function sortedYears() {
  return [...getData().years].sort((a, b) => a.year - b.year);
}

// 某章节历年的分值序列与均值（仅统计有数据的年份，不做插补）
function chapterStats(name) {
  const vals = [];
  sortedYears().forEach((y) => {
    const v = (y.chapters || {})[name];
    if (typeof v === 'number') vals.push({ year: y.year, v });
  });
  const total = vals.reduce((s, x) => s + x.v, 0);
  return { vals, total, avg: vals.length ? total / vals.length : 0, count: vals.length };
}

// 加权模式：0.5 × 近3年（2023-2025）均值 + 0.5 × 全期均值；
// 关闭时退化为全期均值。近3年不足3个数据点时按已有年份平均。
function chapterAvg(st) {
  if (!weighted || st.vals.length === 0) return st.avg;
  const recent = st.vals.slice(-3).map((x) => x.v);
  const rAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return 0.5 * rAvg + 0.5 * st.avg;
}

// 每年三大学科的总分（该年该学科各章之和，缺失记 0）
function subjectYearMatrix() {
  const d = getData();
  return sortedYears().map((y) => {
    const row = { year: y.year };
    d.taxonomy.forEach((g) => {
      row[g.subject] = g.chapters.reduce(
        (s, c) => s + (typeof (y.chapters || {})[c] === 'number' ? y.chapters[c] : 0), 0
      );
    });
    return row;
  });
}

function subjectTotals() {
  const m = subjectYearMatrix();
  const out = {};
  getData().taxonomy.forEach((g) => {
    out[g.subject] = m.reduce((s, row) => s + (row[g.subject] || 0), 0);
  });
  return out;
}

// ---------- 图表 ----------
function ensureChart(key, el) {
  if (!charts[key]) charts[key] = echarts.init(el);
  return charts[key];
}

function renderHeat() {
  const years = sortedYears().map((y) => y.year);
  const chapters = flatChapters.map((c) => c.name);
  const cells = [];
  let maxV = 20;
  sortedYears().forEach((y, yi) => {
    flatChapters.forEach((c, ci) => {
      const v = (y.chapters || {})[c.name];
      if (typeof v === 'number') {
        cells.push([yi, ci, v]);
        if (v > maxV) maxV = v;
      }
    });
  });
  ensureChart('heat', $('chartHeat')).setOption({
    tooltip: {
      position: 'top',
      formatter: (p) => `${esc(chapters[p.value[1]])}<br>${years[p.value[0]]} 年：${p.value[2]} 分`,
    },
    grid: { left: 150, right: 14, top: 8, bottom: 56 },
    xAxis: { type: 'category', data: years, splitArea: { show: true }, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'category', data: chapters, splitArea: { show: true }, axisLabel: { fontSize: 11 }, inverse: true },
    visualMap: {
      min: 0, max: maxV, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      text: ['高分', '低分'], textStyle: { fontSize: 11 },
      inRange: { color: ['#F0F3FE', '#9FB3F8', '#4F6EF2', '#23306B'] },
    },
    series: [{
      type: 'heatmap',
      data: cells,
      label: { show: true, fontSize: 10, formatter: (p) => p.value[2] },
    }],
  });
}

function renderTop() {
  const list = flatChapters
    .map((c) => ({ name: c.name, subject: c.subject, avg: chapterStats(c.name).avg }))
    .filter((x) => x.avg > 0)
    .sort((a, b) => a.avg - b.avg);
  ensureChart('top', $('chartTop')).setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => `${esc(p[0].name)}<br>年均 ${p[0].value} 分` },
    grid: { left: 150, right: 44, top: 8, bottom: 24 },
    xAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    yAxis: { type: 'category', data: list.map((x) => x.name), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar',
      barMaxWidth: 14,
      data: list.map((x) => ({ value: +x.avg.toFixed(1), itemStyle: { color: SUBJECT_COLORS[x.subject] } })),
      label: { show: true, position: 'right', fontSize: 10 },
    }],
  });
}

function renderArea() {
  const d = getData();
  const m = subjectYearMatrix();
  const series = d.taxonomy.map((g) => ({
    name: g.subject,
    type: 'line',
    stack: 'total',
    smooth: true,
    symbol: 'circle',
    symbolSize: 5,
    areaStyle: { opacity: 0.25 },
    lineStyle: { width: 2 },
    emphasis: { focus: 'series' },
    itemStyle: { color: SUBJECT_COLORS[g.subject] },
    data: m.map((r) => +(r[g.subject] || 0).toFixed(1)),
  }));
  ensureChart('area', $('chartArea')).setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 16, top: 32, bottom: 28 },
    xAxis: { type: 'category', boundaryGap: false, data: m.map((r) => r.year), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', name: '分', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 11 } },
    series,
  });
}

function renderLine(subject) {
  const d = getData();
  const g = d.taxonomy.find((x) => x.subject === subject);
  if (!g) return;
  const years = sortedYears().map((y) => y.year);
  const series = g.chapters.map((c) => ({
    name: c,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 5,
    connectNulls: true,
    lineStyle: { width: 2 },
    data: sortedYears().map((y) => {
      const v = (y.chapters || {})[c];
      return typeof v === 'number' ? v : null;
    }),
  }));
  ensureChart('line', $('chartLine')).setOption({
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 36, right: 16, top: 40, bottom: 28 },
    xAxis: { type: 'category', data: years, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', name: '分', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 11 } },
    series,
  }, { notMerge: true });
}

// ---------- 总览 ----------
function renderOverview() {
  const d = getData();
  const years = sortedYears();
  const dataPoints = years.reduce(
    (s, y) => s + Object.values(y.chapters || {}).filter((v) => typeof v === 'number').length, 0
  );
  $('metaStats').innerHTML = `
    <div class="stat-item"><b>${years[0].year}–${years[years.length - 1].year}</b><span>覆盖 ${years.length} 卷真题</span></div>
    <div class="stat-item"><b>${flatChapters.length}</b><span>考点章节</span></div>
    <div class="stat-item"><b>${dataPoints}</b><span>章节数据点</span></div>
    <div class="stat-item"><b>${esc(d.meta.updated || '—')}</b><span>数据更新</span></div>`;

  const totals = subjectTotals();
  const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const ratio = d.meta.syllabusRatio || {};
  $('subjectCards').innerHTML = d.taxonomy.map((g) => {
    const t = totals[g.subject] || 0;
    const share = (t / grand) * 100;
    const r = ratio[g.subject];
    const color = SUBJECT_COLORS[g.subject];
    return `<div class="subj-card">
      <div class="name" style="color:${color}">${esc(g.subject)}</div>
      <div class="nums">合计 ${t} 分 · 占 ${share.toFixed(1)}%</div>
      <div class="bar-wrap"><div class="bar-fill" style="width:${Math.min(share, 100).toFixed(1)}%;background:${color}"></div></div>
      <div class="ratio-note">考纲约 ${typeof r === 'number' ? r + '%' : '—'}</div>
    </div>`;
  }).join('');

  renderHeat();
  renderTop();
}

// ---------- 优先级 ----------
function priorityRows() {
  return flatChapters
    .map((c) => {
      const st = chapterStats(c.name);
      const m = mastery[c.name] == null ? DEFAULT_MASTERY : mastery[c.name];
      const avg = chapterAvg(st);
      return {
        name: c.name, subject: c.subject, count: st.count,
        avg, mastery: m, priority: avg * (6 - m),
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

function renderPriority() {
  const rows = priorityRows();
  const sum = rows.reduce((s, r) => s + r.priority, 0);
  const maxP = Math.max(...rows.map((r) => r.priority), 1);
  $('priorityList').innerHTML = rows.map((r) => {
    const share = sum > 0 ? (r.priority / sum) * 100 : 0;
    const color = SUBJECT_COLORS[r.subject];
    const btns = [1, 2, 3, 4, 5].map((n) =>
      `<button class="m-btn ${n === r.mastery ? 'on' : ''}" data-ch="${esc(r.name)}" data-m="${n}">${n}</button>`
    ).join('');
    return `<div class="p-row">
      <div class="p-head">
        <span class="p-name">${esc(r.name)}</span>
        <span class="subject-tag" style="background:${color}">${SUBJECT_SHORT[r.subject] || esc(r.subject)}</span>
        <span class="p-avg">${weighted ? '加权' : '年均'} ${r.avg.toFixed(1)} 分${r.count === 0 ? ' · 暂无数据' : ''}</span>
      </div>
      <div class="p-bar-wrap">
        <div class="p-bar"><div class="p-bar-fill" style="width:${((r.priority / maxP) * 100).toFixed(1)}%;background:${color}"></div></div>
        <span class="p-share">建议 ${share.toFixed(1)}%</span>
      </div>
      <div class="p-mastery">掌握度 ${btns}<span class="p-priority">优先级 ${r.priority.toFixed(1)}</span></div>
    </div>`;
  }).join('');

  const top3 = rows.slice(0, 3).filter((r) => r.priority > 0);
  $('topAdvice').innerHTML = top3.length
    ? `按你当前的掌握度自评，接下来优先补：<b>${top3.map((r) => esc(r.name)).join('、')}</b>。调整掌握度后排序会实时更新。`
    : '请先在下方为各章节选择掌握度。';
}

// ---------- 数据说明 ----------
function renderAbout() {
  const d = getData();
  const meta = d.meta || {};
  $('aboutUpdated').textContent = `数据更新于 ${meta.updated || '—'}；你的掌握度自评仅保存在本机浏览器，不会上传。`;
  $('aboutSources').innerHTML = (meta.sources || []).map((s) =>
    `<li>· <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label || s.url)}</a></li>`
  ).join('') || '<li>—</li>';
  $('aboutYears').innerHTML = sortedYears().map((y) => {
    const links = (y.sources || []).map((u, i) =>
      `<a href="${esc(u)}" target="_blank" rel="noopener">来源${(y.sources || []).length > 1 ? i + 1 : ''}</a>`
    ).join(' ');
    return `<li><b>${y.year}</b>：${links || '来源待补充'}${y.notes ? ` <span class="hint">（${esc(y.notes)}）</span>` : ''}</li>`;
  }).join('') || '<li>—</li>';
  $('aboutCaveats').innerHTML = `
    <p>· ${esc(meta.caveats || '')}</p>
    <p>· 章节归属口径：不同解析对综合题、应用题的章节归类可能不同，单章分值存在 ±2 分量级的误差。</p>
    <p>· 缺失处理：查不到可靠数据的年份/章节记为空值，年均分值仅按有数据年份计算，不做插补。</p>
    <p>· 模型局限：掌握度为主观自评；优先级采用最简单的线性加权（分值 × 生疏度），未考虑题目难度、命题趋势变化与个人目标分——这些是模型的改进方向。</p>`;
}

// ---------- 路由与初始化 ----------
function switchTab(name) {
  document.querySelectorAll('#tabnav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
  requestAnimationFrame(() => {
    if (name === 'overview') renderOverview();
    if (name === 'trend') { renderArea(); renderLine($('subjectSelect').value); }
    if (name === 'priority') renderPriority();
    if (name === 'about') renderAbout();
  });
}

function init() {
  if (!hasData()) {
    document.getElementById('main').innerHTML =
      '<div class="card"><div class="card-title">数据尚未生成</div><p class="hint">data.js 缺失或为空。请先生成数据文件，并通过 HTTP 方式访问本页面。</p></div>';
    return;
  }
  mastery = loadMastery();
  weighted = localStorage.getItem(W_KEY) === '1';
  const recentYs = sortedYears().map((y) => y.year).slice(-3);
  $('recentYears').textContent = recentYs.join(' / ');
  $('wSwitch').checked = weighted;
  $('wSwitch').addEventListener('change', (e) => {
    weighted = e.target.checked;
    try { localStorage.setItem(W_KEY, weighted ? '1' : '0'); } catch (err) { /* ignore */ }
    renderPriority();
    toast(weighted ? '已切换到近 3 年加权模式' : '已恢复全期均值模式');
  });
  getData().taxonomy.forEach((g) => {
    g.chapters.forEach((c) => flatChapters.push({ name: c, subject: g.subject }));
  });

  $('subjectSelect').innerHTML = getData().taxonomy
    .map((g) => `<option value="${esc(g.subject)}">${esc(g.subject)}</option>`).join('');
  $('subjectSelect').addEventListener('change', (e) => renderLine(e.target.value));

  document.querySelectorAll('#tabnav button').forEach((b) =>
    b.addEventListener('click', () => switchTab(b.dataset.tab))
  );

  $('priorityList').addEventListener('click', (e) => {
    const btn = e.target.closest('.m-btn');
    if (!btn) return;
    mastery[btn.dataset.ch] = +btn.dataset.m;
    saveMastery();
    renderPriority();
  });

  $('btnExportMastery').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ exported: todayStr(), mastery }, null, 2)], { type: 'application/json' });
    const aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(blob);
    aEl.download = 'math3radar-mastery-' + todayStr() + '.json';
    aEl.click();
    URL.revokeObjectURL(aEl.href);
    toast('掌握度已导出');
  });
  $('btnImportMastery').addEventListener('click', () => $('masteryFile').click());
  $('masteryFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj.mastery) throw new Error('格式不符');
        mastery = obj.mastery;
        saveMastery();
        renderPriority();
        toast('掌握度已导入');
      } catch (err) { toast('导入失败：' + err.message); }
    };
    reader.readAsText(f);
  });
  $('btnResetMastery').addEventListener('click', () => {
    if (confirm('确定把全部章节掌握度重置为默认值（3）吗？')) {
      mastery = {};
      saveMastery();
      renderPriority();
      toast('已重置');
    }
  });

  renderOverview();
  window.addEventListener('resize', () => Object.values(charts).forEach((c) => c.resize()));
}

init();
