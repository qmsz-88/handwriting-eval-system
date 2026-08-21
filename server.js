/**
 * 中小学生字体书写智能评价系统 - 后端服务器
 * 纯家庭版：家长 + 学生，无学校/教师/班级
 */
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const { evaluate } = require('./ai-evaluator');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== 中间件 ==========
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `hw_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  }
});

// 鉴权中间件：支持家长账号(x-user-id) 或 学生独立登录令牌(x-student-token)
function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'];
  const studentToken = req.headers['x-student-token'];

  if (!userId && !studentToken) {
    return res.status(401).json({ error: '未登录', code: 'NO_AUTH' });
  }

  // 家长身份
  if (userId && !studentToken) {
    const user = db.findById('users', parseInt(userId));
    if (!user) {
      return res.status(401).json({ error: '用户不存在', code: 'USER_NOT_FOUND' });
    }
    req.user = user;
    req.isStudent = false;
    return next();
  }

  // 学生身份：通过学生登录令牌识别孩子档案
  const child = db.findAll('children').find(c => c.student_token === studentToken && !c.deleted);
  if (!child) {
    return res.status(401).json({ error: '学生登录已失效，请重新登录', code: 'STUDENT_AUTH_EXPIRED' });
  }
  const parent = db.findById('users', child.parent_id);
  if (!parent) {
    return res.status(401).json({ error: '家长账号不存在', code: 'USER_NOT_FOUND' });
  }
  req.user = parent;
  req.child = child;
  req.isStudent = true;
  next();
}

// 家长专属权限中间件：学生令牌禁止访问
function parentOnly(req, res, next) {
  if (req.isStudent) {
    return res.status(403).json({ code: 1, error: '学生账号无此操作权限' });
  }
  next();
}

// ========== 部编版素材数据 ==========
const GRADE_MATERIALS = {
  1: {
    chars: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '人', '口', '手', '足', '耳', '目', '日', '月', '水', '火'],
    words: ['上下', '左右', '前后', '大小', '多少', '山水', '日月', '手足'],
    poems: ['咏鹅 骆宾王\n鹅鹅鹅，曲项向天歌。白毛浮绿水，红掌拨清波。']
  },
  2: {
    chars: ['春', '风', '花', '鸟', '鱼', '虫', '树', '叶', '河', '山', '天', '地', '云', '雨', '石', '土', '田', '禾', '木', '竹'],
    words: ['春风', '花鸟', '山水', '云雨', '树木', '田野', '河流', '石头'],
    poems: ['春晓 孟浩然\n春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。']
  },
  3: {
    chars: ['想', '念', '思', '意', '感', '情', '心', '爱', '梦', '望', '记', '忘', '息', '怒', '喜', '悲', '惊', '怕', '静', '动'],
    words: ['思想', '感情', '心情', '梦想', '回忆', '感觉', '安静', '运动'],
    poems: ['静夜思 李白\n床前明月光，疑是地上霜。举头望明月，低头思故乡。']
  },
  4: {
    chars: ['读', '写', '学', '习', '书', '画', '诗', '词', '歌', '赋', '文', '章', '字', '句', '篇', '段', '阅', '览', '翻', '阅'],
    words: ['读书', '写字', '学习', '文章', '诗句', '歌词', '书画', '阅读'],
    poems: ['登鹳雀楼 王之涣\n白日依山尽，黄河入海流。欲穷千里目，更上一层楼。']
  },
  5: {
    chars: ['观', '察', '思', '考', '研', '究', '探', '索', '发', '现', '创', '造', '设', '计', '实', '验', '证', '明', '推', '理'],
    words: ['观察', '思考', '研究', '探索', '发现', '创造', '设计', '实验'],
    poems: ['望庐山瀑布 李白\n日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。']
  },
  6: {
    chars: ['奋', '斗', '拼', '搏', '努', '力', '坚', '持', '毅', '志', '勇', '敢', '信', '念', '追', '求', '超', '越', '突', '破'],
    words: ['奋斗', '拼搏', '努力', '坚持', '毅力', '勇敢', '信念', '追求'],
    poems: ['石灰吟 于谦\n千锤万凿出深山，烈火焚烧若等闲。粉骨碎身浑不怕，要留清白在人间。']
  },
  7: {
    chars: ['德', '智', '体', '美', '劳', '诚', '信', '礼', '义', '廉', '耻', '忠', '孝', '仁', '善', '正', '直', '公', '平', '和'],
    words: ['品德', '诚信', '礼仪', '忠孝', '善良', '正直', '公平', '和谐'],
    poems: ['己亥杂诗 龚自珍\n九州生气恃风雷，万马齐喑究可哀。我劝天公重抖擞，不拘一格降人才。']
  },
  8: {
    chars: ['历', '史', '文', '化', '科', '学', '技', '术', '艺', '术', '哲', '理', '思', '想', '传', '统', '经', '典', '博', '学'],
    words: ['历史', '文化', '科学', '技术', '艺术', '哲学', '传统', '经典'],
    poems: ['赤壁 杜牧\n折戟沉沙铁未销，自将磨洗认前朝。东风不与周郎便，铜雀春深锁二乔。']
  },
  9: {
    chars: ['梦', '想', '未', '来', '前', '程', '似', '锦', '鹏', '程', '展', '翅', '飞', '翔', '远', '航', '征', '途', '星', '辰'],
    words: ['梦想', '未来', '前程', '展翅', '飞翔', '远航', '征途', '星辰'],
    poems: ['行路难 李白\n金樽清酒斗十千，玉盘珍羞直万钱。停杯投箸不能食，拔剑四顾心茫然。']
  }
};

// ========== 模拟考试题库 ==========
const EXAM_QUESTIONS = {
  1: { title: '一年级书写考核', content: '请抄写以下内容：一二三四五，金木水火土。天地分上下，日月照今古。', time_limit: 15 },
  2: { title: '二年级书写考核', content: '请抄写古诗《春晓》：春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。', time_limit: 15 },
  3: { title: '三年级书写考核', content: '请抄写古诗《静夜思》：床前明月光，疑是地上霜。举头望明月，低头思故乡。', time_limit: 20 },
  4: { title: '四年级书写考核', content: '请抄写古诗《登鹳雀楼》：白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', time_limit: 20 },
  5: { title: '五年级书写考核', content: '请抄写古诗《望庐山瀑布》：日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。', time_limit: 25 },
  6: { title: '六年级书写考核', content: '请抄写古诗《石灰吟》：千锤万凿出深山，烈火焚烧若等闲。粉骨碎身浑不怕，要留清白在人间。', time_limit: 25 },
  7: { title: '七年级书写考核', content: '请抄写《己亥杂诗》：九州生气恃风雷，万马齐喑究可哀。我劝天公重抖擞，不拘一格降人才。', time_limit: 30 },
  8: { title: '八年级书写考核', content: '请抄写《赤壁》：折戟沉沙铁未销，自将磨洗认前朝。东风不与周郎便，铜雀春深锁二乔。', time_limit: 30 },
  9: { title: '九年级书写考核', content: '请抄写《行路难》节选：金樽清酒斗十千，玉盘珍羞直万钱。停杯投箸不能食，拔剑四顾心茫然。', time_limit: 30 }
};

// ========== 奖惩标签库 ==========
const REWARD_TAGS = {
  reward: [
    { key: 'excellent', label: '书写工整优秀', score: 0, color: '#52c41a' },
    { key: 'progress', label: '本次进步明显', score: 0, color: '#1890ff' },
    { key: 'serious', label: '书写态度认真', score: 0, color: '#722ed1' },
    { key: 'persist', label: '坚持打卡练习', score: 0, color: '#13c2c2' }
  ],
  punish: [
    { key: 'messy', label: '书写潦草需重写', score: 0, color: '#f5222d' },
    { key: 'perfunctory', label: '书写态度敷衍', score: 0, color: '#fa8c16' },
    { key: 'inadequate', label: '整改不到位需加强', score: 0, color: '#fa541c' },
    { key: 'dirty', label: '卷面脏乱问题突出', score: 0, color: '#eb2f96' }
  ]
};

// ========== API 路由 ==========

// ---- 认证 ----
// 微信一键登录（模拟）
app.post('/api/auth/login', (req, res) => {
  const { nickname = '微信用户', avatar = '' } = req.body;
  let user = db.findOne('users', { nickname });
  if (!user) {
    user = db.insert('users', {
      nickname,
      avatar,
      role: 'parent',
      openid: `wx_${Date.now()}`,
      total_score: 0
    });
  }
  res.json({ code: 0, data: { user_id: user.id, nickname: user.nickname, avatar: user.avatar, role: user.role } });
});

// 获取当前用户信息
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ code: 0, data: req.user });
});

// 学生独立登录（学生端App专用）
app.post('/api/auth/student-login', (req, res) => {
  const { student_code, student_password } = req.body;
  if (!student_code || !student_code.trim()) {
    return res.status(400).json({ code: 1, error: '请输入学生学号' });
  }
  const child = db.findAll('children').find(
    c => c.student_code === student_code.trim() && !c.deleted
  );
  if (!child || (child.student_password || '') !== (student_password || '')) {
    return res.status(401).json({ code: 1, error: '学号或密码错误' });
  }
  // 签发学生登录令牌
  const token = `st_${child.id}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  db.update('children', child.id, { student_token: token, last_student_login: new Date().toISOString() });
  const parent = db.findById('users', child.parent_id);

  res.json({
    code: 0,
    data: {
      token,
      child: { ...child, student_token: token },
      parent_nickname: parent ? parent.nickname : '家长'
    }
  });
});

