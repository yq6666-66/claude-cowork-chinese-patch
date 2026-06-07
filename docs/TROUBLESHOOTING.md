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

## 提示注入点未找到

v2 中 preload 注入是硬要求，main process 注入是尽力策略。main 注入点找不到时会告警，但不一定影响翻译层生效。

如果 preload 也找不到，说明 Claude bundle 结构变化较大，需要检查解包后的：

```text
.vite/build/mainView.js
.vite/build/mainWindow.js
.vite/build/index.js
```

## 启动时报 Integrity check failed

这表示 `app.asar` 已变化，但 `Claude.exe` 中记录的 ASAR header hash 没同步。处理顺序：

```powershell
npm run restore
npm run install-patch
npm run doctor
```

如果仍失败，需要补充当前 Claude 版本原始 hash 到 `src/core/integrity.js` 的 `knownHashes`。

## 部分页面仍有英文

可能原因：

- 文案是 Claude 远端新下发，词表尚未包含。
- 文案属于第三方插件 UI。
- 文案带占位符或动态变量，被引擎保护后跳过。

可开启采集：

```powershell
$env:COWORK_ZH_COLLECT="1"
npm run install-patch
npm run collect-missing
npm run coverage
```

确认译文后补到 `translations/zh-CN/`。

## 如何恢复原版

```powershell
npm run restore
```

恢复逻辑会使用最近一次备份。v2 备份模块会校验 manifest 中的 SHA256，备份文件被篡改时会拒绝恢复。
