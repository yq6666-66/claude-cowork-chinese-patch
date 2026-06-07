# Changelog

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
