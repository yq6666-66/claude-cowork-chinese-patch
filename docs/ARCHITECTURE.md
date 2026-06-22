# 工作原理

Claude Desktop 是 Electron 应用，主要 UI 资源位于 `resources/app.asar`。本项目只在本机修改已安装副本，不分发 Claude 原始文件或修改后的二进制文件。

默认安全模式的本质是“本地 i18n 词典替换”，不是在线翻译。补丁读取 Claude 已安装目录中的外置 JSON 文案文件，再用 `translations/zh-CN/` 里的词表和规则替换英文字符串。Claude 重启后仍按官方前端逻辑加载这些 JSON，只是文件内容已经变成中文。

## v2 模块

- `src/core/integrity.js`：计算 ASAR header hash；仅在危险完整注入模式中把新 hash 写回 `Claude.exe`。
- `src/core/backup.js`：创建带 SHA256 manifest 的备份，恢复前先校验。
- `src/core/locate.js`：定位 WindowsApps 或用户级 Claude 安装目录。
- `src/translate/engine.js`：纯函数翻译引擎，可单测。
- `src/translate/dictionary.js`：合并 `translations/zh-CN/` 分域词表、规则和保护词。
- `src/inject/locate-hooks.js`：按 `webContents` / `dom-ready` 结构发现 main 注入点。
- `src/inject/inject-bundle.js`：执行 preload 必注、main 尽力注入。
- `src/pipeline/install.js`：发现桌面 locale 和 `ion-dist` 外置 i18n，执行安全补丁或危险 ASAR 注入。
- `src/pipeline/doctor.js`：诊断安全模式所有 locale 文件状态、危险模式 marker、bundle 指纹和完整性 hash。

## 默认安全补丁流程

```text
Claude 安装目录
  -> 停止 Claude 进程
  -> 备份外置 i18n json
  -> 加载分域词表与规则
  -> 更新 resources/en-US.json
  -> 更新 resources/ion-dist/i18n/en-US.json
  -> 更新 resources/ion-dist/i18n/statsig/en-US.json
  -> 写 latest.json
  -> 启动 Claude
```

默认流程不修改 `Claude.exe` 和 `resources/app.asar`，因此不会破坏 Claude MSIX / WindowsApps 的 Authenticode 签名，也不会触发工作区 VM 的客户端签名拒绝。

## 翻译引擎

`src/translate/engine.js` 的匹配顺序：

1. 规范化空白字符后，先做完整句精确匹配。
2. 再按 `rules.json` 的优先级执行正则规则，处理数量、时间、状态和带变量的句子。
3. 如果没有命中完整句和规则，尝试按词典长短顺序做短片段替换。
4. 替换后检查剩余英文片段；残留过多时放弃，避免生成半中半英的异常句子。
5. `protected.json` 中的品牌名、模型名和技术词会被保护，例如 `Claude`、`MCP`、`GitHub`、`API`。

`src/translate/locale.js` 会递归遍历 locale JSON 的所有字符串值，并把上述翻译结果写回临时文件。安装流程自检通过后才复制到 Claude 安装目录。

## 危险完整注入流程

显式传入 `--force-unsafe-asar` 后，才会执行旧流程：

```text
Claude 安装目录
  -> 停止 Claude 进程
  -> 备份 Claude.exe / app.asar / 外置 i18n json
  -> 解包 app.asar 到临时目录
  -> 加载分域词表与规则
  -> 注入运行时翻译层
  -> 更新外置 i18n json
  -> 重新打包 app.asar
  -> 计算 ASAR header hash
  -> 写入 Claude.exe
  -> 写 latest.json
  -> 启动 Claude
```

该模式覆盖率更高，但会修改 `Claude.exe` 字节。当前 Claude Workspace VM 会校验客户端 exe 签名，修改后可能报 `signature verification failed` / `RPC pipe closed`。

## ASAR 完整性

Electron 校验的是 ASAR header hash，不是整个 `app.asar` 文件 SHA256。`computeHeaderHash()` 通过 `@electron/asar` 读取 raw header，再计算 SHA256。

如果危险模式中 `app.asar` 已修改但 `Claude.exe` 里的 hash 没同步，Claude 启动时会报：

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

运行时翻译器会扫描文本节点、按钮值、placeholder、title、aria-label、tooltip 等属性，同时跳过代码块、输入框、用户消息、模型输出和工具结果正文，避免误翻译用户内容。该能力只在 `--force-unsafe-asar` 下启用。

## 定位策略

安装和诊断会按以下顺序寻找 Claude：

1. 命令行显式传入的目录。
2. `COWORK_ZH_APP_DIR` 环境变量。
3. 正在运行的 `Claude.exe` 进程路径。
4. Windows `Get-AppxPackage` 返回的 Store 安装位置。
5. `C:\Program Files\WindowsApps\Claude_*__*\app`。
6. `%LOCALAPPDATA%\Programs` 下的用户级安装目录。
7. 卸载注册表中的 `InstallLocation`。

默认外部命令超时为 `15000` 毫秒。查询较慢时可以设置 `COWORK_ZH_LOCATE_TIMEOUT_MS`。
