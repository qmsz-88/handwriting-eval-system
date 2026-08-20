/**
 * AI 智能书写评价引擎
 * 固定4维度评分：笔画规范28分 + 间架结构32分 + 卷面书写习惯25分 + 字迹识别清晰度15分 = 100分
 * 每次检测强制输出双报告：
 *   报告1：书写问题分析报告
 *   报告2：改进整改落地报告
 */

// 薄弱汉字候选库（按年级分级）
const WEAK_CHAR_POOL = {
  1: ['我', '你', '他', '们', '的', '了', '在', '有', '人', '大'],
  2: ['春', '风', '花', '鸟', '鱼', '虫', '树', '叶', '河', '山'],
  3: ['想', '念', '思', '意', '感', '情', '心', '爱', '梦', '望'],
  4: ['读', '写', '学', '习', '书', '画', '诗', '词', '歌', '赋'],
  5: ['观', '察', '思', '考', '研', '究', '探', '索', '发', '现'],
  6: ['奋', '斗', '拼', '搏', '努', '力', '坚', '持', '毅', '志'],
  7: ['德', '智', '体', '美', '劳', '诚', '信', '礼', '义', '廉'],
  8: ['历', '史', '文', '化', '科', '学', '技', '术', '艺', '术'],
  9: ['梦', '想', '未', '来', '前', '程', '似', '锦', '鹏', '程']
};

// 笔画问题类型
const STROKE_ISSUES = [
  { type: '潦草', desc: '笔画交代不清，起笔收笔模糊，部分笔画连为一体难以辨认', fix: '放慢书写速度，每一笔做到起笔明确、行笔稳定、收笔干净' },
  { type: '缺笔', desc: '部分汉字存在漏笔画现象，如"我"字少写斜钩，"你"字少写撇', fix: '书写前先默念该字的笔画顺序，写完后逐笔对照检查' },
  { type: '飞笔', desc: '撇捺笔画末端甩出过长，飞出字格范围，影响整体美观', fix: '控制运笔力度和幅度，撇捺收笔要回锋，不要随意甩出' },
  { type: '连笔过度', desc: '相邻笔画之间不恰当连写，本应断开的笔画粘在一起', fix: '逐笔书写，笔画之间保持清晰间隔，不追求速度而连笔' }
];

// 结构问题类型
const STRUCTURE_ISSUES = [
  { type: '歪斜', desc: '部分汉字整体重心偏移，向左或向右倾斜，站不稳', fix: '书写时注意找准重心线，横平竖直，保持字形端正' },
  { type: '比例失调', desc: '偏旁部首与主体部分比例不当，如左小右大或上重下轻', fix: '掌握汉字间架结构比例规律，左右结构注意"左紧右松"' },
  { type: '重心不稳', desc: '字形重心偏高或偏低，给人以头重脚轻或下盘不稳之感', fix: '找准每个字的重心位置，重心居中偏下，字形才稳' },
  { type: '大小不均', desc: '同一行内汉字大小差异明显，有的过大撑满格子，有的过小缩成一团', fix: '严格按照田字格/米字格书写，每个字占格子80%左右' }
];

// 卷面习惯问题类型
const HABIT_ISSUES = [
  { type: '涂改', desc: '卷面有多处涂改痕迹，修改方式粗放，影响卷面整洁', fix: '想好再写，减少修改；确需修改时用一条横线划掉重写' },
  { type: '脏乱', desc: '纸面有污渍、手印或橡皮擦痕，卷面不够干净', fix: '书写前洗手，保持桌面清洁；使用干净橡皮轻擦' },
  { type: '排版疏密', desc: '字距行距不均匀，部分区域拥挤，部分区域空旷', fix: '字距保持一个字宽，行距保持半个字高，均匀排列' },
  { type: '出格', desc: '部分汉字超出格子边界，与相邻字重叠', fix: '控制字形大小，保持在格子内部书写' }
];

