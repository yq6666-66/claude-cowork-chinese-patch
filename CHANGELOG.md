# Changelog

## 2.0.2

- 修复工作区启动失败提示的混合中英文显示，覆盖 `Failed to start Claude's workspace`、`reinstall the workspace` 以及已被片段替换后的 `工作区` 变体。
- 新增规则测试，避免 workspace 错误标题和重装链接再次退化成半英文半中文。

## 2.0.1

- 修复运行时翻译范围过宽的问题：跳过 message/prose/markdown/tool-result 等正文容器，避免误处理 Claude 对话、模型输出和工具输出正文。
- 强化未命中采集过滤，排除 `.mjs`、`.css` 文件名、工具状态片段和模型回复片段，避免污染 `translations/_missing.json`。
- 补充 agent mode、本地工作区、文件夹选择、下载、重试、Explorer 操作等实机 UI 文案。
- 新增测试覆盖运行时正文跳过规则和缺词噪声过滤。

## 2.0.0

- 新增 `src/` 分层：core、inject、translate、pipeline。
- 抽离 ASAR header hash、`Claude.exe` hash 写回、备份、日志和定位模块。
- 新增 Vitest 测试矩阵，覆盖核心算法、注入、词表、doctor 和采集工具。
- 运行时翻译器改为可构建脚本，移除固定轮询，使用 MutationObserver、WeakSet 和路由事件触发。
- main process 注入点改为结构化发现，降低 Claude 小版本更新后的维护成本。
- 词表拆分为 `translations/zh-CN/` 分域文件，并保留旧 `zh-CN.json` 兼容入口。
- 新增 `doctor`、`coverage`、`collect-missing` 和 GitHub Actions CI。
- 统一未命中采集开关为 `COWORK_ZH_COLLECT`，并兼容旧的 `CLAUDE_ZH_COLLECT_MISSING`。
- 扩充实机补词覆盖：设置页、连接器、MCP servers、Desktop Extensions、组织限制、网关、模型发现、usage limits、egress requirements 等高频页面。
- 修复短片段边界替换，避免 `Allow` 被误替换成混合词、`Model` 被误替换成混合词。
- 已在 Claude `1.11187.4.0` WindowsApps 版本完成实机安装验证：
  - `patchFingerprint`: `9982f154b1b1`
  - `asarHeaderHash`: `e71085edff044bf18472d2a179d7012e90758c8a2f2bce86d7f60ffea76f4ac8`
  - `doctor`: 健康
  - `exeHasCurrent`: `true`
  - main bundle 注入计数：`1`
  - 收集模式空闲启动未生成新的 `missing-runtime.log`
- 已知限制：Claude 自动更新后通常需要重新运行 `npm run install-patch`；真实界面补词仍依赖用户截图或采集日志持续完善。

## 0.1.0

- 初始开源版本。
- 支持 WindowsApps 版 Claude Desktop / Cowork。
- 提供中文翻译表、安装、恢复、ASAR 注入和完整性 hash 修正脚本。