// 学生退出登录（吊销令牌）
app.post('/api/auth/student-logout', authMiddleware, (req, res) => {
  if (req.isStudent && req.child) {
    db.update('children', req.child.id, { student_token: null });
  }
  res.json({ code: 0, message: '已退出登录' });
});

// ---- 孩子档案 ----
// 获取所有孩子档案（仅家长）
app.get('/api/children', authMiddleware, parentOnly, (req, res) => {
  const children = db.findAll('children', { parent_id: req.user.id });
  res.json({ code: 0, data: children });
});

// 添加孩子档案（含学生注册信息：出生年月日、性别、学生独立登录账号）
app.post('/api/children', authMiddleware, parentOnly, (req, res) => {
  const { name, grade, birth_date, gender, student_code, student_password } = req.body;
  if (!name || !grade) {
    return res.status(400).json({ code: 1, error: '姓名和年级不能为空' });
  }

  // 学生学号：自定义或自动生成（家长可将其告知孩子用于学生端登录）
  let code = (student_code || '').trim();
  if (!code) {
    code = 'stu' + String(Date.now()).slice(-6);
  }
  // 学号唯一性校验
  const exists = db.findAll('children').find(c => c.student_code === code && !c.deleted);
  if (exists) {
    return res.status(400).json({ code: 1, error: `学号 ${code} 已被使用，请更换` });
  }

  const child = db.insert('children', {
    parent_id: req.user.id,
    name,
    grade: parseInt(grade),
    birth_date: birth_date || null,            // 出生年月日
    gender: gender || 'unknown',               // male / female / unknown
    student_code: code,                        // 学生端登录学号
    student_password: student_password || '123456',  // 学生端登录密码
    student_token: null,
    total_score: 0,
    checkin_days: 0,
    last_checkin: null
  });

  // 返回时附上学生登录信息，方便家长告知孩子
  res.json({
    code: 0,
    data: child,
    message: `档案已创建。学生端登录：学号 ${child.student_code} 密码 ${child.student_password}`
  });
});