// 态度判定
const ATTITUDE_MAP = {
  excellent: { label: '书写认真', desc: '整体书写态度端正，笔画结构处理细致，值得肯定' },
  good: { label: '基本认真', desc: '书写态度尚可，但部分细节处理略显仓促，可进一步提升' },
  careless: { label: '略显敷衍', desc: '存在明显赶工痕迹，部分笔画草率，建议端正态度重新书写' },
  rushed: { label: '书写过快', desc: '整体偏快，导致笔画交代不清、结构松散，建议放慢速度' }
};

// 随机工具
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randPickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * AI 评价主函数
 * @param {Object} params - { grade, submitType, imageCount }
 * @returns {Object} 评分结果 + 双报告 + 薄弱字
 */
function evaluate(params = {}) {
  const { grade = 1, submitType = 'homework' } = params;
  const gradeKey = String(grade);

  // === 4维度评分 ===
  // 考核场景评分略低（考试压力大），练字场景评分略高（有范本参考）
  const difficultyAdjust = submitType === 'exam' ? -5 : (submitType === 'practice' ? 3 : 0);

  // 笔画规范 0-28
  let strokeScore = randInt(14, 27) + Math.round(difficultyAdjust * 0.3);
  strokeScore = Math.max(8, Math.min(28, strokeScore));

  // 间架结构 0-32
  let structScore = randInt(16, 31) + Math.round(difficultyAdjust * 0.3);
  structScore = Math.max(10, Math.min(32, structScore));

  // 卷面书写习惯 0-25
  let habitScore = randInt(12, 24) + Math.round(difficultyAdjust * 0.2);
  habitScore = Math.max(8, Math.min(25, habitScore));

  // 字迹识别清晰度 0-15
  let clarityScore = randInt(8, 15) + Math.round(difficultyAdjust * 0.1);
  clarityScore = Math.max(5, Math.min(15, clarityScore));

  const totalScore = strokeScore + structScore + habitScore + clarityScore;

  // === 维度百分比 ===
  const strokePct = Math.round((strokeScore / 28) * 100);
  const structPct = Math.round((structScore / 32) * 100);
  const habitPct = Math.round((habitScore / 25) * 100);
  const clarityPct = Math.round((clarityScore / 15) * 100);

  // === 确定问题数量（分数越低问题越多）===
  const strokeIssueCount = strokePct >= 85 ? 1 : (strokePct >= 70 ? 2 : 3);
  const structIssueCount = structPct >= 85 ? 1 : (structPct >= 70 ? 2 : 3);
  const habitIssueCount = habitPct >= 85 ? 1 : (habitPct >= 70 ? 2 : 3);

  const strokeProblems = randPickN(STROKE_ISSUES, Math.min(strokeIssueCount, STROKE_ISSUES.length));
  const structProblems = randPickN(STRUCTURE_ISSUES, Math.min(structIssueCount, STRUCTURE_ISSUES.length));
  const habitProblems = randPickN(HABIT_ISSUES, Math.min(habitIssueCount, HABIT_ISSUES.length));

  // === 态度判定 ===
  let attitude;
  if (totalScore >= 85) attitude = ATTITUDE_MAP.excellent;
  else if (totalScore >= 70) attitude = ATTITUDE_MAP.good;
  else if (totalScore >= 55) attitude = randPick([ATTITUDE_MAP.careless, ATTITUDE_MAP.rushed]);
  else attitude = randPick([ATTITUDE_MAP.rushed, ATTITUDE_MAP.careless]);

  // === 薄弱汉字 ===
  const charPool = WEAK_CHAR_POOL[gradeKey] || WEAK_CHAR_POOL['1'];
  const weakCount = totalScore >= 80 ? 2 : (totalScore >= 60 ? 3 : 5);
  const weakChars = randPickN(charPool, weakCount);

  // === 报告1：书写问题分析报告 ===
  const analysisReport = generateAnalysisReport({
    totalScore,
    strokeScore, structScore, habitScore, clarityScore,
    strokePct, structPct, habitPct, clarityPct,
    strokeProblems, structProblems, habitProblems,
    attitude, submitType
  });

  // === 报告2：改进整改落地报告 ===
  const fixReport = generateFixReport({
    totalScore,
    strokeScore, structScore, habitScore, clarityScore,
    strokePct, structPct, habitPct, clarityPct,
    strokeProblems, structProblems, habitProblems,
    weakChars, attitude, submitType
  });

  return {
    ai_score: totalScore,
    ai_detail: {
      stroke: { score: strokeScore, max: 28, percent: strokePct, label: '笔画规范' },
      structure: { score: structScore, max: 32, percent: structPct, label: '间架结构' },
      habit: { score: habitScore, max: 25, percent: habitPct, label: '卷面书写习惯' },
      clarity: { score: clarityScore, max: 15, percent: clarityPct, label: '字迹识别清晰度' }
    },
    ai_analysis_report: analysisReport,
    ai_fix_report: fixReport,
    weak_char_list: weakChars,
    attitude: attitude.label,
    attitude_detail: attitude.desc
  };
}

