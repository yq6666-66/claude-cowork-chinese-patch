# 详细使用教程

本文面向第一次使用本项目的 Windows 用户。

## 1. 使用前确认

需要：

- Windows。
- 已安装 Claude Desktop，并能正常打开 Cowork。
- Node.js 20 或更高版本。
- npm 和 Git。
- 可在 UAC 弹窗中授予管理员权限。

检查：

```powershell
node -v
npm -v
git --version
```

## 2. 下载项目

```powershell
git clone https://github.com/yq6666-66/claude-cowork-chinese-patch.git
cd claude-cowork-chinese-patch
npm install
```

## 3. 无损环境检查

```powershell
npm run check-env
```

这个命令不会修改 Claude，只检查 Node、npm、依赖、WindowsApps 路径和关键文件是否存在。

## 4. 安装中文补丁

```powershell
npm run install-patch
```

脚本会尝试自提权。弹出 UAC 时选择允许。默认安装 workspace-safe external locale 补丁，只更新外置 i18n JSON，不修改 `Claude.exe` 和 `resources/app.asar`。

主要步骤：

1. 查找 Claude Desktop 安装目录。
2. 停止正在运行的 Claude。
3. 备份 `Claude.exe`、`resources/app.asar` 和可发现的外置 i18n JSON。
4. 从 `translations/zh-CN/` 加载分域词表。
5. 更新 `resources\en-US.json`、`resources\zh-CN.json`（如果存在）、`resources\ion-dist\i18n\en-US.json` 和 `resources\ion-dist\i18n\statsig\en-US.json`（如果存在）。
6. 写入 `latest.json` 并重启 Claude。

如果你明确接受 Claude 工作区 VM 可能因为 exe 签名失效而无法启动，可以启用危险完整注入模式：

```powershell
npm run install-patch -- --force-unsafe-asar
```

危险模式会额外解包 `app.asar`、注入运行时翻译器、重新打包、计算 ASAR header hash 并写回 `Claude.exe`。当前需要工作区功能时不建议使用。

## 5. 验证

Claude 重启后检查：

- Cowork 首页、侧边栏和设置页常见文案是否变为中文。
- 自定义页中的 Skills、plugins、connectors 相关入口是否翻译。
- 计划任务页的空状态、Keep awake 等文案是否翻译。

也可以运行：

```powershell
npm run doctor
```

默认安全安装的健康输出会包含：

```text
Mode: safe
```

## 6. Claude 更新后

Claude 自动更新后，WindowsApps 目录通常会变成新版本。运行：

```powershell
npm run doctor
```

如果显示 `需安装` 或 `需重打`：

```powershell
npm run install-patch
```

## 7. 恢复原版

```powershell
npm run restore
```

备份位置：

```text
%USERPROFILE%\.claude-cowork-zh-patch\backups
```

安装记录：

```text
%USERPROFILE%\.claude-cowork-zh-patch\latest.json
```

## 8. 补充遗漏翻译

优先编辑 `translations/zh-CN/` 下的分域 JSON，而不是旧版 `translations/zh-CN.json`。

开启采集：

```powershell
$env:COWORK_ZH_COLLECT="1"
npm run install-patch -- --force-unsafe-asar
```

采集依赖运行时翻译器注入，只在危险完整注入模式下可用。采集完成后如需恢复工作区兼容性，执行 `npm run restore`，再运行默认安全安装。

提取本地日志中的未命中：

```powershell
npm run collect-missing
npm run coverage
```

确认译文后，把词条加入对应文件：

- `nav.json`
- `settings.json`
- `cowork.json`
- `connectors.json`
- `misc.json`

动态数量、时间、操作类文案放到 `rules.json`。

## 9. 提交前检查

```powershell
npm test
npm run validate
```

不要提交 `.asar`、`.exe`、`.bak`、日志、备份目录或 `translations/_missing.json`。

## 10. 常见错误

### 找不到 Claude Desktop

默认优先查找：

```text
C:\Program Files\WindowsApps\Claude_*__pzs8sxrjxfjjc\app
```

也会尝试用户级安装目录。若仍失败，请确认 Claude Desktop 已安装并能正常启动。

### Integrity check failed

说明 `app.asar` 和 `Claude.exe` 中记录的 ASAR header hash 不匹配。先执行：

```powershell
npm run restore
npm run doctor
```

恢复后用默认安全模式重新安装：

```powershell
npm run install-patch
```

### 无法启动 Claude 的工作区

如果日志里有 `signature verification failed: client executable is not signed` 或 `RPC pipe closed`，通常是旧版完整注入写坏了 `Claude.exe` 签名。先恢复原版：

```powershell
npm run restore
npm run doctor
```

确认 `Claude.exe` 签名恢复后，再运行默认安全安装，不要使用 `--force-unsafe-asar`。

### 部分英文没有翻译

这通常是默认安全模式无法覆盖的 bundle 文案、远端新文案、第三方插件 UI，或带占位符的动态模板。优先补 locale 词表；确实需要运行时覆盖时再短时间使用危险完整注入采集。