// 更新孩子档案（仅家长）
app.put('/api/children/:id', authMiddleware, parentOnly, (req, res) => {
  const child = db.findById('children', parseInt(req.params.id));
  if (!child || child.parent_id !== req.user.id) {
    return res.status(404).json({ code: 1, error: '孩子档案不存在' });
  }
  // 禁止通过更新接口篡改登录令牌
  delete req.body.student_token;
  const updated = db.update('children', child.id, req.body);
  res.json({ code: 0, data: updated });
});

// 删除孩子档案（仅家长可操作，且不能删除记录）
app.delete('/api/children/:id', authMiddleware, parentOnly, (req, res) => {
  const child = db.findById('children', parseInt(req.params.id));
  if (!child || child.parent_id !== req.user.id) {
    return res.status(404).json({ code: 1, error: '孩子档案不存在' });
  }
  // 不真正删除，标记为已删除
  db.update('children', child.id, { deleted: true });
  res.json({ code: 0, message: '已移除' });
});

// ---- 练字素材 ----
// 获取年级素材
app.get('/api/materials/:grade', (req, res) => {
  const grade = parseInt(req.params.grade);
  const materials = GRADE_MATERIALS[grade] || GRADE_MATERIALS[1];
  res.json({ code: 0, data: materials });
});

