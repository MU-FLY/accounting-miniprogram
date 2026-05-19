const app = getApp();

Page({
  data: {
    userInfo: null,
    totalIncome: '0.00',
    totalExpense: '0.00',
    totalBalance: '0.00',
    billCount: 0,
    totalDays: 0,
    loading: false,
    showAuth: false,
    showProgress: false,
    progressTitle: '',
    progressPercent: 0,
    progressText: '',
    showFeedback: false,
    feedbackContent: '',
    // 每日一攒
    autoSaveEnabled: false,
    autoSaveAmount: '10',
    autoSaveTime: '08:30',
    showAutoSaveModal: false,
    // 导入导出
    showExportModal: false,
    showImportModal: false,
    importFormatHint: '',
    // 公众号
    showOfficialModal: false
  },

  onLoad() {
    this.getUserInfo();
    this.checkSyncStatus();
    // 始终加载本地数据，未登录时显示本地数据
    this.loadLocalStats();
    this.loadAutoSaveSettings();
    this.checkAutoSaveToday();
  },

  onShow() {
    this.checkSyncStatus();
    
    // 根据同步状态决定是否加载数据
    const syncEnabled = wx.getStorageSync('syncEnabled');
    if (syncEnabled) {
      this.loadStats();
    } else {
      // 不同步，显示本地数据
      this.loadLocalStats();
    }
    
    // 检查今日是否已自动攒
    this.checkAutoSaveToday();
  },

  // ==================== 导入导出功能 ====================

  // 显示导出弹窗
  showExportModal() {
    this.setData({ showExportModal: true });
  },

  // 关闭导出弹窗
  closeExportModal() {
    this.setData({ showExportModal: false });
  },

  // 一键导出数据
  async exportData() {
    const localBills = wx.getStorageSync('localBills') || [];
    
    if (localBills.length === 0) {
      wx.showToast({ title: '暂无数据可导出', icon: 'none' });
      return;
    }

    // 构建导出数据结构
    const exportData = {
      version: '2.0',
      exportTime: new Date().toISOString(),
      appName: '随手记',
      data: {
        bills: localBills,
        categories: this.getCategoriesFromStorage(),
        settings: {
          autoSaveEnabled: wx.getStorageSync('autoSaveEnabled') || false,
          autoSaveAmount: wx.getStorageSync('autoSaveAmount') || '10',
          autoSaveTime: wx.getStorageSync('autoSaveTime') || '08:30'
        }
      }
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const fileName = `accounting_backup_${this.formatDate(new Date())}.json`;

    try {
      // 写入临时文件
      const fs = wx.getFileSystemManager();
      const tempPath = `${wx.env.USER_DATA_PATH}/${fileName}`;
      
      fs.writeFileSync(tempPath, jsonStr, 'utf8');

      // 尝试方式1: 分享文件（真机支持）
      wx.shareFileMessage({
        filePath: tempPath,
        fileName: fileName,
        success: () => {
          wx.showToast({ title: '导出成功', icon: 'success' });
          this.closeExportModal();
        },
        fail: (err) => {
          console.error('分享文件失败:', err);
          // 尝试方式2: 保存到磁盘（真机支持）
          this.saveFileToDisk(tempPath, fileName, jsonStr);
        }
      });
    } catch (err) {
      console.error('导出失败:', err);
      // 最终备选：复制到剪贴板
      this.copyToClipboard(jsonStr);
    }
  },

  // 保存到磁盘（真机支持）
  saveFileToDisk(tempPath, fileName, jsonStr) {
    wx.saveFileToDisk({
      filePath: tempPath,
      success: () => {
        wx.showToast({ title: '已保存到下载', icon: 'success' });
        this.closeExportModal();
      },
      fail: (err) => {
        console.error('保存到磁盘失败:', err);
        // 最终备选：复制到剪贴板
        this.copyToClipboard(jsonStr);
      }
    });
  },

  // 复制到剪贴板（通用方案）
  copyToClipboard(jsonStr) {
    wx.setClipboardData({
      data: jsonStr,
      success: () => {
        wx.showModal({
          title: '导出成功',
          content: '数据已复制到剪贴板。\n\n请粘贴到文本编辑器（如备忘录、微信文件传输助手）中保存为 .json 文件。',
          showCancel: false,
          success: () => {
            this.closeExportModal();
          }
        });
      },
      fail: (err) => {
        console.error('复制到剪贴板失败:', err);
        wx.showToast({ title: '导出失败', icon: 'none' });
      }
    });
  },

  // 显示导入弹窗
  showImportModal() {
    const formatHint = `数据格式要求：

1. 文件格式：JSON (.json)
2. 编码：UTF-8
3. 数据结构示例：
{
  "version": "2.0",
  "data": {
    "bills": [
      {
        "date": 1704067200000,
        "amount": 100,
        "category": "餐饮",
        "type": "expense",
        "remark": "午餐"
      }
    ]
  }
}

4. 支持导入字段：
   - date: 时间戳（毫秒）
   - amount: 金额（数字）
   - category: 分类名称
   - type: 类型（income/expense）
   - remark: 备注（可选）`;

    this.setData({ 
      showImportModal: true,
      importFormatHint: formatHint
    });
  },

  // 关闭导入弹窗
  closeImportModal() {
    this.setData({ showImportModal: false });
  },

  // 选择并导入文件
  chooseAndImportFile() {
    // 提示用户数据格式
    wx.showModal({
      title: '导入数据格式',
      content: this.data.importFormatHint,
      confirmText: '选择文件',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doImportFile();
        }
      }
    });
  },

  // 执行文件导入
  doImportFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].path;
        this.parseImportFile(tempFilePath);
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({ title: '未选择文件', icon: 'none' });
      }
    });
  },

  // 解析导入文件
  parseImportFile(filePath) {
    const fs = wx.getFileSystemManager();
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const importData = JSON.parse(content);
      
      // 验证数据结构
      let bills = [];
      
      if (importData.data && importData.data.bills && Array.isArray(importData.data.bills)) {
        // 标准格式
        bills = importData.data.bills;
      } else if (importData.bills && Array.isArray(importData.bills)) {
        // 简化格式
        bills = importData.bills;
      } else if (Array.isArray(importData)) {
        // 纯数组格式
        bills = importData;
      } else {
        wx.showModal({
          title: '格式错误',
          content: '无法识别数据格式，请确保文件符合要求。\n\n支持的格式：\n1. 标准格式：{version, data: {bills}}\n2. 简化格式：{bills: [...]}\n3. 数组格式：[...]',
          showCancel: false
        });
        return;
      }

      if (bills.length === 0) {
        wx.showToast({ title: '文件中没有账单数据', icon: 'none' });
        return;
      }

      // 验证并转换数据
      const validBills = this.validateAndTransformBills(bills);
      
      if (validBills.length === 0) {
        wx.showModal({
          title: '数据无效',
          content: '导入的数据中没有有效的账单记录。\n\n每条记录必须包含：\n- date: 时间戳或日期字符串\n- amount: 金额\n- category: 分类\n- type: income 或 expense',
          showCancel: false
        });
        return;
      }

      // 显示确认对话框
      wx.showModal({
        title: '确认导入',
        content: `检测到 ${validBills.length} 条有效账单数据。\n\n导入方式：\n- 合并：与现有数据合并（去重）\n- 覆盖：替换所有现有数据\n\n请选择导入方式：`,
        confirmText: '合并导入',
        cancelText: '覆盖导入',
        success: (res) => {
          if (res.confirm) {
            this.mergeImportBills(validBills);
          } else {
            this.overwriteImportBills(validBills);
          }
        }
      });

    } catch (err) {
      console.error('解析文件失败:', err);
      wx.showModal({
        title: '导入失败',
        content: '文件解析失败，请检查：\n1. 文件是否为有效的 JSON 格式\n2. 文件编码是否为 UTF-8\n3. 文件内容是否完整',
        showCancel: false
      });
    }
  },

  // 验证并转换账单数据
  validateAndTransformBills(bills) {
    return bills.filter(bill => {
      // 检查必要字段
      if (!bill.amount || !bill.category || !bill.type) {
        return false;
      }

      // 处理日期
      let date = bill.date;
      if (typeof date === 'string') {
        // 尝试解析日期字符串
        date = new Date(date).getTime();
        if (isNaN(date)) {
          return false;
        }
      } else if (typeof date !== 'number') {
        // 如果没有日期，使用当前时间
        date = Date.now();
      }

      // 确保金额是数字
      const amount = parseFloat(bill.amount);
      if (isNaN(amount) || amount <= 0) {
        return false;
      }

      // 确保类型正确
      const type = bill.type === 'income' ? 'income' : 'expense';

      // 转换数据格式
      bill.date = date;
      bill.amount = amount;
      bill.type = type;
      bill.remark = bill.remark || bill.note || '';
      bill.created_at = bill.created_at || new Date().toISOString();

      return true;
    });
  },

  // 合并导入（去重）
  mergeImportBills(newBills) {
    const localBills = wx.getStorageSync('localBills') || [];
    
    // 创建日期+金额+分类的键用于去重
    const existingKeys = new Set(localBills.map(b => 
      `${b.date}_${b.amount}_${b.category}_${b.type}`
    ));
    
    const uniqueBills = newBills.filter(b => {
      const key = `${b.date}_${b.amount}_${b.category}_${b.type}`;
      if (existingKeys.has(key)) {
        return false;
      }
      existingKeys.add(key);
      return true;
    });

    const mergedBills = [...localBills, ...uniqueBills];
    wx.setStorageSync('localBills', mergedBills);
    
    this.loadLocalStats();
    this.closeImportModal();
    
    wx.showToast({
      title: `成功导入 ${uniqueBills.length} 条`,
      icon: 'success',
      duration: 2000
    });
  },

  // 覆盖导入
  overwriteImportBills(newBills) {
    wx.showModal({
      title: '⚠️ 确认覆盖',
      content: '此操作将删除所有现有数据，用导入的数据替换。确定要继续吗？',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('localBills', newBills);
          this.loadLocalStats();
          this.closeImportModal();
          
          wx.showToast({
            title: `成功导入 ${newBills.length} 条`,
            icon: 'success',
            duration: 2000
          });
        }
      }
    });
  },

  // 从存储获取分类
  getCategoriesFromStorage() {
    try {
      const categories = wx.getStorageSync('categories');
      if (categories) return categories;
    } catch (e) {}
    
    // 返回默认分类
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
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  },

  // ==================== 每日一攒（加强版） ====================

  // 加载自动攒设置
  loadAutoSaveSettings() {
    const autoSaveEnabled = wx.getStorageSync('autoSaveEnabled') || false;
    const autoSaveAmount = wx.getStorageSync('autoSaveAmount') || '10';
    const autoSaveTime = wx.getStorageSync('autoSaveTime') || '08:30';
    this.setData({ autoSaveEnabled, autoSaveAmount, autoSaveTime });
  },

  // 检查今日是否已自动攒
  checkAutoSaveToday() {
    if (!this.data.autoSaveEnabled) return;
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const lastAutoSaveDate = wx.getStorageSync('lastAutoSaveDate');
    
    // 如果今天还没攒，且当前时间已过设定时间，立即执行
    if (lastAutoSaveDate !== todayStr) {
      const now = new Date();
      const [hours, minutes] = this.data.autoSaveTime.split(':');
      const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0);
      
      if (now >= targetTime) {
        console.log('已过设定时间，立即执行自动攒');
        this.doAutoSave();
      } else {
        // 设置定时器
        this.scheduleAutoSaveReminder();
      }
    }
  },

  // 打开每日一攒设置弹窗
  openAutoSaveSetting() {
    this.setData({ showAutoSaveModal: true });
  },

  // 关闭每日一攒设置弹窗
  closeAutoSaveModal() {
    this.setData({ showAutoSaveModal: false });
  },

  // 设置自动攒金额
  setAutoSaveAmount(e) {
    const amount = e.detail.value;
    if (amount && parseFloat(amount) > 0) {
      this.setData({ autoSaveAmount: amount });
    }
  },

  // 设置自动攒时间
  setAutoSaveTime(e) {
    const time = e.detail.value;
    this.setData({ autoSaveTime: time });
  },

  // 保存自动攒设置
  saveAutoSaveSettings() {
    const { autoSaveAmount, autoSaveTime } = this.data;
    
    // 校验金额
    if (!autoSaveAmount || parseFloat(autoSaveAmount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }
    
    // 保存设置
    wx.setStorageSync('autoSaveAmount', autoSaveAmount);
    wx.setStorageSync('autoSaveTime', autoSaveTime);
    wx.setStorageSync('autoSaveEnabled', true);
    
    this.setData({ 
      showAutoSaveModal: false,
      autoSaveEnabled: true
    });
    
    wx.showToast({ title: '每日一攒已开启', icon: 'success' });
    
    // 立即设置提醒
    this.scheduleAutoSaveReminder();
    
    // 请求订阅消息权限（用于准时提醒）
    this.requestSubscribeMessage();
  },

  // 关闭自动攒
  disableAutoSave() {
    wx.setStorageSync('autoSaveEnabled', false);
    this.setData({ autoSaveEnabled: false });
    wx.showToast({ title: '每日一攒已关闭', icon: 'none' });
    
    // 清除定时器
    this.clearAutoSaveTimer();
  },

  // 请求订阅消息权限
  requestSubscribeMessage() {
    // 订阅消息模板ID需要在微信公众平台申请
    // 如需使用，请替换为实际的模板ID
    const tmplIds = [];
    
    if (tmplIds.length === 0) {
      console.log('订阅消息模板ID未配置，跳过订阅消息请求');
      return;
    }
    
    wx.requestSubscribeMessage({
      tmplIds: tmplIds,
      success: (res) => {
        console.log('订阅消息授权结果:', res);
        // 保存授权状态
        const authorized = Object.values(res).some(v => v === 'accept');
        wx.setStorageSync('subscribeMessageAuthorized', authorized);
      },
      fail: (err) => {
        console.error('订阅消息授权失败:', err);
      }
    });
  },

  // 自动攒定时器
  autoSaveTimer: null,

  // 设置定时提醒（精确到秒）
  scheduleAutoSaveReminder() {
    // 清除旧定时器
    this.clearAutoSaveTimer();
    
    const { autoSaveTime } = this.data;
    const [hours, minutes] = autoSaveTime.split(':');
    
    const now = new Date();
    let nextTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0);
    
    // 如果今天的时间已过，设置为明天
    if (nextTime <= now) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
    
    const delayMs = nextTime - now;
    
    console.log(`自动攒已设置，下次执行时间: ${nextTime.toLocaleString()}，距离现在 ${delayMs} 毫秒`);
    
    // 使用 setTimeout 设置精确提醒
    this.autoSaveTimer = setTimeout(() => {
      this.doAutoSave();
    }, delayMs);
    
    // 同时设置后台提醒（如果支持）
    this.setBackgroundReminder(nextTime);
  },

  // 设置后台提醒
  setBackgroundReminder(nextTime) {
    // 检查是否支持后台任务
    if (wx.setBackgroundFetchToken) {
      wx.setBackgroundFetchToken({
        token: 'auto_save_reminder',
        success: () => {
          console.log('后台提醒已设置');
        }
      });
    }
    
    // 使用本地通知（如果支持）
    if (wx.showModal) {
      // 小程序内通知
    }
  },

  // 清除定时器
  clearAutoSaveTimer() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  },

  // 执行自动攒
  async doAutoSave() {
    const autoSaveAmount = wx.getStorageSync('autoSaveAmount') || '10';
    const amount = parseFloat(autoSaveAmount);
    
    if (!amount || amount <= 0) return;
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const lastAutoSaveDate = wx.getStorageSync('lastAutoSaveDate');
    
    if (lastAutoSaveDate === todayStr) {
      console.log('今天已经自动攒过了');
      return;
    }
    
    // 创建自动攒账单
    const bill = {
      date: today.getTime(),
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
    
    // 显示通知
    wx.showToast({
      title: `自动攒 ¥${amount} 成功`,
      icon: 'success',
      duration: 2000
    });
    
    console.log(`自动攒成功: ¥${amount}`);
    
    // 刷新统计数据
    this.loadLocalStats();
    
    // 设置明天的提醒
    this.scheduleAutoSaveReminder();
    
    // 发送订阅消息通知（如果已授权）
    this.sendSubscribeMessage(amount);
  },

  // 发送订阅消息
  sendSubscribeMessage(amount) {
    const authorized = wx.getStorageSync('subscribeMessageAuthorized');
    if (!authorized) return;
    
    // 这里需要调用后端接口发送订阅消息
    // 实际实现需要后端配合
    console.log('发送订阅消息提醒:', amount);
  },

  // ==================== 原有功能 ====================

  checkSyncStatus() {
    const syncEnabled = wx.getStorageSync('syncEnabled');
    this.setData({ syncEnabled: !!syncEnabled });
  },

  // 显示进度条
  showProgressBar(title, percent, text) {
    this.setData({
      showProgress: true,
      progressTitle: title,
      progressPercent: percent,
      progressText: text
    });
  },

  // 隐藏进度条
  hideProgressBar() {
    this.setData({
      showProgress: false,
      progressPercent: 0,
      progressText: ''
    });
  },

  // 更新进度条
  updateProgress(percent, text) {
    this.setData({
      progressPercent: percent,
      progressText: text
    });
  },

  // 同步云端数据（需要登录）
  async syncData() {
    // 检查是否已登录
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查是否已同步
    const syncEnabled = wx.getStorageSync('syncEnabled');
    if (syncEnabled) {
      wx.showToast({
        title: '已同步',
        icon: 'success',
        duration: 2000
      });
      return;
    }

    // 先静默检查云端是否有数据
    wx.showLoading({ title: '检查中...' });
    
    try {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
      const yearEnd = new Date(now.getFullYear(), 11, 31).getTime();
      
      // 获取云端账单数量
      const checkRes = await app.request({
        url: `/bills?startDate=${yearStart}&endDate=${yearEnd}&pageSize=1`
      });
      
      wx.hideLoading();
      
      const cloudBills = checkRes.data?.bills || checkRes.data || [];
      const cloudCount = Array.isArray(cloudBills) ? cloudBills.length : 0;
      
      console.log('云端数据检查结果:', { cloudCount, cloudBills, checkRes });
      
      if (cloudCount === 0) {
        // 云端没有数据，直接提示
        const localBills = wx.getStorageSync('localBills') || [];
        if (localBills.length > 0) {
          wx.showModal({
            title: '暂无云端数据',
            content: `检测到您有 ${localBills.length} 条本地账单，云端暂无数据。是否一键上传本地数据到云端？`,
            confirmText: '一键上传',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                this.uploadToCloud();
              }
            }
          });
        } else {
          wx.showToast({
            title: '暂无云端数据',
            icon: 'none',
            duration: 2000
          });
        }
        return;
      }
      
      // 云端有数据，开始从云端同步到本地
      // 显示进度条
      this.showProgressBar('同步云端数据', 0, '正在获取云端数据...');

      try {
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
        const yearEnd = new Date(now.getFullYear(), 11, 31).getTime();

        // 步骤1: 获取云端所有数据
        this.updateProgress(30, '正在下载云端数据...');
        
        const allBillsRes = await app.request({
          url: `/bills?startDate=${yearStart}&endDate=${yearEnd}&pageSize=10000`
        });
        
        const cloudBills = allBillsRes.data?.bills || [];
        
        if (cloudBills.length === 0) {
          // 云端确实没有数据，显示提示
          this.updateProgress(100, '云端暂无数据');
          setTimeout(() => {
            this.hideProgressBar();
            wx.showToast({
              title: '暂无云端数据',
              icon: 'none',
              duration: 2000
            });
          }, 500);
          return;
        }

        // 步骤2: 读取本地数据
        this.updateProgress(50, '正在读取本地数据...');
        await this.delay(200);
        
        const localBills = wx.getStorageSync('localBills') || [];
        const localDates = new Set(localBills.map(b => b.date));

        // 步骤3: 合并数据（去重）
        this.updateProgress(70, '正在合并数据...');
        await this.delay(200);
        
        const newBills = cloudBills.filter(b => !localDates.has(b.date));
        const mergedBills = [...localBills, ...newBills];

        // 步骤4: 保存到本地
        this.updateProgress(90, '正在保存到本地...');
        wx.setStorageSync('localBills', mergedBills);
        await this.delay(300);

        // 步骤5: 完成
        this.updateProgress(100, `同步完成！共 ${cloudBills.length} 条云端数据`);
        
        console.log('云端账单已合并到本地，共', cloudBills.length, '条云端数据，合并后', mergedBills.length, '条');

        setTimeout(() => {
          this.hideProgressBar();
          
          // 同步成功后，启用同步标志
          wx.setStorageSync('syncEnabled', true);
          this.setData({ syncEnabled: true });
          wx.showToast({
            title: `成功同步 ${cloudBills.length} 条`,
            icon: 'success',
            duration: 2000
          });
          console.log('同步成功，已启用云端同步');
          // 同步完成后，重新加载本地统计数据
          this.loadLocalStats();
        }, 800);
        
      } catch (err) {
        this.hideProgressBar();
        wx.showToast({
          title: '同步失败',
          icon: 'none',
          duration: 2000
        });
        console.error('同步失败:', err);
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: '检查失败',
        icon: 'none',
        duration: 2000
      });
      console.error('检查云端数据失败:', err);
    }
  },

  // 延迟工具函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // 一键上传本地数据到云端（需要登录）
  async uploadToCloud() {
    // 检查是否已登录
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const localBills = wx.getStorageSync('localBills') || [];
    
    if (localBills.length === 0) {
      wx.showToast({
        title: '暂无本地数据',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 过滤出未上传的数据（没有 cloudId 字段的）
    const billsToUpload = localBills.filter(bill => {
      // 如果 bill 没有 cloudId 字段，说明是本地数据未上传
      return !bill.cloudId;
    });

    if (billsToUpload.length === 0) {
      wx.showToast({
        title: '所有数据已同步',
        icon: 'success',
        duration: 2000
      });
      return;
    }

    // 显示进度条
    this.showProgressBar('上传本地数据到云端', 0, `准备上传 ${billsToUpload.length} 条数据...`);

    let successCount = 0;
    let failCount = 0;

    // 获取本地账单数组用于更新
    const allLocalBills = wx.getStorageSync('localBills') || [];
    
    for (let i = 0; i < billsToUpload.length; i++) {
      const bill = billsToUpload[i];
      
      // 更新进度
      const percent = Math.round(((i + 1) / billsToUpload.length) * 100);
      this.updateProgress(percent, `正在上传 ${i + 1}/${billsToUpload.length}...`);
      
      try {
        console.log('上传账单数据:', {
          amount: bill.amount,
          type: bill.type,
          category: bill.category,
          date: bill.date,
          note: bill.note || ''
        });
        
        const res = await app.request({
          url: '/bills',
          method: 'POST',
          data: {
            amount: bill.amount,
            type: bill.type,
            category: bill.category,
            date: bill.date,
            dateStr: bill.dateStr || new Date(bill.date).toISOString().split('T')[0],
            remark: bill.note || bill.remark || ''
          }
        });
        console.log('上传账单成功:', res);
        successCount++;
        
        // 上传成功后，给本地账单添加 cloudId 标记
        const billIndex = allLocalBills.findIndex(b => b.date === bill.date);
        if (billIndex !== -1) {
          allLocalBills[billIndex].cloudId = true;
        }
      } catch (err) {
        console.error('上传账单失败:', err);
        console.error('失败账单数据:', bill);
        failCount++;
      }
    }

    // 保存更新后的本地账单（添加了 cloudId）
    wx.setStorageSync('localBills', allLocalBills);
    
    // 显示完成进度
    if (failCount === 0) {
      this.updateProgress(100, `上传完成！成功 ${successCount} 条`);
    } else {
      this.updateProgress(100, `上传完成！成功 ${successCount} 条，失败 ${failCount} 条`);
    }
    
    // 延迟隐藏进度条，让用户看到完成状态
    setTimeout(() => {
      this.hideProgressBar();
      
      if (failCount === 0) {
        wx.showToast({
          title: `成功上传 ${successCount} 条`,
          icon: 'success',
          duration: 2000
        });
        // 上传成功，但不自动同步，让用户自己选择
        console.log('上传成功，不自动同步');
      } else {
        wx.showModal({
          title: '上传完成',
          content: `成功: ${successCount} 条\n失败: ${failCount} 条`,
          showCancel: false
        });
      }
    }, 800);
  },

  // 获取云端所有账单并保存到本地存储
  fetchAndSaveCloudBills() {
    return new Promise(async (resolve, reject) => {
      try {
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
        const yearEnd = new Date(now.getFullYear(), 11, 31).getTime();

        // 获取所有云端账单
        const allBillsRes = await app.request({
          url: `/bills?startDate=${yearStart}&endDate=${yearEnd}&pageSize=10000`
        });
        
        const cloudBills = allBillsRes.data?.bills || [];
        
        if (cloudBills.length > 0) {
          // 合并云端数据和本地数据（去重）
          const localBills = wx.getStorageSync('localBills') || [];
          const localDates = new Set(localBills.map(b => b.date));
          const newBills = cloudBills.filter(b => !localDates.has(b.date));
          const mergedBills = [...localBills, ...newBills];
          wx.setStorageSync('localBills', mergedBills);
          console.log('云端账单已合并到本地，共', cloudBills.length, '条云端数据，合并后', mergedBills.length, '条');
          resolve('synced');
        } else {
          console.log('云端没有账单数据');
          // 检查本地是否有数据
          const localBills = wx.getStorageSync('localBills') || [];
          if (localBills.length > 0) {
            // 本地有数据但云端没有，提示用户云端暂无数据，可点击一键上传
            wx.showModal({
              title: '云端暂无数据',
              content: `检测到您有 ${localBills.length} 条本地账单，云端暂无数据。您可以点击"一键上传云端"将数据上传到云端。`,
              showCancel: false,
              confirmText: '知道了'
            });
            resolve('no_cloud_data');
          } else {
            wx.showToast({
              title: '云端暂无数据',
              icon: 'none',
              duration: 2000
            });
            resolve('no_cloud_data');
          }
        }
      } catch (error) {
        console.error('获取云端账单失败:', error);
        reject(error);
      }
    });
  },

  loadLocalStats() {
    // 加载本地缓存的账单
    const localBills = wx.getStorageSync('localBills') || [];
    
    if (localBills.length === 0) {
      this.setData({
        totalIncome: '0.00',
        totalExpense: '0.00',
        totalBalance: '0.00',
        billCount: 0,
        totalDays: 0
      });
      return;
    }

    // 计算统计数据
    const now = new Date();
    const currentYear = now.getFullYear();
    
    let totalIncome = 0, totalExpense = 0;
    const dateSet = new Set();
    
    localBills.forEach(bill => {
      const billDate = new Date(Number(bill.date));
      if (billDate.getFullYear() === currentYear) {
        if (bill.type === 'income') {
          totalIncome += Number(bill.amount);
        } else {
          totalExpense += Number(bill.amount);
        }
        
        const dateStr = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}-${String(billDate.getDate()).padStart(2, '0')}`;
        dateSet.add(dateStr);
      }
    });
    
    const totalBalance = totalIncome - totalExpense;
    
    this.setData({
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      totalBalance: totalBalance.toFixed(2),
      billCount: localBills.length,
      totalDays: dateSet.size
    });
  },

  loadStats() {
    return new Promise(async (resolve, reject) => {
      this.setData({ loading: true });
      try {
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
        const yearEnd = new Date(now.getFullYear(), 11, 31).getTime();

        const summaryRes = await app.request({
          url: `/bills/summary?startDate=${yearStart}&endDate=${yearEnd}`
        });

        const billsRes = await app.request({
          url: `/bills?startDate=${yearStart}&endDate=${yearEnd}&pageSize=1`
        });

        const summary = summaryRes.data || { totalIncome: 0, totalExpense: 0 };
        const totalIncome = Number(summary.totalIncome || 0);
        const totalExpense = Number(summary.totalExpense || 0);
        const totalBalance = totalIncome - totalExpense;

        // 获取账单总数和记账天数
        const allBillsRes = await app.request({
          url: `/bills?startDate=${yearStart}&endDate=${yearEnd}&pageSize=10000`
        });
        const allBills = allBillsRes.data?.bills || [];
        const billCount = allBills.length;
        
        // 计算记账天数（有账单的不同日期数）
        const dateSet = new Set();
        allBills.forEach(bill => {
          const date = new Date(Number(bill.date));
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          dateSet.add(dateStr);
        });
        const totalDays = dateSet.size;

        this.setData({
          totalIncome: totalIncome.toFixed(2),
          totalExpense: totalExpense.toFixed(2),
          totalBalance: totalBalance.toFixed(2),
          billCount: billCount,
          totalDays: totalDays,
          loading: false
        });
        resolve();
      } catch (error) {
        console.error('Load stats error:', error);
        this.setData({ loading: false });
        reject(error);
      }
    });
  },

  getUserInfo() {
    // 从本地存储获取用户信息
    const nickName = wx.getStorageSync('nickName');
    const avatarUrl = wx.getStorageSync('avatarUrl');
    
    if (nickName || avatarUrl) {
      this.setData({
        userInfo: {
          nickName: nickName || '',
          avatarUrl: avatarUrl || ''
        }
      });
    }
  },

  showAuthModal() {
    // 显示授权弹窗，不自动登录
    this.setData({ showAuth: true });
  },

  hideAuthModal() {
    // 关闭弹窗时清空已选择但未确认的头像和昵称，回到未登录状态
    this.setData({
      showAuth: false,
      userInfo: null
    });
    // 清除本地存储的临时头像昵称
    wx.removeStorageSync('avatarUrl');
    wx.removeStorageSync('nickName');
  },

  confirmAuth() {
    // 检查用户是否已同时设置头像和昵称
    const { avatarUrl, nickName } = this.data.userInfo;
    if (!avatarUrl || !nickName) {
      wx.showToast({
        title: '请同时设置头像和昵称',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 用户点击确认后，才调用微信登录
    this.setData({ showAuth: false });
    this.wxLogin();
  },

  wxLogin() {
    wx.login({
      success: (res) => {
        if (res.code) {
          console.log('微信登录 code:', res.code);
          // 发送 code 到后端换取 openid
          this.sendCodeToServer(res.code);
        }
      }
    });
  },

  sendCodeToServer(code) {
    // 发送 code 到后端换取 openid
    const app = getApp();
    wx.request({
      url: app.globalData.apiBaseUrl + '/wx/login',
      method: 'POST',
      data: { code },
      success: (res) => {
        const data = res.data.data || res.data;
        if (data.openid) {
          // 保存 openid，userId 就是 openid
          wx.setStorageSync('openid', data.openid);
          wx.setStorageSync('userId', data.openid);
          console.log('登录成功，openid:', data.openid);
          
          // 登录成功，默认不同步，让用户手动选择同步
          wx.setStorageSync('syncEnabled', false);
          this.setData({ syncEnabled: false });
          wx.showToast({ title: '登录成功', icon: 'success' });
        } else {
          console.error('登录失败，未获取到 openid:', res.data);
          wx.showToast({ title: '登录失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('登录请求失败:', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      }
    });
  },

  // 登录后检查云端数据并决定是否同步
  async checkCloudDataAndSync() {
    try {
      wx.showLoading({ title: '检查云端数据...' });
      
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
      const yearEnd = new Date(now.getFullYear(), 11, 31).getTime();
      
      // 获取云端账单
      const res = await app.request({
        url: `/bills?startDate=${yearStart}&endDate=${yearEnd}&pageSize=1`
      });
      
      wx.hideLoading();
      
      const cloudBills = res.data?.bills || [];
      
      if (cloudBills.length === 0) {
        // 云端没有数据，提示用户
        wx.showModal({
          title: '云端暂无数据',
          content: '云端暂无账单数据，是否开启同步功能？开启后，您的新账单将自动同步到云端。',
          confirmText: '开启同步',
          cancelText: '暂不同步',
          success: (res) => {
            if (res.confirm) {
              wx.setStorageSync('syncEnabled', true);
              this.setData({ syncEnabled: true });
              wx.showToast({ title: '同步已开启', icon: 'success' });
            } else {
              wx.setStorageSync('syncEnabled', false);
              this.setData({ syncEnabled: false });
            }
          }
        });
      } else {
        // 云端有数据，询问是否同步
        wx.showModal({
          title: '同步云端数据',
          content: `检测到云端有 ${cloudBills.length} 条账单数据，是否同步到本地？`,
          confirmText: '同步',
          cancelText: '不同步',
          success: (res) => {
            if (res.confirm) {
              wx.setStorageSync('syncEnabled', true);
              this.syncData();
            } else {
              wx.setStorageSync('syncEnabled', false);
              this.loadLocalStats();
            }
          }
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('检查云端数据失败:', err);
      // 出错时默认不同步
      wx.setStorageSync('syncEnabled', false);
      this.setData({ syncEnabled: false });
      wx.showToast({ title: '检查失败，暂不同步', icon: 'none' });
    }
  },

  showSyncConfirm() {
    // 检查是否已登录（有 openid）
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      // 未登录，不显示同步提示
      console.log('未登录，跳过同步提示');
      return;
    }
    
    // 默认禁用同步，等待用户选择
    wx.setStorageSync('syncEnabled', false);
    
    wx.showModal({
      title: '同步云端数据',
      content: '登录成功！是否同步云端数据？',
      confirmText: '同步',
      cancelText: '不同步',
      success: (res) => {
        if (res.confirm) {
          // 用户选择同步
          wx.setStorageSync('syncEnabled', true);
          this.syncData();
        } else {
          // 用户选择不同步，显示本地数据
          this.loadLocalStats();
        }
      }
    });
  },

  clearLocalData() {
    // 清除本地统计数据，但不删除用户标识
    this.setData({
      totalIncome: '0.00',
      totalExpense: '0.00',
      totalBalance: '0.00',
      billCount: 0,
      totalDays: 0
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    console.log('获取到头像临时路径:', avatarUrl);
    
    // 保存头像到本地存储
    wx.setStorageSync('avatarUrl', avatarUrl);
    
    this.setData({
      'userInfo.avatarUrl': avatarUrl
    });
  },

  uploadAvatar(tempFilePath) {
    // 上传头像到服务器
    wx.uploadFile({
      url: getApp().globalData.apiBaseUrl + '/upload/avatar',
      filePath: tempFilePath,
      name: 'avatar',
      formData: {
        userId: wx.getStorageSync('userId')
      },
      success: (res) => {
        const data = JSON.parse(res.data);
        if (data.url) {
          this.setData({
            'userInfo.avatarUrl': data.url
          });
        }
      }
    });
  },

  onNicknameChange(e) {
    const nickName = e.detail.value;
    // 保存到本地存储
    wx.setStorageSync('nickName', nickName);
    this.setData({
      'userInfo.nickName': nickName
    });
  },

  onNicknameInput(e) {
    // 实时获取输入值，包括微信昵称
    const nickName = e.detail.value;
    if (nickName) {
      this.setData({
        'userInfo.nickName': nickName
      });
    }
  },

  onNicknameReview(e) {
    // 用户点击了键盘上的"使用微信昵称"按钮
    const nickName = e.detail.value;
    if (nickName) {
      this.setData({
        'userInfo.nickName': nickName
      });
    }
  },

  goAbout() {
    wx.showModal({
      title: '关于随手记',
      content: 'Version 2.4.0\n简单好用的记账小程序',
      showCancel: false
    });
  },

  // 关注公众号
  followOfficialAccount() {
    // 显示公众号图片弹窗
    this.setData({ showOfficialModal: true });
  },

  // 关闭公众号弹窗
  closeOfficialModal() {
    this.setData({ showOfficialModal: false });
  },

  // 复制公众号名称
  copyOfficialName() {
    wx.setClipboardData({
      data: '慕学长记账簿',
      success: () => {
        wx.showToast({
          title: '已复制，请搜索关注',
          icon: 'none',
          duration: 2000
        });
        this.closeOfficialModal();
      }
    });
  },

  goFeedback() {
    this.setData({
      showFeedback: true
    });
  },

  hideFeedbackModal() {
    this.setData({
      showFeedback: false
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '退出登录后将无法同步云端数据，确定要退出吗？',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          // 清除登录相关存储
          wx.removeStorageSync('openid');
          wx.removeStorageSync('userId');
          wx.removeStorageSync('syncEnabled');
          wx.removeStorageSync('avatarUrl');
          wx.removeStorageSync('nickName');
          
          // 重置页面数据
          this.setData({
            userInfo: null,
            syncEnabled: false,
            totalIncome: '0.00',
            totalExpense: '0.00',
            totalBalance: '0.00',
            billCount: 0,
            totalDays: 0
          });
          
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  async clearData() {
    // 检查是否有本地数据
    const localBills = wx.getStorageSync('localBills') || [];
    if (localBills.length === 0) {
      wx.showToast({
        title: '暂无缓存',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const res = await wx.showModal({
      title: '确认清除',
      content: `确定要清除 ${localBills.length} 条本地数据吗？此操作不可恢复！`,
      confirmColor: '#FF4D4F'
    });

    if (!res.confirm) return;

    // 显示进度条
    this.showProgressBar('清除本地缓存', 0, '正在准备清除...');

    // 步骤1: 读取需要保留的数据
    this.updateProgress(20, '正在读取用户数据...');
    await this.delay(300);
    
    const userId = wx.getStorageSync('userId');
    const openid = wx.getStorageSync('openid');
    const nickName = wx.getStorageSync('nickName');
    const avatarUrl = wx.getStorageSync('avatarUrl');

    // 步骤2: 清除所有数据
    this.updateProgress(50, '正在清除本地数据...');
    await this.delay(300);
    wx.clearStorageSync();

    // 步骤3: 恢复用户标识
    this.updateProgress(80, '正在恢复用户标识...');
    await this.delay(200);
    if (userId) wx.setStorageSync('userId', userId);
    if (openid) wx.setStorageSync('openid', openid);
    if (nickName) wx.setStorageSync('nickName', nickName);
    if (avatarUrl) wx.setStorageSync('avatarUrl', avatarUrl);
    
    // 禁用云端同步
    wx.setStorageSync('syncEnabled', false);

    // 步骤4: 完成
    this.updateProgress(100, '清除完成！');
    
    console.log('清除缓存，保留用户标识，禁用同步:', { userId, openid });

    setTimeout(() => {
      this.hideProgressBar();
      wx.showToast({ title: '已清除', icon: 'success' });
      
      // 重置统计数据为0（包括同步状态）
      this.setData({
        syncEnabled: false,
        totalIncome: '0.00',
        totalExpense: '0.00',
        totalBalance: '0.00',
        billCount: 0,
        totalDays: 0
      });
    }, 800);
  },

  // 一键重置：删除本地+云端所有数据
  async resetAllData() {
    // 检查是否已登录
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const res = await wx.showModal({
      title: '⚠️ 危险操作',
      content: '此操作将永久删除本地和云端的所有账单数据，且无法恢复！\n\n确定要继续吗？',
      confirmText: '确认删除',
      confirmColor: '#FF4D4F',
      cancelText: '取消'
    });

    if (!res.confirm) return;

    // 二次确认
    const confirmRes = await wx.showModal({
      title: '最终确认',
      content: '请再次确认：您真的要删除所有数据吗？此操作不可撤销！',
      confirmText: '确认删除',
      confirmColor: '#FF4D4F',
      cancelText: '取消'
    });

    if (!confirmRes.confirm) return;

    // 显示进度条
    this.showProgressBar('一键删除所有数据', 0, '正在准备删除...');

    try {
      const syncEnabled = wx.getStorageSync('syncEnabled');
      const userId = wx.getStorageSync('userId');

      // 步骤1: 删除云端数据
      if (syncEnabled && userId) {
        this.updateProgress(30, '正在删除云端数据...');
        try {
          await app.request({
            url: '/bills/clear-all',
            method: 'POST',
            data: { userId },
            timeout: 10000
          });
        } catch (err) {
          console.error('删除云端数据失败:', err);
          // 继续删除本地数据
        }
      } else {
        this.updateProgress(30, '跳过云端删除（未同步）...');
      }

      await this.delay(300);

      // 步骤2: 保留用户标识
      this.updateProgress(50, '正在保留用户标识...');
      const openid = wx.getStorageSync('openid');
      const nickName = wx.getStorageSync('nickName');
      const avatarUrl = wx.getStorageSync('avatarUrl');
      await this.delay(200);

      // 步骤3: 清除所有本地数据
      this.updateProgress(70, '正在清除本地数据...');
      wx.clearStorageSync();
      await this.delay(300);

      // 步骤4: 恢复用户标识
      this.updateProgress(85, '正在恢复用户标识...');
      if (userId) wx.setStorageSync('userId', userId);
      if (openid) wx.setStorageSync('openid', openid);
      if (nickName) wx.setStorageSync('nickName', nickName);
      if (avatarUrl) wx.setStorageSync('avatarUrl', avatarUrl);

      // 禁用同步
      wx.setStorageSync('syncEnabled', false);

      // 步骤5: 完成
      this.updateProgress(100, '删除完成！');

      setTimeout(() => {
        this.hideProgressBar();
        wx.showToast({ title: '已重置所有数据', icon: 'success' });

        // 重置页面数据（包括同步状态）
        this.setData({
          syncEnabled: false,
          totalIncome: '0.00',
          totalExpense: '0.00',
          totalBalance: '0.00',
          billCount: 0,
          totalDays: 0
        });
      }, 800);

    } catch (error) {
      this.hideProgressBar();
      console.error('重置数据失败:', error);
      wx.showToast({ title: '重置失败', icon: 'none' });
    }
  }
});