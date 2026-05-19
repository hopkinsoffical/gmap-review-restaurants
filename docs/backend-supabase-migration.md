# 后端 Supabase 迁移说明

## 文档目的

这份文档说明如何把本项目的后端数据层，从当前正在使用的 Supabase 项目，迁移到公司名下的新 Supabase 项目。

这份文档面向后续接手迁移的同事编写，重点是让下一位同事可以直接执行，不需要重新梳理当前仓库依赖、数据结构和迁移顺序。

## 当前状态

- 前端归属迁移已经完成。
- 当前规范化后的 GitHub 仓库是：
  - `https://github.com/hopkinsoffical/gmap-reivew-salon`
- 当前规范化后的 Vercel 部署目标已经在公司名下 Vercel 账号中。
- 后端目前仍然连接旧的 Supabase 项目，因为新的公司 Supabase 项目还没有创建并验证完成。
- 本次后端迁移遇到的直接阻塞点是：
  - 当前拿到的公司 Supabase 访问入口，无法稳定地为本产品创建一个新的独立 project
  - 在 dashboard 中出现了项目列表拉取失败、以及创建 project 时前端 client-side exception 的问题

## 推荐目标状态

- 为本产品单独创建一个独立的 Supabase project。
- 不要复用已经装有其它产品数据、函数、embeddings 或历史表结构的共享项目。
- 切换完成后，Vercel production 应使用新公司 Supabase 项目的：
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## 为什么建议单独建项目

- 这个项目的后端使用了 service-role 级别的数据库访问。
- 如果和其它产品共用一个 Supabase project，会明显增加以下风险：
  - 数据污染
  - schema / table / function 冲突
  - 不同系统共用同一套高权限密钥
  - 回滚和排错困难
- 当前仓库已经自带完整 schema 和 seed 流程，所以单独建项目是最干净、最容易验证的迁移方式。

## 与迁移相关的项目架构

- 前端：
  - 静态站点：`index.html` + `app.js` + `styles.css`
- 后端：
  - Vercel Functions，路径在 `api/stores/[slug]/*`
- 数据库访问：
  - Supabase JS admin client 创建位置：
    - [lib/server/supabase.js](../lib/server/supabase.js)
  - 服务端环境变量读取位置：
    - [lib/server/env.js](../lib/server/env.js)

当前后端实际依赖的数据库环境变量只有两个：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 开始前必须具备的条件

在动手迁移之前，先确认以下条件全部满足：

- 可以登录正确的公司 Supabase 账号
- 可以访问官方 Supabase dashboard：
  - `https://supabase.com/dashboard`
- 可以在公司 organization 下创建新的 project
- 可以打开新 project 的 `SQL Editor`
- 可以查看新 project 的 API keys
- 可以修改公司名下 Vercel 项目的 production environment variables

## 第一步：创建新的 Supabase 项目

在公司 Supabase 账号下，为本产品单独新建一个 project。

推荐的 project 名称：

- `rankmysalon-prod`

如果这个名字已经被占用，可以用接近的命名，例如：

- `gmap-review-salon-prod`

创建 project 时的建议：

- Region：
  - 选美国区域，尽量靠近主要用户
- Database password：
  - 使用强密码，并保存到公司统一的密码管理位置
- Organization：
  - 使用当前公司 organization，不要建到个人 workspace

## 第二步：从新项目里取出必须的连接信息

在新的 Supabase project 创建完成之后，取出以下两个值：

- `Project URL`
- `service_role` key

重要说明：

- 本项目运行时**不是**直接使用 Postgres 原始连接串。
- 不要把 `Connect` 弹窗里那个 `postgresql://...` 连接串直接拿去填 Vercel。
- 这个仓库当前运行时真正需要的是：
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

读取这些值的代码位置：

- [lib/server/env.js](../lib/server/env.js)
- [lib/server/supabase.js](../lib/server/supabase.js)

## 本项目需要的数据库对象

这个项目当前依赖以下核心表：

- `stores`
- `store_menu_snapshots`
- `scan_events`
- `store_staff`

仓库中已经包含了 schema 和 seed 文件：

- [sql/001_schema.sql](../sql/001_schema.sql)
- [sql/002_seed_store_example.sql](../sql/002_seed_store_example.sql)
- [sql/003_add_store_review_keywords.sql](../sql/003_add_store_review_keywords.sql)
- [sql/004_seed_store_staff.sql](../sql/004_seed_store_staff.sql)

## SQL 执行顺序

请使用 Supabase 的 `SQL Editor`，按下面的顺序执行，顺序不要改。

### 1. 基础 Schema

执行：

- [sql/001_schema.sql](../sql/001_schema.sql)

这个文件会创建：

- `public.stores`
- `public.store_menu_snapshots`
- `public.scan_events`
- `public.store_staff`
- `updated_at` trigger
- 必需索引

### 2. 店铺基础数据

执行：

- [sql/002_seed_store_example.sql](../sql/002_seed_store_example.sql)

这个文件会创建或更新当前产品正在使用的店铺：

- `angel-tips-garwood`

### 3. 评论关键词补充

执行：