// 获取模拟考试题
app.get('/api/exam/:grade', (req, res) => {
  const grade = parseInt(req.params.grade);
  const exam = EXAM_QUESTIONS[grade] || EXAM_QUESTIONS[1];
  res.json({ code: 0, data: exam });
});

// 获取奖惩标签库
app.get('/api/tags', (req, res) => {
  res.json({ code: 0, data: REWARD_TAGS });
});

// ---- 核心检测：提交图片 + AI评价（家长/学生均可提交，学生提交自动同步到家长端） ----
app.post('/api/records/submit', authMiddleware, upload.array('images', 9), (req, res) => {
  const { child_id, submit_type, submit_role, grade, custom_text } = req.body;

  if (!child_id || !submit_type) {
    return res.status(400).json({ code: 1, error: '缺少必要参数' });
  }

  const child = db.findById('children', parseInt(child_id));
  if (!child || child.parent_id !== req.user.id) {
    return res.status(403).json({ code: 1, error: '无权操作此孩子档案' });
  }
  // 学生令牌只能以学生身份提交，且只能提交自己的档案
  if (req.isStudent && req.child.id !== child.id) {
    return res.status(403).json({ code: 1, error: '学生只能提交自己的检测' });
  }

  const validTypes = ['homework', 'practice', 'exam'];
  if (!validTypes.includes(submit_type)) {
    return res.status(400).json({ code: 1, error: '检测类型无效' });
  }

  // 学生身份强制标记为学生提交
  const finalRole = req.isStudent ? 'student' : (submit_role || 'parent');

  // 处理上传的图片
  const images = (req.files || []).map(f => `/uploads/${f.filename}`);
  // 如果没有文件但有base64图片
  let imageUrls = images;
  if (images.length === 0 && req.body.image_data) {
    // base64 图片保存
    try {
      const dataUrls = JSON.parse(req.body.image_data);
      imageUrls = dataUrls.map((dataUrl, idx) => {
        const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = `hw_${Date.now()}_${idx}.${ext}`;
          fs.writeFileSync(path.join(__dirname, 'uploads', filename), buffer);
          return `/uploads/${filename}`;
        }
        return null;
      }).filter(Boolean);
    } catch (e) {
      // ignore
    }
  }

  // 执行AI评价
  const aiResult = evaluate({
    grade: child.grade,
    submitType: submit_type,
    imageCount: imageUrls.length
  });

  // 创建记录 - 按需求文档完整字段
  const record = db.insert('practice_records', {
    child_id: parseInt(child_id),
    parent_id: req.user.id,
    submit_type,           // 检测类型：homework/practice/exam
    submit_role: finalRole,  // 提交角色：student/parent
    image_url: JSON.stringify(imageUrls),   // 原图地址（多图JSON）
    custom_text: custom_text || '',         // 自定义练习文字
    ai_score: aiResult.ai_score,            // AI总分
    ai_detail: JSON.stringify(aiResult.ai_detail),  // 四维度分数JSON
    ai_analysis_report: aiResult.ai_analysis_report,  // 问题分析报告
    ai_fix_report: aiResult.ai_fix_report,   // 整改改进报告
    weak_char_list: JSON.stringify(aiResult.weak_char_list),  // 薄弱汉字
    attitude: aiResult.attitude,             // 态度判定
    // 家长评价字段（初始为空）
    parent_score: null,
    parent_star: null,
    parent_comment: '',
    parent_reward_type: '',
    score_change: 0,
    parent_evaluate_time: null,
    evaluated: false,
    // 不可删除标记
    deletable: false
  });

  res.json({ code: 0, data: record, message: '检测完成，双报告已生成' });
});

// ---- 记录查询 ----
// 获取孩子的所有记录（家长端全程追溯；学生端只能查看自己）
app.get('/api/records', authMiddleware, (req, res) => {
  const { child_id, submit_type, page = 1, page_size = 20 } = req.query;
  let records = db.findAll('practice_records', { parent_id: req.user.id });

  // 学生身份：强制限定为自己的档案记录
  const effectiveChildId = req.isStudent ? req.child.id : (child_id ? parseInt(child_id) : null);
  if (effectiveChildId) {
    records = records.filter(r => r.child_id === effectiveChildId);
  }
  if (submit_type) {
    records = records.filter(r => r.submit_type === submit_type);
  }

  // 按时间倒序
  records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // 分页
  const start = (parseInt(page) - 1) * parseInt(page_size);
  const paged = records.slice(start, start + parseInt(page_size));

  // 解析JSON字段
  const formatted = paged.map(r => formatRecord(r));

  res.json({
    code: 0,
    data: {
      list: formatted,
      total: records.length,
      page: parseInt(page),
      page_size: parseInt(page_size)
    }
  });
});

