/**
 * 命定勇者奖牌 · 初始精灵数据
 * 来源：洛克王国：世界「命定花种」限时活动（玩家社区整理，期数/难度可在应用内编辑修正）
 * 机制说明：使用精灵单人挑战（仅 1 名真实小洛克参战、精灵全程未力竭、未更换精灵并取胜），
 *           击败「命定花种」精灵即可获得对应精灵的「命定勇者」奖牌。
 */
const SEED_SPIRITS = [
  // ── 2026-03 ~ 04 期 ──────────────────────────────
  { id: 's01', name: '白金独角兽', period: '3-4月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's02', name: '龙息帕尔',   period: '3-4月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '赛季图鉴课题需要：完成龙息帕尔所有图鉴课题（含命定勇者奖牌）' },
  { id: 's03', name: '梦悠悠',     period: '3-4月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '命定花种·梦悠悠（胆小性格）' },
  { id: 's04', name: '电球咩咩',   period: '3-4月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's05', name: '墨影蛙',     period: '3-4月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },

  // ── 2026-05 期 ───────────────────────────────────
  { id: 's06', name: '魔草巫灵',   period: '5月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's07', name: '奇丽花',     period: '5月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's08', name: '高脚鹬',     period: '5月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's09', name: '魔眷鸟',     period: '5月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },

  // ── 2026-06 期 ───────────────────────────────────
  { id: 's10', name: '幻影灵菇',   period: '6月期', type: '', difficulty: '低练度推荐', obtained: false, obtainedDate: '', notes: '' },
  { id: 's11', name: '流浪鼠',     period: '6月期', type: '', difficulty: '低练度推荐', obtained: false, obtainedDate: '', notes: '' },
  { id: 's12', name: '怖哭菇',     period: '6月期', type: '', difficulty: '低练度推荐', obtained: false, obtainedDate: '', notes: '' },
  { id: 's13', name: '咕德帽帽',   period: '6月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's14', name: '巨鼓象',     period: '6月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's15', name: '烟花伯爵',   period: '6月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's16', name: '小丑公爵',   period: '6月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },

  // ── 2026-07 期 ───────────────────────────────────
  { id: 's17', name: '圆号鱼',     period: '7月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's18', name: '蹦床松鼠',   period: '7月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's19', name: '卡瓦重',     period: '7月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's20', name: '里拉鳐',     period: '7月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },

  // ── 2026-08 期 ───────────────────────────────────
  { id: 's21', name: '混乱鱿彩',   period: '8月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
  { id: 's22', name: '秩序鱿墨',   period: '8月期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },

  // ── 2026-09 期（S4 赛季）────────────────────────
  { id: 's23', name: '寂灭骨龙',   period: '9月·第13期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '命定花种·寂灭骨龙（固执性格），首通奖励：分光水晶×400、灵魂环印' },
  { id: 's24', name: '星星眼',     period: '9月·第13期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '命定花种·星星眼（沉默性格）' },
  { id: 's25', name: '智辉章脑',   period: '9月·第13期', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '命定花种·智辉章脑（胆小性格）' },
  { id: 's26', name: '星云旅者',   period: '9月·第14期(当前)', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '当前活动：2026-09-25 ~ 2026-10-09' },
  { id: 's27', name: '玳塔',       period: '9月·第14期(当前)', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '奇遇精灵' },
  { id: 's28', name: '小皮球',     period: '9月·第14期(当前)', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '奇遇精灵' },
  { id: 's29', name: '友爱星飞',   period: '9月·第14期(当前)', type: '', difficulty: '', obtained: false, obtainedDate: '', notes: '' },
];

/**
 * 挑战精灵示例库（初始值）
 * 来源：命定花种攻略中常用的挑战精灵（玩家社区整理）。
 * 用途：统计"哪些精灵已使用 / 未使用"的候选池，可在「精灵库」中随时增删。
 */
const SEED_ROSTER = [
  '罗隐', '画间沉铁兽', '混乱鱿彩', '秩序鱿墨', '绅士鸡', '捕尘长绒',
  '嘟嘟锅', '圣代甜甜', '烟花团', '伊粉贝贝', '火焰猿', '未完虫',
  '巨灵石', '炽心勇狮', '海枝枝', '叮叮恶魔', '卡波', '窃光蚊',
];

/**
 * 命定花种活动配置（用于小工具倒计时，每期更新）
 */
const ACTIVITY_CONFIG = {
  label: '命定花种·第14期',
  targets: ['星云旅者', '玳塔', '小皮球', '友爱星飞'],
  start: '2026-09-25',
  end: '2026-10-09',
};

/** 分光水晶 ↔ 棱镜球 兑换比例 */
const CRYSTAL_PER_PRISM = 1600;
/** 每枚命定勇者奖牌可在图鉴领取的分光水晶 */
const CRYSTAL_PER_MEDAL = 300;
