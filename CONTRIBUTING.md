# 贡献指南

欢迎补充翻译、适配新版本 Claude Desktop，或改进安装与恢复流程。

## 本地检查

```powershell
npm install
npm test
npm run validate
npm run coverage
```

不要提交 `app.asar`、`Claude.exe`、`.bak`、日志、备份目录或 `translations/_missing.json`。

## 补充翻译

优先修改 `translations/zh-CN/` 下的分域词表：

- 导航、任务、项目入口：`nav.json`
- 设置页：`settings.json`
- Cowork 首页：`cowork.json`
- 连接器、插件、技能：`connectors.json`
- 其他：`misc.json`
- 动态规则：`rules.json`
- 不应翻译的品牌词：`protected.json`

原则：

- 保留品牌名：`Claude`、`Anthropic`、`GitHub`、`MCP` 等。
- 优先补完整句，再补短片段。
- 不翻译用户输入、模型输出、代码、路径和命令。
- 改完运行 `npm test` 和 `npm run validate`。

## 收集遗漏文案

```powershell
$env:CLAUDE_ZH_COLLECT_MISSING="1"
npm run install-patch
npm run collect-missing
npm run coverage
```

`translations/_missing.json` 仅用于本地补词，已被 `.gitignore` 忽略。确认译文后，把词条移动到对应分域 JSON。

## 适配新版本

如果 Claude 更新后补丁失效：

1. 运行 `npm run doctor` 判断是升级、marker 缺失还是完整性错误。
2. 检查 `.vite/build/mainView.js`、`.vite/build/mainWindow.js`、`.vite/build/index.js`。
3. 如果 preload 文件名变化，调整 `src/inject/inject-bundle.js`。
4. 如果 main 注入结构变化，补充 `src/inject/locate-hooks.js` 测试后再改实现。
5. 如果完整性 hash 无法写回，把当前版本原始 64 位 ASAR hash 加到 `src/core/integrity.js`。
