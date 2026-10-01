import SwiftUI
import WebKit

/// 承载网页版桌宠的全屏 WKWebView
struct ContentView: UIViewRepresentable {

    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()

        // 视频要能在页面内自动播、内联播（不然 iOS 会弹全屏播放器）
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.allowsPictureInPictureMediaPlayback = true

        // 背景透明，露出下层（以后给画中画 / 小组件用）
        cfg.suppressesIncrementalRendering = false

        let webView = WKWebView(frame: .zero, configuration: cfg)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false

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

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
