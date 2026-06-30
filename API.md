# BoomArena API 文档

> 基础地址：`http://localhost:3100`  
> 认证方式：`Authorization: Bearer <token>`（除登录/注册/排行榜外均需认证）  
> 内容类型：`application/json`

---

## 一、HTTP API

### 1.1 认证 `/api/auth`

#### POST /api/auth/register
注册新用户。

```json
// Request
{ "username": "play1", "password": "123456", "nickname": "玩家一" }

// Response 200
{ "token": "eyJ...", "user": { "id": 6, "username": "play1", "nickname": "玩家一", "rating": 1000 } }
```

| 字段 | 校验 |
|------|------|
| username | 2-16 字符，唯一 |
| password | 至少 4 位 |
| nickname | 必填 |

#### POST /api/auth/login
登录。

```json
// Request
{ "username": "admin", "password": "admin123" }

// Response 200
{ "token": "eyJ...", "user": { "id": 1, "username": "admin", "nickname": "Admin", "rating": 9999, "total_games": 5, "wins": 2 } }
```

错误：`401` — 用户名或密码错误

---

### 1.2 用户 `/api/user`（需认证）

#### GET /api/user/profile
获取当前登录用户的个人信息。

```json
// Response 200
{ "id": 1, "username": "admin", "nickname": "Admin", "avatar": "default", "game_character": "stick", "rating": 1000, "total_games": 5, "wins": 2, "win_rate": "40.0", "created_at": "2026-06-26 16:50:57" }
```

#### GET /api/user/public/:id
获取指定用户的公开资料（积分、胜场、胜率）。

```json
// Response 200
{ "id": 2, "username": "test1", "nickname": "TestPlayer1", "avatar": "default", "game_character": "stick", "rating": 1000, "total_games": 0, "wins": 0, "win_rate": "0.0" }
```

#### GET /api/user/leaderboard
排行榜（前 50 名）。无需认证。

```json
// Response 200
[{ "id": 1, "username": "admin", "nickname": "Admin", "rating": 9999, "wins": 2, "total_games": 5 }, ...]
```

#### GET /api/user/search?q=关键词
搜索用户。排除当前用户自己。

```json
// Response 200
[{ "id": 2, "username": "test1", "nickname": "TestPlayer1", "rating": 1000 }]
```

#### GET /api/user/matches
当前用户的对局历史（最近 20 条）。

```json
// Response 200
[{ "id": 1, "game_type": "bomberman", "is_winner": 1, "kills": 3, "rating_change": 25 }, ...]
```

| 字段 | 含义 |
|------|------|
| is_winner | 1=胜利 0=失败 |
| kills | 击杀数 |
| rating_change | 本局积分变动 |

#### POST /api/user/update-nickname
修改昵称。

```json
// Request
{ "nickname": "新昵称" }

// Response 200
{ "success": true, "nickname": "新昵称" }
```

#### POST /api/user/update-avatar
上传头像或选择预设头像。

**上传文件：**
```
Content-Type: multipart/form-data
字段名: avatar
限制: 2MB, jpg/png/gif/webp
```

```json
// Response 200 (上传成功)
{ "success": true, "avatar": "/uploads/avatars/avatar_1_1688000000.png", "isCustom": true }
```

**预设头像：**
```json
// Request
{ "avatar": "circle" }

// Response 200
{ "success": true, "avatar": "circle", "isCustom": false }
```

可选值：`default`, `circle`, `square`, `triangle`

#### POST /api/user/update-character
设置局内角色形象。

```json
// Request
{ "character": "circle" }

// Response 200
{ "success": true, "character": "circle" }
```

可选值：`stick`（火柴人）、`circle`（球）、`square`（方块）、`triangle`（三角）

#### POST /api/user/change-password
修改密码。

```json
// Request
{ "oldPassword": "旧密码", "newPassword": "新密码" }

// Response 200
{ "success": true }
```

---

### 1.3 好友 `/api/friends`（需认证）

#### GET /api/friends/list
好友列表。包含独立备注。

```json
// Response 200
[{ "id": 3, "username": "test2", "nickname": "TestPlayer2", "rating": 1000, "remark": "我的备注" }]
```

#### GET /api/friends/requests
待处理的好友请求。

```json
// Response 200
[{ "id": 2, "username": "test1", "nickname": "TestPlayer1", "rating": 1000 }]
```

#### POST /api/friends/request
发送好友请求。

```json
// Request
{ "friendId": 2 }

// Response 200
{ "success": true }
```

#### POST /api/friends/respond
接受或拒绝好友请求。

```json
// Request
{ "friendId": 2, "accept": true }

// Response 200
{ "success": true }
```

#### POST /api/friends/remove
删除好友。

