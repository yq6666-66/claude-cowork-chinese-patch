# 详细使用教程

这份教程面向第一次使用本项目的 Windows 用户。它会从环境准备讲到安装、验证、更新后重装和恢复原版。

## 1. 使用前确认

请先确认你的机器满足以下条件：

- 系统是 Windows。
- 已安装 Claude Desktop，并且能正常打开 Cowork。
- 你可以使用管理员权限确认 UAC 弹窗。
- 已安装 Node.js 18 或更高版本。
- 已安装 Git。

在 PowerShell 中检查：

```powershell
node -v
npm -v
git --version
```

如果 `node -v` 不存在，请先安装 Node.js。建议使用 LTS 版本。

## 2. 下载项目

选择一个你习惯存放工具的目录，例如桌面或文档目录，然后执行：

```powershell
git clone https://github.com/19306069208/claude-cowork-zh-patch.git
cd claude-cowork-zh-patch
```

如果你不想使用 Git，也可以在 GitHub 页面点击 `Code`，下载 ZIP，解压后进入项目目录。

## 3. 安装依赖

项目需要 `@electron/asar` 来解包和重新打包 Claude 的 `app.asar`。

```powershell
npm install
```

安装完成后，项目目录下会出现 `node_modules`。这个目录不需要提交到 Git。

## 4. 先做无损环境检查

在真正修改 Claude 文件前，可以先运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
```

它只检查环境，不会修改 Claude。检查内容包括：

- 是否为 Windows。
- 是否安装 Node.js / npm。
- 是否已经执行 `npm install`。
- 是否能找到 WindowsApps 版 Claude Desktop。
- 是否存在 `Claude.exe`、`app.asar` 和语言 JSON。
- 当前 PowerShell 是否为管理员权限。

如果输出里有 `FAIL`，先按提示修复，再继续安装。

## 5. 运行汉化补丁

执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

脚本会做这些事：

1. 查找 WindowsApps 中最新的 Claude Desktop 安装目录。
2. 关闭正在运行的 Claude。
3. 备份原始 `Claude.exe`、`app.asar` 和语言 JSON。
4. 解包 `app.asar`。
5. 注入中文运行时翻译层。
6. 补丁语言文件。
7. 重新打包 `app.asar`。
8. 计算 Electron 使用的 ASAR header hash。
9. 把新 hash 写回 `Claude.exe`。
10. 重新启动 Claude。

Windows 可能会弹出 UAC 管理员权限确认，请选择允许。

## 6. 验证是否成功

Claude 自动重启后，进入 Cowork 页面检查：

- 左侧标签显示为“协作”“代码”。
- 侧边栏显示“新建任务”“项目”“计划任务”“自定义”。
- 首页标题显示“一起完成你的待办事项”。
- 输入框占位文案显示“我能帮你做什么？”。
- 项目入口显示“在项目中工作”。

再打开设置页或自定义页，检查这些区域：

- 自定义页：技能、插件、连接器。
- 计划任务页：保持唤醒、暂无计划任务。
- 设置页：通用、隐私、功能、Claude 代码、协作。
- 桌面应用设置：开机时运行、系统托盘、保持电脑唤醒。

## 7. 备份位置

每次安装都会创建独立备份：

```text
%USERPROFILE%\.claude-cowork-zh-patch\backups
```

最新安装信息记录在：

```text
%USERPROFILE%\.claude-cowork-zh-patch\latest.json
```

不要手动删除这些备份，除非你确定不需要恢复原版。

## 8. 恢复原版

如果 Claude 无法启动，或者你想回到原版界面，执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore.ps1
```

恢复脚本会读取 `latest.json`，把最近一次安装前备份的文件写回 Claude 目录，然后重新启动 Claude。

## 9. Claude 更新后怎么办

Claude Desktop 自动更新后通常会安装到新的 WindowsApps 版本目录。此时旧补丁不会继续生效，界面可能重新变成英文。

处理方式很简单：重新运行安装脚本。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

如果新版本修改了前端 bundle 注入点，脚本会提示找不到注入点。这种情况需要维护者适配 `scripts/patch-asar.cjs`。

## 10. 补充遗漏翻译

如果你发现某个页面仍然有英文，优先编辑：

```text
translations/zh-CN.json
```

格式示例：

```json
{
  "Keep awake": "保持唤醒",
  "No scheduled tasks yet.": "暂无计划任务。"
}
```

注意事项：

- 优先补完整句子。
- 如果页面出现“连接 your apps”这种中英混合，也补短片段，例如 `"your apps": "你的应用"`。
- 不要翻译路径、命令、代码、模型回复内容。

修改后重新运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

## 11. 发布前自检

如果你 fork 后准备提交 PR，先执行：

```powershell
npm run validate
```

这个命令会检查：

- 翻译 JSON 是否可解析。
- Node 脚本是否存在语法错误。
- 仓库是否误加入 `.asar`、`.exe`、`.bak`、日志等不该发布的文件。

## 12. 常见错误

### 找不到 Claude Desktop

确认你安装的是 WindowsApps / Microsoft Store 结构的 Claude Desktop。本项目默认查找：

```text
C:\Program Files\WindowsApps\Claude_*__pzs8sxrjxfjjc\app
```

### 缺少 asar

如果提示找不到 `node_modules\.bin\asar.cmd`，说明还没有安装依赖：

```powershell
npm install
```

### Integrity check failed

说明 `app.asar` 已被修改，但 `Claude.exe` 里的 ASAR header hash 没同步。

先重新运行安装脚本。如果仍失败，把报错中的 hash 和 Claude 版本号提交到 issue。

### 部分英文没有翻译

这通常是 Cowork 远端新下发了文案，或者一句话被拆成多个 DOM 文本节点。补充 `translations/zh-CN.json` 后重新安装即可。

## 13. 安全边界

本项目会修改本机应用安装目录，因此请只从你信任的仓库运行脚本。仓库不会上传或收集你的 Claude 会话、账号、项目文件或本地配置。

不建议把修改后的 `app.asar` 或 `Claude.exe` 分享给别人。公开分发二进制文件有版权和安全风险。
