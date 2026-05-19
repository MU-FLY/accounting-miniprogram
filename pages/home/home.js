const app = getApp();

const CATEGORY_MAP = {
  'food': '餐饮', 'transport': '交通', 'shopping': '购物', 'housing': '住房',
  'entertainment': '娱乐', 'medical': '医疗', 'education': '教育', 'communication': '通讯',
  'clothing': '服饰', 'beauty': '美容', 'social': '社交', 'pet': '宠物',
  'gift': '礼金', 'redpacket': '红包', 'allowance': '津贴',
  'salary': '工资', 'bonus': '奖金', 'investment': '投资', 'parttime': '兼职',
  'initial': '初始资金', 'other': '其他'
};

const CATEGORY_ICONS = {
  '餐饮': '🍜', '交通': '🚗', '购物': '🛍️', '住房': '🏠', '娱乐': '🎮',
  '医疗': '💊', '教育': '📚', '通讯': '📱', '服饰': '👔', '美容': '💄',
  '社交': '🤝', '宠物': '🐱', '礼金': '🧧', '每日一攒': '💰', '其他': '📦',
  '工资': '💵', '奖金': '🎁', '投资': '📈', '兼职': '💼',
  '初始资金': '💎', '红包': '🧧', '津贴': '💰'
};

const CATEGORY_COLORS = {
  '餐饮': '#FF6B6B', '交通': '#4ECDC4', '购物': '#45B7D1', '住房': '#96CEB4',
  '娱乐': '#DDA0DD', '医疗': '#FF8A65', '教育': '#87CEEB', '通讯': '#98D8C8',
  '服饰': '#F7DC6F', '美容': '#F8C8DC', '社交': '#BB8FCE', '宠物': '#85C1E2',
  '礼金': '#F1948A', '每日一攒': '#58D68D', '其他': '#AEB6BF',
  '工资': '#27AE60', '奖金': '#E74C3C', '投资': '#3498DB', '兼职': '#9B59B6',
  '初始资金': '#F39C12', '红包': '#E74C3C', '津贴': '#27AE60'
};

