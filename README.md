# DS桌宠 · iOS 版

一只住在 iPhone 上的桌面小宠物（**106 个动作 · 207 句碎碎念 + 晓伊语音**）。
从安卓版 [DS桌宠](../../) 移植过来，逻辑全部复用同一套 `pet.js`。

> **不需要 Mac。** 编译交给 GitHub 免费的 macOS 机器，签名用你自己的 Apple ID。
> 完整安装步骤看 👉 **[安装教程.md](安装教程.md)**

---

## 两种玩法

### ① 网页 App（PWA）—— 零成本，随时能用
把 `app/Resources/web/` 用任意静态服务器托管，iPhone Safari 打开后
**分享 → 添加到主屏幕**，就是一个全屏的 App 图标（不过期、不用签名）。

本地测试：
```powershell
python -m http.server 8848 --directory app\Resources\web
# iPhone 连同一 Wi-Fi，Safari 打开 http://<电脑局域网IP>:8848/
```

### ② 真 App（.ipa）—— 能带画中画悬浮
推到 GitHub → Actions 自动出「未签名 IPA」→ AltStore / SideStore 用自己的 Apple ID 签名安装。
详见 **[安装教程.md](安装教程.md)**。

---

## 目录结构

```
.
├── .github/workflows/build-ipa.yml   GitHub Actions：借 macOS 机器编译 IPA
├── app/
│   ├── project.yml                   工程描述（XcodeGen，CI 里生成 .xcodeproj）
│   ├── Sources/
│   │   ├── DSPetApp.swift            SwiftUI 入口
│   │   ├── ContentView.swift         承载网页的全屏 WKWebView
│   │   ├── LocalServer.swift         极简本地 HTTP 服务器（给视频用，见下）
│   │   └── Info.plist
│   └── Resources/
│       ├── Assets.xcassets/          App 图标
│       └── web/                      网页版桌宠（= 安卓版的 assets，换成 iOS 能播的格式）
└── 安装教程.md
```

---

## 为什么素材要换格式

| 平台 | 透明视频格式 |
|---|---|
| 安卓 | **VP9 + alpha**（`.webm`） |
| iOS / Safari | **HEVC + alpha**（`.mov`） |

Safari 不支持带 alpha 通道的 WebM，所以 iOS 版用的是 dsh-pet 项目发布的
`assets-mov` 素材包（文件名与 webm 一一对应），**已真机验证透明正常、无黑框**。

### 为什么还塞了一个本地 HTTP 服务器

WKWebView 对 `file://` 下的 `<video>` 支持不稳定（尤其换 `src` 的时候）。
`LocalServer.swift` 用 Network.framework 写了约 150 行的极简服务器
（支持 Range 请求、只监听回环），把 `web/` 目录用 `http://127.0.0.1:<port>/` 提供出去 ——
这条路和 Safari 上实测通过的路径完全一致。

---

## 现在有什么 / 还没有什么

| 能力 | 状态 |
|---|---|
| 106 个动作（扭蛋袋随机，不重复） | ✅ |
| 物理：走动 / 抛飞 / 撞墙 / 拖拽 / 双击戳 | ✅ |
| 碎碎念气泡 + 207 条语音 | ✅ |
| 透明背景（HEVC-alpha） | ✅ 真机确认 |
| 全屏、无浏览器外框、App 图标 | ✅ |
| 画中画悬浮（浮在别的 App 上） | ⏳ 计划中 |
| 主屏 / 锁屏小组件 | ⏳ 计划中 |
| 摇一摇（CoreMotion） | ⏳ 计划中 |
| 读其他 App 的通知 | ❌ iOS 不提供此 API |

---

## 素材来源与声明

- 桌宠形象与动画：开源项目 **[dsh-pet](https://github.com/PC2005-cloud/dsh-pet)**（作者 PC2005-cloud），
  素材由其使用 AI 工具生成，依项目许可「**允许开源使用、禁止商用**」在本项目中非商业使用。
- 本 App **完全免费、无广告、无内购**，不用于任何商业用途。
- 本 App 为**非官方同人作品**，与 DeepSeek（深度求索）官方无隶属或背书关系。
