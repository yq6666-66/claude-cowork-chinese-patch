# Claude Cowork 中文补丁

这是一个面向 Windows 版 Claude Desktop / Cowork 的中文界面补丁器。

项目不会分发 Claude、`app.asar`、`Claude.exe` 或任何修改后的二进制文件。它只提供补丁脚本、运行时翻译层和中文词表，在你的电脑本地对已安装的 Claude Desktop 做备份、注入和重新打包。

> 非官方项目。使用前请确认你理解它会修改本机 Claude Desktop 的安装文件。

## 快速开始

```powershell
git clone https://github.com/yq6666-66/claude-cowork-chinese-patch.git
cd claude-cowork-chinese-patch
npm install
npm run check-env
npm run install-patch
```

弹出 UAC 时选择允许。安装完成后 Claude 会自动重新启动。

## 常用命令

```powershell
npm test              # 运行单元测试
npm run validate      # 发布前检查
npm run coverage      # 查看词表覆盖率概览
npm run collect-missing
npm run doctor        # 检查当前补丁状态
npm run restore       # 从最近一次备份恢复
```

`doctor` 的状态含义：

- `健康`：补丁 marker 存在，`Claude.exe` 中的 ASAR header hash 与当前 `app.asar` 匹配。
- `需重打`：Claude 更新或补丁 marker 缺失，需要重新运行安装。
- `异常`：完整性 hash 不匹配，建议先恢复再重新安装。
- `需安装`：没有找到本项目的 `latest.json` 记录。

## v2 结构

```text
.
├── src/
│   ├── core/          # asar、backup、integrity、locate、logger
│   ├── inject/        # 注入点发现、bundle 注入、运行时脚本构建
│   ├── pipeline/      # doctor 等流程编排
│   └── translate/     # 翻译引擎、词表加载、coverage
├── scripts/           # PowerShell 入口和兼容 CLI
├── translations/
│   ├── zh-CN.json     # 旧版兼容词表
│   └── zh-CN/         # v2 分域词表、规则和保护词
├── test/              # vitest 单元测试与夹具
└── docs/
```

## 工作原则

- PowerShell 只负责提权、停止进程和 Windows 文件授权。
- 可测试的业务逻辑放在 `src/`。
- 运行时翻译器优先完整句匹配，再按正则规则和短片段补全混合中英文。
- 注入策略是 `preload` 必注，main process 尽力注入；main 找不到注入点时不会阻断 `preload` 翻译层。
- 备份与恢复会校验 SHA256，避免从被篡改的备份回滚。

## 补词流程

运行时未命中采集默认关闭。需要收集遗漏文案时设置：

```powershell
$env:COWORK_ZH_COLLECT="1"
npm run install-patch
```

随后从日志提取：

```powershell
npm run collect-missing
npm run coverage
```

把确认后的词条补到 `translations/zh-CN/` 对应分域 JSON，再运行 `npm test` 和 `npm run validate`。

## 支持范围

当前主要针对 Microsoft Store / WindowsApps 版 Claude Desktop：

```text
C:\Program Files\WindowsApps\Claude_*__pzs8sxrjxfjjc\app
```

也保留了用户级安装目录探测逻辑。Claude 自动更新后通常需要重新运行补丁。

## 许可证

MIT