Page({
  data: {
    bills: [],
    yearIncome: '0.00', yearExpense: '0.00', monthIncome: '0.00', monthExpense: '0.00',
    yearBalance: '0.00', yearBalanceClass: 'text-income', yearBalanceSign: '',
    monthBalance: '0.00', monthBalanceClass: 'text-income', monthBalanceSign: '',
    todayIncome: '0.00', todayExpense: '0.00', todayCount: 0,
    dailySaveAmount: '0.00',
    currentYear: new Date().getFullYear(), currentMonth: new Date().getMonth() + 1,
    loading: false, errorMsg: '', syncEnabled: false,
    isBatchMode: false, selectedCount: 0, isAllSelected: false
  },

  onLoad() {
    this.initAndLoad();
  },

  onShow() {
    const syncEnabled = wx.getStorageSync('syncEnabled');
    this.setData({ syncEnabled: !!syncEnabled });
    
    // 先检查并执行自动攒，再加载数据
    this.checkAutoSaveAndRefresh();
  },

  // 检查自动攒并刷新数据
  checkAutoSaveAndRefresh() {
    const autoSaveEnabled = wx.getStorageSync('autoSaveEnabled');
    if (!autoSaveEnabled) {
      this.loadDataAfterCheck();
      return;
    }
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const lastAutoSaveDate = wx.getStorageSync('lastAutoSaveDate');
    
    // 今天还没攒过，检查时间是否已过
    if (lastAutoSaveDate !== todayStr) {
      const autoSaveTime = wx.getStorageSync('autoSaveTime') || '08:30';
      const [hours, minutes] = autoSaveTime.split(':');
      const targetTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes), 0);
      
      if (today >= targetTime) {
        // 时间已过，执行自动攒（内部会刷新数据）
        this.performAutoSave();
        return;
      }
    }
    
    // 不需要自动攒，直接加载数据
    this.loadDataAfterCheck();
  },

  // 加载数据（自动攒检查完后调用）
  loadDataAfterCheck() {
    const syncEnabled = wx.getStorageSync('syncEnabled');
    syncEnabled ? this.loadData() : this.loadLocalData();
  },

  // 执行自动攒（首页版本）
  performAutoSave() {
    const autoSaveAmount = wx.getStorageSync('autoSaveAmount') || '10';
    const amount = parseFloat(autoSaveAmount);
    if (!amount || amount <= 0) return;
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const autoSaveTime = wx.getStorageSync('autoSaveTime') || '08:30';
    const [hours, minutes] = autoSaveTime.split(':');
    const billTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes), 0);
    
    const bill = {
      date: billTime.getTime(),
      amount: amount,
      category: '每日一攒',
      type: 'expense',
      remark: '自动攒',
      created_at: new Date().toISOString()
    };
    
    const localBills = wx.getStorageSync('localBills') || [];
    localBills.push(bill);
    wx.setStorageSync('localBills', localBills);
    wx.setStorageSync('lastAutoSaveDate', todayStr);
    
    console.log('首页自动攒执行成功:', amount, '账单时间:', billTime.toLocaleString());
    console.log('当前账单总数:', localBills.length);
    
    // 直接刷新页面数据
    this.loadLocalData();
  },

  loadLocalData() {
    const localBills = wx.getStorageSync('localBills') || [];
    console.log('loadLocalData 加载账单数:', localBills.length);
    if (localBills.length === 0) {
      this.setData({ bills: [], yearIncome: '0.00', yearExpense: '0.00', monthIncome: '0.00', monthExpense: '0.00', yearBalance: '0.00', monthBalance: '0.00', todayIncome: '0.00', todayExpense: '0.00', todayCount: 0 });
      return;
    }
    const now = new Date();
    const currentYear = now.getFullYear(), currentMonth = now.getMonth() + 1;
    let yearIncome = 0, yearExpense = 0, monthIncome = 0, monthExpense = 0, todayIncome = 0, todayExpense = 0, todayCount = 0;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 86400000 - 1;

    localBills.forEach(bill => {
      const billDate = Number(bill.date);
      const billYear = new Date(billDate).getFullYear(), billMonth = new Date(billDate).getMonth() + 1;
      if (billYear === currentYear) {
        bill.type === 'income' ? yearIncome += Number(bill.amount) : yearExpense += Number(bill.amount);
        if (billMonth === currentMonth) {
          bill.type === 'income' ? monthIncome += Number(bill.amount) : monthExpense += Number(bill.amount);
          if (billDate >= todayStart && billDate <= todayEnd) {
            todayCount++;
            bill.type === 'income' ? todayIncome += Number(bill.amount) : todayExpense += Number(bill.amount);
          }
        }
      }
    });

    const yearBalance = yearIncome - yearExpense;
    const monthBalance = monthIncome - monthExpense;
    const grouped = this.groupByDate(localBills);
    this.setData({
      bills: grouped,
      yearIncome: yearIncome.toFixed(2), yearExpense: yearExpense.toFixed(2),
      monthIncome: monthIncome.toFixed(2), monthExpense: monthExpense.toFixed(2),
      yearBalance: Math.abs(yearBalance).toFixed(2), yearBalanceClass: yearBalance >= 0 ? 'text-income' : 'text-expense', yearBalanceSign: yearBalance >= 0 ? '' : '-',
      monthBalance: Math.abs(monthBalance).toFixed(2), monthBalanceClass: monthBalance >= 0 ? 'text-income' : 'text-expense', monthBalanceSign: monthBalance >= 0 ? '' : '-',
      todayIncome: todayIncome.toFixed(2), todayExpense: todayExpense.toFixed(2), todayCount
    });
  },

  onPullDownRefresh() {
    const syncEnabled = wx.getStorageSync('syncEnabled');
    const loadPromise = syncEnabled ? this.loadData() : Promise.resolve(this.loadLocalData());
    loadPromise.then(() => wx.stopPullDownRefresh());
  },

  async initAndLoad() {
    try { await app.request({ url: '/init', method: 'POST', timeout: 5000 }); } catch (e) { console.log('Init check:', e.message); }
    const syncEnabled = wx.getStorageSync('syncEnabled');
    syncEnabled ? this.loadData() : this.loadLocalData();
  },

  getDateRange() {
    const { currentYear, currentMonth } = this.data;
    const startDate = Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0);
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const endDate = Date.UTC(currentYear, currentMonth - 1, lastDay, 23, 59, 59, 999);
    return { startDate, endDate };
  },

  getYearRange() {
    const { currentYear } = this.data;
    return { startDate: Date.UTC(currentYear, 0, 1, 0, 0, 0), endDate: Date.UTC(currentYear, 11, 31, 23, 59, 59, 999) };
  },

  loadData() {
    return new Promise(async (resolve, reject) => {
      this.setData({ loading: true, errorMsg: '' });
      try {
        const { startDate, endDate } = this.getDateRange();
        const yearRange = this.getYearRange();
        const syncEnabled = wx.getStorageSync('syncEnabled');
        let monthRes, yearRes, monthSummaryRes;

        if (syncEnabled) {
          try { monthRes = await app.request({ url: `/bills?startDate=${startDate}&endDate=${endDate}&pageSize=1000`, timeout: 8000 }); } catch (e) { monthRes = { data: { bills: [] } }; }
          try { yearRes = await app.request({ url: `/bills/summary?startDate=${yearRange.startDate}&endDate=${yearRange.endDate}`, timeout: 8000 }); } catch (e) { yearRes = { data: { totalIncome: 0, totalExpense: 0 } }; }
          try { monthSummaryRes = await app.request({ url: `/bills/summary?startDate=${startDate}&endDate=${endDate}`, timeout: 8000 }); } catch (e) { monthSummaryRes = { data: { totalIncome: 0, totalExpense: 0 } }; }
          
          // 同步模式下也要合并本地新添加的账单
          const localBills = wx.getStorageSync('localBills') || [];
          const cloudBills = monthRes.data?.bills || [];
          const cloudDates = new Set(cloudBills.map(b => b.date));
          const newLocalBills = localBills.filter(b => !cloudDates.has(b.date));
          if (newLocalBills.length > 0) {
            monthRes.data.bills = [...cloudBills, ...newLocalBills];
          }
        } else {
          // 修复：本地模式时正确计算统计数据
          const localBills = wx.getStorageSync('localBills') || [];
          monthRes = { data: { bills: localBills } };
          
          // 计算年度汇总
          let yearIncome = 0, yearExpense = 0;
          let monthIncome = 0, monthExpense = 0;
          const currentYear = this.data.currentYear;
          const currentMonth = this.data.currentMonth;
          
          localBills.forEach(bill => {
            const billDate = Number(bill.date);
            const billYear = new Date(billDate).getFullYear();
            const billMonth = new Date(billDate).getMonth() + 1;
            if (billYear === currentYear) {
              if (bill.type === 'income') {
                yearIncome += Number(bill.amount);
              } else {
                yearExpense += Number(bill.amount);
              }
              if (billMonth === currentMonth) {
                if (bill.type === 'income') {
                  monthIncome += Number(bill.amount);
                } else {
                  monthExpense += Number(bill.amount);
                }
              }
            }
          });
          
          yearRes = { data: { totalIncome: yearIncome, totalExpense: yearExpense } };
          monthSummaryRes = { data: { totalIncome: monthIncome, totalExpense: monthExpense } };
        }

        const bills = monthRes.data?.bills || [];
        const yearSummary = yearRes.data || { totalIncome: 0, totalExpense: 0 };
        const monthSummary = monthSummaryRes.data || { totalIncome: 0, totalExpense: 0 };

        const yearIncome = Number(yearSummary.totalIncome || 0), yearExpense = Number(yearSummary.totalExpense || 0);
        const monthIncome = Number(monthSummary.totalIncome || 0), monthExpense = Number(monthSummary.totalExpense || 0);
        const yearBalance = yearIncome - yearExpense, monthBalance = monthIncome - monthExpense;

        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const todayEnd = todayStart + 86400000 - 1;
        let todayIncome = 0, todayExpense = 0, todayCount = 0;
        bills.forEach(bill => {
          const billDate = Number(bill.date);
          if (billDate >= todayStart && billDate <= todayEnd) {
            todayCount++;
            bill.type === 'income' ? todayIncome += Number(bill.amount) : todayExpense += Number(bill.amount);
          }
        });

        bills.sort((a, b) => Number(b.date) - Number(a.date));
        const grouped = this.groupByDate(bills);

        // 计算每日一攒金额
        let dailySaveAmount = 0;
        bills.forEach(bill => {
          if (bill.category === '每日一攒' || bill.category === 'dailysave') {
            dailySaveAmount += Number(bill.amount);
          }
        });

        this.setData({
          bills: grouped,
          yearIncome: yearIncome.toFixed(2), yearExpense: yearExpense.toFixed(2),
          monthIncome: monthIncome.toFixed(2), monthExpense: monthExpense.toFixed(2),
          yearBalance: Math.abs(yearBalance).toFixed(2), yearBalanceClass: yearBalance >= 0 ? 'text-income' : 'text-expense', yearBalanceSign: yearBalance >= 0 ? '' : '-',
          monthBalance: Math.abs(monthBalance).toFixed(2), monthBalanceClass: monthBalance >= 0 ? 'text-income' : 'text-expense', monthBalanceSign: monthBalance >= 0 ? '' : '-',
          todayIncome: todayIncome.toFixed(2), todayExpense: todayExpense.toFixed(2), todayCount,
          dailySaveAmount: dailySaveAmount.toFixed(2), loading: false
        });
        resolve();
      } catch (error) {
        console.error('Load data error:', error);
        this.setData({ loading: false, errorMsg: '加载失败: ' + error.message });
        wx.showToast({ title: '加载失败', icon: 'none' });
        reject(error);
      }
    });
  },

  getCategoryName(category) { return CATEGORY_MAP[category] || category; },
  getCategoryIcon(category) { return CATEGORY_ICONS[this.getCategoryName(category)] || '📦'; },
  getCategoryColor(category) { return CATEGORY_COLORS[this.getCategoryName(category)] || '#AEB6BF'; },
  
  formatDate(timestamp) {
    const date = new Date(Number(timestamp));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  groupByDate(bills) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const groups = {};

    bills.forEach(bill => {
      const dateStr = this.formatDate(bill.date);
      if (!groups[dateStr]) {
        groups[dateStr] = { date: dateStr, dateStr: `${dateStr.slice(5, 7)}月${dateStr.slice(8, 10)}日`, isToday: dateStr === todayStr, items: [], dayIncome: 0, dayExpense: 0, dayIncomeStr: '0.00', dayExpenseStr: '0.00' };
      }
      const amount = Number(bill.amount);
      const hasRemark = bill.remark && bill.remark.trim();
      const dateObj = new Date(Number(bill.date));
      const fullDateTime = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
      const categoryColor = this.getCategoryColor(bill.category);
      groups[dateStr].items.push({
        ...bill, selected: false, icon: this.getCategoryIcon(bill.category),
        iconBg: categoryColor + '20',
        iconColor: categoryColor,
        categoryName: this.getCategoryName(bill.category), amountStr: amount.toFixed(2),
        amountClass: bill.type === 'income' ? 'text-income' : 'text-expense', amountSign: bill.type === 'income' ? '+' : '-',
        displayDate: dateStr,
        displayTime: fullDateTime,
        displayRemark: hasRemark ? bill.remark.trim() : '',
        sortTime: Number(bill.date)
      });
      bill.type === 'income' ? groups[dateStr].dayIncome += amount : groups[dateStr].dayExpense += amount;
    });

    Object.values(groups).forEach(g => {
      g.dayIncomeStr = g.dayIncome.toFixed(2);
      g.dayExpenseStr = g.dayExpense.toFixed(2);
      // 同一天内按创建时间降序排序（最新的在前）
      g.items.sort((a, b) => b.sortTime - a.sortTime);
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    this.setData({ currentYear, currentMonth }, () => this.loadData());
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    this.setData({ currentYear, currentMonth }, () => this.loadData());
  },

  goAdd() {
    const { currentYear, currentMonth } = this.data;
    const day = String(new Date().getDate()).padStart(2, '0');
    wx.navigateTo({ url: `/pages/add/add?date=${currentYear}-${String(currentMonth).padStart(2, '0')}-${day}` });
  },

  goStats() { wx.switchTab({ url: '/pages/stats/stats' }); },

  // 长按进入批量模式
  onBillLongPress(e) {
    const billDate = String(e.currentTarget.dataset.date);
    const bills = this.data.bills;
    let hasSelection = false;
    
    bills.forEach(group => {
      group.items.forEach(item => {
        if (String(item.date) === billDate) {
          item.selected = !item.selected;
        }
        if (item.selected) hasSelection = true;
      });
    });

    // 如果没有选中任何项，退出批量模式
    if (!hasSelection && this.data.isBatchMode) {
      this.cancelBatchMode();
    } else {
      this.setData({ isBatchMode: true, bills }, this.updateSelectedCount);
    }
  },

  // 点击切换选中/取消
  onBillSelect(e) {
    if (!this.data.isBatchMode) return;
    const billDate = String(e.currentTarget.dataset.date);
    const bills = this.data.bills;
    let hasSelection = false;

    bills.forEach(group => {
      group.items.forEach(item => {
        if (String(item.date) === billDate) {
          item.selected = !item.selected;
        }
        if (item.selected) hasSelection = true;
      });
    });

    // 如果没有选中任何项，退出批量模式
    if (!hasSelection) {
      this.cancelBatchMode();
    } else {
      this.setData({ bills }, this.updateSelectedCount);
    }
  },

  // 取消批量模式
  cancelBatchMode() {
    const bills = this.data.bills;
    bills.forEach(group => group.items.forEach(item => item.selected = false));
    this.setData({ isBatchMode: false, bills, selectedCount: 0, isAllSelected: false });
  },

  // 全选/取消全选
  toggleSelectAll() {
    const { bills, isAllSelected } = this.data;
    bills.forEach(group => group.items.forEach(item => item.selected = !isAllSelected));
    this.setData({ bills, isAllSelected: !isAllSelected }, this.updateSelectedCount);
  },

  // 更新选中数量
  updateSelectedCount() {
    let count = 0;
    const allDates = [];
    this.data.bills.forEach(group => {
      group.items.forEach(item => {
        if (item.selected) count++;
        allDates.push(item.date);
      });
    });
    this.setData({ selectedCount: count, isAllSelected: count > 0 && count === allDates.length });
  },

  // 批量删除
  async executeBatchDelete() {
    const { bills } = this.data;
    const selectedDates = [];
    bills.forEach(group => {
      group.items.forEach(item => {
        if (item.selected) selectedDates.push(item.date);
      });
    });

    if (selectedDates.length === 0) { wx.showToast({ title: '请先选择账单', icon: 'none' }); return; }

    const res = await wx.showModal({
      title: '⚠️ 警告：永久删除',
      content: `确定删除 ${selectedDates.length} 条账单？本地+云端数据将无法恢复！`,
      confirmText: '确认删除', confirmColor: '#FF4D4F', cancelText: '取消'
    });

    if (res.confirm) {
      wx.showLoading({ title: '删除中...' });
      try {
        const syncEnabled = wx.getStorageSync('syncEnabled');
        if (syncEnabled) {
          // 使用 Promise.allSettled 避免单条失败中断整体
          const deletePromises = selectedDates.map(date => 
            app.request({ url: '/bills/delete', method: 'POST', data: { date: Number(date) }, timeout: 8000 })
              .catch(err => ({ error: true, date, message: err.message }))
          );
          const results = await Promise.allSettled(deletePromises);
          const failed = results.filter(r => r.value?.error).map(r => r.value.date);
          if (failed.length > 0) {
            console.warn('部分账单删除失败:', failed);
          }
        }

        const localBills = wx.getStorageSync('localBills') || [];
        const remainingBills = localBills.filter(bill => !selectedDates.includes(bill.date));
        wx.setStorageSync('localBills', remainingBills);

        wx.hideLoading();
        wx.showToast({ title: `已删除 ${selectedDates.length} 条账单`, icon: 'success' });
        this.cancelBatchMode();
        this.loadData();
      } catch (error) {
        wx.hideLoading();
        wx.showToast({ title: '删除失败', icon: 'none' });
        console.error('Delete error:', error);
      }
    }
  }
});