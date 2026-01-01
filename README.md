<div align="center">

# SparkField · 灵光之野

**在策弈与探索的乐趣中，点亮每一刻思考的火花**

[简体中文](README.md) · [English](README.en.md)

</div>

---

**SparkField（灵光之野）** 是一款将**策略自走棋博弈**与**自适应间隔重复学习**自然融合的开源项目。
对局将「导学 → 练习 → 测验 → 订正 → 巩固」五步学习微节点嵌入战术准备与 3D 六角格自动战斗节奏之中：把经过客观核验的知识掌握转化为局内纯整数金币法球与充能结转，同时基于 `FSRS-6` 记忆算法在局外与跨赛季持续追踪长期记忆保持。

第 1 赛季主题为 **《光锥之外》（Beyond the Light Cone）**：包含 36 张原创硬科幻棋子、非对称派系/职能羁绊网、三套程序化 `Three.js` PBR 太空舞台、Colyseus 权威联机房间、PostgreSQL 事务持久化、浏览器离线演练与 Tauri 2 原生宿主支持。

---

## 核心特性

- **玩中学双轨驱动，资源纯整数核算**
  - 每个学习节点按冻结权重 `S = Σ(w_i × q_i) / Σw_i` 核算得分率，并通过有理数整数除法 `(g, c_next) = divmod(c_prev + floor(B × S), 100)` 投送**纯整数金币法球**，余数 `c_next` 存入充能环跨节点结转，保持商店心算清爽同时与小数预算严格等价。
  - 基于 `ts-fsrs`（FSRS-6）动态编排局内外到期复习与下一步推荐，支持单选、多选、配对、短填空、带容差数值与多步分步数值等 6 类客观题型，并支持 `KaTeX` 数学公式排版。

- **确定性策略战棋引擎（`@pkg/game-core`）**
  - **748 张共享牌库**：1～5 费共 36 名原创单位、Lv3–Lv10 刷牌概率、空档归一化与 8 席无淘汰全赛程圆桌对阵（支持四分之一制胜点与同分并列结算）。
  - **深度装备与强化策略**：8 种基础散件合成 36 件成装 + 8 派系纹章 + 远征母舰旗、铁砧多选一、阶段自动补充的磁约束拆卸器与重铸器，以及 24 项三阶半定制历史符文强化。
  - **精致战棋手感与战斗细节**：支持满席直购连锁合星、占格互换与满人口一换一替补、准备倒计时自动补齐、锁店跨轮自动解锁、可达格稳定索敌、护盾/施法锁蓝与延迟回蓝兑现，以及在途弹体全部结清后再判定胜负（支持同归于尽平局）。

- **全屏 Three.js PBR 舞台与精工界面**
  - 原生封装 `BoardStageEngine`（`Three.js` + `postprocessing` `SelectiveBloom` / `SMAA` + `@tweenjs/tween.js`），程序化烘焙玄武钛岩、拉丝香槟金磨损边、白瓷装甲与蓝宝石晶格 PBR 四件套，提供**天梯港 / 戴森熔炉 / 视界观测台**三套可切换舞台与 1★/2★/3★ 升星聚拢光柱、分格刻度血条演出。
  - 打开学习简报板时自动调用 `setAnimationLoop(null)` 挂起 3D 渲染循环降低能耗；全站提供全屏渐进式开屏引导、4 页动态 SVG 图解与 90 秒零持久化实机演练。

- **双格式同构题库编译器（`@pkg/pack-compiler`）**
  - 零服务端依赖，支持标准 `.csv` 表格与 `.md`（YAML Frontmatter）源码双向编译与反编译导出，提供精确到行号的静态诊断、知识图谱 DAG 环检测、`KaTeX` 公式定界符校验以及嵌入原装 `QuestionStepCard` 的沙盒试做与版本回滚。

- **全栈联机、离线演练与多端交付**
  - 后端基于 Fastify + Colyseus + Kysely + PostgreSQL：支持本地账号认证（邮箱选填）、多端唯一 `session_epoch` 顶号无缝接管席位、断线保护与程序 AI 接管（绝不代答学习题）、OpenSkill 独立模式榜单及单事务行锁积分兑换账本。
  - 支持无后端的纯离线单机演练（`Dexie` IndexedDB 原子记录原始作答，联网后按学习单元幂等批次同步）。
  - Web 与 Tauri 2 共用一套前端代码，配套桌面与移动端（macOS / Windows / Linux / Android / iOS）原生宿主工程。

