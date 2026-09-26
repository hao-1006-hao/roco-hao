/* ============================================================
 * 命定勇者奖牌收集统计系统 · 核心逻辑
 * 洛克王国：世界「命定花种」活动
 * 功能：
 *   1. 奖牌收集：追踪各期命定花种精灵的奖牌获得进度
 *   2. 使用记录：记录每一期挑战时使用的精灵（避免重复占名额）
 *   3. 精灵统计：已使用 / 未使用精灵统计
 *   4. 小工具：活动倒计时、分光水晶↔棱镜球换算
 *   数据保存在 localStorage，支持 JSON 导入导出
 * ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'mingding_medal_tracker_v2';

  const state = {
    spirits: [],          // 奖牌目标（命定花种精灵）
    usageRecords: [],     // 挑战使用记录
    roster: [],           // 精灵库（候选池，用于统计未使用）
    activeTab: 'medal',   // medal | usage | tools
    search: '',
    status: 'all',        // all | obtained | missing
    period: 'all',
    sort: 'default',
    editingId: null,      // 正在编辑的奖牌精灵 id
    editingRecordId: null,// 正在编辑的使用记录 id
  };

  /* ---------------- 工具函数 ---------------- */

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const clone = (arr) => JSON.parse(JSON.stringify(arr));
  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function toast(msg, type = 'ok') {
    const box = $('#toastBox');
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2200);
  }

  /* ---------------- 数据存取 ---------------- */

  function sanitizeSpirits(list) {
    return list.map((s) => ({
      id: String(s.id || uid()),
      name: String(s.name || '未命名精灵'),
      period: String(s.period || '未分类'),
      type: String(s.type || ''),
      difficulty: String(s.difficulty || ''),
      obtained: !!s.obtained,
      obtainedDate: String(s.obtainedDate || ''),
      notes: String(s.notes || ''),
    }));
  }

  function sanitizeRecords(list) {
    return list.map((r) => ({
      id: String(r.id || uid()),
      spirit: String(r.spirit || ''),
      period: String(r.period || '未分类'),
      target: String(r.target || ''),
      date: String(r.date || ''),
      success: !!r.success,
      notes: String(r.notes || ''),
    })).filter((r) => r.spirit);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.spirits) && data.spirits.length) {
          state.spirits = sanitizeSpirits(data.spirits);
        } else {
          state.spirits = sanitizeSpirits(clone(SEED_SPIRITS));
        }
        state.usageRecords = sanitizeRecords(Array.isArray(data.usageRecords) ? data.usageRecords : []);
        state.roster = Array.isArray(data.roster) ? data.roster.map((n) => String(n)).filter(Boolean) : clone(SEED_ROSTER);
        return;
      }
    } catch (e) { /* 忽略损坏数据，回退到种子数据 */ }
    state.spirits = sanitizeSpirits(clone(SEED_SPIRITS));
    state.usageRecords = [];
    state.roster = clone(SEED_ROSTER);
    save();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        spirits: state.spirits,
        usageRecords: state.usageRecords,
        roster: state.roster,
        updatedAt: new Date().toISOString(),
      }));
    } catch (e) {
      toast('保存失败：浏览器存储不可用', 'err');
    }
  }

  /* ---------------- 期数工具 ---------------- */

  function sortPeriods(list) {
    return list.sort((a, b) => {
      const numA = parseFloat(a.replace(/[^\d.]/g, '')) || 0;
      const numB = parseFloat(b.replace(/[^\d.]/g, '')) || 0;
      return numA - numB || a.localeCompare(b, 'zh');
    });
  }

  function getMedalPeriods() {
    return sortPeriods(Array.from(new Set(state.spirits.map((s) => s.period).filter(Boolean))));
  }

  function getUsagePeriods() {
    return sortPeriods(Array.from(new Set(state.usageRecords.map((r) => r.period).filter(Boolean))));
  }

  /* ============================================================
   * 模块 1：奖牌收集
   * ============================================================ */

  function getFiltered() {
    let list = state.spirits.slice();
    const q = state.search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.period.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q)
      );
    }
    if (state.status === 'obtained') list = list.filter((s) => s.obtained);
    if (state.status === 'missing') list = list.filter((s) => !s.obtained);
    if (state.period !== 'all') list = list.filter((s) => s.period === state.period);

    if (state.sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    } else if (state.sort === 'date') {
      list.sort((a, b) => (b.obtainedDate || '').localeCompare(a.obtainedDate || ''));
    } else {
      list.sort((a, b) => {
        const pa = parseFloat(a.period.replace(/[^\d.]/g, '')) || 0;
        const pb = parseFloat(b.period.replace(/[^\d.]/g, '')) || 0;
        return pa - pb || a.name.localeCompare(b.name, 'zh');
      });
    }
    return list;
  }

  function renderMedal() {
    const total = state.spirits.length;
    const obtained = state.spirits.filter((s) => s.obtained).length;
    const missing = total - obtained;
    const pct = total ? Math.round((obtained / total) * 100) : 0;

    $('#statTotal').textContent = total;
    $('#statObtained').textContent = obtained;
    $('#statMissing').textContent = missing;
    $('#statPct').textContent = pct + '%';
    $('#lgTotal').textContent = total;
    $('#lgObtained').textContent = obtained;
    $('#lgMissing').textContent = missing;

    const ring = $('#progressRing');
    const r = 52;
    const c = 2 * Math.PI * r;
    ring.style.strokeDasharray = c;
    ring.style.strokeDashoffset = c * (1 - obtained / total);
    $('#ringPct').textContent = pct + '%';
    $('#ringSub').textContent = obtained + ' / ' + total;

    // 期数统计
    const wrap = $('#periodStats');
    const periods = getMedalPeriods();
    if (!periods.length) {
      wrap.innerHTML = '<div class="empty-mini">暂无期数数据</div>';
    } else {
      wrap.innerHTML = periods.map((p) => {
        const inP = state.spirits.filter((s) => s.period === p);
        const got = inP.filter((s) => s.obtained).length;
        const pctP = Math.round((got / inP.length) * 100);
        return `
          <div class="period-row" data-period="${escapeHtml(p)}">
            <div class="period-head">
              <span class="period-name">${escapeHtml(p)}</span>
              <span class="period-num">${got}/${inP.length}</span>
            </div>
            <div class="period-bar"><div class="period-fill" style="width:${pctP}%"></div></div>
          </div>`;
      }).join('');
    }

    // 卡片网格
    const grid = $('#spiritGrid');
    const list = getFiltered();
    $('#resultCount').textContent = list.length ? `共 ${list.length} 只精灵` : '';
    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="72" height="72" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="24" stroke="#55508a" stroke-width="2" stroke-dasharray="4 4"/><path d="M32 24 L34.2 29.6 L40 30.2 L35.8 33.9 L37 39.8 L32 37 L27 39.8 L28.2 33.9 L24 30.2 L29.8 29.6 Z" fill="#55508a"/></svg>
          <p>${state.search || state.status !== 'all' || state.period !== 'all' ? '没有符合条件的精灵' : '还没有任何精灵，点击「添加精灵」开始记录'}</p>
        </div>`;
      return;
    }
    grid.innerHTML = list.map((s) => {
      const dateStr = s.obtainedDate ? ` · ${s.obtainedDate}` : '';
      const meta = [s.period, s.type, s.difficulty].filter(Boolean).join(' · ');
      return `
      <div class="spirit-card ${s.obtained ? 'obtained' : ''}" data-id="${escapeHtml(s.id)}">
        <div class="card-top">
          <div class="card-medal">${medalSvg(s.obtained)}</div>
          <div class="card-badges">
            <span class="badge status-badge ${s.obtained ? 'b-obtained' : 'b-missing'}">${s.obtained ? '已获得' : '未获得'}</span>
            ${s.period ? `<span class="badge b-period">${escapeHtml(s.period)}</span>` : ''}
          </div>
        </div>
        <div class="card-name">${escapeHtml(s.name)}</div>
        <div class="card-meta">${meta ? escapeHtml(meta) : '<span class="dim">未填写分类</span>'}</div>
        <div class="card-notes">${s.notes ? escapeHtml(s.notes) : ''}</div>
        <div class="card-foot">
          <span class="obtained-date">${s.obtained ? (dateStr ? escapeHtml(s.obtainedDate) : '今日获得') : '点击卡片标记获得'}</span>
          <div class="card-actions">
            <button class="icon-btn" data-act="edit" title="编辑">✎</button>
            <button class="icon-btn danger" data-act="del" title="删除">✕</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function medalSvg(obtained) {
    return `<svg class="medal-svg" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 6 L38.5 14.5 L49 12.5 L44.5 22 L52 30 L41.8 31.5 L38 41 L32 34 L26 41 L22.2 31.5 L12 30 L19.5 22 L15 12.5 L25.5 14.5 Z"
        fill="${obtained ? 'url(#goldGrad)' : '#3a3266'}" stroke="${obtained ? '#fff2c8' : '#55508a'}" stroke-width="1.5"/>
      <circle cx="32" cy="34" r="11" fill="#14102e" stroke="${obtained ? '#f6c453' : '#55508a'}" stroke-width="1.5"/>
      <path d="M32 29 L33.8 33.2 L38.4 33.8 L35 36.9 L35.9 41.5 L32 39.3 L28.1 41.5 L29 36.9 L25.6 33.8 L30.2 33.2 Z"
        fill="${obtained ? '#ffe08a' : '#3f3a70'}"/>
    </svg>`;
  }

  function openSpiritForm(id) {
    state.editingId = id || null;
    const form = $('#spiritForm');
    const title = $('#formTitle');
    form.reset();
    $('#fType').value = '';
    if (id) {
      const s = state.spirits.find((x) => x.id === id);
      if (!s) return;
      title.textContent = '编辑精灵';
      $('#fName').value = s.name;
      $('#fPeriod').value = s.period;
      $('#fType').value = s.type;
      $('#fDifficulty').value = s.difficulty;
      $('#fNotes').value = s.notes;
      $('#fObtained').checked = s.obtained;
      $('#fDate').value = s.obtainedDate || '';
    } else {
      title.textContent = '添加新精灵';
      const periods = getMedalPeriods();
      $('#fPeriod').value = state.period !== 'all' ? state.period : (periods[periods.length - 1] || '');
      $('#fDate').value = today();
    }
    openModal('#formModal');
  }

  function submitSpiritForm(e) {
    e.preventDefault();
    const name = $('#fName').value.trim();
    if (!name) { toast('请填写精灵名称', 'err'); return; }
    const payload = {
      name,
      period: $('#fPeriod').value.trim() || '未分类',
      type: $('#fType').value.trim(),
      difficulty: $('#fDifficulty').value.trim(),
      obtained: $('#fObtained').checked,
      obtainedDate: $('#fObtained').checked ? ($('#fDate').value || today()) : '',
      notes: $('#fNotes').value.trim(),
    };
    if (state.editingId) {
      const idx = state.spirits.findIndex((x) => x.id === state.editingId);
      if (idx >= 0) state.spirits[idx] = { ...state.spirits[idx], ...payload };
      toast('已保存修改');
    } else {
      state.spirits.push({ id: uid(), ...payload });
      toast('已添加「' + name + '」');
    }
    save();
    closeModal('#formModal');
    renderAll();
  }

  function toggleObtained(id) {
    const s = state.spirits.find((x) => x.id === id);
    if (!s) return;
    s.obtained = !s.obtained;
    s.obtainedDate = s.obtained ? (s.obtainedDate || today()) : '';
    save();
    renderAll();
    toast(s.obtained ? `已标记「${s.name}」获得奖牌` : `已取消「${s.name}」的奖牌标记`, s.obtained ? 'ok' : 'warn');
  }

  /* ============================================================
   * 模块 2：使用记录 + 精灵统计
   * ============================================================ */

  /** 已使用的精灵（去重） */
  function getUsedSpirits() {
    return Array.from(new Set(state.usageRecords.map((r) => r.spirit.trim()).filter(Boolean)));
  }

  /** 精灵库 = 手动维护的 roster ∪ 使用记录中出现的精灵 */
  function getFullRoster() {
    const set = new Set(state.roster.map((n) => n.trim()).filter(Boolean));
    getUsedSpirits().forEach((n) => set.add(n));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
  }

  function renderUsage() {
    const used = getUsedSpirits();
    const roster = getFullRoster();
    const unused = roster.filter((n) => !used.includes(n));
    const rate = roster.length ? Math.round((used.length / roster.length) * 100) : 0;

    $('#uRoster').textContent = roster.length;
    $('#uUsed').textContent = used.length;
    $('#uUnused').textContent = unused.length;
    $('#uRate').textContent = rate + '%';

    // 未使用精灵
    const unusedBox = $('#unusedList');
    if (!unused.length) {
      unusedBox.innerHTML = '<div class="empty-mini">太棒了，精灵库中的精灵都已使用过！</div>';
    } else {
      unusedBox.innerHTML = unused.map((n) => `<span class="chip chip-unused">${escapeHtml(n)}</span>`).join('');
    }

    // 使用记录列表（按期数分组）
    const wrap = $('#recordList');
    const records = state.usageRecords.slice().sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') || b.period.localeCompare(a.period, 'zh'));
    if (!records.length) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding:28px;">
          <p>还没有使用记录。每一期命定花种用哪只精灵挑战的，点「＋ 记录使用」记下来，
          避免之后重复使用同一只精灵而拿不到奖牌。</p>
        </div>`;
      return;
    }
    // 按期数分组
    const byPeriod = {};
    records.forEach((r) => { (byPeriod[r.period] = byPeriod[r.period] || []).push(r); });
    const periodKeys = sortPeriods(Object.keys(byPeriod));
    wrap.innerHTML = periodKeys.map((p) => {
      const list = byPeriod[p];
      return `
        <div class="record-group">
          <div class="record-group-title">${escapeHtml(p)} <span class="record-group-num">${list.length} 条</span></div>
          ${list.map((r) => `
            <div class="record-item" data-id="${escapeHtml(r.id)}">
              <div class="record-main">
                <span class="record-spirit">${escapeHtml(r.spirit)}</span>
                ${r.target ? `<span class="record-arrow">→</span><span class="record-target">${escapeHtml(r.target)}</span>` : ''}
                ${r.success ? '<span class="badge status-badge b-obtained">获得奖牌</span>' : '<span class="badge status-badge b-missing">未成功</span>'}
              </div>
              <div class="record-sub">${r.date ? escapeHtml(r.date) : '日期未填'}${r.notes ? ' · ' + escapeHtml(r.notes) : ''}</div>
              <div class="card-actions record-actions">
                <button class="icon-btn" data-ract="edit" title="编辑">✎</button>
                <button class="icon-btn danger" data-ract="del" title="删除">✕</button>
              </div>
            </div>`).join('')}
        </div>`;
    }).join('');
  }

  function openRecordForm(id) {
    state.editingRecordId = id || null;
    const form = $('#recordForm');
    form.reset();
    $('#rSuccess').checked = true;
    $('#rDate').value = today();

    // 建议数据（精灵名、花种精灵名、期数）
    $('#dlSpirit').innerHTML = getFullRoster().map((n) => `<option value="${escapeHtml(n)}">`).join('');
    const targets = new Set(state.spirits.map((s) => s.name));
    (ACTIVITY_CONFIG.targets || []).forEach((t) => targets.add(t));
    $('#dlTarget').innerHTML = Array.from(targets).map((t) => `<option value="${escapeHtml(t)}">`).join('');

    // 期数
    const periods = new Set([...getMedalPeriods(), ...getUsagePeriods()]);
    if (ACTIVITY_CONFIG && ACTIVITY_CONFIG.label) periods.add(ACTIVITY_CONFIG.label);
    $('#rPeriod').value = ACTIVITY_CONFIG.label || '';
    $('#rTarget').value = ACTIVITY_CONFIG.targets ? ACTIVITY_CONFIG.targets[0] || '' : '';

    if (id) {
      const r = state.usageRecords.find((x) => x.id === id);
      if (!r) return;
      $('#formRecordTitle').textContent = '编辑使用记录';
      $('#rSpirit').value = r.spirit;
      $('#rPeriod').value = r.period;
      $('#rTarget').value = r.target;
      $('#rDate').value = r.date;
      $('#rSuccess').checked = r.success;
      $('#rNotes').value = r.notes;
    } else {
      $('#formRecordTitle').textContent = '记录使用精灵';
    }
    openModal('#recordModal');
  }

  function submitRecord(e) {
    e.preventDefault();
    const spirit = $('#rSpirit').value.trim();
    const period = $('#rPeriod').value.trim();
    if (!spirit) { toast('请填写使用的精灵名称', 'err'); return; }
    if (!period) { toast('请填写期数', 'err'); return; }

    const payload = {
      spirit,
      period,
      target: $('#rTarget').value.trim(),
      date: $('#rDate').value || today(),
      success: $('#rSuccess').checked,
      notes: $('#rNotes').value.trim(),
    };

    let linked = '';
    // 挑战成功时，自动把对应命定花种精灵标记为已获得
    if (payload.success && payload.target) {
      const t = state.spirits.find((s) => s.name === payload.target);
      if (t && !t.obtained) {
        t.obtained = true;
        t.obtainedDate = payload.date;
        linked = `，并自动标记「${t.name}」奖牌已获得`;
      }
    }

    if (state.editingRecordId) {
      const idx = state.usageRecords.findIndex((x) => x.id === state.editingRecordId);
      if (idx >= 0) state.usageRecords[idx] = { ...state.usageRecords[idx], ...payload };
      toast('已保存使用记录');
    } else {
      state.usageRecords.push({ id: uid(), ...payload });
      toast(`已记录「${spirit}」挑战${payload.target || '花种精灵'}${linked}`);
    }
    save();
    closeModal('#recordModal');
    renderAll();
  }

  function askDeleteRecord(id) {
    const r = state.usageRecords.find((x) => x.id === id);
    if (!r) return;
    $('#confirmText').textContent = `确定要删除「${r.spirit}」在「${r.period}」的使用记录吗？`;
    $('#confirmBtn').dataset.kind = 'record';
    $('#confirmBtn').dataset.id = id;
    openModal('#confirmModal');
  }

  /* ---------------- 精灵库管理 ---------------- */

  function renderRosterList() {
    const box = $('#rosterList');
    const roster = getFullRoster();
    const used = getUsedSpirits();
    if (!roster.length) {
      box.innerHTML = '<div class="empty-mini">精灵库为空，点击下方添加。</div>';
      return;
    }
    box.innerHTML = roster.map((n) => {
      const isUsed = used.includes(n);
      return `
        <div class="roster-item" data-name="${escapeHtml(n)}">
          <span class="roster-name">${escapeHtml(n)}</span>
          ${isUsed ? '<span class="badge status-badge b-obtained">已使用</span>' : '<span class="badge status-badge b-missing">未使用</span>'}
          <button class="icon-btn danger" data-rname="${escapeHtml(n)}" title="移出精灵库">✕</button>
        </div>`;
    }).join('');
  }

  function openRosterModal() {
    renderRosterList();
    openModal('#rosterModal');
  }

  function addRosterSpirit() {
    const input = $('#rNewName');
    const name = input.value.trim();
    if (!name) { toast('请输入精灵名称', 'err'); return; }
    if (!state.roster.includes(name)) {
      state.roster.push(name);
      save();
      renderRosterList();
      renderUsage();
      toast(`已加入精灵库：${name}`);
    } else {
      toast('该精灵已在精灵库中', 'warn');
    }
    input.value = '';
    input.focus();
  }

  function removeRosterSpirit(name) {
    state.roster = state.roster.filter((n) => n !== name);
    save();
    renderRosterList();
    renderUsage();
    toast('已从精灵库移除：' + name);
  }

  /* ============================================================
   * 模块 3：小工具
   * ============================================================ */

  function renderTools() {
    // 活动倒计时
    const box = $('#toolCountdown');
    const cfg = ACTIVITY_CONFIG || {};
    const start = new Date(cfg.start);
    const end = new Date(cfg.end);
    const now = new Date();
    let statusHtml = '';
    if (!cfg.start) {
      statusHtml = '<div class="tool-status">活动数据待更新（在 js/data.js 中配置）</div>';
    } else if (now < start) {
      const days = Math.ceil((start - now) / 86400000);
      statusHtml = `<div class="tool-status soon">距开启还有 <b>${days}</b> 天</div>`;
    } else if (now > end) {
      statusHtml = '<div class="tool-status ended">本期活动已结束</div>';
    } else {
      const days = Math.ceil((end - now) / 86400000);
      statusHtml = `<div class="tool-status live">进行中 · 剩余 <b>${days}</b> 天</div>`;
    }
    box.innerHTML = `
      <div class="tool-name">${escapeHtml(cfg.label || '命定花种')}</div>
      ${cfg.targets && cfg.targets.length ? `<div class="tool-targets">${cfg.targets.map((t) => `<span class="chip chip-gold">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="tool-dates">${cfg.start ? escapeHtml(cfg.start) + ' ~ ' + escapeHtml(cfg.end) : ''}</div>
      ${statusHtml}
      <div class="tool-note">每期活动时间不同，请在 <code>js/data.js</code> 的 <code>ACTIVITY_CONFIG</code> 中更新</div>`;

    // 换算器
    const prism = $('#toolPrismCalc');
    prism.innerHTML = `
      <div class="calc-row">
        <div class="calc-field">
          <label>分光水晶</label>
          <input type="number" id="calcCrystal" min="0" placeholder="0" />
        </div>
        <div class="calc-arrow">↔</div>
        <div class="calc-field">
          <label>棱镜球</label>
          <input type="number" id="calcPrism" min="0" placeholder="0" />
        </div>
      </div>
      <div class="calc-tip">${CRYSTAL_PER_PRISM} 分光水晶 = 1 棱镜球（向下取整，余数保留）</div>`;

    const medal = $('#toolMedalCalc');
    medal.innerHTML = `
      <div class="calc-row">
        <div class="calc-field">
          <label>命定勇者奖牌（枚）</label>
          <input type="number" id="calcMedal" min="0" placeholder="0" />
        </div>
        <div class="calc-result" id="calcMedalResult">= 0 分光水晶</div>
      </div>
      <div class="calc-tip">每枚奖牌可在精灵图鉴领取 ${CRYSTAL_PER_MEDAL} 分光水晶（每只精灵限领一次）</div>`;
  }

  /* ---------------- 选项卡 ---------------- */

  function switchTab(name) {
    state.activeTab = name;
    $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name));
    if (name === 'usage') renderUsage();
    if (name === 'tools') renderTools();
    if (name === 'medal') renderMedal();
  }

  function renderAll() {
    renderMedal();
    renderUsage();
    renderTools();
  }

  /* ---------------- 导出 / 导入 / 重置 ---------------- */

  function exportJson() {
    const data = {
      app: 'mingding-medal-tracker',
      exportedAt: new Date().toISOString(),
      spirits: state.spirits,
      usageRecords: state.usageRecords,
      roster: state.roster,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `命定勇者奖牌数据_${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('已导出 JSON 备份文件');
  }

  function importJson(file, mode) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (mode === 'replace') {
          state.spirits = sanitizeSpirits(Array.isArray(data) ? data : (Array.isArray(data.spirits) ? data.spirits : []));
          state.usageRecords = sanitizeRecords(Array.isArray(data.usageRecords) ? data.usageRecords : []);
          state.roster = Array.isArray(data.roster) ? data.roster.map((n) => String(n)).filter(Boolean) : [];
          toast(`导入完成：${state.spirits.length} 只花种精灵、${state.usageRecords.length} 条使用记录`);
        } else {
          // 合并
          const spiritsIn = Array.isArray(data.spirits) ? data.spirits : [];
          const existing = new Map(state.spirits.map((s) => [s.id, s]));
          sanitizeSpirits(spiritsIn).forEach((s) => existing.set(s.id, s));
          state.spirits = Array.from(existing.values());

          const recIn = Array.isArray(data.usageRecords) ? data.usageRecords : [];
          const recMap = new Map(state.usageRecords.map((r) => [r.id, r]));
          sanitizeRecords(recIn).forEach((r) => recMap.set(r.id, r));
          state.usageRecords = Array.from(recMap.values());

          const rosterIn = Array.isArray(data.roster) ? data.roster : [];
          const set = new Set(state.roster);
          rosterIn.forEach((n) => set.add(String(n)));
          state.roster = Array.from(set).filter(Boolean);

          toast(`合并完成：${state.spirits.length} 只花种精灵、${state.usageRecords.length} 条使用记录`);
        }
        save();
        renderAll();
      } catch (err) {
        toast('导入失败：文件格式不正确', 'err');
      }
    };
    reader.onerror = () => toast('读取文件失败', 'err');
    reader.readAsText(file);
  }

  function resetAll() {
    $('#confirmResetText').textContent = '确定要重置为初始数据吗？当前所有记录将被清空（建议先导出备份）。';
    openModal('#resetModal');
  }

  function doReset() {
    state.spirits = sanitizeSpirits(clone(SEED_SPIRITS));
    state.usageRecords = [];
    state.roster = clone(SEED_ROSTER);
    save();
    closeModal('#resetModal');
    renderAll();
    toast('已重置为初始数据');
  }

  /* ---------------- 模态框 ---------------- */

  function openModal(sel) { $(sel).classList.add('open'); document.body.classList.add('modal-open'); }
  function closeModal(sel) { $(sel).classList.remove('open'); document.body.classList.remove('modal-open'); }
  function closeAllModals() {
    $$('.modal').forEach((m) => m.classList.remove('open'));
    document.body.classList.remove('modal-open');
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents() {
    // 选项卡
    $$('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    // 搜索与筛选（奖牌页）
    $('#searchInput').addEventListener('input', (e) => { state.search = e.target.value; renderMedal(); });
    $('#filterStatus').addEventListener('change', (e) => { state.status = e.target.value; renderMedal(); });
    $('#filterPeriod').addEventListener('change', (e) => { state.period = e.target.value; renderMedal(); });
    $('#sortBy').addEventListener('change', (e) => { state.sort = e.target.value; renderMedal(); });

    // 奖牌页按钮
    $('#btnAdd').addEventListener('click', () => openSpiritForm());
    $('#btnData').addEventListener('click', () => {
      $('#dataSummary').textContent =
        `共收录 ${state.spirits.length} 只花种精灵（已获得 ${state.spirits.filter((s) => s.obtained).length} 只）· ${state.usageRecords.length} 条使用记录 · 精灵库 ${getFullRoster().length} 只`;
      openModal('#dataModal');
    });

    // 精灵卡片（事件委托）
    $('#spiritGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      const card = e.target.closest('.spirit-card');
      if (!card) return;
      const id = card.dataset.id;
      if (btn) {
        e.stopPropagation();
        if (btn.dataset.act === 'edit') openSpiritForm(id);
        if (btn.dataset.act === 'del') {
          const s = state.spirits.find((x) => x.id === id);
          if (!s) return;
          $('#confirmText').textContent = `确定要删除「${s.name}」吗？该操作不可恢复。`;
          $('#confirmBtn').dataset.kind = 'spirit';
          $('#confirmBtn').dataset.id = id;
          openModal('#confirmModal');
        }
        return;
      }
      toggleObtained(id);
    });

    // 期数统计点击 → 筛选该期
    $('#periodStats').addEventListener('click', (e) => {
      const row = e.target.closest('.period-row');
      if (!row) return;
      const p = row.dataset.period;
      state.period = state.period === p ? 'all' : p;
      $('#filterPeriod').value = state.period;
      renderMedal();
      $('#periodStats').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    // 奖牌精灵表单
    $('#spiritForm').addEventListener('submit', submitSpiritForm);
    $('#fObtained').addEventListener('change', () => {
      if ($('#fObtained').checked && !$('#fDate').value) $('#fDate').value = today();
    });
    $('#formCancel').addEventListener('click', () => closeModal('#formModal'));
    $('#formClose').addEventListener('click', () => closeModal('#formModal'));

    // 使用记录
    $('#btnAddRecord').addEventListener('click', () => openRecordForm());
    $('#recordForm').addEventListener('submit', submitRecord);
    $('#recordCancel').addEventListener('click', () => closeModal('#recordModal'));
    $('#recordClose').addEventListener('click', () => closeModal('#recordModal'));
    $('#recordList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ract]');
      const item = e.target.closest('.record-item');
      if (!item) return;
      const id = item.dataset.id;
      if (btn) {
        e.stopPropagation();
        if (btn.dataset.ract === 'edit') openRecordForm(id);
        if (btn.dataset.ract === 'del') askDeleteRecord(id);
      }
    });

    // 精灵库
    $('#btnRoster').addEventListener('click', openRosterModal);
    $('#rAddBtn').addEventListener('click', addRosterSpirit);
    $('#rNewName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addRosterSpirit(); } });
    $('#rosterList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rname]');
      if (btn) removeRosterSpirit(btn.dataset.rname);
    });
    $('#rosterClose').addEventListener('click', () => closeModal('#rosterModal'));
    $('#rosterBackdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal('#rosterModal'); });

    // 确认弹窗（通用：kind = spirit | record）
    $('#confirmBtn').addEventListener('click', () => {
      const kind = $('#confirmBtn').dataset.kind;
      const id = $('#confirmBtn').dataset.id;
      if (kind === 'record') {
        state.usageRecords = state.usageRecords.filter((x) => x.id !== id);
        toast('已删除使用记录');
      } else {
        state.spirits = state.spirits.filter((x) => x.id !== id);
        toast('已删除');
      }
      save();
      closeModal('#confirmModal');
      renderAll();
    });
    $('#confirmCancel').addEventListener('click', () => closeModal('#confirmModal'));
    $('#confirmClose').addEventListener('click', () => closeModal('#confirmModal'));

    // 数据管理
    $('#btnExport').addEventListener('click', exportJson);
    $('#btnImport').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const mode = $('#importMode').value;
      if (mode === 'replace') {
        $('#importReplaceText').textContent = `导入将覆盖当前 ${state.spirits.length} 只精灵、${state.usageRecords.length} 条使用记录（建议先导出备份）。确定继续？`;
        window.__importFile__ = file;
        openModal('#importReplaceModal');
      } else {
        importJson(file, 'merge');
        e.target.value = '';
      }
    });
    $('#importReplaceBtn').addEventListener('click', () => {
      const f = window.__importFile__;
      if (f) importJson(f, 'replace');
      window.__importFile__ = null;
      $('#importFile').value = '';
      closeModal('#importReplaceModal');
    });
    $('#importReplaceCancel').addEventListener('click', () => closeModal('#importReplaceModal'));
    $('#importReplaceCancelBtn').addEventListener('click', () => closeModal('#importReplaceModal'));
    $('#btnReset').addEventListener('click', resetAll);
    $('#resetYes').addEventListener('click', doReset);
    $('#resetNo').addEventListener('click', () => closeModal('#resetModal'));
    $('#resetClose').addEventListener('click', () => closeModal('#resetModal'));

    // 小工具换算
    $('#toolPrismCalc').addEventListener('input', (e) => {
      const crystal = parseInt($('#calcCrystal').value, 10);
      const prism = parseInt($('#calcPrism').value, 10);
      if (e.target.id === 'calcCrystal' && !isNaN(crystal)) {
        $('#calcPrism').value = Math.floor(crystal / CRYSTAL_PER_PRISM);
      } else if (e.target.id === 'calcPrism' && !isNaN(prism)) {
        $('#calcCrystal').value = prism * CRYSTAL_PER_PRISM;
      }
    });
    $('#toolMedalCalc').addEventListener('input', () => {
      const m = parseInt($('#calcMedal').value, 10);
      $('#calcMedalResult').textContent = (isNaN(m) ? 0 : m) + ' 枚 × ' + CRYSTAL_PER_MEDAL + ' = ' + (isNaN(m) ? 0 : m * CRYSTAL_PER_MEDAL) + ' 分光水晶';
    });

    // 模态框通用关闭
    $$('.modal-backdrop').forEach((b) => b.addEventListener('click', (e) => {
      if (e.target === b) closeAllModals();
    }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllModals();
    });

    // 期数筛选下拉选项
    function refreshPeriodFilter() {
      const sel = $('#filterPeriod');
      const cur = state.period;
      sel.innerHTML = '<option value="all">全部期数</option>' +
        getMedalPeriods().map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
      sel.value = cur;
    }
    refreshPeriodFilter();
    const origSave = save;
    save = function () {
      origSave();
      refreshPeriodFilter();
    };
  }

  /* ---------------- 初始化 ---------------- */

  function init() {
    load();
    bindEvents();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
