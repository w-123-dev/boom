# BoomArena 💣

多人联机炸弹人对战平台。Node.js + Express 后端，Socket.IO 实时通信，SQLite 数据库，原生 Canvas 渲染前端。

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
node server/index.js

# 3. 打开浏览器
http://localhost:3100
```

---

## 账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | `admin` | `admin123` | 后台 `/admin.html` |
| 玩家 1 | `test1` | `123456` | 测试账号 |
| 玩家 2 | `test2` | `123456` | 测试账号 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js + Express |
| 实时通信 | Socket.IO v4 |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JWT (jsonwebtoken + bcryptjs) |
| 前端 | 原生 HTML5 / CSS3 / JavaScript |
| 游戏渲染 | Canvas 2D |
| 音效 | Web Audio API（合成音效，无外部依赖） |
| 文件上传 | multer |

---

## 功能

### 🎮 游戏系统
- 2-4 人实时联机对战
- 6 种道具：💣+ 炸弹、🔥+ 范围、⚡ 加速、🛡️ 护盾、👟 踢炸弹、💀 减速
- 动态难度：随时间推进自动加速、提升炸弹上限
- 3 种地图主题：暗黑地牢、🧊 冰雪世界、🌋 火山炼狱
- 4 种地图尺寸：13×13、15×15、17×17、21×21
- 局内角色：火柴人、球、方块、三角
- 断线重连：断线后 HUD 显示 `[disconnected]`，重连后可继续游戏
- 10 分钟超时平局

### 🏠 大厅
- 房间列表（显示人数、密码、地图尺寸、主题）
- 大厅聊天 + 历史记录
- 在线用户列表（点击查看资料卡片）
- 用户卡片：积分、胜场、胜率

### 👤 用户系统
- 注册 / 登录
- 个人主页：昵称修改、头像上传、密码修改
- 局内角色选择
- 排行榜（前 50）
- 对局历史

### 🤝 好友系统
- 搜索用户、发送好友请求
- 接受 / 拒绝
- 删除好友
- 独立备注（双方互不可见）
- 私聊

### 🛠️ 管理后台
- 用户管理
- 数据统计
- 公告发布

### 🏆 积分规则
| 排名 | 基础分 | 额外 |
|------|--------|------|
| 第 1 名 | +20 | |
| 第 2 名 | +10 | 每次击杀 +5 |
| 第 3 名 | 0 | 每次死亡 -10 |
| 第 4 名 | -5 | |

---

## 游戏操作

| 按键 | 功能 |
|------|------|
| ↑ ↓ ← → / W A S D | 移动 |
| 空格 | 放置炸弹 |
| M | 开关音效 |

---

## 项目结构

```
bomberman-platform/
├── server/                       # 后端
│   ├── index.js                  # 入口 + Socket.IO 逻辑
│   ├── config.js                 # 配置
│   ├── db.js                     # 数据库初始化
│   ├── routes/
│   │   ├── auth.js               # 登录 / 注册
│   │   ├── user.js               # 用户信息 / 排行榜
│   │   ├── friends.js            # 好友系统
│   │   └── admin.js              # 管理后台
│   ├── utils/
│   │   └── jwt.js                # JWT 工具
│   └── game-engine/
│       └── bomberman/
│           ├── game.js           # 游戏主循环
│           ├── player.js         # 玩家逻辑
│           ├── bomb.js           # 炸弹逻辑
│           ├── map.js            # 地图生成
│           └── powerup.js        # 道具系统
├── public/                       # 前端
│   ├── index.html                # 大厅
│   ├── login.html / register.html
│   ├── profile.html              # 个人主页
│   ├── room.html                 # 房间
│   ├── game.html                 # 游戏
│   ├── leaderboard.html          # 排行榜
│   ├── admin.html                # 管理后台
│   ├── css/
│   │   ├── common.css            # 全局样式
│   │   ├── lobby.css             # 大厅样式
│   │   └── login.css             # 登录样式
│   └── js/
│       ├── api.js                # 请求封装
│       ├── socket.js             # Socket 初始化
│       ├── lobby.js              # 大厅逻辑
│       ├── game-client.js        # 游戏客户端
│       ├── sound.js              # 音效系统
│       └── renderer/index.js     # Canvas 渲染器
├── data/
│   └── database.sqlite           # SQLite 数据库
├── uploads/
│   └── avatars/                  # 头像上传目录
├── README.md
└── API.md                        # 接口文档
```

---

## API 文档

完整的 HTTP 接口和 Socket.IO 事件说明见 [API.md](/API.md)，包含：
- 所有 RESTful 接口的请求/响应格式
- 所有 Socket.IO 事件的收发格式
- 数据库表结构

---

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
node server/index.js

# 监听端口 3100
```

管理员后台：`http://localhost:3100/admin.html`