```json
// Request
{ "friendId": 2 }

// Response 200
{ "success": true }
```

#### POST /api/friends/set-remark
设置好友备注（独立存储，对方不可见）。

```json
// Request
{ "friendId": 3, "remark": "张三" }

// Response 200
{ "success": true }
```

---

### 1.4 管理 `/api/admin`

#### POST /api/admin/login
管理员登录。账号 `admin` / `admin123`。

```json
// Request
{ "username": "admin", "password": "admin123" }

// Response 200
{ "success": true, "token": "eyJ..." }
```

#### GET /api/admin/stats
统计信息（需管理员 token）。

```json
// Response 200
{ "userCount": 5, "matchCount": 10, "recentMatches": 3, "onlineCount": 2 }
```

#### GET /api/admin/users
用户列表（需管理员 token）。

```json
// Response 200
[{ "id": 1, "username": "admin", "nickname": "Admin", "rating": 9999, "total_games": 5, "wins": 2, "avatar": "default", "created_at": "...", "last_login": "..." }]
```

#### GET /api/admin/announcements
获取公告列表。无需认证。

```json
// Response 200
[{ "content": "欢迎来到 BoomArena!", "created_at": "2026-06-26 16:50:57" }]
```

#### POST /api/admin/announcements
发布公告（需管理员 token）。

```json
// Request
{ "content": "今晚 8 点开黑！" }

// Response 200
{ "success": true }
```

#### GET /api/rooms
获取所有房间基本信息。无需认证。

```json
// Response 200
[{ "code": "ABCD", "players": 2, "status": "waiting" }]
```

---

## 二、Socket.IO 事件

> 连接时需传入 token：`io({ auth: { token } })`

### 2.1 客户端 → 服务端

#### lobby_chat
```javascript
// 发送大厅聊天消息
socket.emit('lobby_chat', '大家好');
```
限制：最长 100 字符，发送间隔 ≥ 1 秒

#### request_room_list
```javascript
// 请求房间列表
socket.emit('request_room_list');
// 服务端回复 room_list 事件
```

#### create_room
```javascript
// 创建房间
socket.emit('create_room', { gameType: 'bomberman', maxPlayers: 4 });
// 服务端回复 join_result
```
默认地图尺寸 17×17，主题 暗黑地牢。可在房间内调整。

#### join_room
```javascript
// 加入房间（可带密码）
socket.emit('join_room', { code: 'ABCD', password: '123' });
// 服务端回复 join_result
```

#### refresh_room
```javascript
// 刷新房间信息（页面重连时使用）
socket.emit('refresh_room', { code: 'ABCD' });
// 服务端回复 room_update
```

#### room_ready
```javascript
// 准备/取消准备
socket.emit('room_ready');
```

#### start_game
```javascript
// 房主开始游戏
socket.emit('start_game');
```
条件：≥ 2 人，全员准备，状态 waiting

#### leave_room
```javascript
// 离开房间
socket.emit('leave_room');
```

#### update_room_settings
```javascript
// 房主修改房间设置
socket.emit('update_room_settings', { mapSize: 21, theme: 'ice' });
```
| 参数 | 可选值 |
|------|--------|
| mapSize | 13, 15, 17, 21 |
| theme | `default`, `ice`, `volcano` |

#### game_input
```javascript
// 方向键输入
socket.emit('game_input', { dir: 'up', pressed: true });
// 松开
socket.emit('game_input', { dir: 'up', pressed: false });
```
方向：`up` `down` `left` `right`

#### plant_bomb
```javascript
// 放置炸弹
socket.emit('plant_bomb');
```

#### join_game
```javascript
// 加入游戏对局（进入游戏页面时调用，含断线重连）
socket.emit('join_game', { code: 'ABCD' });
```

#### request_results
```javascript
// 请求对局结算
socket.emit('request_results', { code: 'ABCD' });
// 服务端回复 game_over
```

#### private_msg
```javascript
// 发送私聊消息
socket.emit('private_msg', { targetId: 2, msg: '你好' });
```
限制：最长 200 字符，发送间隔 ≥ 1 秒

#### request_chat_history
```javascript
// 请求聊天历史
socket.emit('request_chat_history', { room: 'lobby' });
// 私聊历史
socket.emit('request_chat_history', { room: 'pm_1_2' }); // userId 小_大
// 服务端回复 chat_history
```

### 2.2 服务端 → 客户端

#### lobby_chat
```javascript
// 大厅聊天广播
socket.on('lobby_chat', function(data) {
  // data = { user: "Admin", msg: "大家好" }
});
```

#### online_users
```javascript
// 在线用户列表
socket.on('online_users', function(users) {
  // users = [{ id: 1, username: "admin", nickname: "Admin" }, ...]
});
```