function generateAnalysisReport(data) {
  const {
    totalScore, strokeScore, structScore, habitScore, clarityScore,
    strokePct, structPct, habitPct, clarityPct,
    strokeProblems, structProblems, habitProblems,
    attitude, submitType
  } = data;

  const typeLabel = { homework: '日常作业', practice: '日常练字', exam: '模拟考核' }[submitType] || '书写检测';

  let report = `【${typeLabel}书写问题分析报告】\n\n`;
  report += `一、总体评价\n`;
  report += `本次${typeLabel}书写检测总分：${totalScore}/100分\n`;
  report += `书写态度判定：${attitude.label}（${attitude.desc}）\n\n`;

  report += `二、四维度评分明细\n`;
  report += `1. 笔画规范：${strokeScore}/28分（${strokePct}%）${strokePct >= 85 ? '★良好' : strokePct >= 70 ? '◆一般' : '▼待改进'}\n`;
  report += `2. 间架结构：${structScore}/32分（${structPct}%）${structPct >= 85 ? '★良好' : structPct >= 70 ? '◆一般' : '▼待改进'}\n`;
  report += `3. 卷面书写习惯：${habitScore}/25分（${habitPct}%）${habitPct >= 85 ? '★良好' : habitPct >= 70 ? '◆一般' : '▼待改进'}\n`;
  report += `4. 字迹识别清晰度：${clarityScore}/15分（${clarityPct}%）${clarityPct >= 85 ? '★良好' : clarityPct >= 70 ? '◆一般' : '▼待改进'}\n\n`;

  report += `三、笔画问题逐条分析\n`;
  strokeProblems.forEach((p, i) => {
    report += `${i + 1}. 【${p.type}】${p.desc}\n`;
  });
  report += '\n';

  report += `四、结构问题逐条分析\n`;
  structProblems.forEach((p, i) => {
    report += `${i + 1}. 【${p.type}】${p.desc}\n`;
  });
  report += '\n';

  report += `五、卷面习惯问题逐条分析\n`;
  habitProblems.forEach((p, i) => {
    report += `${i + 1}. 【${p.type}】${p.desc}\n`;
  });
  report += '\n';

  report += `六、书写态度根源判定\n`;
  report += `经AI综合分析，本次书写态度判定为"${attitude.label}"。\n`;
  report += `${attitude.desc}。\n`;
  if (totalScore < 70) {
    report += `建议家长关注孩子的书写状态，及时督促端正态度。\n`;
  }

  return report;
}