- [sql/003_add_store_review_keywords.sql](../sql/003_add_store_review_keywords.sql)

这个文件的作用是确保店铺的 `review_keywords` 字段被正确填入。

### 4. Staff 列表

执行：

- [sql/004_seed_store_staff.sql](../sql/004_seed_store_staff.sql)

这个文件会插入或更新店铺：

- `angel-tips-garwood`

对应的 staff 列表。

## 第三步：导入菜单快照

注意：仅执行 SQL 还不够。  
菜单数据还必须单独导入 `store_menu_snapshots` 表。

导入脚本是：

- [scripts/seed-menu-snapshot.js](../scripts/seed-menu-snapshot.js)

这个脚本会读取：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STORE_SLUG`
- `MENU_VERSION`
- `MENU_FILE`
- `SOURCE_NOTE`

默认使用的菜单文件是：

- [menu.json](../menu.json)

### 推荐的一次性本地执行方式

在 repo 根目录运行。运行前，先临时把 `.env.local` 或当前 shell 环境改成新的公司 Supabase 项目值。

```bash
cd "/path/to/gmap-reivew-salon"
set -a
source .env.local
set +a
STORE_SLUG=angel-tips-garwood MENU_VERSION=1 MENU_FILE=./menu.json SOURCE_NOTE="Seeded into company Supabase project" node scripts/seed-menu-snapshot.js
```

执行前要特别确认：

- `SUPABASE_URL` 已指向新的公司 Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` 已指向新的公司 Supabase project

注意：

- 不要把这些本地密钥改动提交进仓库。

## 第四步：在 Supabase 内做最小验证

完成 SQL 和菜单导入之后，先不要急着切 Vercel。  
先在新的 Supabase project 内做最小验证。

### 表级验证

在 `Table Editor` 里确认：

- `stores` 中存在且只存在当前产品需要的 active store：
  - `angel-tips-garwood`
- `store_staff` 中已经有 staff 数据
- `store_menu_snapshots` 中已经有一条 published 的菜单快照

### 推荐执行的 SQL 检查

在 `SQL Editor` 中手动运行：

```sql
select slug, is_active
from public.stores;
```

```sql
select count(*) as staff_count
from public.store_staff ss
join public.stores s on s.id = ss.store_id
where s.slug = 'angel-tips-garwood';
```

```sql
select version, is_published, published_at
from public.store_menu_snapshots sms
join public.stores s on s.id = sms.store_id
where s.slug = 'angel-tips-garwood'
order by version desc;
```

期望结果至少包括：

- 可以看到 `angel-tips-garwood`
- `store_staff` 有数量
- `store_menu_snapshots` 有一条 published 数据

## 第五步：确认无误后再更新 Vercel

在新的 Supabase project 验证通过之前，不要切生产。

只有确认新 Supabase 项目可用之后，才去修改 Vercel production env：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

其余 production env 除非有明确变更需求，否则保持现状：

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `APP_BASE_URL`
- `TAVUS_API_KEY`
- `PIPECAT_BACKEND_URL`

## 第六步：切换后验证线上功能

修改完 Vercel env 并重新部署后，验证线上功能。

### 功能验证

- 打开站点，确认 store bootstrap 正常
- 打开：
  - `/stores/angel-tips-garwood`
- 确认菜单和 staff 可以正常加载
- 确认 review generation 仍然能正常工作
- 确认 receipt recognition 流程仍然能正常工作

### API 验证

至少验证：

- `GET /api/stores/angel-tips-garwood/bootstrap`

期望结果：

- 不是报错响应
- 返回 store 数据
- 返回菜单快照
- 返回 staff 列表

## 回滚方案

如果新的 Supabase project 验证失败：

1. 立刻把 Vercel 中这两个值改回旧项目：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. 重新部署 Vercel 项目
3. 保留新 Supabase project，方便继续排查
4. 在新项目完全验证通过之前，不要删除旧的可用后端配置

## 已知阻塞历史

第一次迁移尝试中，已经遇到过以下问题：

- 在公司 Supabase 入口中，项目列表拉取失败
- 在尝试创建新 project 时，dashboard 出现 client-side exception

这通常意味着以下几种可能：

- 当前给出的访问入口不是标准管理入口
- dashboard 本身处于异常状态
- 当前账号虽然能看见一些项目，但没有稳定创建新 project 的能力

如果再次遇到类似问题，建议按下面顺序处理：

1. 改用官方 dashboard：
   - `https://supabase.com/dashboard`
2. 确认公司账号是否具备创建 project 的权限
3. 如果仍不稳定，直接请负责 Supabase 的同事代建这个独立 project

## 最终交接检查清单

在宣布迁移完成之前，确认下面所有项目都成立：

- 新的公司 Supabase project 已创建
- SQL schema 已执行
- store 数据已 seed
- review keywords 已写入
- staff 已写入
- menu snapshot 已导入
- Vercel production 的 `SUPABASE_URL` 已更新
- Vercel production 的 `SUPABASE_SERVICE_ROLE_KEY` 已更新
- 线上 bootstrap 已验证通过
- 线上 review generation 已验证通过
- 旧后端凭证仍保留到确认不再需要回滚为止