// 获取未评价的记录（家长端待办）— 必须在 :id 路由之前定义；学生不可访问
app.get('/api/records/pending', authMiddleware, parentOnly, (req, res) => {
  const { child_id } = req.query;
  let records = db.findAll('practice_records', { parent_id: req.user.id, evaluated: false });
  if (child_id) {
    records = records.filter(r => r.child_id === parseInt(child_id));
  }
  records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ code: 0, data: records.map(formatRecord) });
});

// 获取单条记录详情
app.get('/api/records/:id', authMiddleware, (req, res) => {
  const record = db.findById('practice_records', parseInt(req.params.id));
  if (!record || record.parent_id !== req.user.id) {
    return res.status(404).json({ code: 1, error: '记录不存在' });
  }
  // 学生只能查看自己的记录
  if (req.isStudent && record.child_id !== req.child.id) {
    return res.status(403).json({ code: 1, error: '无权查看此记录' });
  }
  res.json({ code: 0, data: formatRecord(record) });
});

// 格式化记录（解析JSON字段）
function formatRecord(r) {
  return {
    ...r,
    image_urls: typeof r.image_url === 'string' ? JSON.parse(r.image_url || '[]') : (r.image_url || []),
    ai_detail_parsed: typeof r.ai_detail === 'string' ? JSON.parse(r.ai_detail || '{}') : (r.ai_detail || {}),
    weak_chars: typeof r.weak_char_list === 'string' ? JSON.parse(r.weak_char_list || '[]') : (r.weak_char_list || []),
    child_name: (db.findById('children', r.child_id) || {}).name || '未知'
  };
}

// ---- 家长评价（仅家长可操作，学生禁止修改分数/评价/积分） ----
app.post('/api/records/:id/evaluate', authMiddleware, parentOnly, (req, res) => {
  const record = db.findById('practice_records', parseInt(req.params.id));
  if (!record || record.parent_id !== req.user.id) {
    return res.status(404).json({ code: 1, error: '记录不存在' });
  }

  const { parent_score, parent_star, parent_comment, parent_reward_type } = req.body;

  // 积分计算规则
  const STAR_SCORE_MAP = { 5: 5, 4: 3, 3: 1, 2: 0, 1: -2 };
  let scoreChange = 0;
  if (parent_star && STAR_SCORE_MAP[parent_star] !== undefined) {
    scoreChange = STAR_SCORE_MAP[parent_star];
  }
  // 奖励标签额外加分
  const rewardTag = [...REWARD_TAGS.reward, ...REWARD_TAGS.punish].find(t => t.key === parent_reward_type);
  if (rewardTag && REWARD_TAGS.reward.find(t => t.key === parent_reward_type)) {
    scoreChange += 2; // 奖励标签额外+2
  }

  const updated = db.update('practice_records', record.id, {
    parent_score: parent_score !== undefined ? parseInt(parent_score) : null,
    parent_star: parent_star ? parseInt(parent_star) : null,
    parent_comment: parent_comment || '',
    parent_reward_type: parent_reward_type || '',
    score_change: scoreChange,
    parent_evaluate_time: new Date().toISOString(),
    evaluated: true
  });

  // 更新孩子总积分
  const child = db.findById('children', record.child_id);
  if (child) {
    db.update('children', child.id, {
      total_score: (child.total_score || 0) + scoreChange
    });
  }

  // 记录积分日志
  db.insert('score_logs', {
    child_id: record.child_id,
    record_id: record.id,
    change: scoreChange,
    reason: `家长评价：${parent_star}星${parent_reward_type ? '(' + (rewardTag?.label || '') + ')' : ''}`,
    balance: (child?.total_score || 0) + scoreChange
  });

  res.json({ code: 0, data: formatRecord(updated), message: '评价已保存，积分已结算' });
});

// 孩子档案访问校验：家长限本人档案，学生限本人自己
function childAccessError(req, child) {
  if (!child || child.parent_id !== req.user.id) return '无权操作';
  if (req.isStudent && child.id !== req.child.id) return '学生只能访问自己的数据';
  return null;
}

