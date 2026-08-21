/**
 * 中小学生字体书写智能评价系统 - 前端应用
 * 双端独立：学生端App / 家长端App（由页面 APP_MODE 决定）
 */

// 页面模式：student.html 设置 'student'，parent.html 设置 'parent'，落地页不设
const APP_MODE = window.APP_MODE || null;

// ========== 全局状态 ==========
const state = {
  user: null,
  children: [],
  currentChild: null,
  mode: APP_MODE || 'student', // student | parent
  sessionType: APP_MODE || 'parent', // 当前登录身份：student(学生令牌) | parent(家长账号)
  studentToken: null,          // 学生独立登录令牌
  currentPage: 'home',
  selectedImages: [],
  practiceMaterial: null,
  examQuestion: null,
  tags: null,
  pageHistory: []
};

// ========== 服务器地址配置 ==========
// APK 内默认指向公网服务器；浏览器/PWA 同源场景默认相对路径；用户可在登录页「服务器设置」中修改
const DEFAULT_SERVER_URL = 'https://47.93.40.53';

function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

// 返回 API 根地址（含 /api 后缀）
function getApiBase() {
  const custom = (localStorage.getItem('server_url') || '').trim().replace(/\/+$/, '');
  if (custom) return custom + '/api';
  if (isNativeApp()) return DEFAULT_SERVER_URL + '/api';
  return '/api';
}

// ========== 服务器设置弹窗（登录页底部入口） ==========
function initServerSettingsLink() {
  const loginPage = document.getElementById('page-login');
  if (!loginPage) return;
  const tip = loginPage.querySelector('.login-tip');
  if (!tip || loginPage.querySelector('.server-settings-link')) return;
  const link = document.createElement('div');
  link.className = 'server-settings-link';
  link.style.cssText = 'text-align:center;margin-top:10px;font-size:12px;color:#9aa0a6;cursor:pointer;user-select:none;';
  link.textContent = '服务器设置';
  link.addEventListener('click', openServerSettings);
  tip.after(link);
}

function openServerSettings() {
  const old = document.getElementById('server-settings-modal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'server-settings-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:14px;padding:22px;width:86%;max-width:360px;box-shadow:0 8px 30px rgba(0,0,0,.18);';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:16px;font-weight:600;color:#222;margin-bottom:6px;';
  title.textContent = '服务器设置';
  const desc = document.createElement('div');
  desc.style.cssText = 'font-size:12px;color:#888;margin-bottom:12px;line-height:1.6;';
  desc.textContent = '用于 APK 内连接服务器。留空则使用默认公网服务器；PWA/浏览器同源访问无需设置。';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = localStorage.getItem('server_url') || '';
  input.placeholder = 'https://xxx.trycloudflare.com';
  input.style.cssText = 'width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:8px;padding:10px;font-size:14px;outline:none;';
  const err = document.createElement('div');
  err.style.cssText = 'color:#e74c3c;font-size:12px;margin-top:6px;display:none;';
  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:10px;margin-top:16px;';
  const ok = document.createElement('button');
  ok.textContent = '保存';
  ok.style.cssText = 'flex:1;background:linear-gradient(135deg,#4a90d9,#3a7bd5);color:#fff;border:none;border-radius:8px;padding:10px;font-size:14px;cursor:pointer;';
  const cancel = document.createElement('button');
  cancel.textContent = '取消';
  cancel.style.cssText = 'flex:1;background:#f2f3f5;color:#555;border:none;border-radius:8px;padding:10px;font-size:14px;cursor:pointer;';
  btns.appendChild(ok);
  btns.appendChild(cancel);
  box.appendChild(title);
  box.appendChild(desc);
  box.appendChild(input);
  box.appendChild(err);
  box.appendChild(btns);
  modal.appendChild(box);
  document.body.appendChild(modal);
  input.focus();
  ok.onclick = () => {
    const v = input.value.trim().replace(/\/+$/, '');
    if (v && !/^https?:\/\//.test(v)) {
      err.textContent = '地址需以 http:// 或 https:// 开头';
      err.style.display = 'block';
      return;
    }
    if (v) localStorage.setItem('server_url', v);
    else localStorage.removeItem('server_url');
    modal.remove();
    alert('已保存。服务器地址：' + (v || (isNativeApp() ? DEFAULT_SERVER_URL : '当前站点(同源)')) + '\n重新登录后生效。');
  };
  cancel.onclick = () => modal.remove();
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ========== 会话持久化 ==========
function sessionKey() {
  return 'hw_session_' + (APP_MODE || 'default');
}

function saveSession() {
  localStorage.setItem(sessionKey(), JSON.stringify({
    sessionType: state.sessionType,
    token: state.studentToken,
    userId: state.user ? state.user.user_id : null
  }));
}

function clearSession() {
  localStorage.removeItem(sessionKey());
}

async function tryRestoreSession() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(sessionKey())); } catch (e) {}
  if (!raw) return false;
  try {
    if (raw.sessionType === 'student' && raw.token) {
      // 学生身份：用令牌换取最新档案信息
      const res = await fetch(getApiBase() + '/auth/me', { headers: { 'x-student-token': raw.token } });
      const data = await res.json();
      if (res.status !== 200 || data.code !== 0) { clearSession(); return false; }
      state.sessionType = 'student';
      state.studentToken = raw.token;
      state.user = { user_id: data.data.child.parent_id };
      state.currentChild = data.data.child;
      state.children = [data.data.child];
      return true;
    } else if (raw.userId) {
      const res = await fetch(getApiBase() + '/auth/me', { headers: { 'x-user-id': raw.userId } });
      const data = await res.json();
      if (res.status !== 200 || data.code !== 0) { clearSession(); return false; }
      state.sessionType = 'parent';
      state.studentToken = null;
      state.user = { user_id: raw.userId };
      return true;
    }
  } catch (e) {
    clearSession();
  }
  return false;
}

// ========== API 客户端 ==========
const API = {
  get baseURL() { return getApiBase(); },
  async request(method, path, body, isFormData) {
    const headers = {};
    if (state.studentToken) headers['x-student-token'] = state.studentToken;
    else if (state.user) headers['x-user-id'] = state.user.user_id;
    let options = { method, headers };
    if (body && !isFormData) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    } else if (body && isFormData) {
      options.body = body; // FormData
    }
    const res = await fetch(this.baseURL + path, options);
    // 登录失效：自动退出到登录页
    if (res.status === 401) {
      clearSession();
      state.user = null;
      state.studentToken = null;
      const loginPage = document.getElementById('page-login');
      if (loginPage) {
        loginPage.style.display = '';
        loginPage.classList.add('active');
        document.getElementById('main-app').style.display = 'none';
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || '登录已失效，请重新登录');
    }
    const data = await res.json();
    if (data.code !== 0 && data.code !== undefined) {
      throw new Error(data.error || data.message || '请求失败');
    }
    return data;
  },
  get(path) { return this.request('GET', path); },
  post(path, body, isFormData) { return this.request('POST', path, body, isFormData); },
  put(path, body) { return this.request('PUT', path, body); },
  del(path) { return this.request('DELETE', path); }
};

// ========== 工具函数 ==========
function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

function showLoading(text = 'AI正在分析中...') {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.className = 'loading-overlay';
    el.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${text}</div>`;
    document.body.appendChild(el);
  }
  el.querySelector('.loading-text').textContent = text;
  el.style.display = 'flex';
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getScoreClass(score) {
  if (score >= 85) return 'score-excellent';
  if (score >= 70) return 'score-good';
  if (score >= 55) return 'score-normal';
  return 'score-poor';
}

function getScoreColor(score) {
  if (score >= 85) return 'var(--success)';
  if (score >= 70) return 'var(--info)';
  if (score >= 55) return 'var(--warning)';
  return 'var(--danger)';
}

function getScoreLabel(score) {
  if (score >= 85) return '优秀';
  if (score >= 70) return '良好';
  if (score >= 55) return '一般';
  return '待改进';
}

function getTypeLabel(type) {
  return { homework: '日常作业', practice: '日常练字', exam: '模拟考核' }[type] || type;
}

function getTypeClass(type) {
  return { homework: 'type-homework', practice: 'type-practice', exam: 'type-exam' }[type] || '';
}

function getGradeLabel(grade) {
  const labels = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
  return labels[grade] || `${grade}年级`;
}

function openPreview(src) {
  document.getElementById('preview-img').src = src;
  document.getElementById('image-preview').style.display = 'flex';
}
function closePreview() {
  document.getElementById('image-preview').style.display = 'none';
}

function showModal(html) {
  const container = document.getElementById('modal-container');
  container.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()">${html}</div>`;
}
function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

// ========== 底部导航配置 ==========
const TAB_CONFIG = {
  student: [
    { key: 'home', icon: '🏠', label: '首页' },
    { key: 'records', icon: '📋', label: '记录' },
    { key: 'checkin', icon: '📅', label: '打卡' },
    { key: 'profile', icon: '👤', label: '我的' }
  ],
  parent: [
    { key: 'trace', icon: '🔍', label: '追溯' },
    { key: 'pending', icon: '✋', label: '待评' },
    { key: 'stats', icon: '📊', label: '统计' },
    { key: 'profile', icon: '👤', label: '我的' }
  ]
};

