# Claude Cowork 中文补丁

这是一个面向 Windows 版 Claude Desktop / Cowork 的中文界面补丁器。

项目不会分发 Claude、`app.asar`、`Claude.exe` 或任何修改后的二进制文件。它只提供补丁脚本和中文翻译表，在你的电脑本地对已安装的 Claude Desktop 做备份、注入翻译层并重新打包。

> 非官方项目。使用前请确认你理解它会修改本机 Claude Desktop 的安装文件。

## 快速开始

```powershell
git clone https://github.com/19306069208/claude-cowork-zh-patch.git
cd claude-cowork-zh-patch
npm install
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

弹出 UAC 时选择允许。安装完成后 Claude 会自动重新启动。

完整步骤请看：[详细使用教程](docs/USAGE.md)。

也可以先做无损环境检查：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
```

## 功能

- 将 Cowork 首页、侧边栏、任务入口、项目入口等常见文案改为中文。
- 覆盖设置页中的常见残留英文，包括：
  - 个人资料、隐私、功能、Claude 代码、协作、桌面应用设置
  - Skills / plugins / connectors / Customize
  - Scheduled tasks / Keep awake
  - Global instructions / memory
  - desktop settings / startup / system tray / keep computer awake
- 注入 DOM 级运行时翻译层，能处理远端页面动态加载出来的文案。
- 自动备份原始 `app.asar`、语言文件和 `Claude.exe`。
- 自动修正 Electron 对 `app.asar` 的完整性校验哈希。

## 项目结构

```text
.
├── scripts/
│   ├── install.ps1                 # 安装补丁：备份、解包、注入、重打包、修正哈希
│   ├── restore.ps1                 # 从最近一次备份恢复
│   ├── patch-asar.cjs              # 注入 DOM 运行时翻译层
│   ├── update-locale.cjs           # 补丁语言 JSON
│   ├── get-asar-header-hash.cjs    # 计算 Electron 使用的 ASAR header hash
│   ├── patch-exe-hash.cjs          # 写回 Claude.exe 中的完整性哈希
│   ├── check-environment.ps1       # 无损环境检查
│   └── validate-release.cjs        # 发布前检查
├── translations/
│   └── zh-CN.json                  # 中文翻译表
├── docs/
│   ├── ARCHITECTURE.md             # 工作原理
│   ├── FEATURES.md                 # 汉化范围
│   ├── USAGE.md                    # 详细使用教程
│   └── TROUBLESHOOTING.md          # 常见问题
└── README.md
```

## 支持范围

当前脚本主要针对 Microsoft Store / WindowsApps 版 Claude Desktop：

```text
C:\Program Files\WindowsApps\Claude_*__pzs8sxrjxfjjc\app
```

已在 `Claude_1.6608.2.0_x64__pzs8sxrjxfjjc` 上验证。其他版本可能需要补充注入点或翻译词条。

## 工作原理

1. 定位 WindowsApps 中的 Claude Desktop 安装目录。
2. 停止正在运行的 Claude 进程。
3. 备份 `Claude.exe`、`resources/app.asar`、`en-US.json` 和 `zh-CN.json`。
4. 解包 `app.asar`。
5. 在 Claude 的前端 bundle 中注入运行时中文翻译层。
6. 使用 `translations/zh-CN.json` 补丁语言文件。
7. 重新打包 `app.asar`。
8. 计算 Electron 实际校验的 ASAR header hash，并写入 `Claude.exe`。
9. 重新启动 Claude。

## 安装

需要：

- Windows
- Node.js 18+
- PowerShell
- 管理员权限
- 已安装 Claude Desktop / Cowork

执行：

```powershell
npm install
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

脚本会尝试自动提权。弹出 UAC 时选择允许。

安装后可检查：

- Cowork 首页是否显示“协作”“新建任务”“项目”“计划任务”“自定义”。
- 首页标题是否显示“一起完成你的待办事项”。
- 设置页中常见英文是否已替换为中文。

## 恢复

补丁会把备份放到：

```text
%USERPROFILE%\.claude-cowork-zh-patch\backups
```

恢复最近一次备份：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore.ps1
```

## 发布前检查

维护者发布前可以执行：

```powershell
npm run validate
```

这个检查会确认：

- 翻译 JSON 可解析。
- Node 脚本语法正确。
- 仓库中没有误加入 `.asar`、`.exe`、`.bak` 等二进制或备份文件。

## 为什么不用直接发布修改后的 app.asar？

因为 `app.asar` 和 `Claude.exe` 属于 Claude Desktop 原程序文件。发布修改后的二进制包会带来版权、完整性和安全风险。这个仓库只开源补丁逻辑和翻译表，用户在自己的机器上对自己的安装副本执行修改。

## 已知限制

- Claude 自动更新后，WindowsApps 目录会变成新版本，需要重新运行补丁。
- Cowork 部分页面由远端动态下发，新增英文文案需要继续补充 `translations/zh-CN.json`。
- 该补丁不是 Anthropic 官方功能。

## 文档

- [详细使用教程](docs/USAGE.md)
- [汉化范围](docs/FEATURES.md)
- [工作原理](docs/ARCHITECTURE.md)
- [常见问题](docs/TROUBLESHOOTING.md)
- [贡献指南](CONTRIBUTING.md)

## 许可证

MIT