// ---- 每日打卡 ----
app.post('/api/checkin', authMiddleware, (req, res) => {
  const { child_id } = req.body;
  const child = db.findById('children', parseInt(child_id));
  const accessErr = childAccessError(req, child);
  if (accessErr) {
    return res.status(403).json({ code: 1, error: accessErr });
  }

  const today = new Date().toISOString().split('T')[0];
  // 检查今天是否已打卡
  const existing = db.findAll('checkins', { child_id: child.id }).find(c => c.date === today);
  if (existing) {
    return res.json({ code: 1, message: '今日已打卡', data: { checkin_days: child.checkin_days } });
  }

  db.insert('checkins', {
    child_id: child.id,
    date: today
  });

  const newDays = (child.checkin_days || 0) + 1;
  db.update('children', child.id, {
    checkin_days: newDays,
    last_checkin: today,
    total_score: (child.total_score || 0) + 1  // 打卡+1分
  });

  res.json({ code: 0, data: { checkin_days: newDays, total_score: (child.total_score || 0) + 1 }, message: '打卡成功+1分' });
});

// 获取打卡记录
app.get('/api/checkins/:child_id', authMiddleware, (req, res) => {
  const child_id = parseInt(req.params.child_id);
  const child = db.findById('children', child_id);
  const accessErr = childAccessError(req, child);
  if (accessErr) {
    return res.status(403).json({ code: 1, error: accessErr });
  }
  const checkins = db.findAll('checkins', { child_id });
  res.json({ code: 0, data: { checkin_days: child.checkin_days || 0, last_checkin: child.last_checkin, records: checkins } });
});

// ---- 薄弱字库 ----
app.get('/api/weak-chars/:child_id', authMiddleware, (req, res) => {
  const child_id = parseInt(req.params.child_id);
  const child = db.findById('children', child_id);
  const accessErr = childAccessError(req, child);
  if (accessErr) {
    return res.status(403).json({ code: 1, error: accessErr });
  }

  const records = db.findAll('practice_records', { child_id });
  const charCount = {};
  records.forEach(r => {
    let chars = [];
    try { chars = JSON.parse(r.weak_char_list || '[]'); } catch(e) {}
    chars.forEach(ch => {
      charCount[ch] = (charCount[ch] || 0) + 1;
    });
  });

  const sorted = Object.entries(charCount)
    .sort((a, b) => b[1] - a[1])
    .map(([char, count]) => ({ char, count }));

  res.json({ code: 0, data: sorted });
});

// ---- 统计与趋势 ----
app.get('/api/stats/:child_id', authMiddleware, (req, res) => {
  const child_id = parseInt(req.params.child_id);
  const child = db.findById('children', child_id);
  const accessErr = childAccessError(req, child);
  if (accessErr) {
    return res.status(403).json({ code: 1, error: accessErr });
  }

  const records = db.findAll('practice_records', { child_id });
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 最近30天趋势
  const trend = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const dayRecords = records.filter(r => r.created_at.split('T')[0] === dateStr);
    const avgScore = dayRecords.length > 0
      ? Math.round(dayRecords.reduce((s, r) => s + r.ai_score, 0) / dayRecords.length)
      : null;
    trend.push({ date: dateStr, score: avgScore, count: dayRecords.length });
  }

  // 本月统计
  const thisMonth = now.getMonth();
  const monthRecords = records.filter(r => new Date(r.created_at).getMonth() === thisMonth);
  const excellentCount = monthRecords.filter(r => r.ai_score >= 85).length;
  const perfunctoryCount = monthRecords.filter(r => r.ai_score < 60).length;

  // 按类型统计
  const typeStats = {
    homework: records.filter(r => r.submit_type === 'homework').length,
    practice: records.filter(r => r.submit_type === 'practice').length,
    exam: records.filter(r => r.submit_type === 'exam').length
  };

  // 平均分
  const avgScore = records.length > 0
    ? Math.round(records.reduce((s, r) => s + r.ai_score, 0) / records.length * 10) / 10
    : 0;

  // 家长评价统计
  const evaluatedRecords = records.filter(r => r.evaluated);
  const avgParentScore = evaluatedRecords.length > 0
    ? Math.round(evaluatedRecords.filter(r => r.parent_score).reduce((s, r) => s + r.parent_score, 0) / evaluatedRecords.filter(r => r.parent_score).length * 10) / 10
    : 0;
  const avgStar = evaluatedRecords.length > 0
    ? Math.round(evaluatedRecords.filter(r => r.parent_star).reduce((s, r) => s + r.parent_star, 0) / evaluatedRecords.filter(r => r.parent_star).length * 10) / 10
    : 0;

  res.json({
    code: 0,
    data: {
      child: { name: child.name, grade: child.grade, total_score: child.total_score, checkin_days: child.checkin_days },
      trend,
      total_records: records.length,
      avg_score: avgScore,
      excellent_count: excellentCount,
      perfunctory_count: perfunctoryCount,
      type_stats: typeStats,
      avg_parent_score: avgParentScore,
      avg_star: avgStar,
      evaluated_count: evaluatedRecords.length,
      pending_count: records.length - evaluatedRecords.length
    }
  });
});

