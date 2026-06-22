# 智能汉化启动器(launcher/)

一个**桌面快捷方式**,双击即打开 Claude,并在 Claude 自动更新导致汉化失效时**自动重新汉化**——省去每次更新后手动跑 `npm run install-patch`。

## 它做什么

双击桌面的「Claude 中文」快捷方式时:

1. 先用 `scripts/doctor.cjs` **只读检查**当前汉化是否健康(退出码 0 = 健康,不提权、不弹 UAC);
2. **健康** → 用版本无关的商店 AUMID 直接启动 / 唤起 Claude;
3. **失效**(通常是 Claude 更新过)→ 调用本仓库的 `scripts/install.ps1` 重新汉化(会弹 UAC,完成后自行重启 Claude),失败则兜底直接打开 Claude。

判断只依赖 doctor 的退出码,不解析任何中文字面量,避免不同代码页下的乱码问题。

## 安装

确保已经能正常使用主项目(`npm install` 完成、`npm run doctor` 可运行),然后:

```powershell
npm run make-launcher
```

它会在桌面创建「Claude 中文」快捷方式。若本机有 .NET Framework 的 `csc.exe`,会编译一个**无窗口启动器**(`claude-zh-launcher.exe`,零闪窗);否则回退为 `powershell -WindowStyle Hidden` 方式(启动时有极轻微一闪)。重复运行此命令是幂等的。

## 文件说明

- `launch-claude-zh.ps1` —— 启动器"大脑":doctor 检查 → 启动 Claude 或重新汉化。路径全部相对本仓库解析,无写死的用户路径。
- `launcher.cs` —— 极小无窗口启动器源码(编译为 WinExe);定位与自身同目录的 `launch-claude-zh.ps1` 并隐藏拉起,实现零闪窗。
- `build-shortcut.ps1` —— 提取 Claude 图标、(可选)编译 exe、创建桌面快捷方式。幂等。
- 生成物 `claude-zh-launcher.exe`、`claude.ico`、`launcher.log` 不入库(见 `.gitignore`)。

## 环境备注

- **AUMID** 通过 `Get-StartApps` 动态解析,回退到 Anthropic 商店包的 `Claude_pzs8sxrjxfjjc!Claude`。
- 启动 Claude 用 `Start-Process "shell:AppsFolder\<AUMID>"`:在隐藏上下文里也能可靠拉起 MSIX 应用,已运行时还能由 shell 中转把窗口唤到前台。**不要**改成 `explorer.exe` 中转或直接起 `Claude.exe`——在隐藏上下文里都不可靠。
- 新版 Windows 11 已弃用 VBScript,故未使用 `.vbs` 隐藏启动方案。

## 卸载

删除桌面的「Claude 中文.lnk」即可。`launcher/` 下的生成物(exe / ico / log)可一并删除。
