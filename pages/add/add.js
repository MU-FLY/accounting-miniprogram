const app = getApp();

const EXPENSE_CATEGORIES = [
  { name: '餐饮', icon: '🍜', color: '#FF6B6B' },
  { name: '交通', icon: '🚗', color: '#4ECDC4' },
  { name: '购物', icon: '🛍️', color: '#45B7D1' },
  { name: '住房', icon: '🏠', color: '#96CEB4' },
  { name: '娱乐', icon: '🎮', color: '#DDA0DD' },
  { name: '医疗', icon: '💊', color: '#FF8A65' },
  { name: '教育', icon: '📚', color: '#87CEEB' },
  { name: '通讯', icon: '📱', color: '#98D8C8' },
  { name: '服饰', icon: '👔', color: '#F7DC6F' },
  { name: '美容', icon: '💄', color: '#F8C8DC' },
  { name: '社交', icon: '🤝', color: '#BB8FCE' },
  { name: '宠物', icon: '🐱', color: '#85C1E2' },
  { name: '礼金', icon: '🧧', color: '#F1948A' },
  { name: '其他', icon: '📦', color: '#AEB6BF' }
];

const INCOME_CATEGORIES = [
  { name: '工资', icon: '💵', color: '#27AE60' },
  { name: '奖金', icon: '🎁', color: '#E74C3C' },
  { name: '投资', icon: '📈', color: '#3498DB' },
  { name: '兼职', icon: '💼', color: '#9B59B6' },
  { name: '初始资金', icon: '💎', color: '#F39C12' },
  { name: '红包', icon: '🧧', color: '#E74C3C' },
  { name: '津贴', icon: '💰', color: '#27AE60' },
  { name: '其他', icon: '📦', color: '#95A5A6' }
];

Page({
  data: {
    type: 'expense',
    categories: EXPENSE_CATEGORIES,
    selectedCategory: '餐饮',
    amount: '0',
    date: '',
    note: '',
    showKeyboard: true
  },

  onLoad(options) {
    let dateStr = '';
    if (options && options.date) {
      dateStr = options.date;
    } else {
      const today = new Date();
      dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    this.setData({ date: dateStr });
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    this.setData({
      type: type,
      categories: categories,
      selectedCategory: categories[0].name
    });
  },

  selectCategory(e) {
    const categoryName = e.currentTarget.dataset.name;
    this.setData({ selectedCategory: categoryName });
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  inputNumber(e) {
    const num = e.currentTarget.dataset.num;
    let amount = this.data.amount;

    if (num === 'back') {
      amount = amount.slice(0, -1) || '0';
    } else if (num === '.') {
      if (!amount.includes('.')) {
        amount += '.';
      }
    } else if (num === 'clear') {
      amount = '0';
    } else {
      if (amount === '0') {
        amount = num;
      } else if (amount.length < 10) {
        amount += num;
      }
    }

    this.setData({ amount });
  },

  async submit() {
    const { type, selectedCategory, amount, date, note } = this.data;
    const numAmount = parseFloat(amount);

    if (numAmount <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' });
      return;
    }

    try {
      // 生成时间戳（精确到毫秒，确保唯一性）
      const dateTime = Date.now();

      console.log('提交日期:', date, '生成时间戳:', dateTime, '对应本地时间:', new Date(dateTime).toLocaleString());

      const billData = {
        type,
        category: selectedCategory,
        amount: numAmount,
        remark: note,
        date: dateTime,
        dateStr: date
      };
      
      // 保存到本地缓存
      const localBills = wx.getStorageSync('localBills') || [];
      localBills.push({
        ...billData,
        created_at: new Date().toISOString()
      });
      wx.setStorageSync('localBills', localBills);

      wx.showToast({ title: '记账成功', icon: 'success' });
      // 通知首页刷新数据
      const pages = getCurrentPages();
      const homePage = pages.find(p => p.route === 'pages/home/home');
      if (homePage && homePage.loadData) {
        homePage.loadData();
      }
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    } catch (error) {
      console.error('Submit error:', error);
      wx.showToast({ title: '记账失败', icon: 'none' });
    }
  }
});
