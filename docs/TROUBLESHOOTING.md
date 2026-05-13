# 常见问题

## Claude 自动更新后又变回英文

WindowsApps 版 Claude 更新后会安装到新的版本目录，原补丁目录不再生效。重新运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

## 启动时报 Integrity check failed

这表示 `app.asar` 已经变了，但 `Claude.exe` 中的 ASAR header hash 没同步。

先尝试重新运行安装脚本。如果仍失败，请检查：

- `npm install` 是否成功。
- `scripts/get-asar-header-hash.cjs` 是否能输出 64 位 hash。
- `scripts/patch-exe-hash.cjs` 中是否缺少当前 Claude 版本的旧 hash。

## 提示没有管理员权限

WindowsApps 目录需要管理员权限写入。安装脚本会尝试自动提权；如果 UAC 没弹出，可以手动以管理员身份打开 PowerShell 后执行安装命令。

## 不确定这台电脑能不能安装

先运行无损检查：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
```

它不会修改 Claude，只会检查 Node.js、npm、`@electron/asar`、Claude WindowsApps 路径和关键文件是否存在。

## 部分页面仍有英文

常见原因：

- Cowork 远端下发了新文案。
- 一句话被拆成多个 DOM 文本节点，需要补短片段。
- 文案在第三方插件 UI 中，不属于 Claude/Cowork 主界面。

处理方式：把残留英文补到 `translations/zh-CN.json`，然后重新运行安装脚本。

## 如何恢复原版

执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore.ps1
```

恢复脚本会使用 `%USERPROFILE%\.claude-cowork-zh-patch\latest.json` 指向的最近一次备份。

## 安装教程在哪里

完整流程见：

```text
docs/USAGE.md
```

如果你是第一次使用，建议先从教程按顺序执行，不要直接改脚本。