// ========== 页面渲染器 ==========

// --- 登录入口：根据App模式分流 ---
async function handleLogin() {
  if (APP_MODE === 'student') return handleStudentLogin();
  return handleParentLogin();
}

// --- 家长登录（家长端App） ---
async function handleParentLogin() {
  const nickname = document.getElementById('login-nickname').value.trim() || '家长';
  try {
    showLoading('登录中...');
    const res = await API.post('/auth/login', { nickname });
    state.user = res.data;
    state.sessionType = 'parent';
    state.studentToken = null;
    saveSession();
    hideLoading();
    await enterMainApp();
  } catch (e) {
    hideLoading();
    showToast(e.message);
  }
}

// --- 学生独立登录（学生端App：学号 + 密码） ---
async function handleStudentLogin() {
  const code = document.getElementById('login-code').value.trim();
  const pwd = document.getElementById('login-pwd').value;
  if (!code) { showToast('请输入学号'); return; }
  if (!pwd) { showToast('请输入密码'); return; }
  try {
    showLoading('登录中...');
    const res = await API.post('/auth/student-login', {
      student_code: code,
      student_password: pwd
    });
    state.user = { user_id: res.data.child.parent_id };
    state.studentToken = res.data.token;
    state.sessionType = 'student';
    state.currentChild = res.data.child;
    state.children = [res.data.child];
    saveSession();
    hideLoading();
    await enterMainApp();
    showToast(`欢迎回来，${res.data.child.name}！`);
  } catch (e) {
    hideLoading();
    showToast(e.message);
  }
}

// --- 进入主应用 ---
async function enterMainApp() {
  const loginPage = document.getElementById('page-login');
  if (loginPage) {
    loginPage.classList.remove('active');
    loginPage.style.display = 'none';
  }
  document.getElementById('main-app').style.display = 'flex';
  if (state.sessionType === 'parent') {
    await loadChildren();
  } else {
    updateHeader();
  }
  renderApp();
}

// --- 退出登录 ---
async function logout() {
  if (state.sessionType === 'student' && state.studentToken) {
    try { await API.post('/auth/student-logout', {}); } catch (e) { /* ignore */ }
  }
  clearSession();
  state.user = null;
  state.studentToken = null;
  state.currentChild = null;
  state.children = [];
  const loginPage = document.getElementById('page-login');
  if (loginPage) {
    loginPage.style.display = '';
    loginPage.classList.add('active');
  }
  document.getElementById('main-app').style.display = 'none';
  showToast('已退出登录');
}

// --- 加载孩子列表 ---
async function loadChildren() {
  try {
    const res = await API.get('/children');
    state.children = res.data || [];
    if (state.children.length > 0 && !state.currentChild) {
      state.currentChild = state.children[0];
    }
    updateHeader();
  } catch (e) {
    showToast(e.message);
  }
}

function updateHeader() {
  const nameEl = document.getElementById('current-child-name');
  const avatarEl = document.getElementById('current-child-avatar');
  const switchIcon = document.querySelector('#header-child-switcher .switch-icon');
  if (state.currentChild) {
    nameEl.textContent = state.currentChild.name;
    const isGirl = state.currentChild.gender === 'female';
    avatarEl.textContent = isGirl ? '👧' : '👦';
  } else {
    nameEl.textContent = '添加孩子';
    avatarEl.textContent = '➕';
  }
  // 学生端：固定本人档案，隐藏切换箭头
  if (switchIcon) {
    switchIcon.style.display = state.sessionType === 'student' ? 'none' : '';
  }
}

// --- 渲染主应用 ---
function renderApp() {
  renderTabBar();
  navigateTo(state.mode === 'student' ? 'home' : 'trace');
}

// --- 底部导航栏 ---
function renderTabBar() {
  const tabs = TAB_CONFIG[state.mode];
  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = tabs.map(tab => `
    <div class="tab-item ${state.currentPage === tab.key ? 'active' : ''}" onclick="navigateTo('${tab.key}')">
      <span class="tab-icon">${tab.icon}</span>
      <span class="tab-label">${tab.label}</span>
    </div>
  `).join('');
}

// --- 导航 ---
function navigateTo(page, params = {}) {
  state.currentPage = page;
  state.pageHistory.push({ page, params });
  renderTabBar();
  const container = document.getElementById('page-container');
  container.scrollTop = 0;

  const pages = {
    home: renderHomePage,
    records: renderRecordsPage,
    checkin: renderCheckinPage,
    profile: renderProfilePage,
    trace: renderTracePage,
    pending: renderPendingPage,
    stats: renderStatsPage,
    homework: () => renderDetectPage('homework'),
    practice: () => renderDetectPage('practice'),
    exam: () => renderDetectPage('exam'),
    weakchars: renderWeakCharsPage,
    honors: renderHonorsPage,
    scorelog: renderScoreLogPage,
    monthly: renderMonthlyReportPage,
    addchild: renderAddChildPage,
    recordDetail: () => renderRecordDetail(params.id),
    result: () => renderResultPage(params.id)
  };

  const renderer = pages[page];
  if (renderer) {
    renderer();
  }
}

// ========== 学生端 - 首页 ==========
async function renderHomePage() {
  const container = document.getElementById('page-container');
  let statsHtml = '';
  if (state.currentChild) {
    try {
      const res = await API.get(`/stats/${state.currentChild.id}`);
      const s = res.data;
      statsHtml = `
        <div class="hero-banner">
          <h2>你好，${state.currentChild.name}！</h2>
          <p>${getGradeLabel(state.currentChild.grade)} | 今日也要认真书写哦</p>
          <div class="hero-stats">
            <div class="hero-stat">
              <div class="hero-stat-num">${s.total_records}</div>
              <div class="hero-stat-label">累计检测</div>
            </div>
            <div class="hero-stat">
              <div class="hero-stat-num">${s.avg_score || '--'}</div>
              <div class="hero-stat-label">平均分</div>
            </div>
            <div class="hero-stat">
              <div class="hero-stat-num">${s.child?.checkin_days || 0}</div>
              <div class="hero-stat-label">打卡天数</div>
            </div>
          </div>
        </div>`;
    } catch (e) { /* ignore */ }
  } else {
    statsHtml = `
      <div class="hero-banner">
        <h2>欢迎使用书写评价系统</h2>
        <p>请先添加孩子档案开始使用</p>
        <button class="btn btn-success btn-sm mt-12" onclick="navigateTo('addchild')">+ 添加孩子</button>
      </div>`;
  }

  container.innerHTML = `
    <div class="page-content">
      ${statsHtml}
      <div class="section-title">三大检测场景</div>
      <div class="scene-grid">
        <div class="scene-card" onclick="navigateTo('homework')">
          <div class="scene-card-header">
            <div class="scene-icon blue">📝</div>
            <div class="scene-info">
              <h3>日常作业书写检测</h3>
              <p>拍照上传日常作业，AI智能识别书写质量，自动生成双报告</p>
              <span class="scene-tag tag-blue">重点推荐</span>
            </div>
          </div>
        </div>
        <div class="scene-card" onclick="navigateTo('practice')">
          <div class="scene-card-header">
            <div class="scene-icon green">✏️</div>
            <div class="scene-info">
              <h3>日常练字检测</h3>
              <p>1-9年级部编版生字、词语、古诗素材，支持自定义练习</p>
              <span class="scene-tag tag-green">练字素材</span>
            </div>
          </div>
        </div>
        <div class="scene-card" onclick="navigateTo('exam')">
          <div class="scene-card-header">
            <div class="scene-icon orange">📋</div>
            <div class="scene-info">
              <h3>模拟考试书写考核</h3>
              <p>年级对应模拟书写考核题库，生成考试卷面专项测评报告</p>
              <span class="scene-tag tag-orange">模拟考核</span>
            </div>
          </div>
        </div>
      </div>
      <div class="lock-notice">学生提交的所有记录不可删除，家长可全程追溯</div>
    </div>
  `;
}

// ========== 检测页面（通用） ==========
async function renderDetectPage(type) {
  const container = document.getElementById('page-container');
  state.selectedImages = [];

  const typeConfig = {
    homework: { title: '日常作业书写检测', icon: '📝', tips: '请拍摄清晰的作业页面，支持多张上传', color: 'blue' },
    practice: { title: '日常练字检测', icon: '✏️', tips: '选择练字素材或在纸上书写后拍照上传', color: 'green' },
    exam: { title: '模拟考试书写考核', icon: '📋', tips: '请按照考核要求认真书写后拍照上传', color: 'orange' }
  };
  const config = typeConfig[type];

  let materialHtml = '';
  if (type === 'practice' && state.currentChild) {
    materialHtml = await renderPracticeMaterial();
  } else if (type === 'exam' && state.currentChild) {
    materialHtml = await renderExamQuestion();
  }

  container.innerHTML = `
    <div class="page-content">
      <div class="section-title">${config.icon} ${config.title}</div>
      ${materialHtml}
      <div class="upload-area">
        <div class="upload-tips">💡 ${config.tips}<br>支持自动纠偏、裁边、去阴影</div>
        <div class="image-preview-grid" id="preview-grid"></div>
        <div class="image-upload-zone" onclick="document.getElementById('image-input').click()">
          <div class="upload-icon">📸</div>
          <div class="upload-text"><strong>点击拍照/选择图片</strong><br>支持多张图片上传（最多9张）</div>
        </div>
        <input type="file" id="image-input" accept="image/*" multiple style="display:none" onchange="handleImageSelect(event)">
        ${type === 'practice' ? `
          <div class="custom-input-area mt-12">
            <div class="modal-label">自定义练习文字（选填）</div>
            <textarea id="custom-text" placeholder="输入要练习的文字内容..."></textarea>
          </div>
        ` : ''}
        <button class="btn btn-primary btn-block btn-lg mt-12" onclick="submitDetection('${type}')">开始AI智能检测</button>
      </div>
    </div>
  `;
}

