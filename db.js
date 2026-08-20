/**
 * 数据库层 - JSON 文件存储
 * 模拟关系型数据库，支持多表操作
 * 表结构严格按需求文档设计
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据库结构
function initDB() {
  const defaultDB = {
    // 用户表（家长主账号）
    users: [],
    // 孩子档案表
    children: [],
    // 练习记录主表 - 按需求文档完整字段
    practice_records: [],
    // 月度报告表
    monthly_reports: [],
    // 积分记录表
    score_logs: [],
    // 每日打卡记录
    checkins: [],
    // 自增ID计数器
    _seq: {
      users: 1,
      children: 1,
      practice_records: 1,
      monthly_reports: 1,
      score_logs: 1,
      checkins: 1
    }
  };

  if (!fs.existsSync(DB_FILE)) {
    saveDB(defaultDB);
    return defaultDB;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(raw);
    // 确保所有表存在
    for (const key of Object.keys(defaultDB)) {
      if (!db[key]) db[key] = defaultDB[key];
    }
    return db;
  } catch (e) {
    saveDB(defaultDB);
    return defaultDB;
  }
}

let db = initDB();

function saveDB(data) {
  const toSave = data || db;
  fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
}

function getDB() {
  return db;
}

function nextId(table) {
  db._seq[table] = (db._seq[table] || 0) + 1;
  return db._seq[table];
}

function save() {
  saveDB(db);
}

// ========== 通用CRUD ==========
function insert(table, record) {
  if (!db[table]) db[table] = [];
  record.id = nextId(table);
  record.created_at = record.created_at || new Date().toISOString();
  db[table].push(record);
  save();
  return record;
}

function update(table, id, updates) {
  const table_data = db[table] || [];
  const idx = table_data.findIndex(r => r.id === id);
  if (idx === -1) return null;
  table_data[idx] = { ...table_data[idx], ...updates };
  save();
  return table_data[idx];
}

function findById(table, id) {
  return (db[table] || []).find(r => r.id === id);
}

function findOne(table, condition) {
  return (db[table] || []).find(r => {
    return Object.keys(condition).every(k => r[k] === condition[k]);
  });
}

function findAll(table, condition) {
  if (!condition) return db[table] || [];
  return (db[table] || []).filter(r => {
    return Object.keys(condition).every(k => {
      if (Array.isArray(condition[k])) return condition[k].includes(r[k]);
      return r[k] === condition[k];
    });
  });
}

function count(table, condition) {
  return findAll(table, condition).length;
}

module.exports = {
  getDB,
  save,
  insert,
  update,
  findById,
  findOne,
  findAll,
  count,
  nextId
};
