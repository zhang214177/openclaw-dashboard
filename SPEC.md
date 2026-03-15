# OpenClaw 监控面板 - 规格说明书

## 1. 项目概述

- **项目名称**: OpenClaw Monitor Dashboard
- **类型**: Web 应用 (React + Express + SQLite)
- **核心功能**: 监控 OpenClaw AI 助手的状态，展示运行数据
- **目标用户**: OpenClaw 管理员

## 2. 功能列表

### 2.1 用户系统
- [x] 用户注册（用户名、密码、邮箱）
- [x] 用户登录（JWT Token）
- [x] 密码加密存储（bcrypt）
- [x] Session 管理

### 2.2 监控数据
- [x] 系统信息（OS、Node.js 版本、运行时间）
- [x] 会话统计（活跃会话数、总消息数）
- [x] 模型使用情况（当前模型、Token 消耗）
- [x] Skills 统计（已安装数量、分类）
- [x] 定时任务状态（Cron jobs）
- [x] 最近活动记录

### 2.3 仪表盘展示
- [x] 实时数据卡片
- [x] 活动时间线
- [x] 系统健康状态指示

## 3. 技术栈

- **前端**: React + Vite + TailwindCSS
- **后端**: Express.js + SQLite
- **认证**: JWT + bcrypt
- **部署**: 本地运行

## 4. 数据库结构

### users 表
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### stats 表
```sql
CREATE TABLE stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_type TEXT NOT NULL,
  metric_value TEXT NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### activities 表
```sql
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_type TEXT NOT NULL,
  description TEXT,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 5. 页面结构

1. **登录页** `/login` - 用户登录
2. **注册页** `/register` - 用户注册
3. **仪表盘** `/dashboard` - 主监控面板
4. **设置页** `/settings` - 用户设置

## 6. API 接口

- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/stats` - 获取监控数据
- `POST /api/stats` - 上报监控数据
- `GET /api/activities` - 获取活动记录

## 7. 安全措施

- 密码 bcrypt 加密
- JWT Token 认证
- 防止 SQL 注入
- CORS 配置
