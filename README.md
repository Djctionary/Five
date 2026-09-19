# Five

一个给小圈子用的空闲时间协调工具。每个人在周视图上标出自己有空的时段，
页面会算出所有人重合的时间。

## 功能

- 注册需要一个共用密钥，密钥只在服务端校验，同一 IP 15 分钟内最多失败 10 次
- 用户名加密码登录，密码用 scrypt 哈希存储。没有邮箱，也没有找回密码
- 头像由种子在本地生成 SVG，四种样式，随时可以换
- 周视图按 30 分钟分格，鼠标拖动或手机点选来标记空闲
- 可以筛选看哪些人的时间，重合人数越多颜色越深
- 侧栏列出本周所有人都有空的时段

## 本地运行

```bash
npm install
cp .env.example .env.local   # 填入 DATABASE_URL 和 INVITE_CODE
npm run db:init              # 建表
npm run dev
```

`npm run db:init` 会把 `db/schema.sql` 应用到 `DATABASE_URL` 指向的库，可以重复执行。

## 部署到 Vercel

1. 把仓库导入 Vercel
2. 在项目的 Storage 里添加 Neon，`DATABASE_URL` 会自动注入
3. 手动加两个环境变量：`INVITE_CODE`，以及可选的 `APP_TIMEZONE`（默认 `Asia/Shanghai`）
4. 部署完成后在本地跑一次 `DATABASE_URL=<生产库连接串> npm run db:init` 建表

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | Neon Postgres 连接串 |
| `INVITE_CODE` | 注册密钥，只在服务端比对 |
| `APP_TIMEZONE` | 全组共用的时区，IANA 名称，默认 `Asia/Shanghai` |

## 结构

```
app/            页面与 server actions
components/     界面组件
lib/            数据库、鉴权、时间与头像工具
db/schema.sql   表结构
```

时间以本地日期加 0-47 的半小时格号存储，不存时区偏移，因此全组必须在同一个时区。