// ---- 月度报告 ----
app.get('/api/monthly-report/:child_id', authMiddleware, (req, res) => {
  const { month } = req.query;
  const child_id = parseInt(req.params.child_id);
  const child = db.findById('children', child_id);
  const accessErr = childAccessError(req, child);
  if (accessErr) {
    return res.status(403).json({ code: 1, error: accessErr });
  }

  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const records = db.findAll('practice_records', { child_id })
    .filter(r => r.created_at.startsWith(targetMonth));

  if (records.length === 0) {
    return res.json({ code: 0, data: null, message: '本月暂无记录' });
  }

  const scores = records.map(r => r.ai_score);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  // 按维度统计
  const dimStats = { stroke: [], structure: [], habit: [], clarity: [] };
  records.forEach(r => {
    try {
      const detail = JSON.parse(r.ai_detail);
      dimStats.stroke.push(detail.stroke.percent);
      dimStats.structure.push(detail.structure.percent);
      dimStats.habit.push(detail.habit.percent);
      dimStats.clarity.push(detail.clarity.percent);
    } catch(e) {}
  });

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  // 薄弱字统计
  const charCount = {};
  records.forEach(r => {
    try {
      JSON.parse(r.weak_char_list || '[]').forEach(ch => {
        charCount[ch] = (charCount[ch] || 0) + 1;
      });
    } catch(e) {}
  });
  const topWeakChars = Object.entries(charCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // 家长评价统计
  const evaluated = records.filter(r => r.evaluated);
  const starDist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  evaluated.forEach(r => { if (r.parent_star) starDist[r.parent_star]++; });

  const report = {
    child_name: child.name,
    month: targetMonth,
    total_records: records.length,
    avg_score: avgScore,
    max_score: maxScore,
    min_score: minScore,
    dim_avg: {
      stroke: avg(dimStats.stroke),
      structure: avg(dimStats.structure),
      habit: avg(dimStats.habit),
      clarity: avg(dimStats.clarity)
    },
    type_count: {
      homework: records.filter(r => r.submit_type === 'homework').length,
      practice: records.filter(r => r.submit_type === 'practice').length,
      exam: records.filter(r => r.submit_type === 'exam').length
    },
    top_weak_chars: topWeakChars.map(([char, count]) => ({ char, count })),
    star_distribution: starDist,
    total_score: child.total_score,
    checkin_days: child.checkin_days,
    evaluated_count: evaluated.length,
    // 生成文字总结
    summary: generateMonthlySummary(child.name, targetMonth, records.length, avgScore, maxScore, minScore, avg(dimStats.stroke), avg(dimStats.structure), avg(dimStats.habit), avg(dimStats.clarity))
  };

  res.json({ code: 0, data: report });
});

function generateMonthlySummary(name, month, total, avg, max, min, stroke, structure, habit, clarity) {
  let summary = `${name}同学${month}月书写成长总结\n\n`;
  summary += `本月共完成书写检测${total}次，平均得分${avg}分，最高${max}分，最低${min}分。\n\n`;
  summary += `各维度平均表现：\n`;
  summary += `- 笔画规范：${stroke}%\n`;
  summary += `- 间架结构：${structure}%\n`;
  summary += `- 卷面习惯：${habit}%\n`;
  summary += `- 字迹清晰度：${clarity}%\n\n`;

  const weakest = Math.min(stroke, structure, habit, clarity);
  const dimNames = { [stroke]: '笔画规范', [structure]: '间架结构', [habit]: '卷面习惯', [clarity]: '字迹清晰度' };
  summary += `本月最需提升的维度：${dimNames[weakest]}\n`;

  if (avg >= 85) {
    summary += `\n整体表现优秀，书写习惯良好，继续保持！`;
  } else if (avg >= 70) {
    summary += `\n整体表现良好，在${dimNames[weakest]}方面还有提升空间，建议针对性练习。`;
  } else {
    summary += `\n整体表现有待提升，建议增加练字频率，重点改善${dimNames[weakest]}问题。`;
  }

  return summary;
}

// ---- 积分记录 ----
app.get('/api/score-logs/:child_id', authMiddleware, (req, res) => {
  const child_id = parseInt(req.params.child_id);
  const child = db.findById('children', child_id);
  const accessErr = childAccessError(req, child);
  if (accessErr) {
    return res.status(403).json({ code: 1, error: accessErr });
  }
  const logs = db.findAll('score_logs', { child_id });
  logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ code: 0, data: logs });
});

