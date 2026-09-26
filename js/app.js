/* ============================================================
 * 命定勇者奖牌收集统计系统 · 核心逻辑（v3 全图鉴版）
 * 洛克王国：世界「命定花种」活动
 *
 * 机制（用户确认版）：
 *   1. 列出游戏全部精灵（全图鉴），记录每只精灵是否有「命定勇者」奖牌
 *   2. 玩法：用任意精灵单人通关官方每期推出的「命定花种」精灵
 *   3. 通关成功后，获得奖牌的是【所使用的精灵】（不是被通关的花种精灵）
 *   4. 每只精灵通关过一次即获得一枚奖牌（二态：有 / 无），日期记首次通关时间
 *
 * 功能：
 *   - 面板1 精灵图鉴：全部精灵卡片 + 奖牌状态 + 搜索/属性/阶段筛选
 *   - 面板2 挑战记录：记录「用 X 通关 Y 期花种」，成功自动给 X 标记奖牌
 *   - 面板3 小工具：活动倒计时、分光水晶↔棱镜球换算
 *   数据保存在 localStorage，支持 JSON 导入导出
 * ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'mingding_medal_tracker_v3';

  const state = {
    spirits: [],          // 全部精灵（图鉴），含 medal / medalDate / medalSrc / notes
    records: [],          // 挑战记录：{id, spirit, target, period, date, success, notes}
    activeTab: 'medal',   // medal | usage | tools
    search: '',
    status: 'all',        // all | medal | nomedal
    type: 'all',
    stage: 'all',
    sort: 'default',
    editingId: null,      // 正在编辑的精灵 id
    editingRecordId: null,// 正在编辑的记录 id
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
    .replace(/\"/g, '&quot;').replace(/'/g, '&#39;');

  const STAGE_LABEL = { 0: '', 1: '一阶', 2: '二阶', 3: '三阶', 4: '首领进化' };

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
      types: Array.isArray(s.types) ? s.types.map(String) : (s.type ? [String(s.type)] : []),
      stage: Number(s.stage) || 0,
      class: String(s.class || ''),
      season: String(s.season || ''),
      medal: !!s.medal,
      medalDate: String(s.medalDate || ''),
      medalSrc: String(s.medalSrc || (s.medal ? 'manual' : '')),
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
          state.spirits = sanitizeSpirits(clone(SPIRITS));
        }
        state.records = sanitizeRecords(Array.isArray(data.records) ? data.records : []);
        return;
      }
    } catch (e) { /* 忽略损坏数据，回退到种子数据 */ }
    state.spirits = sanitizeSpirits(clone(SPIRITS));
    state.records = [];
    save();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        spirits: state.spirits,
        records: state.records,
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

  function getRecordPeriods() {
    return sortPeriods(Array.from(new Set(state.records.map((r) => r.period).filter(Boolean))));
  }

  function getFlowerPeriods() {
    return FLOWER_PERIODS.map((p) => p.period);
  }

  /** 全图鉴属性列表（保持固定顺序） */
  function getAllTypes() {
    const order = ['普通', '草', '火', '水', '光', '地', '冰', '龙', '电', '毒', '虫', '武', '翼', '萌', '幽', '恶', '机械', '幻'];
    const set = new Set();
    state.spirits.forEach((s) => s.types.forEach((t) => set.add(t)));
    return order.filter((t) => set.has(t)).concat(Array.from(set).filter((t) => !order.includes(t)));
  }

  /* ============================================================
   * 模块 1：精灵图鉴（奖牌收集）
   * ============================================================ */

  function getFiltered() {
    let list = state.spirits.slice();
    const q = state.search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.class.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    }
    if (state.status === 'medal') list = list.filter((s) => s.medal);
    if (state.status === 'nomedal') list = list.filter((s) => !s.medal);
    if (state.type !== 'all') list = list.filter((s) => s.types.includes(state.type));
    if (state.stage !== 'all') list = list.filter((s) => String(s.stage) === state.stage);

    if (state.sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    } else if (state.sort === 'date') {
      list.sort((a, b) => (b.medalDate || '').localeCompare(a.medalDate || ''));
    } else {
      list.sort((a, b) => {
        const na = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const nb = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        return na - nb;
      });
    }
    return list;
  }

  function renderMedal() {
    const total = state.spirits.length;
    const medal = state.spirits.filter((s) => s.medal).length;
    const noMedal = total - medal;
    const pct = total ? Math.round((medal / total) * 100) : 0;

    $('#statTotal').textContent = total;
    $('#statObtained').textContent = medal;
    $('#statMissing').textContent = noMedal;
    $('#statPct').textContent = pct + '%';
    $('#lgTotal').textContent = total;
    $('#lgObtained').textContent = medal;
    $('#lgMissing').textContent = noMedal;

    const ring = $('#progressRing');
    const r = 52;
    const c = 2 * Math.PI * r;
    ring.style.strokeDasharray = c;
    ring.style.strokeDashoffset = c * (1 - medal / total);
    $('#ringPct').textContent = pct + '%';
    $('#ringSub').textContent = medal + ' / ' + total;

    // 卡片网格
    const grid = $('#spiritGrid');
    const list = getFiltered();
    $('#resultCount').textContent = list.length ? `共 ${list.length} 只精灵` : '';
    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>${state.search || state.status !== 'all' || state.type !== 'all' || state.stage !== 'all' ? '没有符合条件的精灵' : '暂无精灵数据'}</p>
        </div>`;
      return;
    }
    // 分批渲染避免一次性 DOM 过大卡顿
    const pageSize = 200;
    grid.innerHTML = list.slice(0, pageSize).map((s) => spiritCardHtml(s)).join('');
    if (list.length > pageSize) {
      const more = document.createElement('div');
      more.className = 'empty-mini';
      more.style.cssText = 'text-align:center;padding:14px;cursor:pointer;color:var(--gold);';
      more.textContent = `还有 ${list.length - pageSize} 只未显示，点击加载全部`;
      more.addEventListener('click', () => {
        grid.innerHTML = list.map((s) => spiritCardHtml(s)).join('');
      });
      grid.appendChild(more);
    }
  }

  function spiritCardHtml(s) {
    const stageTxt = STAGE_LABEL[s.stage] || '';
    const typeHtml = s.types.length
      ? s.types.map((t) => `<span class="badge b-type">${escapeHtml(t)}</span>`).join('')
      : '';
    const stageHtml = stageTxt ? `<span class="badge b-stage">${escapeHtml(stageTxt)}</span>` : '';
    return `
    <div class="spirit-card ${s.medal ? 'obtained' : ''}" data-id="${escapeHtml(s.id)}">
      <div class="card-top">
        <div class="card-medal">${medalSvg(s.medal)}</div>
        <div class="card-badges">
          <span class="badge status-badge ${s.medal ? 'b-obtained' : 'b-missing'}">${s.medal ? '有奖牌' : '无奖牌'}</span>
        </div>
      </div>
      <div class="card-name">${escapeHtml(s.name)}</div>
      <div class="card-meta">${[s.id.replace('pet_', 'NO.'), stageHtml, typeHtml].filter(Boolean).join(' · ')}</div>
      <div class="card-notes">${s.notes ? escapeHtml(s.notes) : (s.class ? escapeHtml(s.class) : '')}</div>
      <div class="card-foot">
        <span class="obtained-date">${s.medal ? (s.medalDate ? '奖牌日期 ' + escapeHtml(s.medalDate) : '已获得奖牌') : '点击卡片标记有奖牌'}</span>
        <div class="card-actions">
          <button class="icon-btn" data-act="edit" title="编辑">✎</button>
        </div>
      </div>
    </div>`;
  }

  function medalSvg(medal) {
    return `<svg class="medal-svg" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 6 L38.5 14.5 L49 12.5 L44.5 22 L52 30 L41.8 31.5 L38 41 L32 34 L26 41 L22.2 31.5 L12 30 L19.5 22 L15 12.5 L25.5 14.5 Z"
        fill="${medal ? 'url(#goldGrad)' : '#3a3266'}" stroke="${medal ? '#fff2c8' : '#55508a'}" stroke-width="1.5"/>
      <circle cx="32" cy="34" r="11" fill="#14102e" stroke="${medal ? '#f6c453' : '#55508a'}" stroke-width="1.5"/>
      <path d="M32 29 L33.8 33.2 L38.4 33.8 L35 36.9 L35.9 41.5 L32 39.3 L28.1 41.5 L29 36.9 L25.6 33.8 L30.2 33.2 Z"
        fill="${medal ? '#ffe08a' : '#3f3a70'}"/>
    </svg>`;
  }

  function openSpiritForm(id) {
    state.editingId = id || null;
    const form = $('#spiritForm');
    form.reset();
    $('#fObtained').checked = false;
    $('#fDate').value = today();
    $('#fDate').disabled = true;
    if (id) {
      const s = state.spirits.find((x) => x.id === id);
      if (!s) return;
      $('#formTitle').textContent = '编辑精灵';
      $('#fName').value = s.name;
      $('#fStage').value = STAGE_LABEL[s.stage] || '';
      $('#fTypes').value = s.types.join(' / ');
      $('#fSeason').value = s.season ? 'S' + s.season + ' 赛季' : '';
      $('#fNotes').value = s.notes;
      $('#fObtained').checked = s.medal;
      $('#fDate').value = s.medalDate || '';
      $('#fDate').disabled = !s.medal;
    } else {
      $('#formTitle').textContent = '补充精灵';
    }
    openModal('#formModal');
  }

  const STAGE_MAP = { '一阶': 1, '二阶': 2, '三阶': 3, '四阶': 4, '首领进化': 4 };

  function submitSpiritForm(e) {
    e.preventDefault();
    const name = $('#fName').value.trim();
    if (!name) { toast('请填写精灵名称', 'err'); return; }
    const nowMedal = $('#fObtained').checked;
    const payload = {
      name,
      types: $('#fTypes').value.split(/[\/、,，\s]+/).filter(Boolean),
      stage: STAGE_MAP[$('#fStage').value.trim()] || 0,
      season: $('#fSeason').value.trim().replace(/^S/i, ''),
      medal: nowMedal,
      medalDate: nowMedal ? ($('#fDate').value || today()) : '',
      medalSrc: nowMedal ? 'manual' : '',
      notes: $('#fNotes').value.trim(),
    };
    if (state.editingId) {
      const idx = state.spirits.findIndex((x) => x.id === state.editingId);
      if (idx < 0) return;
      const s = state.spirits[idx];
      s.notes = payload.notes;
      if (payload.medal !== s.medal) {
        s.medal = payload.medal;
        s.medalSrc = payload.medal ? 'manual' : '';
        s.medalDate = payload.medalDate;
      } else if (payload.medal && !s.medalDate) {
        s.medalDate = payload.medalDate;
      }
      toast(`已保存「${s.name}」`);
    } else {
      if (state.spirits.some((x) => x.name === name)) { toast('该精灵已存在于图鉴中', 'warn'); return; }
      state.spirits.push({ id: uid(), ...payload });
      toast(`已补充「${name}」`);
    }
    save();
    closeModal('#formModal');
    renderAll();
  }

  /** 手动切换奖牌标记 */
  function toggleMedal(id) {
    const s = state.spirits.find((x) => x.id === id);
    if (!s) return;
    s.medal = !s.medal;
    s.medalSrc = s.medal ? 'manual' : '';
    s.medalDate = s.medal ? (s.medalDate || today()) : '';
    save();
    renderAll();
    toast(s.medal ? `「${s.name}」标记为有奖牌` : `「${s.name}」标记为无奖牌`, s.medal ? 'ok' : 'warn');
  }

  /* ============================================================
   * 模块 2：挑战记录 + 奖牌统计
   * ============================================================ */

  function renderUsage() {
    const medalList = state.spirits.filter((s) => s.medal).map((s) => s.name);
    const noMedalList = state.spirits.filter((s) => !s.medal).map((s) => s.name);
    const total = state.spirits.length;
    const medal = medalList.length;
    const rate = total ? Math.round((medal / total) * 100) : 0;

    $('#uTotal').textContent = total;
    $('#uMedal').textContent = medal;
    $('#uNoMedal').textContent = total - medal;
    $('#uRate').textContent = rate + '%';

    // 已获得奖牌精灵（金色 chips，最多展示前 200 + 计数）
    const medalBox = $('#medalList');
    if (!medalList.length) {
      medalBox.innerHTML = '<div class="empty-mini">还没有任何精灵获得奖牌。记录一次「挑战成功」或点卡片手动标记即可。</div>';
    } else {
      medalBox.innerHTML = medalList.slice(0, 200).map((n) => `<span class="chip chip-gold">${escapeHtml(n)}</span>`).join('')
        + (medalList.length > 200 ? `<span class="chip chip-unused">…等共 ${medalList.length} 只</span>` : '');
    }

    // 未获得奖牌精灵（前 150 + 计数）
    const noMedalBox = $('#noMedalList');
    noMedalBox.innerHTML = noMedalList.slice(0, 150).map((n) => `<span class="chip chip-unused">${escapeHtml(n)}</span>`).join('')
      + (noMedalList.length > 150 ? `<span class="chip chip-unused">…等共 ${noMedalList.length} 只</span>` : '');

    // 挑战记录列表（按期数分组）
    const wrap = $('#recordList');
    const records = state.records.slice().sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') || b.period.localeCompare(a.period, 'zh'));
    if (!records.length) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding:28px;">
          <p>还没有挑战记录。用某只精灵通关官方「命定花种」精灵后，点「＋ 记录挑战」登记，
          系统会自动给那只精灵标记奖牌。</p>
        </div>`;
      return;
    }
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
                <span class="record-arrow">通关</span>
                <span class="record-target">${escapeHtml(r.target || '花种精灵')}</span>
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

    // 使用的精灵建议：全图鉴名称
    $('#dlSpirit').innerHTML = state.spirits.map((s) => `<option value="${escapeHtml(s.name)}">`).join('');
    // 花种目标建议：官方命定花种精灵
    const targets = new Set();
    FLOWER_PERIODS.forEach((p) => (p.targets || []).forEach((t) => targets.add(t)));
    $('#dlTarget').innerHTML = Array.from(targets).map((t) => `<option value="${escapeHtml(t)}">`).join('');
    // 期数建议
    $('#rPeriod').value = (ACTIVITY_CONFIG && ACTIVITY_CONFIG.label) || '';

    if (id) {
      const r = state.records.find((x) => x.id === id);
      if (!r) return;
      $('#formRecordTitle').textContent = '编辑挑战记录';
      $('#rSpirit').value = r.spirit;
      $('#rPeriod').value = r.period;
      $('#rTarget').value = r.target;
      $('#rDate').value = r.date;
      $('#rSuccess').checked = r.success;
      $('#rNotes').value = r.notes;
    } else {
      $('#formRecordTitle').textContent = '记录挑战';
    }
    openModal('#recordModal');
  }

  /** 根据成功记录重算某只精灵的奖牌来源（record 来源撤销逻辑） */
  function refreshMedalFromRecords(spiritName) {
    const s = state.spirits.find((x) => x.name === spiritName);
    if (!s) return;
    const hasSuccess = state.records.some((r) => r.spirit === spiritName && r.success);
    if (!hasSuccess && s.medalSrc === 'record') {
      s.medal = false;
      s.medalSrc = '';
      s.medalDate = '';
    }
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

    // 挑战成功 → 奖牌归【使用的精灵】（首次通关）
    let linked = '';
    if (payload.success) {
      const s = state.spirits.find((x) => x.name === spirit);
      if (s && !s.medal) {
        s.medal = true;
        s.medalSrc = 'record';
        s.medalDate = payload.date;
        linked = `，自动标记「${s.name}」获得奖牌`;
      } else if (s && s.medal) {
        linked = `（「${s.name}」已有奖牌）`;
      } else {
        linked = `（「${spirit}」不在图鉴中，仅保留记录）`;
      }
    }

    if (state.editingRecordId) {
      const old = state.records.find((x) => x.id === state.editingRecordId);
      const idx = state.records.findIndex((x) => x.id === state.editingRecordId);
      if (idx >= 0) state.records[idx] = { ...state.records[idx], ...payload };
      // 若旧记录曾给某精灵标记奖牌且现在不再满足条件，则撤销
      if (old) {
        refreshMedalFromRecords(old.spirit);
        refreshMedalFromRecords(payload.spirit);
      }
      toast('已保存挑战记录');
    } else {
      state.records.push({ id: uid(), ...payload });
      toast(`已记录「${spirit}」通关${payload.target || '花种精灵'}${linked}`);
    }
    save();
    closeModal('#recordModal');
    renderAll();
  }

  function askDeleteRecord(id) {
    const r = state.records.find((x) => x.id === id);
    if (!r) return;
    $('#confirmText').textContent = `确定要删除「${r.spirit}」通关「${r.target || '花种精灵'}」的记录吗？${r.success ? '若这是该精灵唯一的成功记录，其奖牌标记会被撤销。' : ''}`;
    $('#confirmBtn').dataset.kind = 'record';
    $('#confirmBtn').dataset.id = id;
    openModal('#confirmModal');
  }

  /* ============================================================
   * 模块 3：小工具
   * ============================================================ */

  function renderTools() {
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
      records: state.records,
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
          state.records = sanitizeRecords(Array.isArray(data.records) ? data.records : []);
          toast(`导入完成：${state.spirits.length} 只精灵、${state.records.length} 条挑战记录`);
        } else {
          const spiritsIn = Array.isArray(data.spirits) ? data.spirits : [];
          const existing = new Map(state.spirits.map((s) => [s.id, s]));
          sanitizeSpirits(spiritsIn).forEach((s) => existing.set(s.id, s));
          state.spirits = Array.from(existing.values());

          const recIn = Array.isArray(data.records) ? data.records : [];
          const recMap = new Map(state.records.map((r) => [r.id, r]));
          sanitizeRecords(recIn).forEach((r) => recMap.set(r.id, r));
          state.records = Array.from(recMap.values());

          toast(`合并完成：${state.spirits.length} 只精灵、${state.records.length} 条挑战记录`);
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
    $('#confirmResetText').textContent = '确定要重置为初始数据吗？当前所有奖牌标记和挑战记录将被清空（建议先导出备份）。';
    openModal('#resetModal');
  }

  function doReset() {
    state.spirits = sanitizeSpirits(clone(SPIRITS));
    state.records = [];
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

    // 搜索与筛选（图鉴页）
    $('#searchInput').addEventListener('input', (e) => { state.search = e.target.value; renderMedal(); });
    $('#filterStatus').addEventListener('change', (e) => { state.status = e.target.value; renderMedal(); });
    $('#filterType').addEventListener('change', (e) => { state.type = e.target.value; renderMedal(); });
    $('#filterStage').addEventListener('change', (e) => { state.stage = e.target.value; renderMedal(); });
    $('#sortBy').addEventListener('change', (e) => { state.sort = e.target.value; renderMedal(); });

    // 精灵卡片（事件委托）：点击卡片切换奖牌，✎ 编辑
    $('#spiritGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      const card = e.target.closest('.spirit-card');
      if (!card) return;
      const id = card.dataset.id;
      if (btn) {
        e.stopPropagation();
        if (btn.dataset.act === 'edit') openSpiritForm(id);
        return;
      }
      toggleMedal(id);
    });

    // 精灵表单
    $('#spiritForm').addEventListener('submit', submitSpiritForm);
    $('#fObtained').addEventListener('change', () => {
      $('#fDate').disabled = !$('#fObtained').checked;
      if ($('#fObtained').checked && !$('#fDate').value) $('#fDate').value = today();
    });
    $('#formCancel').addEventListener('click', () => closeModal('#formModal'));
    $('#formClose').addEventListener('click', () => closeModal('#formModal'));

    // 挑战记录
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

    // 确认弹窗（kind = record）
    $('#confirmBtn').addEventListener('click', () => {
      const kind = $('#confirmBtn').dataset.kind;
      const id = $('#confirmBtn').dataset.id;
      if (kind === 'record') {
        const r = state.records.find((x) => x.id === id);
        state.records = state.records.filter((x) => x.id !== id);
        if (r) refreshMedalFromRecords(r.spirit);
        toast('已删除挑战记录');
      }
      save();
      closeModal('#confirmModal');
      renderAll();
    });
    $('#confirmCancel').addEventListener('click', () => closeModal('#confirmModal'));
    $('#confirmClose').addEventListener('click', () => closeModal('#confirmModal'));

    // 数据管理
    $('#btnData').addEventListener('click', () => {
      $('#dataSummary').textContent =
        `全图鉴 ${state.spirits.length} 只（有奖牌 ${state.spirits.filter((s) => s.medal).length} 只）· ${state.records.length} 条挑战记录`;
      openModal('#dataModal');
    });
    $('#btnExport').addEventListener('click', exportJson);
    $('#btnImport').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const mode = $('#importMode').value;
      if (mode === 'replace') {
        $('#importReplaceText').textContent = `导入将覆盖当前 ${state.spirits.length} 只精灵、${state.records.length} 条挑战记录（建议先导出备份）。确定继续？`;
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

    // 属性/阶段筛选下拉
    function refreshTypeFilter() {
      const sel = $('#filterType');
      const cur = state.type;
      sel.innerHTML = '<option value="all">全部属性</option>' +
        getAllTypes().map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
      sel.value = cur;
    }
    function refreshStageFilter() {
      const sel = $('#filterStage');
      const cur = state.stage;
      sel.innerHTML = '<option value="all">全部阶段</option>' +
        [1, 2, 3, 4].map((s) => `<option value="${s}">${STAGE_LABEL[s]}</option>`).join('');
      sel.value = cur;
    }
    refreshTypeFilter();
    refreshStageFilter();
  }

  /* ---------------- 初始化 ---------------- */

  function init() {
    load();
    bindEvents();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
