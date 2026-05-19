# 微信记账小程序

基于腾讯云数据库的微信记账小程序，支持收支记录、分类统计、数据可视化。

## 功能特性

- 📊 账单首页 - 年度/月度收支概览，按日期分组展示
- ➕ 快速记账 - 支出/收入切换，13种分类，自定义数字键盘
- 📈 统计图表 - 分类饼图、月度柱状图、趋势分析
- 👤 个人中心 - 用户头像、记账统计、数据管理

## 技术栈

### 前端
- 微信小程序原生开发
- WXML / WXSS / JavaScript

### 后端
- Node.js + Express
- MySQL2 (腾讯云数据库)
- RESTful API

## 项目结构

```
├── app.js                 # 小程序入口
├── app.json               # 全局配置
├── app.wxss               # 全局样式
├── pages/                 # 页面目录
│   ├── home/             # 账单首页
│   ├── add/              # 记账页面
│   ├── stats/            # 统计页面
│   └── settings/         # 个人中心
├── server/               # 后端API
│   ├── server.js         # Express服务器
│   ├── db.js             # 数据库连接
│   └── routes/
│       └── bills.js      # 账单路由
└── assets/icons/         # 图标资源
```

## 数据库表结构

```sql
CREATE TABLE bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(10) NOT NULL,        -- 'income' 或 'expense'
  category VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/bills | 获取账单列表 |
| POST | /api/bills | 创建账单 |
| DELETE | /api/bills/:id | 删除账单 |
| GET | /api/bills/stats/summary | 获取统计摘要 |

## 快速开始

### 后端部署

```bash
cd server
npm install
npm start
```

### 小程序配置

1. 微信开发者工具导入项目
2. 配置 request 合法域名：`https://your-domain.com`
3. 编译预览

## 自动同步

运行 PowerShell 脚本实现文件变更自动推送到 GitHub：

```powershell
.\sync.ps1
```

## 开发者

- GitHub: [@your-username](https://github.com/your-username)
