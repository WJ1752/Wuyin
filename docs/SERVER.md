# 账号服务部署与运维

日期：2026-11-01。

2026-11-06 的实际公网部署、容量、存档重启与备份恢复结果见[部署实机记录](DEPLOYMENT.md)。当前手机默认界面未通过用户真机验收，正在重做；本文的服务端检查不代表项目整体已验收完成。

服务使用 Fastify、Node 内置 SQLite、HTTP-only 会话 Cookie 和同源 API。数据库保存注册账号、密码哈希、会话、账号角色与共享仓库的云端快照。前端生产文件也由同一个 Node 服务提供；Caddy 负责 HTTPS。

单人开荒的战斗和成长仍在客户端计算。默认组队远征由服务器模拟战斗并保存结果，但配装来自云档；结构校验不能证明上传的装备来自真实掉落。大厅与社区职业榜使用已同步云档，不能作为竞技反作弊认证。另有不读取玩家装备的官方配装试炼，使用独立服务器成绩表，详见本文末尾。

## 本机开发

需要 Node.js 22.18 或更高版本；生产镜像采用 Node 24 LTS。安装与运行：

```sh
pnpm install --frozen-lockfile
```

复制 `.env.example` 为 `.env`，保留开发默认值。分别在两个终端运行：

```sh
pnpm server:dev
```

```sh
pnpm dev
```

打开 `http://127.0.0.1:5173`。Vite 将 `/api` 代理到本机 3001 端口，浏览器继续使用同源 Cookie。开发环境没有启用 Secure Cookie，因此只能用于本机调试。Node 22 可能打印 SQLite 的实验性 API 提示。

如果修改 API 端口，在启动 Vite 前设置进程环境变量 `DEV_API_TARGET`（例如 `http://127.0.0.1:3002`），并让服务端 `APP_ORIGINS` 包含浏览器实际使用的前端来源。`DEV_API_TARGET` 仅用于开发代理，不是浏览器公开配置。

## 单机 Docker 部署

以下运维命令按 Linux shell 编写。准备 Docker Engine 与 Compose v2、一个指向服务器的真实域名，以及可访问的 TCP 80/443；UDP 443 用于 HTTP/3，可按网络条件关闭对应映射。

1. 在独立部署目录取得代码与锁文件，复制 `.env.example` 为 `.env`。
2. 修改 `PUBLIC_DOMAIN=game.example.com` 为真实域名，只填写域名，不加协议、路径或端口；修改 `ACME_EMAIL` 为证书联络邮箱。
3. 检查配置并启动：

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app proxy
curl --fail https://game.example.com/api/health
```

将上面的域名替换为实际值。健康接口应返回 `{"ok":true}`。打开 HTTPS 页面，注册一个验收账号，创建角色并刷新页面；退出后重新登录，确认角色和仓库可恢复。完成一次服务器重启后再确认存档存在。

Compose 会覆盖 `.env` 中的开发参数，使用 `NODE_ENV=production`、`HOST=0.0.0.0`、`PORT=3001`、`DATABASE_PATH=/app/data/wuyin.sqlite` 和 `APP_ORIGINS=https://${PUBLIC_DOMAIN}`。生产环境 Cookie 强制 Secure；不能用直连 HTTP 代替 HTTPS 登录验收。生产服务缺少 `APP_ORIGINS` 时拒绝启动。

