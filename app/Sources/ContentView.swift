import SwiftUI
import WebKit
import AVFoundation

/// 承载网页版桌宠的全屏 WKWebView
struct ContentView: UIViewRepresentable {

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()

        // 视频要能在页面内自动播、内联播（不然 iOS 会弹全屏播放器）
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.allowsPictureInPictureMediaPlayback = true

        // ★ 网页 → 原生：画中画指令（window.webkit.messageHandlers.pip.postMessage）
        cfg.userContentController.add(context.coordinator, name: "pip")

        let webView = WKWebView(frame: .zero, configuration: cfg)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false

        // ★ 画中画：在页面视图上挂一个隐形的播放器层
        PiPManager.shared.attach(to: webView)
        PiPManager.shared.onEvent = { [weak webView] state, detail in
            let js = "window.__pipState && window.__pipState(\(jsString(state)), \(jsString(detail)))"
            DispatchQueue.main.async {
                webView?.evaluateJavaScript(js) { _, err in
                    if let err = err { NSLog("DSPet: pipState js error \(err)") }
                }
            }
        }

        // 优先走本地 http（和 Safari 实测通过的路径一模一样）
        LocalServer.shared.start()
        if let url = LocalServer.shared.startURL {
            webView.load(URLRequest(url: url))
        } else if let index = Bundle.main.url(forResource: "index",
                                              withExtension: "html",
                                              subdirectory: "web") {
            // 兜底：本地服务器没起来就直接读文件
            webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        PiPManager.shared.layout(in: uiView)
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController
            .removeScriptMessageHandler(forName: "pip")
    }
}

/// 把 Swift 字符串安全地塞进 JS（用 JSON 编码，转义引号 / 换行 / emoji）
func jsString(_ s: String) -> String {
    guard let data = try? JSONEncoder().encode(s),
          let text = String(data: data, encoding: .utf8) else { return "\"\"" }
    return text
}

/// 接收网页发来的画中画指令
final class Coordinator: NSObject, WKScriptMessageHandler {

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.name == "pip",
              let body = message.body as? [String: Any],
              let cmd = body["cmd"] as? String else { return }

        let anim = body["anim"] as? String
        NSLog("DSPet: pip 指令 \(cmd) \(anim ?? "")")

        switch cmd {
        case "start": PiPManager.shared.start(file: anim)
        case "play":  PiPManager.shared.play(file: anim ?? PiPManager.shared.currentFile)
        case "stop":  PiPManager.shared.stop()
        default:      break
        }
    }
}
