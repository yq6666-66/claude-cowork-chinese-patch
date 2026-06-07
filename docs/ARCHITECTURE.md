# 工作原理

Claude Desktop 是 Electron 应用，主要 UI 资源位于 `resources/app.asar`。本项目只在本机修改已安装副本，不分发 Claude 原始文件或修改后的二进制文件。

## v2 模块

- `src/core/integrity.js`：计算 ASAR header hash，并把新 hash 写回 `Claude.exe`。
- `src/core/backup.js`：创建带 SHA256 manifest 的备份，恢复前先校验。
- `src/core/locate.js`：定位 WindowsApps 或用户级 Claude 安装目录。
- `src/translate/engine.js`：纯函数翻译引擎，可单测。
- `src/translate/dictionary.js`：合并 `translations/zh-CN/` 分域词表、规则和保护词。
- `src/inject/locate-hooks.js`：按 `webContents` / `dom-ready` 结构发现 main 注入点。
- `src/inject/inject-bundle.js`：执行 preload 必注、main 尽力注入。
- `src/pipeline/doctor.js`：诊断补丁 marker、bundle 指纹和完整性 hash。

## 补丁流程

```text
Claude 安装目录
  -> 停止 Claude 进程
  -> 备份 Claude.exe / app.asar / locale json
  -> 解包 app.asar 到临时目录
  -> 加载分域词表与规则
  -> 注入运行时翻译层
  -> 更新 en-US.json / zh-CN.json
  -> 重新打包 app.asar
  -> 计算 ASAR header hash
  -> 写入 Claude.exe
  -> 写 latest.json
  -> 启动 Claude
```

后续安装流程会继续向原子化收口：线上文件替换前，尽量在临时目录完成注入、重打包、hash 写回和自检。

## ASAR 完整性

Electron 校验的是 ASAR header hash，不是整个 `app.asar` 文件 SHA256。`computeHeaderHash()` 通过 `@electron/asar` 读取 raw header，再计算 SHA256。

如果 `app.asar` 已修改但 `Claude.exe` 里的 hash 没同步，Claude 启动时会报：

```text
Integrity check failed for asar archive
```

## 注入策略

运行时翻译器会写入 preload bundle。main process 注入用于页面加载完成后再补一次翻译，但它不是硬依赖。

v1 依赖硬编码 needle。v2 改为扫描类似结构：

```js
windowRef.webContents.on("dom-ready", () => { ... })
```

这样 Claude 小版本更新、混淆函数名变化时，不需要频繁手改注入点。
