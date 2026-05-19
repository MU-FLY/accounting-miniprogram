App({
  globalData: {
    userInfo: null,
    apiBaseUrl: 'https://www.flyboy.online/api'
  },

  onLaunch() {
    console.log('App Launch');
    this.autoLogin();
  },

  autoLogin() {
    // 如果本地有 openid，说明已登录过，仅刷新登录状态，不自动同步数据
    const openid = wx.getStorageSync('openid');
    if (openid) {
      console.log('已有 openid，刷新登录状态:', openid);
      // 调用微信登录刷新状态，但不自动启用同步
      wx.login({
        success: (res) => {
          if (res.code) {
            this.sendCodeToServer(res.code);
          }
        }
      });
    }
  },

  sendCodeToServer(code) {
    wx.request({
      url: this.globalData.apiBaseUrl + '/wx/login',
      method: 'POST',
      data: { code },
      success: (res) => {
        const data = res.data.data || res.data;
        if (data.openid) {
          wx.setStorageSync('openid', data.openid);
          // userId 就是 openid，不需要额外存储
          wx.setStorageSync('userId', data.openid);
          console.log('自动登录成功，openid:', data.openid);
        }
      }
    });
  },

  onShow() {
    console.log('App Show');
  },

  onHide() {
    console.log('App Hide');
  },

  request(options) {
    const baseUrl = this.globalData.apiBaseUrl;
    const openid = wx.getStorageSync('openid') || '';
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 10000;
      let isAborted = false;
      
      const requestTask = wx.request({
        url: baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data || {},
        timeout: timeout,
        header: {
          'Content-Type': 'application/json',
          'X-User-Id': wx.getStorageSync('userId') || '',
          'X-Openid': openid,
          ...options.header
        },
        success: (res) => {
          if (isAborted) return;
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // 适配云端返回格式 { code: 0, data: {...} }
            if (res.data.code === 0 || res.data.code === undefined) {
              resolve(res.data);
            } else {
              reject(new Error(res.data.message || '请求失败'));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        },
        fail: (err) => {
          if (isAborted) return;
          console.error('请求失败:', err);
          if (err.errMsg && err.errMsg.includes('timeout')) {
            reject(new Error('请求超时，请检查网络'));
          } else {
            reject(new Error('网络请求失败'));
          }
        }
      });

      // 手动超时处理（仅当 wx.request 超时机制不可靠时启用）
      if (timeout > 0) {
        setTimeout(() => {
          if (!isAborted) {
            isAborted = true;
            requestTask.abort();
            reject(new Error('请求超时'));
          }
        }, timeout + 1000); // 给 wx.request 原生超时一点缓冲时间
      }
    });
  }
});