// --- 练字素材渲染 ---
async function renderPracticeMaterial() {
  try {
    const grade = state.currentChild.grade;
    const res = await API.get(`/materials/${grade}`);
    const m = res.data;
    state.practiceMaterial = m;
    return `
      <div class="card">
        <div class="card-title">📚 ${getGradeLabel(grade)}练字素材</div>
        <div class="material-tabs">
          <div class="material-tab active" onclick="switchMaterialTab(this,'chars')">生字</div>
          <div class="material-tab" onclick="switchMaterialTab(this,'words')">词语</div>
          <div class="material-tab" onclick="switchMaterialTab(this,'poems')">古诗</div>
        </div>
        <div id="material-chars" class="material-panel">
          <div class="char-grid">
            ${m.chars.map(ch => `<div class="char-cell" onclick="selectChar(this,'${ch}')">${ch}</div>`).join('')}
          </div>
        </div>
        <div id="material-words" class="material-panel hidden">
          <div class="word-grid">
            ${m.words.map(w => `<div class="word-cell" onclick="selectWord(this,'${w}')">${w}</div>`).join('')}
          </div>
        </div>
        <div id="material-poems" class="material-panel hidden">
          ${m.poems.map(p => `<div class="poem-card"><div class="poem-text">${p}</div></div>`).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    return `<div class="card text-center text-gray">${e.message}</div>`;
  }
}

function switchMaterialTab(el, tab) {
  el.parentElement.querySelectorAll('.material-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['chars', 'words', 'poems'].forEach(t => {
    document.getElementById('material-' + t).classList.toggle('hidden', t !== tab);
  });
}

function selectChar(el, ch) {
  el.classList.toggle('selected');
}
function selectWord(el, w) {
  el.classList.toggle('selected');
}

// --- 考试题渲染 ---
async function renderExamQuestion() {
  try {
    const grade = state.currentChild.grade;
    const res = await API.get(`/exam/${grade}`);
    state.examQuestion = res.data;
    return `
      <div class="exam-card">
        <div class="exam-title">${res.data.title}</div>
        <div class="exam-content">${res.data.content}</div>
        <div class="exam-meta">
          <span>⏱ 建议时长：${res.data.time_limit}分钟</span>
          <span>📏 年级：${getGradeLabel(grade)}</span>
        </div>
      </div>
    `;
  } catch (e) {
    return `<div class="card text-center text-gray">${e.message}</div>`;
  }
}

// --- 图片选择处理 ---
function handleImageSelect(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    if (state.selectedImages.length >= 9) {
      showToast('最多上传9张图片');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      state.selectedImages.push({ dataUrl: e.target.result, file });
      renderImagePreview();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function renderImagePreview() {
  const grid = document.getElementById('preview-grid');
  if (!grid) return;
  grid.innerHTML = state.selectedImages.map((img, idx) => `
    <div class="image-preview-item">
      <img src="${img.dataUrl}" onclick="openPreview('${img.dataUrl}')">
      <div class="image-remove" onclick="removeImage(${idx})">✕</div>
    </div>
  `).join('');
}

function removeImage(idx) {
  state.selectedImages.splice(idx, 1);
  renderImagePreview();
}

// --- 提交检测 ---
async function submitDetection(type) {
  if (!state.currentChild) {
    showToast('请先添加孩子档案');
    return;
  }
  if (state.selectedImages.length === 0) {
    showToast('请至少上传一张图片');
    return;
  }

  showLoading('AI正在智能分析书写质量...\n生成双报告中...');

  try {
    const formData = new FormData();
    formData.append('child_id', state.currentChild.id);
    formData.append('submit_type', type);
    formData.append('submit_role', state.sessionType === 'student' ? 'student' : 'parent');
    formData.append('grade', state.currentChild.grade);

    if (type === 'practice') {
      const customText = document.getElementById('custom-text')?.value || '';
      formData.append('custom_text', customText);
    }

    state.selectedImages.forEach((img, idx) => {
      formData.append('images', img.file);
    });

    const res = await API.post('/records/submit', formData, true);
    hideLoading();
    showToast('检测完成！双报告已生成');
    state.selectedImages = [];
    setTimeout(() => navigateTo('result', { id: res.data.id }), 500);
  } catch (e) {
    hideLoading();
    showToast(e.message);
  }
}

// ========== 检测结果页 ==========
async function renderResultPage(recordId) {
  const container = document.getElementById('page-container');
  showLoading('加载报告...');
  try {
    const res = await API.get(`/records/${recordId}`);
    const r = res.data;
    hideLoading();

    const detail = r.ai_detail_parsed;
    const scoreClass = getScoreClass(r.ai_score);
    const deg = Math.round((r.ai_score / 100) * 360);

    container.innerHTML = `
      <div class="page-content">
        <!-- 分数展示 -->
        <div class="card text-center">
          <div style="font-size:13px;color:var(--text-3);margin-bottom:4px">${getTypeLabel(r.submit_type)} · ${formatDate(r.created_at)}</div>
          <div class="score-circle-wrap">
            <div class="score-circle ${scoreClass}" style="--deg:${deg}deg">
              <div class="score-num" style="color:${getScoreColor(r.ai_score)}">${r.ai_score}</div>
              <div class="score-label">${getScoreLabel(r.ai_score)}</div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--text-3)">书写态度：<span class="font-bold" style="color:${getScoreColor(r.ai_score)}">${r.attitude}</span></div>
        </div>

        <!-- 四维度评分 -->
        <div class="section-title">四维度评分</div>
        <div class="dim-grid">
          ${renderDimCard('笔画规范', detail.stroke, 'bar-blue')}
          ${renderDimCard('间架结构', detail.structure, 'bar-green')}
          ${renderDimCard('卷面书写习惯', detail.habit, 'bar-orange')}
          ${renderDimCard('字迹清晰度', detail.clarity, 'bar-purple')}
        </div>

        <!-- 原图 -->
        <div class="section-title">原始拍照</div>
        <div class="card">
          <div class="image-preview-grid">
            ${r.image_urls.map(url => `<div class="image-preview-item" onclick="openPreview('${url}')"><img src="${url}" alt="原图"></div>`).join('')}
          </div>
        </div>

        <!-- 报告1：问题分析 -->
        <div class="report-block">
          <div class="report-header">
            <div class="report-icon analysis">🔍</div>
            <div class="report-title">书写问题分析报告</div>
          </div>
          <div class="report-body">${r.ai_analysis_report}</div>
        </div>

        <!-- 报告2：改进整改 -->
        <div class="report-block">
          <div class="report-header">
            <div class="report-icon fix">📝</div>
            <div class="report-title">改进整改落地报告</div>
          </div>
          <div class="report-body">${r.ai_fix_report}</div>
        </div>

        <!-- 薄弱汉字 -->
        ${r.weak_chars.length > 0 ? `
          <div class="section-title">本次薄弱汉字</div>
          <div class="weak-char-list">
            ${r.weak_chars.map(ch => `<div class="weak-char-item"><div class="weak-char-text">${ch}</div><div class="weak-char-count">需重点练习</div></div>`).join('')}
          </div>
        ` : ''}

        <!-- 家长评价展示 -->
        ${r.evaluated ? renderParentEvaluationDisplay(r) : `
          <div class="card text-center text-gray" style="padding:20px">
            <div style="font-size:24px;margin-bottom:8px">⏳</div>
            <div>家长尚未评价</div>
            <div style="font-size:12px;margin-top:4px">等待家长打分、星级评价和评语</div>
          </div>
        `}

        <div class="lock-notice">此记录已永久存档，不可删除</div>

        <div style="padding:12px 0 20px">
          <button class="btn btn-outline btn-block" onclick="navigateTo('${state.sessionType === 'parent' ? 'trace' : 'records'}')">返回列表</button>
        </div>
      </div>
    `;
  } catch (e) {
    hideLoading();
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-text">${e.message}</div></div>`;
  }
}

function renderDimCard(label, dim, barClass) {
  return `
    <div class="dim-card">
      <div class="dim-label">${label}</div>
      <div class="dim-score" style="color:${getScoreColor(dim.percent)}">${dim.score}<small>/${dim.max}</small></div>
      <div class="dim-bar"><div class="dim-bar-fill ${barClass}" style="width:${dim.percent}%"></div></div>
    </div>
  `;
}