---

## 三种对局节奏

| 模式 | 总时长 | 学习节点 | 主战斗轮次 | 每轮准备期 | 适用场景 |
|---|---:|---:|---:|---:|---|
| **超快（Quick）** | 15 分钟 | 4 节（6 分钟） | 6 轮 PVP | 50 秒 | 碎片时间快速博弈与间隔回顾 |
| **标准（Standard）** | 30 分钟 | 6 节（15 分钟） | 7 PVP + 1 PVE | 50 秒 | 主推完整策略经营与重点精学 |
| **深度（Deep）** | 60 分钟 | 8 节（32 分钟） | 10 PVP + 2 PVE | 50 秒 | 长线综合迁移（含 2 次护眼休息） |

---

## 仓库结构

```text
.
├── apps/
│   ├── client/          # React 前端、Three.js PBR 舞台引擎、Dexie 离线演练与 Tauri 2 原生宿主
│   └── server/          # Fastify REST API、Colyseus 权威房间与 Kysely / PostgreSQL 服务
├── packages/
│   ├── contracts/       # 共享 Zod 协议契约、防剧透题目投影、扩展接口与内容装载器
│   ├── game-core/       # 纯 TypeScript 确定性战棋引擎、AI 机器人与守恒属性校验
│   ├── learning-core/   # 6 题型客观判分、有理数金币结算、FSRS-6 调度与积分额度策略
│   ├── learning-ui/     # 可复用 KaTeX 渲染、五步答题卡、图鉴编年史与推荐成装合成树组件
│   └── pack-compiler/   # 无 IO 依赖的 CSV / Markdown+YAML 双向课程包编译器与校验器
└── content/
    ├── courses/         # 双格式题库源码示例与编译后的标准课程包 JSON
    ├── game/            # 36 棋子、18 羁绊、散件成装与 24 强化配置数据
    ├── lore/            # 第 1 赛季六纪元编年史、派系志与台词文本档案
    └── modes/           # 三模式精确时间线、经济参数与商店概率表
```

---

## 开源技术栈

- **前端与 3D 渲染**：React 19、TypeScript、Vite、Three.js、postprocessing、@tweenjs/tween.js、KaTeX、Dexie
- **服务端与实时通信**：Node.js（`>= 22`）、Fastify、Colyseus、Kysely、PostgreSQL（`>= 16`）、Zod、OpenSkill、ts-fsrs
- **跨端原生宿主**：Tauri 2（Rust）

---

## 快速开始

### 环境要求

- **Node.js** `>= 22` 与 **pnpm** `>= 10`
- **PostgreSQL** `>= 16`
- **Rust** 稳定版工具链 *（仅在需要编译 Tauri 2 原生桌面/移动包时安装）*

### 本地运行步骤

1. **安装工作区依赖**
   ```bash
   pnpm install
   ```

2. **准备本地环境变量与 PostgreSQL 数据库**
   ```bash
   cp .env.example .env
   createdb beyond_light_cone
   ```
   *(按需在 `.env` 中配置 `DATABASE_URL`，以及用于初始化管理员账号的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`。)*

3. **同时启动后端权威服务与前端开发服务器**
   ```bash
   pnpm dev
   ```
   启动后即可在浏览器访问 **`http://127.0.0.1:5173`**（后端默认监听 `http://127.0.0.1:3001`；也可在登录页直接选择「离线试玩」免数据库体验单机棋盘与五步练习）。

---

## 测试与构建命令

```bash
# 1. 全仓 TypeScript 严格类型检查
pnpm typecheck

# 2. 全仓单元测试与真实 PostgreSQL / Colyseus 集成测试
pnpm test

# 3. 隔离浏览器 UI 动作专项回归
pnpm test:ui

# 4. 全栈真实浏览器端到端验收（自动拉起隔离库测试服务与 Metal WebGL 渲染）
pnpm test:e2e

# 5. 构建 Web 生产产物
pnpm --filter @app/client build

# 6. Rust 原生宿主单元测试与桌面应用打包
cd apps/client/src-tauri && cargo test --locked
pnpm --filter @app/client exec tauri build
```

---

## 开源协议

基于 [MIT License](LICENSE) 开源发布。