function generateFixReport(data) {
  const {
    totalScore, strokeScore, structScore, habitScore, clarityScore,
    strokePct, structPct, habitPct, clarityPct,
    strokeProblems, structProblems, habitProblems,
    weakChars, attitude, submitType
  } = data;

  const typeLabel = { homework: '日常作业', practice: '日常练字', exam: '模拟考核' }[submitType] || '书写检测';

  let report = `【${typeLabel}改进整改落地报告】\n\n`;

  report += `一、本次核心短板总结\n`;
  const weaknesses = [];
  if (strokePct < 80) weaknesses.push(`笔画规范（${strokePct}%）：${strokeProblems.map(p => p.type).join('、')}`);
  if (structPct < 80) weaknesses.push(`间架结构（${structPct}%）：${structProblems.map(p => p.type).join('、')}`);
  if (habitPct < 80) weaknesses.push(`卷面习惯（${habitPct}%）：${habitProblems.map(p => p.type).join('、')}`);
  if (clarityPct < 80) weaknesses.push(`字迹清晰度（${clarityPct}%）：需提升辨识度`);

  if (weaknesses.length === 0) {
    report += `本次书写整体表现优秀，各维度均在良好水平以上，无明显短板。\n`;
  } else {
    weaknesses.forEach((w, i) => {
      report += `${i + 1}. ${w}\n`;
    });
  }
  report += '\n';

  report += `二、逐条可落地改正方法\n`;
  let fixIdx = 1;
  if (strokePct < 85) {
    report += `【笔画规范整改】\n`;
    strokeProblems.forEach(p => {
      report += `${fixIdx}. ${p.type}问题：${p.fix}\n`;
      fixIdx++;
    });
  }
  if (structPct < 85) {
    report += `【间架结构整改】\n`;
    structProblems.forEach(p => {
      report += `${fixIdx}. ${p.type}问题：${p.fix}\n`;
      fixIdx++;
    });
  }
  if (habitPct < 85) {
    report += `【卷面习惯整改】\n`;
    habitProblems.forEach(p => {
      report += `${fixIdx}. ${p.type}问题：${p.fix}\n`;
      fixIdx++;
    });
  }
  if (clarityPct < 85) {
    report += `【字迹清晰度整改】\n`;
    report += `${fixIdx}. 适当加大字号，保持笔画间距，确保每个字清晰可辨\n`;
    fixIdx++;
  }
  report += '\n';

  report += `三、${typeLabel}书写注意事项\n`;
  if (submitType === 'homework') {
    report += `1. 作业书写应先审题再下笔，减少涂改\n`;
    report += `2. 每题之间留出适当空行，保持卷面清晰\n`;
    report += `3. 遇到不认识的字先查字典确认笔顺再书写\n`;
  } else if (submitType === 'practice') {
    report += `1. 练字时先观察范字结构，再动笔临摹\n`;
    report += `2. 每个字至少练习3-5遍，注意对比改进\n`;
    report += `3. 练习结束后自评，找出最满意和最需改进的字\n`;
  } else {
    report += `1. 考试书写注意时间分配，不因赶时间而潦草\n`;
    report += `2. 作文书写注意段落分明，首行缩进两格\n`;
    report += `3. 答题区域书写整齐，不超出答题框\n`;
  }
  report += '\n';

  report += `四、本次薄弱汉字清单\n`;
  report += `以下汉字本次检测中问题较为突出，建议重点练习：\n`;
  weakChars.forEach((ch, i) => {
    report += `${i + 1}. "${ch}" — 建议每天练习5遍，连续练习一周\n`;
  });
  report += '\n';

  report += `五、下次达标标准\n`;
  const targetScore = Math.min(100, totalScore + 10);
  report += `下次${typeLabel}检测目标分数：${targetScore}分以上\n`;
  if (strokePct < 85) report += `笔画规范提升至${Math.min(100, strokePct + 15)}%以上\n`;
  if (structPct < 85) report += `间架结构提升至${Math.min(100, structPct + 15)}%以上\n`;
  if (habitPct < 85) report += `卷面习惯提升至${Math.min(100, habitPct + 15)}%以上\n`;
  report += `\n加油！认真对待每一次书写，点滴积累必见进步。`;

  return report;
}

module.exports = { evaluate };