function renderParentEvaluationDisplay(r) {
  const stars = '★'.repeat(r.parent_star) + '☆'.repeat(5 - r.parent_star);
  return `
    <div class="section-title">家长评价</div>
    <div class="card">
      <div class="card-row mb-8">
        <span class="star-display" style="font-size:20px">${stars}</span>
        <span class="font-bold" style="color:${getScoreColor(r.parent_score || 0)}">${r.parent_score || '--'}分</span>
      </div>
      ${r.parent_reward_type ? `<div style="margin-bottom:8px"><span class="scene-tag ${REWARD_TAG_MAP[r.parent_reward_type]?.type === 'reward' ? 'tag-green' : 'tag-orange'}">${REWARD_TAG_MAP[r.parent_reward_type]?.label || r.parent_reward_type}</span></div>` : ''}
      ${r.parent_comment ? `<div style="font-size:13px;color:var(--text-2);line-height:1.6;padding:8px;background:#f9f9f9;border-radius:8px">${r.parent_comment}</div>` : ''}
      <div style="font-size:11px;color:var(--text-4);margin-top:8px">${formatDate(r.parent_evaluate_time)}</div>
      <div style="margin-top:8px;font-size:13px;color:${r.score_change >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:600">积分${r.score_change >= 0 ? '+' : ''}${r.score_change}</div>
    </div>
  `;
}

// 标签映射（从API获取后填充）
let REWARD_TAG_MAP = {};

// ========== 记录列表页 ==========
async function renderRecordsPage() {
  const container = document.getElementById('page-container');
  if (!state.currentChild) {
    container.innerHTML = renderNoChildHint();
    return;
  }
  showLoading('加载中...');
  try {
    const res = await API.get(`/records?child_id=${state.currentChild.id}`);
    const records = res.data.list;
    hideLoading();
    container.innerHTML = `
      <div class="page-content">
        <div class="section-title">书写记录时间轴</div>
        ${records.length === 0 ? renderEmpty('暂无记录', '去完成第一次书写检测吧') : `
          <div class="record-list">
            ${records.map(r => renderRecordItem(r)).join('')}
          </div>
        `}
      </div>
    `;
  } catch (e) {
    hideLoading();
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-text">${e.message}</div></div>`;
  }
}

