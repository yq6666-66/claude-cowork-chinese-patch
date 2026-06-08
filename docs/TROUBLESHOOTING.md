# 常见问题

## Claude 更新后又变回英文

WindowsApps 版 Claude 更新后会切到新的版本目录。先运行：

```powershell
npm run doctor
```

如果显示 `需安装` 或 `需重打`，重新执行：

```powershell
npm run install-patch
```

## 无法启动 Claude 的工作区 / RPC pipe closed

如果错误里出现：

```text
无法启动 Claude 的工作区
RPC pipe closed
signature verification failed: client executable is not signed
```

优先判断是否运行过旧版完整 ASAR 注入。该模式会改写 `Claude.exe`，会让 Authenticode 签名变成 `HashMismatch`，当前 Claude Workspace VM 会拒绝这种 exe。

处理顺序：

```powershell
npm run restore
npm run doctor
```

确认恢复后，只运行默认安全模式：

```powershell
npm run install-patch
npm run doctor
```

如果你手动排查，可以检查签名：

```powershell
Get-AuthenticodeSignature -LiteralPath "C:\Program Files\WindowsApps\Claude_1.11187.4.0_x64__pzs8sxrjxfjjc\app\Claude.exe" | Format-List Status,StatusMessage,Path
```

`Status` 应为 `Valid`。如果仍是 `HashMismatch`，不要继续安装补丁，先恢复或重装 Claude。

## 提示注入点未找到

该问题只适用于 `--force-unsafe-asar` 危险完整注入模式。默认安全模式不会解包或注入 `app.asar`，因此不会遇到注入点问题。

危险模式中 preload 注入是硬要求，main process 注入是尽力策略。main 注入点找不到时会告警，但不一定影响翻译层生效。

如果 preload 也找不到，说明 Claude bundle 结构变化较大，需要检查解包后的：

```text
.vite/build/mainView.js
.vite/build/mainWindow.js
.vite/build/index.js
```

## 启动时报 Integrity check failed

这表示 `app.asar` 已变化，但 `Claude.exe` 中记录的 ASAR header hash 没同步。该问题通常来自危险完整注入模式或手动修改 `app.asar`。处理顺序：

```powershell
npm run restore
npm run doctor
```

恢复后推荐重新运行默认安全模式：

```powershell
npm run install-patch
```

如果你明确要继续危险完整注入，才需要补充当前 Claude 版本原始 hash 到 `src/core/integrity.js` 的 `knownHashes`，然后使用：

```powershell
npm run install-patch -- --force-unsafe-asar
```

## 部分页面仍有英文

可能原因：

- 文案是 Claude 远端新下发，词表尚未包含。
- 文案属于第三方插件 UI。
- 文案带占位符或动态变量，被引擎保护后跳过。

可开启采集：

```powershell
$env:COWORK_ZH_COLLECT="1"
npm run install-patch -- --force-unsafe-asar
npm run collect-missing
npm run coverage
```

采集完成后如果需要工作区功能，执行 `npm run restore`，再运行默认 `npm run install-patch` 回到安全模式。确认译文后补到 `translations/zh-CN/`。

## 如何恢复原版

```powershell
npm run restore
```

恢复逻辑会使用最近一次备份。v2 备份模块会校验 manifest 中的 SHA256，备份文件被篡改时会拒绝恢复。
