<p align="center">
  <img src="build/icon.png" width="128" alt="繁花GG" />
</p>

<h1 align="center">繁花GG</h1>

<p align="center">网易云音乐桌面伴侣：实时歌词、播放控制、全屏屏保</p>

<p align="center">
  <img alt="platform" src="https://img.shields.io/badge/platform-Windows%2010%2F11-blue" />
  <img alt="electron" src="https://img.shields.io/badge/Electron-44-47848f" />
  <img alt="vue" src="https://img.shields.io/badge/Vue-3-42b883" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

繁花GG 是一个 Windows 桌面小应用，连接正在运行的**网易云音乐 PC 客户端**，实时显示当前歌曲、进度和滚动歌词，并可以直接控制播放。
它不修改网易云的任何文件、不注入 DLL，也不播放或下载任何音乐。所有播放都由你本机的官方客户端完成。

## 功能

- **实时信息**：歌名、歌手、专辑、封面、播放进度、滚动歌词（含翻译）
- **播放控制**：播放 / 暂停、上一首 / 下一首、拖动进度条或点击歌词跳转、喜欢 / 取消喜欢
- **主页外观**：9:16 竖屏窗口；封面可选上下排列或左右排列，尺寸可调；可选用任意已安装字体
- **屏保模式**：歌词、黑胶、时钟三种全屏样式；可设置密码锁，闲置 10 秒自动隐藏解锁框，移动鼠标重新出现
- **自动连接**：自动以调试模式启动或重启网易云，断线自动重连，也可以一键“重新连接网易云”

## 系统要求

- Windows 10 / 11（x64）
- 网易云音乐 PC 版 **3.x**（已在 3.1.42 上验证，不支持 2.x）

## 下载安装

在 [Releases](../../releases) 页面下载：

| 文件 | 说明 |
| --- | --- |
| `FanhuaGG-x.y.z-Setup.exe` | 安装版，可选择安装目录，自动创建桌面和开始菜单快捷方式 |
| `FanhuaGG-x.y.z-Portable.exe` | 便携版，免安装，双击即用 |

安装包没有代码签名，首次运行时 Windows SmartScreen 可能提示“未知发布者”。点击“更多信息”→“仍要运行”即可。

## 工作原理

网易云音乐 3.x 的界面基于 CEF（Chromium Embedded Framework）。繁花GG 会以 `--remote-debugging-port=9222` 参数启动网易云，
再通过 Chrome DevTools Protocol 连接它的界面页面，读取内部播放状态，并调用客户端自带的播放操作（与点击网易云自身按钮效果相同）。

## 注意事项

- 如果网易云已经以普通方式运行，繁花GG 会**关闭它并以调试模式重新启动**，播放会中断几秒。之后再打开繁花GG 时会直接连接，不再重启。
- 调试端口只监听本机（127.0.0.1），但本机上的其他程序也能通过该端口控制网易云。
- 端口被占用时，可通过环境变量 `NCM_DEBUG_PORT` 更换端口。如果无法自动找到网易云安装位置，可用 `NCM_PATH` 指定 `cloudmusic.exe` 的路径。
- 屏保密码锁是**应用级**的锁，拦不住 Ctrl+Alt+Del、Win+L、任务管理器等系统功能，不能代替系统锁屏。
- 设置保存在 `%APPDATA%\FanhuaGG\settings.json`，密码只以加盐哈希（scrypt）形式保存。
- 本工具依赖网易云客户端的内部实现，网易云更新版本后可能需要重新适配。

## 从源码构建

需要 Node.js 22 及以上版本。

```bash
npm install
npm run dev      # 开发模式：Vite 热更新 + Electron
npm start        # 构建并运行
npm run dist     # 打包 Windows 安装版和便携版，输出到 release/
npm run icons    # 由 build/icon.svg 重新生成 build/icon.png 和 build/icon.ico
npm run ncm -- status   # 命令行调试：查看 / 控制网易云（status、next、toggle、like 等）
```

中国大陆网络环境下，安装和打包时可以设置镜像：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
```

## 项目结构

```
build/                  图标源文件（icon.svg）及生成的 icon.png / icon.ico
src/main/               Electron 主进程
  ncm/                  网易云连接：进程管理、CDP 客户端、注入页面的桥接脚本、控制器
  settings.js           设置存储（密码 scrypt 哈希）
  screensaver.js        屏保与密码锁
  fonts.js              读取系统字体
src/preload/            预加载脚本（向界面暴露 window.ncm / window.desktop）
src/renderer/           界面：Vite + Vue 3 + TypeScript
tools/                  开发工具：启动器、图标生成、命令行控制、调试探针
```

## 免责声明

本项目是个人学习交流用途的非官方工具，与网易公司及网易云音乐没有任何关联，也未获得其授权或认可。
“网易云音乐”及相关名称、标识是网易公司的商标。本项目不提供、不存储、不传播任何音乐内容。
使用本项目的风险由使用者自行承担。

## 许可证

[MIT](LICENSE) © 2026 zhizi01
