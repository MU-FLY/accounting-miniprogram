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
    showAutoSaveModal: false
  },

  onLoad() {
    this.getUserInfo();
    this.checkSyncStatus();
    // 始终加载本地数据，未登录时显示本地数据
    this.loadLocalStats();
    this.loadAutoSaveSettings();
  },

  // 加载自动攒设置
  loadAutoSaveSettings() {
    const autoSaveEnabled = wx.getStorageSync('autoSaveEnabled') || false;
    const autoSaveAmount = wx.getStorageSync('autoSaveAmount') || '10';
    const autoSaveTime = wx.getStorageSync('autoSaveTime') || '08:30';
    this.setData({ autoSaveEnabled, autoSaveAmount, autoSaveTime });
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
    this.scheduleAutoSaveReminder();
  },

  // 关闭自动攒
  disableAutoSave() {
    wx.setStorageSync('autoSaveEnabled', false);
    this.setData({ autoSaveEnabled: false });
    wx.showToast({ title: '每日一攒已关闭', icon: 'none' });
  },

  // 设置定时提醒
  scheduleAutoSaveReminder() {
    const { autoSaveTime } = this.data;
    const [hours, minutes] = autoSaveTime.split(':');
    
    const now = new Date();
    let nextTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0);
    
    if (nextTime <= now) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
    
    const delayMs = nextTime - now;
    
    setTimeout(() => {
      this.doAutoSave();
    }, delayMs);
    
    console.log(`自动攒已设置，下次执行时间: ${nextTime.toLocaleString()}`);
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
    
    wx.showToast({
      title: `自动攒 ¥${amount} 成功`,
      icon: 'success',
      duration: 2000
    });
    
    console.log(`自动攒成功: ¥${amount}`);
    this.scheduleAutoSaveReminder();
  },

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
      content: 'Version 1.0.0\n简单好用的记账小程序',
      showCancel: false
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
