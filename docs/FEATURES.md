# 汉化范围

本项目目标是改善 Claude Desktop / Cowork 在中文环境下的可用性，重点覆盖高频 UI 文案。

## 已覆盖区域

- Cowork 首页、欢迎语、推荐任务、输入框占位。
- 左侧导航：新建任务、项目、计划任务、自定义、固定、最近。
- 自定义页：Skills、connectors、plugins、个人插件、连接应用。
- 设置页：通用、隐私、功能、Claude 代码、协作、桌面应用设置。
- 计划任务页：空状态、Keep awake、电脑唤醒提示。
- 第三方推理与 Gateway 配置中的常见字段。
- 个人资料、职业下拉、全局指令、记忆、本地会话等常见设置。

## v2 词表

词表拆分在 `translations/zh-CN/`：

- `nav.json`：导航、侧边栏、任务、项目入口。
- `settings.json`：设置页、个人资料、桌面应用设置。
- `cowork.json`：首页、欢迎语、推荐任务、占位文案。
- `connectors.json`：连接器、插件、技能、计划任务相关入口。
- `misc.json`：暂时无法明确归类的词条。
- `rules.json`：正则规则，例如时间、数量、动态操作文案。
- `protected.json`：保护词，例如 `Claude`、`MCP`、`GitHub`。

旧版 `translations/zh-CN.json` 仍保留为兼容入口。

## 混合中英文处理

运行时翻译顺序：

1. 完整句精确匹配。
2. 正则规则匹配。
3. 短片段替换，并保留保护词。

这用于修复类似：

```text
连接 your apps
创建 new skills
计划任务 only run while your computer is awake.
```

## 未承诺覆盖

- Claude 远端新下发且词表没有收录的文案。
- 系统原生菜单和 Chromium 内置错误页。
- 第三方插件自己的 UI。
- 模型生成的对话内容。

遗漏文案可通过 `COWORK_ZH_COLLECT=1` 开启采集，再运行 `npm run collect-missing` 生成本地 `_missing.json`。