// ---- 荣誉/成就 ----
app.get('/api/honors/:child_id', authMiddleware, (req, res) => {
  const child_id = parseInt(req.params.child_id);
  const child = db.findById('children', child_id);
  const accessErr = childAccessError(req, child);
  if (accessErr) {
    return res.status(403).json({ code: 1, error: accessErr });
  }

  const records = db.findAll('practice_records', { child_id });
  const checkinDays = child.checkin_days || 0;
  const totalScore = child.total_score || 0;

  const honors = [
    { id: 'h1', name: '书写新星', icon: 'star', desc: '完成首次书写检测', unlocked: records.length >= 1, progress: Math.min(records.length, 1) + '/1' },
    { id: 'h2', name: '勤奋之星', icon: 'fire', desc: '累计检测10次', unlocked: records.length >= 10, progress: Math.min(records.length, 10) + '/10' },
    { id: 'h3', name: '坚持达人', icon: 'calendar', desc: '连续打卡7天', unlocked: checkinDays >= 7, progress: Math.min(checkinDays, 7) + '/7' },
    { id: 'h4', name: '书写小能手', icon: 'pen', desc: '累计检测30次', unlocked: records.length >= 30, progress: Math.min(records.length, 30) + '/30' },
    { id: 'h5', name: '积分达人', icon: 'trophy', desc: '积分达到50分', unlocked: totalScore >= 50, progress: Math.min(totalScore, 50) + '/50' },
    { id: 'h6', name: '满分学员', icon: 'crown', desc: '获得AI评分95分以上', unlocked: records.some(r => r.ai_score >= 95), progress: records.some(r => r.ai_score >= 95) ? '1/1' : '0/1' },
    { id: 'h7', name: '月度冠军', icon: 'medal', desc: '单月检测20次以上', unlocked: records.length >= 20, progress: Math.min(records.length, 20) + '/20' },
    { id: 'h8', name: '五星好评', icon: 'star-fill', desc: '获得家长5星评价', unlocked: records.some(r => r.parent_star === 5), progress: records.some(r => r.parent_star === 5) ? '1/1' : '0/1' }
  ];

  res.json({ code: 0, data: honors });
});

// ---- 健康检查 ----
app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'OK', time: new Date().toISOString() });
});

// ---- 兜底路由：返回前端 ----
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- 启动 ----
const httpServer = app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  中小学生字体书写智能评价系统`);
  console.log(`  HTTP 服务已启动: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
httpServer.on('error', (e) => {
  console.error(`HTTP(${PORT}) 启动失败:`, e.message);
  process.exit(1);
});

// ---- HTTPS（自签证书，证书存在时自动启用 443）----
try {
  const https = require('https');
  const certFile = path.join(__dirname, 'certs', 'server.crt');
  const keyFile = path.join(__dirname, 'certs', 'server.key');
  if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    const httpsPort = parseInt(process.env.HTTPS_PORT || '443', 10);
    const httpsServer = https.createServer(
      { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) },
      app
    );
    httpsServer.listen(httpsPort, () => {
      console.log(`  HTTPS 服务已启动: https://localhost:${httpsPort} (自签证书)`);
    });
    httpsServer.on('error', (e) => {
      console.warn(`  HTTPS(${httpsPort}) 启动失败（不影响 HTTP）:`, e.message);
    });
  } else {
    console.log('  未发现 certs/server.crt，跳过 HTTPS 启动');
  }
} catch (e) {
  console.warn('  HTTPS 启动失败（不影响 HTTP）:', e.message);
}
