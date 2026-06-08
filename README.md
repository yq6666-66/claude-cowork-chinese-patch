# Claude Cowork 中文补丁

[![CI](https://github.com/yq6666-66/claude-cowork-chinese-patch/actions/workflows/ci.yml/badge.svg)](https://github.com/yq6666-66/claude-cowork-chinese-patch/actions/workflows/ci.yml)

这是一个面向 Windows 版 Claude Desktop / Cowork 的中文界面补丁器。默认使用 **workspace-safe external locale 模式**：更新 Claude 外置 locale / `ion-dist` i18n JSON，不修改 `Claude.exe` 和 `resources/app.asar`，优先保证 Claude 工作区 / VM 能正常启动。

项目不会分发 Claude、`app.asar`、`Claude.exe` 或任何修改后的二进制文件。所有修改都只发生在你的本机 Claude Desktop 安装目录中，并且会在安装前创建可校验备份。

> 非官方项目。使用前请确认你理解它会修改本机 Claude Desktop 的安装文件。Claude 自动更新后通常需要重新运行补丁。
>
> 重要：旧版“完整 ASAR 注入”会写入 `Claude.exe` 中的 ASAR header hash。当前 Claude MSIX / WindowsApps 的工作区 VM 会校验 `Claude.exe` 的 Authenticode 签名，写入 exe 会让签名变成 `HashMismatch`，从而触发 `signature verification failed` 和 `RPC pipe closed`。因此 v2.0.3 起默认不再修改 exe。

## 当前状态

- 当前版本：`2.0.3`
- 主要支持：Microsoft Store / WindowsApps 版 Claude Desktop / Cowork
- 已实机验证：Claude `1.11187.4.0`
- 词表覆盖：`translations/zh-CN/` 分域词表，`810` 条词典项，`34` 条正则规则
- 自动化检查：Vitest、发布校验、词表覆盖率、GitHub Actions CI

v2.0.3 当前默认策略：

```text
mode: safe
modifies Claude.exe: false
modifies app.asar: false
workspace VM compatibility: preserved
doctor: 健康 / workspace-safe external locale patch is installed
```

## 汉化模式选择

| 模式 | 命令 | 会修改 | 适合场景 | 风险 |
| --- | --- | --- | --- | --- |
| 安全模式（默认） | `npm run install-patch` | 外置 locale / `ion-dist` i18n JSON | 需要 Claude 工作区、VM、插件和 Skills 页面稳定可用 | 覆盖率取决于本地 i18n JSON 和词表命中 |
| 危险完整注入模式 | `npm run install-patch -- --force-unsafe-asar` | `resources/app.asar` 和 `Claude.exe` ASAR header hash | 暂时不使用工作区，只追求更高可见文案覆盖 | 可能导致 `HashMismatch`、`signature verification failed`、`RPC pipe closed` |
| 恢复原版 | `npm run restore` | 从最近一次备份恢复 | Claude 无法启动、工作区异常、需要回到官方文件 | 需要备份记录和备份文件完整 |

建议优先使用默认安全模式。这个模式不会重写 `Claude.exe`，也不会把运行时脚本注入到 `ion-dist/assets/v1/index-*.js`，因此不会因为补丁本身删除插件、Skills 或破坏工作区启动链路。

## 功能亮点

- 默认安全模式中文化 Claude 桌面 locale 和 `ion-dist` 前端 i18n 文件，不破坏 `Claude.exe` 签名。
- 保留旧版完整 ASAR 注入能力，但必须显式启用 `--force-unsafe-asar`。
- 运行时翻译器仍可用于危险模式，支持完整句匹配、正则模板和短片段补全。
- 安装前自动备份 `Claude.exe`、`resources/app.asar` 以及可发现的外置 i18n JSON。
- `doctor` 可识别安全模式和危险 ASAR 模式，检查补丁状态、bundle 指纹和所有 locale 文件状态。
- `restore` 可从最近一次备份恢复原版 Claude 文件。
- `collect-missing` 可在危险完整注入模式下从运行时日志提取未命中文案，方便持续补词。
- 不提交、不下载、不保存任何 Claude 二进制产物到仓库。

## 插件和 Skills 汉化说明

v2.0.3 的默认安全模式会优先覆盖 Claude 本地 i18n JSON 中已经存在的插件、连接器、MCP servers、Desktop Extensions、Skills 入口和常见操作文案。新增的 `translations/zh-CN/ion-residual.json` 用来补齐 `ion-dist` 中容易残留的半中半英文案，例如连接器列表、创建 Skills、计划任务和状态提示。

需要注意：

- 默认安全模式只更新本地可发现的 i18n JSON，不会改写第三方插件包、远端下发的插件元数据或 Skills 原始定义。
- 如果某个插件或 Skill 的描述来自远端接口，且没有落在本地 `ion-dist` i18n JSON 中，安全模式可能无法直接覆盖这段描述。
- 补丁不会删除、隐藏或重建插件与 Skills；如果安装后插件或 Skills 消失，优先执行 `npm run restore` 恢复官方文件，再运行默认 `npm run install-patch`。
- 危险完整注入模式的运行时 DOM 翻译覆盖面更高，但它会修改 `Claude.exe` 签名链路。需要 Claude 工作区可用时，不建议使用该模式。

## 支持范围

优先支持 Microsoft Store / WindowsApps 版 Claude Desktop：

```text
C:\Program Files\WindowsApps\Claude_*__pzs8sxrjxfjjc\app
```

项目也保留了用户级安装目录探测逻辑。若 Claude 的包结构发生较大变化，可以先运行：

```powershell
npm run locate
npm run inspect-bundle
```

## 使用前准备

需要：

- Windows。
- 已安装 Claude Desktop，并能正常打开 Cowork。
- Node.js `20` 或更高版本。
- npm 和 Git。
- 可在 UAC 弹窗中授予管理员权限。

检查命令：

```powershell
node -v
npm -v
git --version
```

## 快速开始

```powershell
git clone https://github.com/yq6666-66/claude-cowork-chinese-patch.git
cd claude-cowork-chinese-patch
npm install
npm run check-env
npm run install-patch
```

执行 `npm run install-patch` 时如果弹出 UAC，请选择允许。默认安装的是 workspace-safe external locale 补丁，安装完成后 Claude 会自动重新启动。

安装后建议运行：

```powershell
npm run doctor
```

如果输出为 `健康` 且 `Mode: safe`，说明当前是不会破坏工作区 VM 的安全安装。

## 常用命令

```powershell
npm run check-env       # 无损环境检查，不修改 Claude
npm run install-patch   # 安装安全中文补丁，只更新外置 i18n JSON，不修改 Claude.exe/app.asar
npm run doctor          # 检查当前补丁状态
npm run restore         # 从最近一次备份恢复原版
npm run inspect-bundle  # 只读检查真实 app.asar 的 bundle 结构和注入点
npm run collect-missing # 提取运行时采集到的未命中文案
npm run coverage        # 查看词表覆盖率概览
npm test                # 运行单元测试
npm run validate        # 发布前校验词表、脚本和源码语法
```

危险完整注入模式仅用于你明确接受“工作区 VM 可能失败”的场景：

```powershell
npm run install-patch -- --force-unsafe-asar
```

`doctor` 状态含义：

- `健康`：安全模式下 locale 文件状态匹配，或危险模式下 marker/hash 匹配。
- `需重打`：Claude 更新、locale 文件变化、补丁 marker 缺失或当前安装文件已变化，需要重新运行 `npm run install-patch`。
- `异常`：完整性 hash 不匹配，建议先 `npm run restore`，再重新安装。
- `需安装`：没有找到本项目的 `latest.json` 安装记录。

## 安装流程说明

默认 `npm run install-patch` 会按顺序执行：

1. 定位 Claude Desktop 安装目录。
2. 停止正在运行的 Claude 进程。
3. 备份 `Claude.exe`、`resources/app.asar` 以及可发现的外置 i18n JSON。
4. 从 `translations/zh-CN/` 加载分域词表、正则规则和保护词。
5. 更新 `resources\en-US.json`、`resources\zh-CN.json`（如果存在）、`resources\ion-dist\i18n\en-US.json` 和 `resources\ion-dist\i18n\statsig\en-US.json`（如果存在）。
6. 运行自检，写入 `%USERPROFILE%\.claude-cowork-zh-patch\latest.json`。
7. 重启 Claude。

只有显式 `--force-unsafe-asar` 时，才会额外执行解包 `app.asar`、注入运行时翻译器、重新打包、计算 ASAR header hash 并写回 `Claude.exe`。该模式覆盖率更高，但会破坏 Authenticode 签名，当前不推荐给需要 Claude 工作区的人使用。

## 为什么安全模式覆盖率低于旧版完整汉化

早期版本的“几乎完整汉化”依赖完整 ASAR 注入：补丁会把运行时翻译器写进 Claude 的 preload / main bundle，页面加载后直接扫描 DOM 并翻译可见文案。这条路径覆盖率高，但必须修改 `resources/app.asar`，随后还要把新的 ASAR header hash 写回 `Claude.exe` 才能通过 Electron 自身完整性检查。

当前 Claude Workspace VM 会校验 `Claude.exe` 的 Authenticode 签名。只要写过 exe，签名状态就会变成 `HashMismatch`，VM 会拒绝启动。因此默认安全模式改为只更新外置 i18n JSON，尤其是 `resources\ion-dist\i18n\en-US.json`。这能保住工作区功能，但只能覆盖这些 JSON 中存在且词表可命中的文案。

如果你只追求最高汉化覆盖、暂时不使用 Claude 工作区，可以继续使用：

```powershell
npm run install-patch -- --force-unsafe-asar
```

如果你需要工作区可用，就使用默认 `npm run install-patch`，并继续把旧版完整汉化中高频可见文案迁移到 `translations/zh-CN/`。

备份目录：

```text
%USERPROFILE%\.claude-cowork-zh-patch\backups
```

安装状态：

```text
%USERPROFILE%\.claude-cowork-zh-patch\latest.json
```

## 项目结构

```text
.
├── src/
│   ├── core/          # asar、backup、integrity、locate、logger
│   ├── inject/        # 注入点发现、bundle 注入、运行时脚本构建
│   ├── pipeline/      # install、doctor 等流程编排
│   └── translate/     # 翻译引擎、词表加载、coverage、missing 过滤
├── scripts/           # PowerShell 入口和兼容 CLI
├── translations/
│   ├── zh-CN.json     # 旧版兼容词表
│   └── zh-CN/         # v2 分域词表、规则和保护词
├── test/              # Vitest 单元测试与夹具
├── docs/              # 使用、架构、功能和故障排查文档
└── .github/workflows/ # GitHub Actions CI
```

## 词表说明

v2 将词表拆分在 `translations/zh-CN/`：

- `nav.json`：导航、侧边栏、任务、项目入口。
- `settings.json`：设置页、个人资料、桌面应用设置、组织策略。
- `cowork.json`：Cowork 首页、欢迎语、推荐任务、占位文案。
- `connectors.json`：连接器、插件、MCP servers、Desktop Extensions。
- `misc.json`：无法稳定归类但需要覆盖的通用词条。
- `s4-collected.json`：实机 S4 采样过程中补充的高频词条。
- `ion-residual.json`：安全外置 i18n 模式下 `ion-dist` 易残留的半中半英文案修正。
- `rules.json`：动态数量、时间、操作类文案的正则规则。
- `protected.json`：保护词，例如 `Claude`、`MCP`、`GitHub`、模型名和品牌名。

运行时翻译优先级：

1. 完整句精确匹配。
2. 正则规则匹配。
3. 短片段替换，并保护品牌名、模型名、协议名和技术名。

这样可以处理类似：

```text
连接 your apps
创建 new skills
计划任务 only run while your computer is awake.
```

## 补充遗漏翻译

运行时未命中采集默认关闭，并且依赖完整 ASAR 注入。需要收集遗漏文案时，先开启采集模式，并临时使用危险完整注入：

```powershell
$env:COWORK_ZH_COLLECT="1"
npm run install-patch -- --force-unsafe-asar
```

然后在 Claude 中打开高频页面，例如首页、侧边栏、设置各子页、连接器、计划任务、自定义、技能、第三方推理和个人资料下拉。采样后运行：

```powershell
npm run collect-missing
npm run coverage
```

确认译文后，把词条加入 `translations/zh-CN/` 对应文件。动态句子、数量、时间和带变量的操作文案优先加入 `rules.json`。

采集完成后，如果你需要 Claude 工作区功能，执行 `npm run restore`，再运行默认 `npm run install-patch` 回到 workspace-safe 模式。

提交前至少运行：

```powershell
npm test
npm run validate
npm run coverage
```

不要提交以下产物：

```text
*.asar
*.exe
*.bak
*.log
translations/_missing.json
node_modules/
%USERPROFILE%\.claude-cowork-zh-patch\
```

## Claude 更新后怎么办

Claude 自动更新后，WindowsApps 目录通常会变成新版本，旧补丁不会自动迁移。处理顺序：

```powershell
npm run doctor
```

如果显示 `需安装` 或 `需重打`：

```powershell
npm run install-patch
npm run doctor
```

如果出现完整性错误、`signature verification failed`、`RPC pipe closed` 或 `无法启动 Claude 的工作区`：

```powershell
npm run restore
npm run doctor
```

确认恢复为官方文件后，再运行默认安全安装：

```powershell
npm run install-patch
npm run doctor
```

## 恢复原版

```powershell
npm run restore
```

恢复逻辑会读取最近一次安装记录，并校验备份 manifest 中的 SHA256。备份文件被篡改或缺失时会拒绝恢复。

## 已知限制

- Claude 远端新下发的文案可能不在当前词表中，需要继续补词。
- 默认安全模式只能覆盖外置 i18n JSON 中存在的文案，覆盖率低于完整 ASAR 注入。
- 完整 ASAR 注入会修改 `Claude.exe`，在当前 Claude MSIX 工作区 VM 上可能导致 `RPC pipe closed`，需要工作区时不要使用。
- 第三方插件自己的 UI 不一定由 Claude bundle 统一渲染，覆盖率取决于实际 DOM。
- 系统原生菜单、Chromium 内置错误页、模型生成的对话内容不属于补丁目标。
- Claude bundle 结构大改时，可能需要更新 `src/inject/` 的注入点发现逻辑。
- 本项目主要面向 Windows；其他系统不在当前验证范围内。

## 更多文档

- [详细使用教程](docs/USAGE.md)
- [功能覆盖范围](docs/FEATURES.md)
- [架构说明](docs/ARCHITECTURE.md)
- [故障排查](docs/TROUBLESHOOTING.md)
- [贡献说明](CONTRIBUTING.md)
- [更新记录](CHANGELOG.md)

## 许可证

MIT