#### room_list / room_created / room_updated / room_removed
```javascript
// 房间列表刷新
socket.on('room_list', function(list) {
  // list = [{ code, hostId, playerCount, maxPlayers, gameType, hasPassword, status, mapSize, theme }, ...]
});
socket.on('room_created', function(room) { ... });
socket.on('room_updated', function(data) { ... });
socket.on('room_removed', function(code) { ... });
```

#### join_result
```javascript
// 加入房间结果
socket.on('join_result', function(data) {
  // data = { success: true, code: "ABCD" }
  // data = { success: false, error: "Room full" }
  // 成功后跳转到 /room.html?code=ABCD
});
```

#### room_update
```javascript
// 房间状态更新
socket.on('room_update', function(data) {
  // data = { code, hostId, gameType, maxPlayers, hasPassword, players, status, mapSize, theme }
  // players = [{ userId, nickname, ready }, ...]
});
```

#### game_start
```javascript
// 游戏开始
socket.on('game_start', function(data) {
  // data = { map, players, gridSize, theme }
  // 跳转到 /game.html?code=房间码
});
```

#### game_state
```javascript
// 游戏状态（每 50ms 推送）
socket.on('game_state', function(state) {
  // state = {
  //   state: "playing" | "finished",
  //   tick: 1234,
  //   players: [{ id, nickname, x, y, direction, alive, color, maxBombs, activeBombs, bombRange, shielded, speed, kills, game_character, avatar, kicker, disconnected }],
  //   bombs: [{ id, x, y, ownerId }],
  //   explosions: [{ cells: [{x, y}] }],
  //   powerups: [{ x, y, type }],
  //   map: [[0,1,2,...]],
  //   winner: userId | null,
  //   elapsed: 12345,
  //   theme: "default"
  // }
});
```

#### game_over
```javascript
// 游戏结束（含结算）
socket.on('game_over', function(data) {
  // data = {
  //   winner: userId | null,
  //   matchId: 1,
  //   rankings: [{ id, nickname, rank }],
  //   scores: [{ userId, rank, kills, baseScore, killBonus, deathPenalty, ratingChange }]
  // }
});
```

#### private_msg
```javascript
// 收到私聊
socket.on('private_msg', function(data) {
  // data = { from: userId, fromName: "Admin", msg: "你好" }
  // 自己发送的: data.sent === true
});

socket.on('private_msg_error', function(msg) {
  // "User is offline"
});
```

#### chat_history
```javascript
// 聊天历史
socket.on('chat_history', function(data) {
  // data = { room: "lobby", messages: [{ user_name, message }] }
});
```

#### error_msg
```javascript
// 服务端错误消息
socket.on('error_msg', function(msg) {
  // "Not in a room", "Only host can start" 等
});
```

---

## 三、数据库表结构

### users
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 用户 ID |
| username | TEXT UNIQUE | 用户名 |
| password_hash | TEXT | bcrypt 密码 |
| nickname | TEXT | 昵称 |
| avatar | TEXT | 头像路径/预设 |
| game_character | TEXT | 局内角色 |
| rating | INTEGER | 积分（默认 1000） |
| total_games | INTEGER | 总对局数 |
| wins | INTEGER | 胜场 |
| created_at | DATETIME | 注册时间 |
| last_login | DATETIME | 最后登录 |

### matches
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 对局 ID |
| room_id | TEXT | 房间码 |
| game_type | TEXT | 游戏类型 |
| max_players | INTEGER | 最大人数 |
| started_at | DATETIME | 开始时间 |
| ended_at | DATETIME | 结束时间 |
| duration_secs | INTEGER | 时长 |
| status | TEXT | `waiting/playing/finished` |

### match_players
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| match_id | INTEGER FK | 对局 ID |
| user_id | INTEGER FK | 用户 ID |
| player_index | INTEGER | 玩家序号 |
| is_winner | INTEGER | 是否胜利 |
| kills | INTEGER | 击杀数 |
| rating_change | INTEGER | 积分变动 |

### friends
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| user_id | INTEGER FK | 请求方 |
| friend_id | INTEGER FK | 接收方 |
| status | TEXT | `pending/accepted` |
| remark | TEXT | 共享备注（已弃用） |
| created_at | DATETIME | |

### friend_remarks
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | INTEGER FK | 用户 |
| friend_id | INTEGER FK | 好友 |
| remark | TEXT | 独立备注 |

主键：`(user_id, friend_id)`

### chat_messages
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| room | TEXT | `lobby` 或 `pm_小ID_大ID` |
| user_id | INTEGER | 发送者 |
| user_name | TEXT | 发送者昵称 |
| message | TEXT | 消息内容 |
| created_at | DATETIME | |

### announcements
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| content | TEXT | 公告内容 |
| created_at | DATETIME | |
