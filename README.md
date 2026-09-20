# Soul V

五个灵魂的空闲时间协调工具。每个人在周视图上标出自己有空的时段，
页面会算出所有人重合的时间。

## 功能

- 注册需要一个共用密钥，密钥只在服务端校验，同一 IP 15 分钟内最多失败 10 次
- 用户名加密码登录，密码用 scrypt 哈希存储。没有邮箱，也没有找回密码
- 头像由种子在本地生成 SVG，四种样式，随时可以换
- 日历只画中午到午夜，正好占满一屏，不需要滚动
- 电脑上显示一周，按钮翻页；手机上显示三天，左右滑动翻页
- 拖动选一段时间（不跨天），松手后填这段时间想干什么，点自己的块可以改或删
- 每个人一个颜色，各占一条竖道；所有选中的人都有空的那段会被斜纹标出来
- 可以筛选只看哪几个人

## 本地运行

```bash
npm install
cp .env.example .env.local   # 填入 DATABASE_URL 和 INVITE_CODE
npm run db:init              # 建表
npm run dev
```

## 部署到 Vercel

1. 把仓库导入 Vercel
2. 在项目的 Storage 里添加 Neon，`DATABASE_URL` 会自动注入
3. 加环境变量 `INVITE_CODE`，以及一个临时的 `MIGRATE_TOKEN`（随便一串长一点的随机字符）
4. 部署完成后访问 `https://<你的域名>/api/init?token=<MIGRATE_TOKEN>`，
   返回 `{"ok":true,...}` 就说明表建好了
5. 回到环境变量里删掉 `MIGRATE_TOKEN`，重新部署一次。没有这个变量时该接口直接返回 404

建表也可以不通过这个接口：`npm run db:sql` 会把建表语句打印出来，粘到 Neon 控制台的
SQL Editor 里执行一次即可；或者本地跑 `DATABASE_URL=<连接串> npm run db:init`。
三条路等价，语句全是 `if not exists`，重复执行没有副作用。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | Neon Postgres 连接串 |
| `INVITE_CODE` | 注册密钥，只在服务端比对 |
| `APP_TIMEZONE` | 全组共用的时区，IANA 名称。留空或填错会退回 `Asia/Shanghai` |
| `MIGRATE_TOKEN` | 可选。设了之后 `/api/init?token=<它>` 可以建表，建完就删掉 |

## 排查

`/api/health` 会返回数据库是否连得上、四张表在不在、以及几个环境变量有没有配，
不返回任何表里的数据。页面上遇到数据库问题时会直接把错误写在界面上，而不是
一个 Next.js 的 digest。

## 结构

```
app/              页面、server actions 与 /api/init
components/       界面组件
lib/              数据库、鉴权、时间与头像工具
lib/schema.mjs    表结构，建表的唯一来源
scripts/          建表与打印建表语句的脚本
```

时间以本地日期加 0-47 的半小时格号存储，不存时区偏移，因此全组必须在同一个时区。
界面只画格号 24 到 48，也就是中午到午夜；这个范围在 `lib/time.ts` 的
`VIEW_FIRST_SLOT` 和 `VIEW_LAST_SLOT` 里，要改改这两个常量即可。
