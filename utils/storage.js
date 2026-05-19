// utils/storage.js - 本地文件存储
var fs = wx.getFileSystemManager();
var DATA_FILE = wx.env.USER_DATA_PATH + '/accounting_data.json';

function readAll() {
  try {
    var data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { records: [], categories: null };
  }
}

function writeAll(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8');
    return true;
  } catch (e) {
    console.error('写入文件失败:', e);
    return false;
  }
}

function getRecords() {
  var data = readAll();
  return data.records || [];
}

function saveRecords(records) {
  var data = readAll();
  data.records = records;
  return writeAll(data);
}

function addRecord(record) {
  var records = getRecords();
  records.push(record);
  return saveRecords(records);
}

function deleteRecord(id) {
  var records = getRecords();
  var filtered = records.filter(function(r) { return r.id !== id; });
  return saveRecords(filtered);
}

function getCategories() {
  var data = readAll();
  if (data.categories) return data.categories;
  return getDefaultCategories();
}

function getDefaultCategories() {
  return {
    expense: [
      { id: 'food', name: '餐饮', icon: '🍔', color: '#FF6B6B' },
      { id: 'transport', name: '交通', icon: '🚕', color: '#FFA502' },
      { id: 'shopping', name: '购物', icon: '🛒', color: '#FF6348' },
      { id: 'entertain', name: '娱乐', icon: '🎬', color: '#7BED9F' },
      { id: 'housing', name: '居住', icon: '🏠', color: '#70A1FF' },
      { id: 'medical', name: '医疗', icon: '💊', color: '#5352ED' },
      { id: 'education', name: '学习', icon: '📖', color: '#2ED573' },
      { id: 'other', name: '其他', icon: '📦', color: '#747D8C' }
    ],
    income: [
      { id: 'salary', name: '工资', icon: '💰', color: '#2ED573' },
      { id: 'bonus', name: '奖金', icon: '🎁', color: '#FFA502' },
      { id: 'invest', name: '投资', icon: '📈', color: '#5352ED' },
      { id: 'other_income', name: '其他', icon: '💵', color: '#70A1FF' }
    ]
  };
}

function initData() {
  var data = readAll();
  if (!data.categories) {
    data.categories = getDefaultCategories();
  }
  if (!data.records) {
    data.records = [];
  }
  writeAll(data);
  return data;
}

module.exports = {
  readAll: readAll,
  writeAll: writeAll,
  getRecords: getRecords,
  saveRecords: saveRecords,
  addRecord: addRecord,
  deleteRecord: deleteRecord,
  getCategories: getCategories,
  initData: initData
};