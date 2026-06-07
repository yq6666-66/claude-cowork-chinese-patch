# Claude Cowork 中文补丁

[![CI](https://github.com/yq6666-66/claude-cowork-chinese-patch/actions/workflows/ci.yml/badge.svg)](https://github.com/yq6666-66/claude-cowork-chinese-patch/actions/workflows/ci.yml)

这是一个面向 Windows 版 Claude Desktop / Cowork 的中文界面补丁器。它通过本地备份、解包、注入运行时翻译层、更新 locale 文件、重新打包和修正 ASAR 完整性 hash，让 Claude Desktop 的高频 Cowork 界面文案显示为简体中文。

项目不会分发 Claude、`app.asar`、`Claude.exe` 或任何修改后的二进制文件。所有修改都只发生在你的本机 Claude Desktop 安装目录中，并且会在安装前创建可校验备份。

> 非官方项目。使用前请确认你理解它会修改本机 Claude Desktop 的安装文件。Claude 自动更新后通常需要重新运行补丁。

## 当前状态

- 当前版本：`2.0.0`
- 主要支持：Microsoft Store / WindowsApps 版 Claude Desktop / Cowork
- 已实机验证：Claude `1.11187.4.0`
- 词表覆盖：`translations/zh-CN/` 分域词表，`635` 条词典项，`28` 条正则规则
- 自动化检查：Vitest、发布校验、词表覆盖率、GitHub Actions CI

v2.0.0 实机安装验证记录：

```text
patchFingerprint: 9982f154b1b1
asarHeaderHash: e71085edff044bf18472d2a179d7012e90758c8a2f2bce86d7f60ffea76f4ac8
doctor: 健康
exeHasCurrent: true
main bundle injection count: 1
```

## 功能亮点

- 中文化 Cowork 首页、侧边栏、设置、连接器、MCP servers、Desktop Extensions、组织限制、Gateway、模型发现、usage limits、egress requirements 等高频页面。
- 运行时翻译器支持完整句匹配、正则模板和短片段补全，能处理部分混合中英文节点。
- 支持 `preload` 必注入和 main process 尽力注入，降低 Claude 小版本更新后补丁失效概率。
- 安装前自动备份 `Claude.exe`、`resources/app.asar`、`en-US.json` 和 `zh-CN.json`。
- `doctor` 可检查补丁 marker、ASAR header hash 和 `Claude.exe` 完整性状态。
- `restore` 可从最近一次备份恢复原版 Claude 文件。
- `collect-missing` 可从运行时日志提取未命中文案，方便持续补词。
- 不提交、不下载、不保存任何 Claude 二进制产物到仓库。

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

执行 `npm run install-patch` 时如果弹出 UAC，请选择允许。安装完成后 Claude 会自动重新启动。

安装后建议运行：

```powershell
npm run doctor
```

如果输出为 `健康`，说明补丁 marker 和 ASAR 完整性 hash 状态正常。

## 常用命令

```powershell
npm run check-env       # 无损环境检查，不修改 Claude
npm run install-patch   # 安装中文补丁，会备份、注入、打包、修正 hash 并重启 Claude
npm run doctor          # 检查当前补丁状态
npm run restore         # 从最近一次备份恢复原版
npm run inspect-bundle  # 只读检查真实 app.asar 的 bundle 结构和注入点
npm run collect-missing # 提取运行时采集到的未命中文案
npm run coverage        # 查看词表覆盖率概览
npm test                # 运行单元测试
npm run validate        # 发布前校验词表、脚本和源码语法
```

`doctor` 状态含义：

- `健康`：补丁 marker 存在，`Claude.exe` 中的 ASAR header hash 与当前 `app.asar` 匹配。
- `需重打`：Claude 更新、补丁 marker 缺失或当前安装文件已变化，需要重新运行 `npm run install-patch`。
- `异常`：完整性 hash 不匹配，建议先 `npm run restore`，再重新安装。
- `需安装`：没有找到本项目的 `latest.json` 安装记录。

## 安装流程说明

`npm run install-patch` 会按顺序执行：

1. 定位 Claude Desktop 安装目录。
2. 停止正在运行的 Claude 进程。
3. 备份 `Claude.exe`、`resources/app.asar`、`en-US.json` 和 `zh-CN.json`。
4. 解包 `app.asar` 到本地工作目录。
5. 从 `translations/zh-CN/` 加载分域词表、正则规则和保护词。
6. 向 Claude bundle 注入运行时翻译器。
7. 更新 locale JSON。
8. 重新打包 `app.asar`。
9. 计算新的 ASAR header hash，并写回 `Claude.exe`。
10. 运行自检，写入 `%USERPROFILE%\.claude-cowork-zh-patch\latest.json`。
11. 重启 Claude。

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

运行时未命中采集默认关闭。需要收集遗漏文案时，先开启采集模式再重新安装：

```powershell
$env:COWORK_ZH_COLLECT="1"
npm run install-patch
```

然后在 Claude 中打开高频页面，例如首页、侧边栏、设置各子页、连接器、计划任务、自定义、技能、第三方推理和个人资料下拉。采样后运行：

```powershell
npm run collect-missing
npm run coverage
```

确认译文后，把词条加入 `translations/zh-CN/` 对应文件。动态句子、数量、时间和带变量的操作文案优先加入 `rules.json`。

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

如果出现完整性错误：

```powershell
npm run restore
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
