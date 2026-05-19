import * as echarts from '../../components/ec-canvas/echarts';

const app = getApp();

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A'];

function initPieChart(canvas, width, height, dpr, categoryData, totalAmount, type) {
  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);

  const data = categoryData.map((item, index) => ({
    name: item.name,
    value: item.value,
    itemStyle: { color: COLORS[index % COLORS.length] }
  }));

  const option = {
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicInOut',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)'
    },
    series: [{
      type: 'pie',
      radius: '50%',
      center: ['50%', '42%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'outside',
        formatter: function(params) {
          return params.name + '\n¥' + params.value.toFixed(2) + '\n' + params.percent + '%';
        },
        fontSize: 13,
        lineHeight: 18,
        color: '#333'
      },
      labelLine: {
        show: true,
        length: 15,
        length2: 10,
        smooth: true,
        lineStyle: {
          type: 'dashed',
          width: 1
        }
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        },
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      data: data
    }]
  };

  chart.setOption(option);
  return chart;
}

Page({
  data: {
    type: 'expense',
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    categoryData: [],
    categoryTotal: '0.00',
    monthlyData: [],
    yAxisLabels: [],
    totalIncome: 0,
    totalExpense: 0,
    loading: false,
    ec: {},
    syncEnabled: false
  },

  onLoad() {
    // 先清空所有数据状态，避免显示旧数据
    this.setData({
      loading: true,
      ec: {},
      barAnimate: false,
      monthlyData: [],
      categoryData: [],
      categoryTotal: '0.00',
      yAxisLabels: [],
      totalIncome: 0,
      totalExpense: 0
    });
    
    // 检查是否允许同步
    const syncEnabled = wx.getStorageSync('syncEnabled');
    this.setData({ syncEnabled: !!syncEnabled });
    
    // 延迟加载，确保加载动画先显示
    if (syncEnabled) {
      setTimeout(() => {
        this.loadStats();
      }, 100);
    } else {
      // 不允许同步，加载本地数据
      this.loadLocalStats();
    }
  },

  onShow() {
    // 检查是否允许同步
    const syncEnabled = wx.getStorageSync('syncEnabled');
    this.setData({ syncEnabled: !!syncEnabled });
    
    // 无论是否同步，先清空数据状态，确保不会显示旧数据
    this.setData({
      loading: true,
      ec: {},
      barAnimate: false,
      monthlyData: [],
      categoryData: [],
      categoryTotal: '0.00',
      yAxisLabels: [],
      totalIncome: 0,
      totalExpense: 0
    });
    
    if (!syncEnabled) {
      // 不允许同步，加载本地数据
      this.loadLocalStats();
      return;
    }
    
    // 允许同步，从云端加载数据
    this.loadStats();
  },

  loadLocalStats() {
    // 加载本地缓存的账单
    const localBills = wx.getStorageSync('localBills') || [];
    
    if (localBills.length === 0) {
      // 确保完全清空所有数据状态
      this.setData({
        categoryData: [],
        categoryTotal: '0.00',
        monthlyData: [],
        yAxisLabels: [],
        totalIncome: 0,
        totalExpense: 0,
        loading: false,
        ec: {},
        barAnimate: false
      });
      return;
    }

    // 计算统计数据
    const { currentYear, currentMonth, type } = this.data;
    
    // 分类统计
    const categoryMap = {};
    let totalAmount = 0;
    
    // 月度统计
    const monthlyMap = {};
    
    localBills.forEach(bill => {
      const billDate = new Date(Number(bill.date));
      const billYear = billDate.getFullYear();
      const billMonth = billDate.getMonth() + 1;
      
      if (billYear === currentYear) {
        // 月度统计
        if (!monthlyMap[billMonth]) {
          monthlyMap[billMonth] = { income: 0, expense: 0 };
        }
        if (bill.type === 'income') {
          monthlyMap[billMonth].income += Number(bill.amount);
        } else {
          monthlyMap[billMonth].expense += Number(bill.amount);
        }
        
        // 分类统计（只统计当前月份）
        if (billMonth === currentMonth && bill.type === type) {
          if (!categoryMap[bill.category]) {
            categoryMap[bill.category] = 0;
          }
          categoryMap[bill.category] += Number(bill.amount);
          totalAmount += Number(bill.amount);
        }
      }
    });
    
    // 转换分类数据
    const categoryData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    
    // 转换月度数据（与 loadStats 格式保持一致）
    const monthlyData = [];
    for (let i = 1; i <= 12; i++) {
      const data = monthlyMap[i] || { income: 0, expense: 0 };
      const value = type === 'income' ? data.income : data.expense;
      monthlyData.push(value);
    }
    
    // 计算Y轴标签
    const maxVal = Math.max(...monthlyData, 1);
    const yAxisLabels = this.generateYAxisLabels(maxVal);
    
    // 转换为包含完整属性的对象数组（与 loadStats 格式一致）
    const maxValue = maxVal;
    const formattedMonthlyData = [];
    for (let i = 1; i <= 12; i++) {
      const data = monthlyMap[i] || { income: 0, expense: 0 };
      const value = type === 'income' ? data.income : data.expense;
      const targetHeight = maxValue > 0 ? Math.max(value / maxValue * 380, 4) : 0;
      formattedMonthlyData.push({
        month: i,
        income: data.income,
        expense: data.expense,
        value: value,
        valueStr: value >= 10000 ? (value / 10000).toFixed(1) + 'w' : value.toFixed(0),
        barHeight: 0,
        targetBarHeight: targetHeight,
        barColor: type === 'income' ? '#36e691' : '#FF6B6B'
      });
    }
    
    // 计算总收入和支出
    let totalIncome = 0, totalExpense = 0;
    localBills.forEach(bill => {
      const billDate = new Date(Number(bill.date));
      if (billDate.getFullYear() === currentYear) {
        if (bill.type === 'income') {
          totalIncome += Number(bill.amount);
        } else {
          totalExpense += Number(bill.amount);
        }
      }
    });
    
    // 判断柱状图是否有数据
    const hasMonthlyData = formattedMonthlyData.some(item => item.value > 0);
    
    // 先重置动画状态
    const resetMonthlyData = formattedMonthlyData.map(item => ({
      ...item,
      barHeight: 0
    }));
    
    // 准备饼图配置
    let ecConfig = {};
    if (categoryData.length > 0) {
      ecConfig = {
        onInit: (canvas, width, height, dpr) => {
          return initPieChart(canvas, width, height, dpr, categoryData, totalAmount, type);
        }
      };
    }

    this.setData({
      categoryData,
      categoryTotal: totalAmount.toFixed(2),
      monthlyData: hasMonthlyData ? resetMonthlyData : [],
      yAxisLabels,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      loading: false,
      barAnimate: false,
      ec: ecConfig
    }, () => {
      // 触发柱状图动画
      if (hasMonthlyData) {
        this.triggerBarAnimation();
      }
      // 延迟初始化饼图，确保 DOM 准备好
      if (categoryData.length > 0) {
        setTimeout(() => {
          const ecComponent = this.selectComponent('#pieChart');
          if (ecComponent) {
            ecComponent.init();
          }
        }, 200);
      }
    });
  },

  prevYear() {
    let { currentYear } = this.data;
    currentYear--;
    this.setData({ currentYear }, () => {
      const syncEnabled = wx.getStorageSync('syncEnabled');
      if (syncEnabled) {
        this.loadStats();
      } else {
        this.loadLocalStats();
      }
    });
  },

  nextYear() {
    let { currentYear } = this.data;
    currentYear++;
    this.setData({ currentYear }, () => {
      const syncEnabled = wx.getStorageSync('syncEnabled');
      if (syncEnabled) {
        this.loadStats();
      } else {
        this.loadLocalStats();
      }
    });
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    this.setData({ currentYear, currentMonth }, () => {
      const syncEnabled = wx.getStorageSync('syncEnabled');
      if (syncEnabled) {
        this.loadStats();
      } else {
        this.loadLocalStats();
      }
    });
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    this.setData({ currentYear, currentMonth }, () => {
      const syncEnabled = wx.getStorageSync('syncEnabled');
      if (syncEnabled) {
        this.loadStats();
      } else {
        this.loadLocalStats();
      }
    });
  },

  getDateRange() {
    const { currentYear, currentMonth } = this.data;
    const startDate = new Date(currentYear, currentMonth - 1, 1).getTime();
    const endDate = new Date(currentYear, currentMonth, 0).getTime();
    return { startDate, endDate };
  },

  loadStats() {
    return new Promise(async (resolve, reject) => {
      this.setData({ loading: true });
      try {
        const { startDate, endDate } = this.getDateRange();
        const { currentYear, type } = this.data;

        const monthRes = await app.request({
          url: `/bills?startDate=${startDate}&endDate=${endDate}&type=${type}&pageSize=1000`
        });

        const summaryRes = await app.request({
          url: `/bills/summary?startDate=${startDate}&endDate=${endDate}`
        });

        const yearStart = new Date(currentYear, 0, 1).getTime();
        const yearEnd = new Date(currentYear, 11, 31).getTime();

        const yearRes = await app.request({
          url: `/bills?startDate=${yearStart}&endDate=${yearEnd}&pageSize=10000`
        });

        const bills = monthRes.data?.bills || [];
        const summary = summaryRes.data || { totalIncome: 0, totalExpense: 0 };
        const yearBills = yearRes.data?.bills || [];

        const categoryMap = {};
        bills.forEach(bill => {
          const cat = bill.category;
          if (!categoryMap[cat]) {
            categoryMap[cat] = { name: cat, value: 0, count: 0 };
          }
          categoryMap[cat].value += Number(bill.amount);
          categoryMap[cat].count++;
        });

        const categoryData = Object.values(categoryMap)
          .sort((a, b) => b.value - a.value)
          .map((c, index) => ({
            ...c,
            name: this.getCategoryName(c.name),
            valueStr: c.value.toFixed(2),
            color: COLORS[index % COLORS.length],
            percentage: 0
          }));

        const totalAmount = categoryData.reduce((sum, c) => sum + c.value, 0);

        categoryData.forEach(c => {
          c.percentage = totalAmount > 0 ? ((c.value / totalAmount) * 100).toFixed(1) : 0;
        });

        const monthlyMap = {};
        for (let i = 1; i <= 12; i++) {
          monthlyMap[i] = { month: i, income: 0, expense: 0 };
        }

        yearBills.forEach(bill => {
          const date = new Date(Number(bill.date));
          const month = date.getMonth() + 1;
          if (bill.type === 'income') {
            monthlyMap[month].income += Number(bill.amount);
          } else {
            monthlyMap[month].expense += Number(bill.amount);
          }
        });

        const maxValue = Math.max(...Object.values(monthlyMap).map(m =>
          type === 'income' ? m.income : m.expense
        ));

        const yAxisLabels = this.generateYAxisLabels(maxValue);

        const monthlyData = Object.values(monthlyMap).map(m => {
          const value = type === 'income' ? m.income : m.expense;
          const targetHeight = maxValue > 0 ? Math.max(value / maxValue * 380, 4) : 0;
          return {
            month: m.month,
            income: m.income,
            expense: m.expense,
            value: value,
            valueStr: value >= 10000 ? (value / 10000).toFixed(1) + 'w' : value.toFixed(0),
            barHeight: 0,
            targetBarHeight: targetHeight,
            barColor: type === 'income' ? '#36e691' : '#FF6B6B'
          };
        });

        // 判断柱状图是否有数据（全年该类型有任意月份有数据）
        const hasMonthlyData = monthlyData.some(item => item.value > 0);

        // 先重置动画状态，确保每次都能触发动画
        const resetMonthlyData = monthlyData.map(item => ({
          ...item,
          barHeight: 0
        }));

        // 准备饼图配置
        let ecConfig = {};
        if (categoryData.length > 0) {
          ecConfig = {
            onInit: (canvas, width, height, dpr) => {
              return initPieChart(canvas, width, height, dpr, categoryData, totalAmount, type);
            }
          };
        }

        this.setData({
          categoryData,
          categoryTotal: totalAmount.toFixed(2),
          monthlyData: hasMonthlyData ? resetMonthlyData : [],
          yAxisLabels,
          totalIncome: Number(summary.totalIncome || 0).toFixed(2),
          totalExpense: Number(summary.totalExpense || 0).toFixed(2),
          loading: false,
          barAnimate: false,
          ec: ecConfig
        }, () => {
          if (hasMonthlyData) {
            this.triggerBarAnimation();
          }
          // 延迟初始化饼图，确保 DOM 准备好
          if (categoryData.length > 0) {
            setTimeout(() => {
              const ecComponent = this.selectComponent('#pieChart');
              if (ecComponent) {
                ecComponent.init();
              }
            }, 200);
          }
          resolve();
        });
      } catch (error) {
        console.error('Load stats error:', error);
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
        reject(error);
      }
    });
  },

  initPieChartWithEcharts(categoryData, totalAmount) {
    const { type } = this.data;
    // 先清空再设置，强制重新初始化
    this.setData({ ec: {} }, () => {
      // 使用 setTimeout 确保 DOM 已准备好
      setTimeout(() => {
        this.setData({
          ec: {
            onInit: (canvas, width, height, dpr) => {
              return initPieChart(canvas, width, height, dpr, categoryData, totalAmount, type);
            }
          }
        }, () => {
          // 手动触发 ec-canvas 初始化
          setTimeout(() => {
            const ecComponent = this.selectComponent('#pieChart');
            if (ecComponent) {
              ecComponent.init();
            }
          }, 100);
        });
      }, 100);
    });
  },

  generateYAxisLabels(maxValue) {
    if (maxValue <= 0) return ['0', '0', '0', '0', '0'];
    const steps = 5;
    const stepValue = Math.ceil(maxValue / steps / 1000) * 1000;
    const labels = [];
    for (let i = steps; i >= 0; i--) {
      const val = stepValue * i;
      if (val >= 10000) {
        labels.push((val / 10000).toFixed(1) + 'w');
      } else if (val >= 1000) {
        labels.push((val / 1000).toFixed(0) + 'k');
      } else {
        labels.push(val.toFixed(0));
      }
    }
    return labels;
  },

  switchType(e) {
    const newType = e.currentTarget.dataset.type;
    // 切换类型时重新加载，确保饼图和柱状图都有动画
    this.setData({ 
      type: newType, 
      loading: true,
      ec: {},
      barAnimate: false,
      monthlyData: []
    }, () => {
      // 根据同步状态决定加载数据源
      const syncEnabled = wx.getStorageSync('syncEnabled');
      if (syncEnabled) {
        this.loadStats();
      } else {
        this.loadLocalStats();
      }
    });
  },

  // 使用当前数据重新渲染图表（用于切换支出/收入类型）
  renderWithCurrentData() {
    const { type, categoryData: currentCategoryData, monthlyData: currentMonthlyData } = this.data;

    // 重新计算分类数据的颜色和百分比
    const categoryData = currentCategoryData.map((c, index) => ({
      ...c,
      color: COLORS[index % COLORS.length]
    }));

    const totalAmount = categoryData.reduce((sum, c) => sum + c.value, 0);
    categoryData.forEach(c => {
      c.percentage = totalAmount > 0 ? ((c.value / totalAmount) * 100).toFixed(1) : 0;
    });

    // 重新计算月度数据的最大值和高度
    const maxValue = Math.max(...currentMonthlyData.map(m =>
      type === 'income' ? m.income : m.expense
    ));

    const yAxisLabels = this.generateYAxisLabels(maxValue);

    const monthlyData = currentMonthlyData.map(m => {
      const value = type === 'income' ? m.income : m.expense;
      const targetHeight = maxValue > 0 ? Math.max(value / maxValue * 200, 4) : 0;
      return {
        ...m,
        value: value,
        valueStr: value >= 10000 ? (value / 10000).toFixed(1) + 'w' : value.toFixed(0),
        barHeight: 0,
        targetBarHeight: targetHeight,
        barColor: type === 'income' ? '#36e691' : '#FF6B6B'
      };
    });

    this.setData({
      categoryData,
      categoryTotal: totalAmount.toFixed(2),
      monthlyData,
      yAxisLabels,
      barAnimate: false
    }, () => {
      if (categoryData.length > 0) {
        this.initPieChartWithEcharts(categoryData, totalAmount);
      }
      this.triggerBarAnimation();
    });
  },

  triggerBarAnimation() {
    setTimeout(() => {
      const { monthlyData } = this.data;
      const animatedData = monthlyData.map(item => ({
        ...item,
        barHeight: item.targetBarHeight || 0
      }));
      this.setData({ monthlyData: animatedData, barAnimate: true });
    }, 100);
  },

  onMonthChange(e) {
    const month = parseInt(e.detail.value) + 1;
    this.setData({ currentMonth: month }, () => {
      this.loadStats();
    });
  },

  getCategoryName(category) {
    const map = {
      'food': '餐饮', 'transport': '交通', 'shopping': '购物', 'housing': '住房',
      'entertainment': '娱乐', 'medical': '医疗', 'education': '教育', 'communication': '通讯',
      'clothing': '服饰', 'beauty': '美容', 'social': '社交', 'pet': '宠物',
      'salary': '工资', 'bonus': '奖金', 'investment': '投资', 'parttime': '兼职', 'other': '其他'
    };
    return map[category] || category;
  }
});
