import AVFoundation
import AVKit
import UIKit

/// 画中画悬浮：让桌宠以「视频小窗」的形式浮在其他 App 上面。
///
/// 原理：iOS 不允许普通 App 造悬浮窗，但允许「画中画」。
/// 这里挂一个 AVPlayerLayer（播放 bundle 里的 HEVC-alpha .mov），
/// 再挂一个 AVPictureInPictureController —— 点按钮或按 Home 时她就浮起来。
///
/// ⚠️ 关键坑（v1 就是这么失败的）：
///   刚 replaceCurrentItem 之后 isPictureInPicturePossible 还是 false，
///   这时候调 startPictureInPicture()，系统**既不启动也不报错**，静默失败。
///   所以必须 KVO 等它变 true 再起，并且加超时兜底。
final class PiPManager: NSObject {

    static let shared = PiPManager()

    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var pipController: AVPictureInPictureController?
    private var loopObserver: NSObjectProtocol?
    private var possibleObs: NSKeyValueObservation?
    private var startTimer: Timer?

    /// 当前播放的动画文件名（不带扩展名，比如 a032）
    private(set) var currentFile = "a032"

    /// 通知网页状态：starting / active / stopped / failed / unsupported
    var onEvent: ((String, String) -> Void)?

    private override init() { super.init() }

    var isActive: Bool { pipController?.isPictureInPictureActive ?? false }
    var isSupported: Bool { AVPictureInPictureController.isPictureInPictureSupported() }

    private func emit(_ state: String, _ detail: String = "") {
        NSLog("DSPet: pip \(state) \(detail)")
        DispatchQueue.main.async { [weak self] in
            self?.onEvent?(state, detail)
        }
    }

    // MARK: - 挂到页面视图上

    func attach(to view: UIView) {
        guard playerLayer == nil else { return }

        let layer = AVPlayerLayer()
        // 铺在网页**下面**（网页本身是整屏不透明背景，所以看不见它），
        // 但尺寸要足够大 —— 太小的图层系统会认为「没有在可见地播」，不给起画中画。
        // makeUIView 阶段 bounds 可能还是 0，所以先给个保底尺寸。
        layer.frame = view.bounds.isEmpty
            ? CGRect(x: 0, y: 0, width: 360, height: 203)
            : view.bounds
        layer.videoGravity = .resizeAspect
        // 注意：CALayer.autoresizingMask 是 macOS 专有 API，iOS 上编译不过，
        // 所以这里手动跟着 view 的尺寸走（见 layout(in:)）
        view.layer.insertSublayer(layer, at: 0)
        playerLayer = layer
        // 布局完成后补一次尺寸（makeUIView 阶段 bounds 往往是 0）
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak view] in
            guard let view = view else { return }
            self.layout(in: view)
        }

        let p = AVPlayer()
        p.isMuted = true
        p.actionAtItemEnd = .none
        player = p
        layer.player = p

        guard isSupported else {
            NSLog("DSPet: 这台设备不支持画中画")
            emit("unsupported")
            return
        }
        // ★ 音频会话要在判断支持之前设好
        setupAudioSession()

        let c = AVPictureInPictureController(playerLayer: layer)
        c?.delegate = self
        c?.canStartPictureInPictureAutomaticallyFromInline = false
        c?.requiresLinearPlayback = true
        pipController = c

        NSLog("DSPet: 画中画已就绪 supported=\(isSupported)")
    }

    private func setupAudioSession() {
        do {
            let s = AVAudioSession.sharedInstance()
            try s.setCategory(.playback, mode: .moviePlayback, options: [])
            try s.setActive(true)
        } catch {
            NSLog("DSPet: 音频会话设置失败 \(error)")
        }
    }

    /// 布局变化时同步一下播放器层的尺寸（由 ContentView.updateUIView 调）
    func layout(in view: UIView) {
        guard let layer = playerLayer, !view.bounds.isEmpty else { return }
        if layer.frame != view.bounds { layer.frame = view.bounds }
    }

    // MARK: - 播放哪一段

    func play(file name: String) {
        currentFile = name
        guard let url = Bundle.main.url(forResource: name,
                                        withExtension: "mov",
                                        subdirectory: "web/assets") else {
            emit("failed", "找不到素材 \(name).mov")
            return
        }
        if let ob = loopObserver { NotificationCenter.default.removeObserver(ob) }
        let item = AVPlayerItem(url: url)
        player?.replaceCurrentItem(with: item)
        loopObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
        ) { [weak self] _ in
            self?.player?.seek(to: .zero)
            self?.player?.play()
        }
        player?.play()
    }

    // MARK: - 开关

    func start(file name: String? = nil) {
        guard isSupported, let c = pipController else {
            emit("unsupported")
            return
        }
        if c.isPictureInPictureActive { return }

        emit("starting", "possible=\(c.isPictureInPicturePossible)")
        play(file: name ?? currentFile)
        setupAudioSession()

        if c.isPictureInPicturePossible {
            beginStart(c)
            return
        }

        // 等系统说「可以了」
        possibleObs?.invalidate()
        possibleObs = c.observe(\.isPictureInPicturePossible, options: [.new]) { [weak self] ctrl, change in
            guard let self = self, change.newValue == true else { return }
            self.possibleObs?.invalidate()
            self.possibleObs = nil
            self.beginStart(ctrl)
        }

        // 兜底：6 秒还没准备好就明确报错，别让按钮一直「启动中…」
        startTimer?.invalidate()
        startTimer = Timer.scheduledTimer(withTimeInterval: 6, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            self.possibleObs?.invalidate()
            self.possibleObs = nil
            if !(self.pipController?.isPictureInPictureActive ?? false) {
                self.emit("failed", "系统一直说不能起（视频没解码出来？）")
            }
        }
    }

    private func beginStart(_ c: AVPictureInPictureController) {
        startTimer?.invalidate()
        startTimer = nil
        guard !c.isPictureInPictureActive else { return }
        NSLog("DSPet: possible=true，正式起画中画")
        c.startPictureInPicture()
    }

    func stop() {
        possibleObs?.invalidate()
        possibleObs = nil
        startTimer?.invalidate()
        startTimer = nil
        pipController?.stopPictureInPicture()
    }
}

// MARK: - 代理

extension PiPManager: AVPictureInPictureControllerDelegate {

    func pictureInPictureControllerWillStartPictureInPicture(_ controller: AVPictureInPictureController) {
        NSLog("DSPet: 画中画将要开始")
    }

    func pictureInPictureControllerDidStartPictureInPicture(_ controller: AVPictureInPictureController) {
        startTimer?.invalidate()
        startTimer = nil
        emit("active")
    }

    func pictureInPictureControllerDidStopPictureInPicture(_ controller: AVPictureInPictureController) {
        player?.pause()
        emit("stopped")
    }

    func pictureInPictureController(_ controller: AVPictureInPictureController,
                                    failedToStartPictureInPictureWithError error: Error) {
        startTimer?.invalidate()
        startTimer = nil
        emit("failed", error.localizedDescription)
    }

    func pictureInPictureController(_ controller: AVPictureInPictureController,
                                    restoreUserInterfaceForPictureInPictureStopWithCompletionHandler
                                    completionHandler: @escaping (Bool) -> Void) {
        completionHandler(true)
    }
}