应用与代理均以 UID/GID 1000 运行，根文件系统只读，丢弃 Linux capabilities。应用端口仅在 Compose 网络内可达；只有代理的 80/443 映射到宿主机。Caddy 在容器内部监听 8080/8443，通过端口映射提供标准 HTTP/HTTPS；其管理接口关闭。证书与数据库使用持久命名卷，初次创建时继承镜像中对应目录的 UID 1000 所有权。[Caddy 内外端口配置说明](https://caddyserver.com/docs/caddyfile/options#http-port)

`TRUST_PROXY=1` 只在此受控单层 Caddy 拓扑启用，使限流识别真实客户端 IP。不要额外公开应用 3001 端口，也不要让外部请求绕过可信代理直接访问应用。直连部署保持默认 `TRUST_PROXY=0`；增加代理层数前，应核对每一跳，不能直接信任所有转发头。

镜像分为构建、生产依赖、应用与代理阶段。`.dockerignore` 排除 `.env`、数据库、备份、缓存和本地依赖；镜像不包含注册账号数据库或部署凭据。基础镜像使用 Node 24 与 Caddy 2 的维护标签，更新时执行 `docker compose build --pull`，并保存此次上线的 Git 提交与镜像 ID，便于回滚。[Node 受支持版本](https://nodejs.org/en/about/previous-releases)

## 配置与数据

| 参数            | 默认值或用途                                               |
| --------------- | ---------------------------------------------------------- |
| `HOST`          | 本机默认 `127.0.0.1`，容器内为 `0.0.0.0`                   |
| `PORT`          | `3001`                                                     |
| `DATABASE_PATH` | 本机 `data/wuyin.sqlite`；容器 `/app/data/wuyin.sqlite`    |
| `APP_ORIGINS`   | 逗号分隔的精确来源，包含协议与可选端口，不允许路径或通配符 |
| `NODE_ENV`      | `production` 启用 Secure Cookie 与 `dist` 静态托管         |
| `TRUST_PROXY`   | 默认 `0`；允许 0–3 层可信代理，Compose 单层 Caddy 设置 `1` |
| `PUBLIC_DOMAIN` | Compose 的公开域名                                         |
| `ACME_EMAIL`    | Caddy 自动证书联络邮箱                                     |

| Compose 卷     | 内容                              |
| -------------- | --------------------------------- |
| `game_data`    | SQLite 数据库、WAL 和共享内存文件 |
| `game_backups` | 一致性数据库备份                  |
| `caddy_data`   | TLS 证书及私钥                    |
| `caddy_config` | Caddy 配置状态                    |

SQLite 采用 WAL 模式与忙等待。部署为单个应用实例，数据卷使用本机磁盘；不要用多个主机共享文件系统横向扩容。需要多实例写入时应先更换数据库和冲突协调方案。

会话相关签名密钥自动生成并保存在数据库内，无须另设 `SESSION_SECRET`。数据库备份也包含密码哈希、会话哈希和签名密钥，应按生产凭据保护，异地副本使用加密存储。日志不应输出密码、Cookie 或完整存档；默认日志轮转为每文件 10 MiB、保留 3 个文件。

`docker compose down` 保留命名卷；`docker compose down -v` 会删除数据库、备份和证书卷，不用于常规升级或重启。

## 在线备份

不能在运行时只复制 `wuyin.sqlite`：已提交的数据可能仍在 `-wal` 文件中。`server/backup.ts` 调用 Node 官方 SQLite 在线备份 API，之后执行 `PRAGMA quick_check`，只创建新文件并拒绝覆盖已有目标。备份文件权限为 0600。[Node SQLite backup API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)、[SQLite 在线备份说明](https://sqlite.org/backup.html)

本机运行：

```sh
pnpm server:backup
```

默认写入 `backups/wuyin-<UTC时间>.sqlite`，也可以指定目标路径：

```sh
pnpm server:backup backups/checkpoint-2026-11-01.sqlite
```

容器在线备份和导出到宿主机：

```sh
docker compose exec -T app node --import tsx server/backup.ts /app/backups/checkpoint-2026-11-01.sqlite
mkdir -p backups
docker compose cp app:/app/backups/checkpoint-2026-11-01.sqlite ./backups/
```

每次使用新的文件名，备份成功后再复制到异地加密存储。命名卷中的备份与主数据库仍在同一台机器上，不能替代异地副本。定时任务由部署环境的 cron、systemd timer 或运维平台调用同一命令；本项目不会自动创建定时任务。

## 停机恢复

恢复会将全部注册账号和云存档回退到选定备份时间。先关闭入口和应用，保留当前数据库的备份，再恢复；避免让仍打开页面的客户端继续上传过期状态。

下面示例恢复 `game_backups` 卷中已经存在的 `checkpoint-2026-11-01.sqlite`。文件名需换成实际备份；不要重复使用 `before-restore-2026-11-01.sqlite`。

```sh
docker compose stop proxy app
docker compose run --rm --no-deps app node --import tsx server/backup.ts /app/backups/before-restore-2026-11-01.sqlite
docker compose run --rm --no-deps app node --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
import { constants, copyFileSync, existsSync, mkdirSync, renameSync, chmodSync } from "node:fs";
const source = "/app/backups/checkpoint-2026-11-01.sqlite";
const destination = "/app/data/wuyin.sqlite";
const staged = "/app/data/wuyin.restore.sqlite";
const check = new DatabaseSync(source, {readOnly:true});
if (check.prepare("PRAGMA quick_check").get().quick_check !== "ok") throw new Error("Invalid backup");
if (![1, 2, 3].includes(check.prepare("PRAGMA user_version").get().user_version)) throw new Error("Unsupported database version");
check.prepare("SELECT token_hash FROM sessions LIMIT 0").all();
check.close();
copyFileSync(source, staged, constants.COPYFILE_EXCL);
chmodSync(staged, 0o600);
const retained = "/app/data/pre-restore-" + Date.now();
mkdirSync(retained, {mode:0o700});
for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(destination + suffix)) renameSync(destination + suffix, retained + "/wuyin.sqlite" + suffix);
}
renameSync(staged, destination);
const restored = new DatabaseSync(destination);
restored.exec("DELETE FROM sessions");
restored.close();
console.log("Restored; prior database retained at " + retained);
'
docker compose up -d
```

该过程先检查备份并创建暂存文件，再把旧主库及 WAL/SHM 一起移入保留目录，最后替换主库；不会将旧 WAL 套用到恢复后的数据库。`DELETE FROM sessions` 使旧会话失效，用户需重新登录并加载恢复后的云存档；避免旧页面用恢复前会话继续保存。恢复后检查健康接口、账号登录、角色和仓库，再开放使用；确认成功前保留 `pre-restore-*` 与恢复前备份。

若整台机器丢失，先在新主机创建 Compose 数据卷，将异地备份放入 `game_backups` 卷并确保 UID 1000 可读，再执行上述恢复流程；空库没有恢复前备份可做时，跳过该备份命令。卷名通常包含 Compose 项目前缀，可用 `docker volume ls` 确认。不要通过公开 HTTP 上传或下载数据库备份。

## 更新与故障定位

升级前运行一次在线备份，记录当前 Git 提交，再取得新版代码并执行：

```sh
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 app proxy
```

检查健康接口与一次真实登录、存档回读。数据库结构版本位于 `PRAGMA user_version`；回退旧镜像前先确认其兼容当前结构，无法兼容时使用升级前备份恢复。

- `APP_ORIGINS` 错误或 403：检查浏览器实际来源与配置完全一致，尤其是协议、端口和域名。
- 登录后刷新变成未登录：确认通过 HTTPS 访问生产站点，代理没有改写 Cookie。
- 409 存档冲突：客户端应保留本地副本并提示重新拉取云存档，不能直接用旧版本反复覆盖。
- 多名玩家同时遇到 429：核对可信代理跳数；不要通过关闭限流来掩盖代理 IP 配置错误。
- SQLite 权限错误：数据目录及已有卷需允许 UID/GID 1000 写入，不能仅允许读取主库。
- 健康检查失败：先看应用日志中的环境变量、数据库权限与启动错误；Compose 会等应用健康后启动代理。[Compose 启动依赖说明](https://docs.docker.com/compose/how-tos/startup-order/)

## 本轮验证范围

一轮完整测试 64 项通过，覆盖原有战斗、掉落、六角色、仓库以及新增认证、归属、并发版本、重启持久化与前端云生命周期。浏览器联调发现无请求体的退出请求误带 JSON Content-Type，修正后仅复验对应云生命周期用例。TypeScript 与生产构建通过，保留原有主包体积提示。

通过生产静态托管冒烟检查：首页与构建后的 JavaScript 资源可由后端读取，健康接口返回成功，未知 API 返回 404。

独立本机环境实测登录、显式迁移、云角色创建、刷新恢复、退出后恢复访客、重新登录载入云档；第二个独立会话更新云端后，旧设备修改触发冲突并暂停上传，明确选择加载后恢复第二设备版本。联调完成后浏览器无 error/warn 日志。截图：[云账号](cloud-accounts-preview.jpg)、[跨设备冲突](cloud-conflict-preview.jpg)。

已在 Node 22.18 上实测备份脚本：保持源数据库 WAL 打开且尚未检查点，备份成功读取全部已提交行；重复目标路径和源路径覆盖均被拒绝，源数据库保持可读。配置已与服务实际路由和启动参数交叉核对。

当前工作环境未安装 Docker，未执行镜像构建、Compose 启动、ACME 签发或真实公网恢复演练。以上命令与配置已提供，部署机器仍应执行文档中的启动和恢复验收；本轮没有连接或修改远端服务器。

## 多玩家大厅与职业榜（2026-11-01）

同源服务新增以下接口，继续使用现有 Cookie、CSRF、来源检查与速率限制：

| 接口                                  | 功能                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/lobby`                      | 游客也可读取真实在线角色、归一化位置、公开装备与成就；最多返回100名      |
| `POST /api/lobby/heartbeat`           | 登录并同步云档后发送 `x`、`y`（0–1）与活动状态；角色身份从服务端存档取得 |
| `POST /api/lobby/leave`               | 当前登录会话离开大厅，断线45秒自动过期，退出登录级联清除                 |
| `GET /api/leaderboard?classId=ranger` | 读取指定职业前20名，支持 ranger/barbarian/sorcerer/necromancer/druid     |

在线榜每账号、每职业取已同步通关记录中的最佳一条；优先层数、其次用时。公开字段为角色昵称、职业、等级、成绩和套装名称，不包含登录账号名、用户ID或完整存档。排行榜展示客户端战绩，仍不提供权威战斗验证。

数据库会由版本1自动升级到版本2，新增会话关联的 `lobby_presence` 表。升级前按上文备份；新旧备份均可恢复并由服务启动时迁移。保持单服务实例部署，角色移动使用短轮询，当前没有分区或聊天服务。

## 1–4 人协作远征（2026-11-01）

使用现有同源 API 与会话，新增 `GET /api/coop/room`，以及 `POST /api/coop/create`、`join`、`ready`、`start`、`exchange`、`leave`。创建传 `{stage}`，加入传六位 `{code}`，准备传 `{ready}`。交换传客人 `{input}` 或房主 `{snapshot}`，均返回当前成员可见的 `{room}`。

房间目前存放于单服务进程内，不写入SQLite；重启或更新服务会中止当前远征。请运行一个游戏服务实例，不能把不同队员分配到各自独立的后端副本。沿用当前 HTTP 反向代理即可，不需增加 WebSocket 配置。战场交换按登录用户独立限流，支持同IP四人联机。

所有成员必须登录、同步云端角色并解锁对应层数。房主客户端运行唯一模拟，服务端校验房间权限、输入/快照结构并中转，不提供服务器战斗反作弊或队长迁移。队长失联30秒、已有首帧后20秒不再产生新快照，或任意成员主动离队，会中止未结算远征。刷新队长页面会明确中止，避免重新建立不一致的世界；队员可重连仍在进行的房间。独立时钟可应对后台渲染降频，无法保证被浏览器完全冻结的页面继续运行。

具体数值与玩法见 [协作远征设计](COOP_DESIGN.md)。

## 长期保档、账号恢复与官方试炼（2026-11-06）

数据库结构升级至版本 3。新增的恢复码摘要、远征结算凭据、官方验证成绩与玩家反馈均随现有 SQLite 在线备份保存。

新界面创建组队时传 `{stage,authority:"server"}`，默认由服务器使用同一 `GameEngine` 托管全队。队长与队员均只提交操作，不能上传快照或成绩；刷新可回到同一战场，输入与命令序号从已确认位置续接，AUTO 恢复当前实战配置。单人成员断线不会结束全队，全员离线超过 30 秒才中止；主动离队仍中止全队。默认最多同时托管 2 场，可用 `MAX_HOSTED_ROOMS` 在 1–8 间配置。为兼容旧客户端，仅传 `{stage}` 的旧房主模拟模式仍保留，房主刷新会明确中止；不把旧模式的限制套用到默认托管模式。

- 合作最终帧在响应前将每名成员的结果写入 `coop_results`。`GET /api/coop/results` 查询本人未领取记录，`POST /api/coop/claim` 传 `{runId,revision}`，在同一数据库事务内调用与客户端相同的成长结算函数、写角色档、推进 revision 并标记领取。重复领取返回现有档案，不再发奖；旧 revision 写档被拒绝。领取事实不来自可导入的客户端字段，服务重启仍可从远征面板补领。房间本身仍是单进程短期状态，未完成的战斗不会在服务重启后继续。
- 注册会显示一次随机恢复码，服务器只保存 SHA-256 摘要。设置可验证当前密码后改密、轮换恢复码、撤销其它设备会话或永久注销；恢复码找回会轮换密码和恢复码并撤销旧会话。注销会级联删除云档、奖励和成绩，界面要求输入账号名和密码确认；操作前本机保留备份。
- `POST /api/trials/start` 只接收 `{setId}`，采用实验室的固定官方装备、当前统一技能预算、150 层和固定种子。服务器使用同一个 `GameEngine` 的无画面模式，以实际经过时间按 30Hz 推进；客户端只发送已学习技能的操作。`/api/trials/exchange` 拒绝客户端快照和成绩。默认最多 4 场，可用 `MAX_OFFICIAL_TRIALS` 在 1–16 间配置；低内存主机建议设置 2。`GET /api/trials/state` 可恢复仍在运行的试炼；断线超过 30 秒中止。
- 官方试炼不读取开荒装备，也不发放金币、装备或成长。成功成绩只由服务器写入 `verified_runs`，`GET /api/leaderboard/verified?classId=ranger` 读取每账号每流派的最佳条目并取职业前 20 条。原 `/api/leaderboard` 继续作为社区云档榜，两者明确区分；普通开荒、导入存档和房主模拟合作不具备竞技反作弊认证。
- `/api/feedback` 接收 `{category,message}`，类别为 `bug`、`suggestion`、`runtime` 或 `network`；消息限制 5–2000 字、每 IP 每分钟 5 次，保留 30 天，最多 10000 条。不要上传密码、恢复码或完整存档。账号页与设置页共用反馈表单。
- `/api/operations/metrics` 仅在配置至少 32 字符的 `OPERATIONS_TOKEN` 后开放，使用 `Authorization: Bearer <token>` 读取进程启动时间、请求数、5xx、平均/最大耗时、事件循环延迟、RSS/堆内存、远征/领取/试炼事件、待领数和反馈数；不返回存档或账号身份。默认不开放。日志对密码、恢复码、Cookie 和 Authorization 脱敏；超过 2 秒的 API 记录无请求体的慢请求日志。应由运维平台监控非 2xx、备份失败、持续 5xx 和内存；仓库中的指标本身不会代替通知服务。

### 低内存 Linux 主机与独立公网 HTTP 测试

`deploy/install-runtime.sh` 从 Node 官方下载 Node 24 x86_64 包并校验 SHA-256，安装在 `/opt/wuyin/runtime`，保留系统原有 Node 与其它服务。前端在开发机器完成构建，部署包应包含 `dist`、`src`、`server`、依赖清单和锁文件；服务器只安装锁定的生产依赖。

`deploy/wuyin.service` 使用专用 `wuyin` 用户、只读应用目录、独立 `/var/lib/wuyin/data` 与 256MiB JavaScript 堆，最大进程内存 450MiB；环境文件为 `/etc/wuyin/app.env`，发布目录通过 `/opt/wuyin/current` 指向。不要覆盖已有的其它应用或占用其端口。

明确选择暂不配置域名时，可使用独立端口，例如：

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
APP_ORIGINS=http://YOUR_SERVER_IP:8080
DATABASE_PATH=/var/lib/wuyin/data/wuyin.sqlite
MAX_OFFICIAL_TRIALS=2
MAX_HOSTED_ROOMS=2
ALLOW_INSECURE_PUBLIC_TEST=1
TRUST_PROXY=0
```

此显式开关允许 HTTP 测试 Cookie，但不会加密通信。登录界面提示只使用独立测试密码。正常生产默认仍强制 Secure Cookie；接入域名和 HTTPS 后移除此开关并把 `APP_ORIGINS` 改为准确 HTTPS 来源。不要把 HTTP 测试验收表述为 HTTPS 发布验收。

### 定时备份与隔离恢复演练

`server/dailyBackup.ts` 复用 Node SQLite 在线备份，写入 `BACKUP_DIRECTORY`（默认 `backups`），随后调用 `verifyRecovery` 将备份复制到隔离临时目录，检查完整性、账号/存档数量和撤销会话后的可重开性；不会替换在线数据库。只有新备份通过演练后，才清理本工具命名且超过 14 天的旧副本。

```sh
node --import tsx server/dailyBackup.ts
node --import tsx server/recoveryDrill.ts /path/to/backup.sqlite
```

在上述 systemd 布局中安装 `deploy/wuyin-backup.service` 与 `deploy/wuyin-backup.timer` 后，执行 `systemctl enable --now wuyin-backup.timer`，每天 UTC 04:00（香港 12:00）自动备份并验证恢复副本。可用 `systemctl start wuyin-backup.service` 立即执行，`journalctl -u wuyin-backup.service` 检查结果。该演练验证备份数据可恢复，不包含实际灾难切换、客户端重新登录或外部存储。主机上的副本仍须同步到独立存储；未提供异地目标时不能声称已经具备异地容灾。