function renderRecordItem(r) {
  const thumb = r.image_urls && r.image_urls[0] ? r.image_urls[0] : '';
  const stars = r.parent_star ? '★'.repeat(r.parent_star) + '☆'.repeat(5 - r.parent_star) : '';
  return `
    <div class="record-item" onclick="navigateTo('recordDetail',{id:${r.id}})">
      <div class="record-item-header">
        <span class="record-type-tag ${getTypeClass(r.submit_type)}">${getTypeLabel(r.submit_type)}</span>
        <span class="record-time">${formatDateShort(r.created_at)}</span>
      </div>
      <div class="record-body">
        <div class="record-thumb">${thumb ? `<img src="${thumb}">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px">📝</div>'}</div>
        <div class="record-info">
          <div class="record-score" style="color:${getScoreColor(r.ai_score)}">${r.ai_score}<small>/100</small></div>
          <div class="record-attitude">${r.attitude || ''}</div>
          <div class="record-status">
            ${r.evaluated ? `<span class="status-evaluated">✓ 已评价</span>${stars ? `<span class="star-display">${stars}</span>` : ''}` : '<span class="status-pending">⏳ 待家长评价</span>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ========== 记录详情页 ==========
async function renderRecordDetail(recordId) {
  renderResultPage(recordId);
}

// ========== 打卡页 ==========
async function renderCheckinPage() {
  const container = document.getElementById('page-container');
  if (!state.currentChild) {
    container.innerHTML = renderNoChildHint();
    return;
  }
  try {
    const res = await API.get(`/checkins/${state.currentChild.id}`);
    const data = res.data;
    const today = new Date().toISOString().split('T')[0];
    const checkedToday = data.last_checkin === today;

    // 构建日历
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const checkedDates = new Set(data.records.map(r => r.date));

    let calendarHtml = '';
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    weekDays.forEach(d => { calendarHtml += `<div class="calendar-header">${d}</div>`; });
    for (let i = 0; i < firstDay; i++) { calendarHtml += '<div class="calendar-day empty"></div>'; }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isChecked = checkedDates.has(dateStr);
      const isToday = dateStr === today;
      calendarHtml += `<div class="calendar-day ${isChecked ? 'checked' : ''} ${isToday ? 'today' : ''}">${d}</div>`;
    }

    container.innerHTML = `
      <div class="page-content">
        <div class="checkin-hero">
          <div class="checkin-circle ${checkedToday ? 'checked' : ''}">
            <div class="checkin-days">${data.checkin_days || 0}</div>
            <div class="checkin-label">${checkedToday ? '今日已打卡' : '天'}</div>
          </div>
          <div style="font-size:14px;color:var(--text-2);margin-bottom:16px">
            ${checkedToday ? '✅ 今天已打卡，继续保持！' : '坚持每日练字打卡，养成好习惯'}
          </div>
          <button class="btn ${checkedToday ? 'btn-outline' : 'btn-primary'} checkin-btn" ${checkedToday ? 'disabled' : ''} onclick="doCheckin()">
            ${checkedToday ? '今日已打卡' : '立即打卡 +1分'}
          </button>
        </div>
        <div class="checkin-calendar">
          <div class="card-title" style="text-align:center;margin-bottom:12px">${year}年${month + 1}月打卡日历</div>
          <div class="calendar-grid">${calendarHtml}</div>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-text">${e.message}</div></div>`;
  }
}

async function doCheckin() {
  if (!state.currentChild) return;
  try {
    showLoading('打卡中...');
    const res = await API.post('/checkin', { child_id: state.currentChild.id });
    hideLoading();
    if (res.code === 0) {
      showToast('打卡成功！+1分');
      renderCheckinPage();
    } else {
      showToast(res.message);
    }
  } catch (e) {
    hideLoading();
    showToast(e.message);
  }
}

// ========== 个人中心 ==========
function renderProfilePage() {
  if (state.sessionType === 'student') return renderStudentProfilePage();
  return renderParentProfilePage();
}

// --- 学生版个人中心（展示注册信息） ---
function renderStudentProfilePage() {
  const container = document.getElementById('page-container');
  const child = state.currentChild;
  if (!child) {
    container.innerHTML = renderNoChildHint();
    return;
  }
  const genderText = child.gender === 'female' ? '女' : (child.gender === 'male' ? '男' : '未填写');
  const ageText = child.birth_date ? calcAge(child.birth_date) : '未填写';

  container.innerHTML = `
    <div class="page-content">
      <div class="profile-header">
        <div class="profile-avatar">${child.gender === 'female' ? '👧' : '👦'}</div>
        <div class="profile-name">${child.name}</div>
        <div class="profile-grade">${getGradeLabel(child.grade)} | 积分：${child.total_score || 0}</div>
      </div>

      <div class="section-title">我的注册信息</div>
      <div class="card">
        <div class="report-stat-row"><span>姓名</span><span class="font-bold">${child.name}</span></div>
        <div class="report-stat-row"><span>性别</span><span>${genderText}</span></div>
        <div class="report-stat-row"><span>出生年月日</span><span>${child.birth_date || '未填写'}</span></div>
        <div class="report-stat-row"><span>年龄</span><span>${ageText}</span></div>
        <div class="report-stat-row"><span>年级</span><span>${getGradeLabel(child.grade)}</span></div>
        <div class="report-stat-row"><span>学号</span><span>${child.student_code || '--'}</span></div>
      </div>

      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-num">${child.total_score || 0}</div>
          <div class="profile-stat-label">成长积分</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-num">${child.checkin_days || 0}</div>
          <div class="profile-stat-label">打卡天数</div>
        </div>
      </div>
      <div class="menu-list">
        <div class="menu-item" onclick="navigateTo('weakchars')">
          <div class="menu-icon" style="background:#fff1f0">📖</div>
          <div class="menu-label">个人薄弱汉字本</div>
          <div class="menu-arrow">›</div>
        </div>
        <div class="menu-item" onclick="navigateTo('honors')">
          <div class="menu-icon" style="background:#fff7e6">🏆</div>
          <div class="menu-label">荣誉成就</div>
          <div class="menu-arrow">›</div>
        </div>
        <div class="menu-item" onclick="navigateTo('scorelog')">
          <div class="menu-icon" style="background:#f6ffed">💰</div>
          <div class="menu-label">积分明细</div>
          <div class="menu-arrow">›</div>
        </div>
        <div class="menu-item" onclick="navigateTo('monthly')">
          <div class="menu-icon" style="background:#f9f0ff">📊</div>
          <div class="menu-label">月度成长报告</div>
          <div class="menu-arrow">›</div>
        </div>
      </div>
      <div class="menu-list">
        <div class="menu-item">
          <div class="menu-icon" style="background:#f0f0f0">🔒</div>
          <div class="menu-label">所有记录不可删除</div>
        </div>
        <div class="menu-item" onclick="logout()">
          <div class="menu-icon" style="background:#fff1f0">🚪</div>
          <div class="menu-label">退出登录</div>
          <div class="menu-arrow">›</div>
        </div>
      </div>
      <div style="text-align:center;padding:20px;color:var(--text-4);font-size:12px">
        书写智能评价 · 学生端 v2.0<br>家长可全程查看你的书写记录
      </div>
    </div>
  `;
}

// 根据出生年月日计算年龄
function calcAge(birthDate) {
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '未填写';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 130 ? `${age}岁` : '未填写';
}

// --- 家长版个人中心 ---
function renderParentProfilePage() {
  const container = document.getElementById('page-container');
  const child = state.currentChild;

  container.innerHTML = `
    <div class="page-content">
      <div class="profile-header">
        <div class="profile-avatar">${child ? (child.gender === 'female' ? '👧' : '👦') : '👤'}</div>
        <div class="profile-name">${child ? child.name : '未添加孩子'}</div>
        ${child ? `<div class="profile-grade">${getGradeLabel(child.grade)}${child.birth_date ? ' | ' + child.birth_date : ''} | 积分：${child.total_score || 0}</div>` : '<div class="profile-grade">点击下方添加孩子档案</div>'}
      </div>
      ${child ? `
        <div class="profile-stats">
          <div class="profile-stat">
            <div class="profile-stat-num">${child.total_score || 0}</div>
            <div class="profile-stat-label">成长积分</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-num">${child.checkin_days || 0}</div>
            <div class="profile-stat-label">打卡天数</div>
          </div>
        </div>
      ` : ''}
      <div class="menu-list">
        <div class="menu-item" onclick="navigateTo('addchild')">
          <div class="menu-icon" style="background:#e8f1fb">➕</div>
          <div class="menu-label">添加 / 管理孩子档案</div>
          <div class="menu-arrow">›</div>
        </div>
        <div class="menu-item" onclick="showChildSwitcher()">
          <div class="menu-icon" style="background:#e8f1fb">🔄</div>
          <div class="menu-label">切换孩子</div>
          <div class="menu-arrow">›</div>
        </div>
        ${child ? `
          <div class="menu-item" onclick="showStudentAccountModal()">
            <div class="menu-icon" style="background:#f6ffed">🎓</div>
            <div class="menu-label">学生端登录信息</div>
            <div class="menu-arrow">›</div>
          </div>
          <div class="menu-item" onclick="navigateTo('monthly')">
            <div class="menu-icon" style="background:#f9f0ff">📊</div>
            <div class="menu-label">月度成长报告</div>
            <div class="menu-arrow">›</div>
          </div>
        ` : ''}
      </div>
      <div class="menu-list">
        <div class="menu-item">
          <div class="menu-icon" style="background:#f0f0f0">🔒</div>
          <div class="menu-label">学生记录不可删除</div>
        </div>
        <div class="menu-item" onclick="logout()">
          <div class="menu-icon" style="background:#fff1f0">🚪</div>
          <div class="menu-label">退出登录</div>
          <div class="menu-arrow">›</div>
        </div>
      </div>
      <div style="text-align:center;padding:20px;color:var(--text-4);font-size:12px">
        书写智能评价 · 家长端 v2.0<br>学生提交记录 100% 实时同步可见
      </div>
    </div>
  `;
}

// --- 学生端登录信息弹窗（家长查看） ---
function showStudentAccountModal() {
  const child = state.currentChild;
  if (!child) return;
  const html = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title">学生端登录信息</div>
        <div class="modal-close" onclick="closeModal()">✕</div>
      </div>
      <div class="modal-section">
        <p style="font-size:13px;color:var(--text-3);line-height:1.6;margin-bottom:12px">
          将以下登录信息告知孩子，孩子即可在「学生端App」中独立登录使用。<br>
          学生提交的所有检测记录会自动同步到你的家长端。
        </p>
        <div class="card" style="background:#f9f9f9">
          <div class="report-stat-row"><span>学生姓名</span><span class="font-bold">${child.name}</span></div>
          <div class="report-stat-row"><span>登录学号</span><span class="font-bold" style="color:var(--primary)">${child.student_code || '--'}</span></div>
          <div class="report-stat-row"><span>登录密码</span><span class="font-bold">${child.student_password || '--'}</span></div>
        </div>
        <p style="font-size:12px;color:var(--warning);margin-top:12px">⚠️ 密码可在「管理孩子档案」中修改</p>
      </div>
      <button class="btn btn-primary btn-block btn-lg" onclick="closeModal()">知道了</button>
    </div>
  `;
  showModal(html);
}

// ========== 薄弱汉字本 ==========
async function renderWeakCharsPage() {
  const container = document.getElementById('page-container');
  if (!state.currentChild) { container.innerHTML = renderNoChildHint(); return; }
  try {
    const res = await API.get(`/weak-chars/${state.currentChild.id}`);
    const chars = res.data;
    container.innerHTML = `
      <div class="page-content">
        <div class="section-title">个人薄弱汉字本</div>
        <p style="font-size:13px;color:var(--text-3);padding:0 4px 12px">系统自动汇总所有检测中识别到的薄弱汉字</p>
        ${chars.length === 0 ? renderEmpty('暂无薄弱汉字', '完成检测后系统会自动汇总') : `
          <div class="weak-char-list">
            ${chars.map(c => `
              <div class="weak-char-item">
                <div class="weak-char-text">${c.char}</div>
                <div class="weak-char-count">出现${c.count}次</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-text">${e.message}</div></div>`;
  }
}

// ========== 荣誉成就 ==========
async function renderHonorsPage() {
  const container = document.getElementById('page-container');
  if (!state.currentChild) { container.innerHTML = renderNoChildHint(); return; }
  try {
    const res = await API.get(`/honors/${state.currentChild.id}`);
    const honors = res.data;
    container.innerHTML = `
      <div class="page-content">
        <div class="section-title">🏆 荣誉成就</div>
        <div class="honor-grid">
          ${honors.map(h => `
            <div class="honor-card ${h.unlocked ? '' : 'locked'}">
              <div class="honor-icon">${h.unlocked ? getHonorIcon(h.icon) : '🔒'}</div>
              <div class="honor-name">${h.name}</div>
              <div class="honor-desc">${h.desc}</div>
              <div class="honor-progress">${h.progress}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-text">${e.message}</div></div>`;
  }
}

function getHonorIcon(name) {
  const icons = { star: '⭐', fire: '🔥', calendar: '📅', pen: '✒️', trophy: '🏆', crown: '👑', medal: '🥇', 'star-fill': '🌟' };
  return icons[name] || '🏅';
}

// ========== 积分明细 ==========
async function renderScoreLogPage() {
  const container = document.getElementById('page-container');
  if (!state.currentChild) { container.innerHTML = renderNoChildHint(); return; }
  try {
    const res = await API.get(`/score-logs/${state.currentChild.id}`);
    const logs = res.data;
    container.innerHTML = `
      <div class="page-content">
        <div class="section-title">积分明细</div>
        <div class="card text-center mb-12">
          <div style="font-size:13px;color:var(--text-3)">当前总积分</div>
          <div style="font-size:36px;font-weight:700;color:var(--primary)">${state.currentChild.total_score || 0}</div>
        </div>
        ${logs.length === 0 ? renderEmpty('暂无积分记录', '通过打卡和家长评价获取积分') : `
          <div class="score-log-list">
            ${logs.map(log => `
              <div class="score-log-item">
                <div>
                  <div class="score-log-reason">${log.reason}</div>
                  <div class="score-log-time">${formatDate(log.created_at)}</div>
                </div>
                <div class="score-log-change ${log.change >= 0 ? 'plus' : 'minus'}">${log.change >= 0 ? '+' : ''}${log.change}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-text">${e.message}</div></div>`;
  }
}

// ========== 家长端 - 追溯页 ==========
async function renderTracePage() {
  const container = document.getElementById('page-container');
  if (!state.currentChild) { container.innerHTML = renderNoChildHint(); return; }
  showLoading('加载追溯记录...');
  try {
    const res = await API.get(`/records?child_id=${state.currentChild.id}`);
    const records = res.data.list;
    hideLoading();

    let filterHtml = `
      <div class="material-tabs" style="padding:12px">
        <div class="material-tab active" onclick="filterTrace(this,'')">全部 (${records.length})</div>
        <div class="material-tab" onclick="filterTrace(this,'homework')">作业 (${records.filter(r=>r.submit_type==='homework').length})</div>
        <div class="material-tab" onclick="filterTrace(this,'practice')">练字 (${records.filter(r=>r.submit_type==='practice').length})</div>
        <div class="material-tab" onclick="filterTrace(this,'exam')">考核 (${records.filter(r=>r.submit_type==='exam').length})</div>
      </div>
    `;

    container.innerHTML = `
      <div class="page-content">
        <div class="section-title">全程追溯</div>
        <div class="lock-notice">学生所有操作记录100%可见、可查、可追溯</div>
        ${filterHtml}
        <div id="trace-list">
          ${records.length === 0 ? renderEmpty('暂无记录', '学生提交后将自动显示在此') : records.map(r => renderTraceItem(r)).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    hideLoading();
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-text">${e.message}</div></div>`;
  }
}

function renderTraceItem(r) {
  const thumb = r.image_urls && r.image_urls[0] ? r.image_urls[0] : '';
  const stars = r.parent_star ? '★'.repeat(r.parent_star) + '☆'.repeat(5 - r.parent_star) : '';
  return `
    <div class="record-item" onclick="navigateTo('recordDetail',{id:${r.id}})">
      <div class="record-item-header">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="record-type-tag ${getTypeClass(r.submit_type)}">${getTypeLabel(r.submit_type)}</span>
          <span style="font-size:11px;color:var(--text-4)">${r.submit_role === 'student' ? '学生提交' : '家长提交'}</span>
        </div>
        <span class="record-time">${formatDate(r.created_at)}</span>
      </div>
      <div class="record-body">
        <div class="record-thumb">${thumb ? `<img src="${thumb}">` : '📝'}</div>
        <div class="record-info">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="record-score" style="color:${getScoreColor(r.ai_score)}">${r.ai_score}<small>/100</small></div>
            ${r.parent_score ? `<div style="font-size:13px;color:var(--text-3)">家长：${r.parent_score}分</div>` : ''}
          </div>
          <div class="record-attitude">${r.attitude || ''}</div>
          <div class="record-status">
            ${r.evaluated ? `<span class="status-evaluated">✓ 已评价</span>${stars ? `<span class="star-display">${stars}</span>` : ''}` : `<span class="status-pending">⏳ 待评价</span>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

let currentTraceFilter = '';
function filterTrace(el, type) {
  el.parentElement.querySelectorAll('.material-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentTraceFilter = type;
  // Re-fetch and filter
  renderTracePage().then(() => {
    if (type) {
      document.querySelectorAll('#trace-list .record-item').forEach(item => {
        // Simple filter - in production would use API filter
      });
    }
  });
}

// ========== 家长端 - 待评价页 ==========
async function renderPendingPage() {
  const container = document.getElementById('page-container');
  if (!state.currentChild) { container.innerHTML = renderNoChildHint(); return; }
  try {
    const res = await API.get(`/records/pending?child_id=${state.currentChild.id}`);
    const records = res.data;
    container.innerHTML = `
      <div class="page-content">
        <div class="section-title">待评价记录</div>
        <div class="lock-notice">每条学生记录家长均可独立打分、评星级、写评语</div>
        ${records.length === 0 ? renderEmpty('全部已评价', '暂无待评价记录') : `
          <div class="record-list">
            ${records.map(r => `
              <div class="record-item">
                <div class="record-item-header">
                  <span class="record-type-tag ${getTypeClass(r.submit_type)}">${getTypeLabel(r.submit_type)}</span>
                  <span class="record-time">${formatDateShort(r.created_at)}</span>
                </div>
                <div class="record-body">
                  <div class="record-thumb">${r.image_urls[0] ? `<img src="${r.image_urls[0]}" onclick="openPreview('${r.image_urls[0]}')">` : '📝'}</div>
                  <div class="record-info">
                    <div class="record-score" style="color:${getScoreColor(r.ai_score)}">${r.ai_score}<small>/100</small></div>
                    <div class="record-attitude">${r.attitude || ''}</div>
                    <button class="btn btn-primary btn-sm mt-8" onclick="showEvaluateModal(${r.id})">立即评价</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-text">${e.message}</div></div>`;
  }
}

// ========== 家长评价弹窗 ==========
async function showEvaluateModal(recordId) {
  // 加载标签
  if (!state.tags) {
    try {
      const tagRes = await API.get('/tags');
      state.tags = tagRes.data;
      state.tags.reward.forEach(t => REWARD_TAG_MAP[t.key] = { ...t, type: 'reward' });
      state.tags.punish.forEach(t => REWARD_TAG_MAP[t.key] = { ...t, type: 'punish' });
    } catch (e) { /* ignore */ }
  }

  // 获取记录详情
  const res = await API.get(`/records/${recordId}`);
  const r = res.data;

  const html = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title">家长人工评价</div>
        <div class="modal-close" onclick="closeModal()">✕</div>
      </div>

      <div style="background:#f9f9f9;border-radius:8px;padding:10px;margin-bottom:16px">
        <div style="font-size:12px;color:var(--text-3)">AI评分：${r.ai_score}分 | ${getTypeLabel(r.submit_type)} | ${formatDateShort(r.created_at)}</div>
        ${r.image_urls[0] ? `<img src="${r.image_urls[0]}" style="width:100%;border-radius:8px;margin-top:8px" onclick="openPreview('${r.image_urls[0]}')">` : ''}
      </div>

      <div class="modal-section">
        <div class="modal-label">1-5星星级评价</div>
        <div class="star-rating" id="star-rating">
          ${[1,2,3,4,5].map(n => `<span class="star-item" data-star="${n}" onclick="selectStar(${n})">★</span>`).join('')}
        </div>
        <div style="font-size:12px;color:var(--text-3);margin-top:4px" id="star-tip">点击星星评价（5星=+5分, 4星=+3分, 3星=+1分, 2星=0分, 1星=-2分）</div>
      </div>

      <div class="modal-section">
        <div class="modal-label">家长人工打分（0-100）</div>
        <div class="score-input">
          <input type="number" id="parent-score" min="0" max="100" value="${r.ai_score}" />
          <span>分</span>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-label">奖惩标签</div>
        <div class="tag-group">
          <div style="font-size:11px;color:var(--success);width:100%;margin-bottom:4px">奖励标签：</div>
          ${state.tags.reward.map(t => `<div class="tag-chip reward" data-tag="${t.key}" onclick="selectTag(this,'reward')">${t.label}</div>`).join('')}
          <div style="font-size:11px;color:var(--danger);width:100%;margin:8px 0 4px">督促整改标签：</div>
          ${state.tags.punish.map(t => `<div class="tag-chip punish" data-tag="${t.key}" onclick="selectTag(this,'punish')">${t.label}</div>`).join('')}
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-label">家长评语</div>
        <textarea class="comment-input" id="parent-comment" placeholder="写一段评语鼓励或督促孩子..."></textarea>
      </div>

      <button class="btn btn-primary btn-block btn-lg" onclick="submitEvaluate(${recordId})">提交评价</button>
    </div>
  `;
  showModal(html);
}

let selectedStar = 0;
let selectedTag = '';

function selectStar(n) {
  selectedStar = n;
  document.querySelectorAll('#star-rating .star-item').forEach(el => {
    const s = parseInt(el.dataset.star);
    el.classList.toggle('active', s <= n);
  });
}

function selectTag(el, type) {
  document.querySelectorAll('.tag-chip').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
  selectedTag = el.dataset.tag;
}

async function submitEvaluate(recordId) {
  if (selectedStar === 0) {
    showToast('请选择星级');
    return;
  }
  const score = parseInt(document.getElementById('parent-score').value);
  if (isNaN(score) || score < 0 || score > 100) {
    showToast('请输入0-100的分数');
    return;
  }
  const comment = document.getElementById('parent-comment').value;

  try {
    showLoading('保存评价...');
    await API.post(`/records/${recordId}/evaluate`, {
      parent_score: score,
      parent_star: selectedStar,
      parent_comment: comment,
      parent_reward_type: selectedTag
    });
    hideLoading();
    showToast('评价已保存，积分已结算');
    closeModal();
    selectedStar = 0;
    selectedTag = '';
    renderPendingPage();
  } catch (e) {
    hideLoading();
    showToast(e.message);
  }
}

// ========== 家长端 - 统计页 ==========
async function renderStatsPage() {
  const container = document.getElementById('page-container');
  if (!state.currentChild) { container.innerHTML = renderNoChildHint(); return; }
  showLoading('加载统计数据...');
  try {
    const res = await API.get(`/stats/${state.currentChild.id}`);
    const s = res.data;
    hideLoading();

    container.innerHTML = `
      <div class="page-content">
        <div class="section-title">${s.child.name}的书写统计</div>

        <div class="stats-overview">
          <div class="stats-card">
            <div class="stats-card-label">平均AI评分</div>
            <div class="stats-card-value" style="color:${getScoreColor(s.avg_score)}">${s.avg_score || '--'}</div>
            <div class="stats-card-sub">累计${s.total_records}次检测</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-label">家长平均打分</div>
            <div class="stats-card-value" style="color:var(--purple)">${s.avg_parent_score || '--'}</div>
            <div class="stats-card-sub">平均${s.avg_star || '--'}星</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-label">本月优秀次数</div>
            <div class="stats-card-value" style="color:var(--success)">${s.excellent_count}</div>
            <div class="stats-card-sub">AI评分≥85分</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-label">本月敷衍次数</div>
            <div class="stats-card-value" style="color:var(--danger)">${s.perfunctory_count}</div>
            <div class="stats-card-sub">AI评分<60分</div>
          </div>
        </div>

        <div class="trend-chart">
          <div class="chart-title">📈 最近30天书写趋势</div>
          ${renderTrendChart(s.trend)}
        </div>

        <div class="section-title">检测类型分布</div>
        <div class="type-distribution">
          <div class="type-bar">
            <div class="type-bar-num" style="color:var(--primary)">${s.type_stats.homework}</div>
            <div class="type-bar-label">日常作业</div>
          </div>
          <div class="type-bar">
            <div class="type-bar-num" style="color:var(--success)">${s.type_stats.practice}</div>
            <div class="type-bar-label">日常练字</div>
          </div>
          <div class="type-bar">
            <div class="type-bar-num" style="color:var(--warning)">${s.type_stats.exam}</div>
            <div class="type-bar-label">模拟考核</div>
          </div>
        </div>

        <div class="section-title">评价概况</div>
        <div class="card">
          <div class="report-stat-row"><span>已评价记录</span><span>${s.evaluated_count}次</span></div>
          <div class="report-stat-row"><span>待评价记录</span><span class="text-warning">${s.pending_count}次</span></div>
          <div class="report-stat-row"><span>累计积分</span><span class="text-primary font-bold">${s.child.total_score}分</span></div>
          <div class="report-stat-row"><span>打卡天数</span><span>${s.child.checkin_days}天</span></div>
        </div>

        <div style="padding:12px 0">
          <button class="btn btn-primary btn-block" onclick="navigateTo('monthly')">查看月度成长报告</button>
        </div>
      </div>
    `;
  } catch (e) {
    hideLoading();
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-text">${e.message}</div></div>`;
  }
}

// --- 趋势图（SVG） ---
function renderTrendChart(trend) {
  const width = 380, height = 160, padding = 30;
  const validData = trend.filter(d => d.score !== null);
  if (validData.length === 0) {
    return '<div style="text-align:center;padding:40px;color:var(--text-4)">暂无数据</div>';
  }
  const maxScore = 100;
  const xStep = (width - padding * 2) / (trend.length - 1 || 1);
  const yScale = (score) => height - padding - (score / maxScore) * (height - padding * 2);

  let pathD = '';
  let dotsHtml = '';
  trend.forEach((d, i) => {
    const x = padding + i * xStep;
    if (d.score !== null) {
      const y = yScale(d.score);
      pathD += (pathD === '' ? 'M' : 'L') + x + ',' + y;
      dotsHtml += `<circle cx="${x}" cy="${y}" r="3" fill="${getScoreColor(d.score)}"/>`;
    }
  });

  const gridLines = [0, 25, 50, 75, 100].map(v => {
    const y = yScale(v);
    return `<line x1="${padding}" y1="${y}" x2="${width-padding}" y2="${y}" stroke="#f0f0f0" stroke-width="1"/><text x="${padding-4}" y="${y+3}" text-anchor="end" font-size="9" fill="#bbb">${v}</text>`;
  }).join('');

  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    ${gridLines}
    <path d="${pathD}" fill="none" stroke="#4a90d9" stroke-width="2"/>
    ${dotsHtml}
  </svg>`;
}

// ========== 月度报告 ==========
async function renderMonthlyReportPage() {
  const container = document.getElementById('page-container');
  if (!state.currentChild) { container.innerHTML = renderNoChildHint(); return; }
  const month = new Date().toISOString().slice(0, 7);
  showLoading('生成月度报告...');
  try {
    const res = await API.get(`/monthly-report/${state.currentChild.id}?month=${month}`);
    const r = res.data;
    hideLoading();
    if (!r) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">本月暂无记录</div></div></div>`;
      return;
    }
    container.innerHTML = `
      <div class="page-content">
        <div class="section-title">${r.month}月度成长报告</div>
        <div class="report-summary">
          <h3>${r.child_name}的${r.month}月总结</h3>
          <p>${r.summary}</p>
        </div>
        <div class="report-section">
          <h4>📊 基础数据</h4>
          <div class="report-stat-row"><span>检测次数</span><span>${r.total_records}次</span></div>
          <div class="report-stat-row"><span>平均分</span><span class="font-bold" style="color:${getScoreColor(r.avg_score)}">${r.avg_score}分</span></div>
          <div class="report-stat-row"><span>最高分</span><span class="text-success">${r.max_score}分</span></div>
          <div class="report-stat-row"><span>最低分</span><span class="text-danger">${r.min_score}分</span></div>
          <div class="report-stat-row"><span>累计积分</span><span class="text-primary">${r.total_score}分</span></div>
          <div class="report-stat-row"><span>打卡天数</span><span>${r.checkin_days}天</span></div>
        </div>
        <div class="report-section">
          <h4>📐 四维度平均</h4>
          <div class="report-stat-row"><span>笔画规范</span><span>${r.dim_avg.stroke}%</span></div>
          <div class="report-stat-row"><span>间架结构</span><span>${r.dim_avg.structure}%</span></div>
          <div class="report-stat-row"><span>卷面习惯</span><span>${r.dim_avg.habit}%</span></div>
          <div class="report-stat-row"><span>字迹清晰度</span><span>${r.dim_avg.clarity}%</span></div>
        </div>
        <div class="report-section">
          <h4>📝 类型分布</h4>
          <div class="report-stat-row"><span>日常作业</span><span>${r.type_count.homework}次</span></div>
          <div class="report-stat-row"><span>日常练字</span><span>${r.type_count.practice}次</span></div>
          <div class="report-stat-row"><span>模拟考核</span><span>${r.type_count.exam}次</span></div>
        </div>
        ${r.top_weak_chars.length > 0 ? `
          <div class="report-section">
            <h4>📖 高频薄弱字Top10</h4>
            <div class="weak-char-list" style="padding:0">
              ${r.top_weak_chars.map(c => `<div class="weak-char-item"><div class="weak-char-text">${c.char}</div><div class="weak-char-count">${c.count}次</div></div>`).join('')}
            </div>
          </div>
        ` : ''}
        <div class="report-section">
          <h4>⭐ 家长评价分布</h4>
          <div class="report-stat-row"><span>5星评价</span><span>${r.star_distribution[5]}次</span></div>
          <div class="report-stat-row"><span>4星评价</span><span>${r.star_distribution[4]}次</span></div>
          <div class="report-stat-row"><span>3星评价</span><span>${r.star_distribution[3]}次</span></div>
          <div class="report-stat-row"><span>2星评价</span><span>${r.star_distribution[2]}次</span></div>
          <div class="report-stat-row"><span>1星评价</span><span>${r.star_distribution[1]}次</span></div>
        </div>
        <div class="export-bar">
          <button class="btn btn-primary btn-block" onclick="exportReport()">📥 导出PDF报告</button>
        </div>
      </div>
    `;
  } catch (e) {
    hideLoading();
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-text">${e.message}</div></div>`;
  }
}

function exportReport() {
  showToast('PDF报告已生成，请在下载列表查看');
  // 实际生产中调用后端PDF导出接口
  window.print();
}

// ========== 添加/管理孩子页面（含学生注册信息） ==========
function renderAddChildPage() {
  const container = document.getElementById('page-container');
  const grades = [1,2,3,4,5,6,7,8,9];
  container.innerHTML = `
    <div class="page-content">
      <div class="section-title">添加孩子档案</div>
      <div class="card">
        <div class="modal-section">
          <div class="modal-label">孩子姓名</div>
          <div class="input-group">
            <input type="text" id="child-name" placeholder="请输入孩子姓名" style="width:100%;height:44px;padding:0 12px;border:1px solid var(--border);border-radius:8px;font-size:15px">
          </div>
        </div>
        <div class="modal-section">
          <div class="modal-label">性别</div>
          <div class="material-tabs" id="gender-tabs">
            <div class="material-tab active" onclick="selectGender(this,'male')">👦 男</div>
            <div class="material-tab" onclick="selectGender(this,'female')">👧 女</div>
          </div>
        </div>
        <div class="modal-section">
          <div class="modal-label">出生年月日</div>
          <div class="input-group">
            <input type="date" id="child-birth" style="width:100%;height:44px;padding:0 12px;border:1px solid var(--border);border-radius:8px;font-size:15px">
          </div>
        </div>
        <div class="modal-section">
          <div class="modal-label">年级</div>
          <div class="material-tabs">
            ${grades.map(g => `<div class="material-tab" onclick="selectGrade(this,${g})">${getGradeLabel(g)}</div>`).join('')}
          </div>
          <div id="selected-grade" style="font-size:13px;color:var(--text-3);margin-top:4px">请选择年级</div>
        </div>
        <div class="modal-section">
          <div class="modal-label">学生端登录学号（选填，留空自动生成）</div>
          <div class="input-group">
            <input type="text" id="child-code" placeholder="例如：xiaoming01" style="width:100%;height:44px;padding:0 12px;border:1px solid var(--border);border-radius:8px;font-size:15px">
          </div>
        </div>
        <div class="modal-section">
          <div class="modal-label">学生端登录密码（选填，默认 123456）</div>
          <div class="input-group">
            <input type="text" id="child-pwd" placeholder="学生端App登录密码" style="width:100%;height:44px;padding:0 12px;border:1px solid var(--border);border-radius:8px;font-size:15px">
          </div>
        </div>
        <div class="lock-notice" style="margin:12px 0">孩子可在「学生端App」用学号+密码独立登录，提交记录自动同步到家长端</div>
        <button class="btn btn-primary btn-block btn-lg mt-12" onclick="addChild()">添加档案</button>
      </div>
      ${state.children.length > 0 ? `
        <div class="section-title">已添加的孩子</div>
        ${state.children.map(c => `
          <div class="card card-row">
            <div style="display:flex;align-items:center;gap:12px">
              <span style="font-size:32px">${c.gender === 'female' ? '👧' : '👦'}</span>
              <div>
                <div class="font-bold">${c.name}</div>
                <div style="font-size:12px;color:var(--text-3)">${getGradeLabel(c.grade)}${c.birth_date ? ' | ' + c.birth_date : ''} | 积分：${c.total_score}</div>
                <div style="font-size:11px;color:var(--text-4)">学号：${c.student_code || '--'}</div>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <button class="btn btn-outline btn-sm" onclick="switchChild(${c.id})">${c.id === state.currentChild?.id ? '当前' : '切换'}</button>
              <button class="btn btn-outline btn-sm" onclick="showEditChildModal(${c.id})">编辑</button>
            </div>
          </div>
        `).join('')}
      ` : ''}
    </div>
  `;
}

let selectedGrade = 0;
let selectedGender = 'male';
function selectGrade(el, grade) {
  el.parentElement.querySelectorAll('.material-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  selectedGrade = grade;
  document.getElementById('selected-grade').textContent = `已选择：${getGradeLabel(grade)}`;
}
function selectGender(el, gender) {
  document.getElementById('gender-tabs').querySelectorAll('.material-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  selectedGender = gender;
}

async function addChild() {
  const name = document.getElementById('child-name').value.trim();
  const birth = document.getElementById('child-birth').value;
  const code = document.getElementById('child-code').value.trim();
  const pwd = document.getElementById('child-pwd').value.trim();
  if (!name) { showToast('请输入孩子姓名'); return; }
  if (!selectedGrade) { showToast('请选择年级'); return; }
  try {
    showLoading('添加中...');
    const res = await API.post('/children', {
      name,
      grade: selectedGrade,
      birth_date: birth || null,
      gender: selectedGender,
      student_code: code || null,
      student_password: pwd || null
    });
    hideLoading();
    await loadChildren();
    selectedGrade = 0;
    navigateTo('addchild');
    // 展示学生端登录信息
    const child = res.data;
    showStudentAccountInfo(child);
  } catch (e) {
    hideLoading();
    showToast(e.message);
  }
}

// 添加成功后展示学生端登录信息
function showStudentAccountInfo(child) {
  const html = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title">✅ ${child.name}的档案已创建</div>
        <div class="modal-close" onclick="closeModal()">✕</div>
      </div>
      <div class="modal-section">
        <p style="font-size:13px;color:var(--text-3);line-height:1.6;margin-bottom:12px">
          孩子的学生端登录信息如下，请妥善保管并告知孩子：<br>
          在「学生端App」输入学号和密码即可独立登录，提交的所有检测记录会自动同步到家长端。
        </p>
        <div class="card" style="background:#f0f9eb">
          <div class="report-stat-row"><span>姓名</span><span class="font-bold">${child.name}</span></div>
          <div class="report-stat-row"><span>出生年月日</span><span>${child.birth_date || '未填写'}</span></div>
          <div class="report-stat-row"><span>登录学号</span><span class="font-bold" style="color:var(--primary);font-size:16px">${child.student_code}</span></div>
          <div class="report-stat-row"><span>登录密码</span><span class="font-bold" style="font-size:16px">${child.student_password}</span></div>
        </div>
      </div>
      <button class="btn btn-primary btn-block btn-lg" onclick="closeModal()">知道了</button>
    </div>
  `;
  showModal(html);
}

// 编辑孩子信息弹窗（含出生年月日、密码修改）
function showEditChildModal(childId) {
  const child = state.children.find(c => c.id === childId);
  if (!child) return;
  const html = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-title">编辑${child.name}的档案</div>
        <div class="modal-close" onclick="closeModal()">✕</div>
      </div>
      <div class="modal-section">
        <div class="modal-label">出生年月日</div>
        <div class="input-group">
          <input type="date" id="edit-birth" value="${child.birth_date || ''}" style="width:100%;height:44px;padding:0 12px;border:1px solid var(--border);border-radius:8px;font-size:15px">
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-label">学生端登录密码</div>
        <div class="input-group">
          <input type="text" id="edit-pwd" value="${child.student_password || ''}" style="width:100%;height:44px;padding:0 12px;border:1px solid var(--border);border-radius:8px;font-size:15px">
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-label">年级</div>
        <div class="input-group">
          <input type="number" id="edit-grade" min="1" max="9" value="${child.grade}" style="width:100%;height:44px;padding:0 12px;border:1px solid var(--border);border-radius:8px;font-size:15px">
        </div>
      </div>
      <button class="btn btn-primary btn-block btn-lg" onclick="saveChildEdit(${child.id})">保存修改</button>
    </div>
  `;
  showModal(html);
}

async function saveChildEdit(childId) {
  const birth = document.getElementById('edit-birth').value;
  const pwd = document.getElementById('edit-pwd').value.trim();
  const grade = parseInt(document.getElementById('edit-grade').value);
  try {
    showLoading('保存中...');
    await API.put(`/children/${childId}`, {
      birth_date: birth || null,
      student_password: pwd || '123456',
      grade: (grade >= 1 && grade <= 9) ? grade : undefined
    });
    hideLoading();
    closeModal();
    showToast('已保存');
    await loadChildren();
    navigateTo('addchild');
  } catch (e) {
    hideLoading();
    showToast(e.message);
  }
}

// ========== 孩子切换 ==========
function showChildSwitcher() {
  const html = `
    <div class="child-switch-sheet">
      <div class="modal-header">
        <div class="modal-title">切换孩子</div>
        <div class="modal-close" onclick="closeModal()">✕</div>
      </div>
      ${state.children.map(c => `
        <div class="child-switch-item ${c.id === state.currentChild?.id ? 'active' : ''}" onclick="switchChild(${c.id})">
          <span class="child-switch-avatar">${c.id === state.currentChild?.id ? '👧' : '👦'}</span>
          <div class="child-switch-info">
            <div class="child-switch-name">${c.name}</div>
            <div class="child-switch-grade">${getGradeLabel(c.grade)} | 积分：${c.total_score}</div>
          </div>
          ${c.id === state.currentChild?.id ? '<span style="color:var(--success)">✓</span>' : ''}
        </div>
      `).join('')}
      <div class="child-switch-item" onclick="closeModal();navigateTo('addchild')">
        <span class="child-switch-avatar">➕</span>
        <div class="child-switch-info">
          <div class="child-switch-name">添加新孩子</div>
        </div>
      </div>
    </div>
  `;
  showModal(html);
}

function switchChild(childId) {
  const child = state.children.find(c => c.id === childId);
  if (child) {
    state.currentChild = child;
    updateHeader();
    closeModal();
    navigateTo(state.mode === 'student' ? 'home' : 'trace');
    showToast(`已切换到${child.name}`);
  }
}

// ========== 模式切换 ==========
function switchMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  navigateTo(mode === 'student' ? 'home' : 'trace');
}

// ========== 辅助渲染 ==========
function renderEmpty(text, sub) {
  return `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">${text}</div>${sub ? `<div style="font-size:12px;color:var(--text-4);margin-top:4px">${sub}</div>` : ''}</div>`;
}

function renderNoChildHint() {
  return `<div class="page-content"><div class="empty-state"><div class="empty-icon">👶</div><div class="empty-text">请先添加孩子档案</div><button class="btn btn-primary btn-sm mt-12" onclick="navigateTo('addchild')">+ 添加孩子</button></div></div>`;
}

// ========== 事件绑定 ==========
function bindEvents() {
  // 登录按钮（学生端/家长端表单不同，按模式绑定）
  const loginBtn = document.getElementById('btn-login');
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);

  const nicknameInput = document.getElementById('login-nickname');
  if (nicknameInput) {
    nicknameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  }
  const codeInput = document.getElementById('login-code');
  if (codeInput) {
    codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  }
  const pwdInput = document.getElementById('login-pwd');
  if (pwdInput) {
    pwdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  }

  // 模式切换按钮（仅旧版合一页面存在，独立App页面已移除）
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

  // 顶部孩子切换（学生端为固定本人，家长端可切换）
  const switcher = document.getElementById('header-child-switcher');
  if (switcher) {
    switcher.addEventListener('click', () => {
      if (state.sessionType === 'student') return; // 学生端不可切换
      if (state.children.length > 0) {
        showChildSwitcher();
      } else {
        navigateTo('addchild');
      }
    });
  }
}

// ========== 初始化 ==========
bindEvents();
initServerSettingsLink();

// 自动恢复登录会话
(async function init() {
  const restored = await tryRestoreSession();
  if (restored && (APP_MODE === null || APP_MODE === state.sessionType)) {
    await enterMainApp();
  } else if (restored && APP_MODE !== state.sessionType) {
    // 会话身份与当前App不匹配（例如学生令牌打开了家长端），清除
    clearSession();
    state.user = null;
    state.studentToken = null;
    state.currentChild = null;
  }
})();
