import AVFoundation
import AVKit
import UIKit

/// 画中画悬浮：让桌宠以「视频小窗」的形式浮在其他 App 上面。
///
/// 关键点（都是踩坑踩出来的）：
///  1. iOS 不允许普通 App 造悬浮窗，只有「画中画」能浮起来
///  2. 刚换上视频时 `isPictureInPicturePossible` 还是 false，
///     这时候调 `startPictureInPicture()` 系统会**静默忽略** —— 必须 KVO 等它变 true
///  3. 画中画窗口是**系统画的不透明窗**，视频里的 alpha 不会被合成 →
///     所以 PiP 单独用一套**带背景**的小视频（web/pip/*.mp4），不是那套透明的 .mov
///  4. 靠「播完通知」重播在后台不稳，改用官方的 **AVPlayerLooper** 做无缝循环
final class PiPManager: NSObject {

    static let shared = PiPManager()

    private var queuePlayer: AVQueuePlayer?
    private var playerLayer: AVPlayerLayer?
    private var pipController: AVPictureInPictureController?
    private var possibleObs: NSKeyValueObservation?
    private var startTimer: Timer?
    private var looper: AVPlayerLooper?
    private var rotateTimer: Timer?

    /// PiP 专用的那套小视频（带背景）
    private var playlist: [String] = []
    private var playlistIndex = 0

    /// 当前播放的动画文件名（不带扩展名，比如 a032）
    private(set) var currentFile = "a032"

    /// 通知网页状态：starting / active / stopped / failed / unsupported
    var onEvent: ((String, String) -> Void)?
    /// 通知原生调试面板（RootView）
    var onEventUI: ((String, String) -> Void)?
    /// 最近一次事件（面板 onAppear 时补读，因为 attach 阶段面板还没挂上）
    private(set) var lastEvent: (String, String) = ("", "")

    private override init() { super.init() }

    var isActive: Bool { pipController?.isPictureInPictureActive ?? false }
    var isSupported: Bool { AVPictureInPictureController.isPictureInPictureSupported() }

    private func emit(_ state: String, _ detail: String = "") {
        NSLog("DSPet: pip \(state) \(detail)")
        lastEvent = (state, detail)
        DispatchQueue.main.async { [weak self] in
            self?.onEvent?(state, detail)
            self?.onEventUI?(state, detail)
        }
    }

    // MARK: - 挂到页面视图上

    func attach(to view: UIView) {
        guard playerLayer == nil else { return }

        let layer = AVPlayerLayer()
        // 铺在网页下面（网页是整屏不透明背景，看不见它），但尺寸要够大，
        // 太小的图层系统会认为「没有在可见地播」，不给起画中画
        layer.frame = view.bounds.isEmpty
            ? CGRect(x: 0, y: 0, width: 360, height: 203)
            : view.bounds
        layer.videoGravity = .resizeAspect
        view.layer.insertSublayer(layer, at: 0)
        playerLayer = layer
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak view] in
            guard let view = view else { return }
            self.layout(in: view)
        }

        // ★ AVQueuePlayer 是 AVPlayerLooper 的前提
        let p = AVQueuePlayer()
        p.isMuted = true
        queuePlayer = p
        layer.player = p

        buildPlaylist()

        guard isSupported else {
            emit("unsupported")
            return
        }
        setupAudioSession()

        let c = AVPictureInPictureController(playerLayer: layer)
        if c == nil {
            emit("failed", "控制器创建失败（图层 \(Int(layer.frame.width))x\(Int(layer.frame.height))）")
        }
        c?.delegate = self
        c?.canStartPictureInPictureAutomaticallyFromInline = false
        c?.requiresLinearPlayback = true
        pipController = c

        emit("ready", "PiP素材 \(playlist.count) 个 · 图层 \(Int(layer.frame.width))x\(Int(layer.frame.height))")
    }

    /// 收集 web/pip/*.mp4 作为 PiP 的动画池
    private func buildPlaylist() {
        guard let dir = Bundle.main.resourceURL?.appendingPathComponent("web/pip") else { return }
        let names = (try? FileManager.default.contentsOfDirectory(atPath: dir.path))?
            .filter { $0.hasSuffix(".mp4") }
            .map { String($0.dropLast(4)) } ?? []
        playlist = names.shuffled()
        NSLog("DSPet: PiP 素材 \(playlist.count) 个")
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

    /// 布局变化时同步播放器层尺寸
    func layout(in view: UIView) {
        guard let layer = playerLayer, !view.bounds.isEmpty else { return }
        if layer.frame != view.bounds { layer.frame = view.bounds }
    }

    // MARK: - 播放

    private func pipURL(_ name: String) -> URL? {
        // 优先用带背景的 PiP 专用视频
        if let u = Bundle.main.url(forResource: name, withExtension: "mp4", subdirectory: "web/pip") {
            return u
        }
        // 兜底：透明 mov
        return Bundle.main.url(forResource: name, withExtension: "mov", subdirectory: "web/assets")
    }

    func play(file name: String) {
        currentFile = name
        guard let url = pipURL(name), let p = queuePlayer else {
            emit("failed", "找不到素材 \(name)")
            return
        }
        let item = AVPlayerItem(url: url)
        p.removeAllItems()
        // ★ AVPlayerLooper：官方无缝循环，不依赖播完通知
        looper = AVPlayerLooper(player: p, templateItem: item)
        p.play()
    }

    private func playNextFromPlaylist() {
        guard !playlist.isEmpty else { return }
        playlistIndex = (playlistIndex + 1) % playlist.count
        play(file: playlist[playlistIndex])
    }

    /// 每 12 秒换一个动作，让小窗里的她"活着"
    private func startRotation() {
        rotateTimer?.invalidate()
        rotateTimer = Timer.scheduledTimer(withTimeInterval: 12, repeats: true) { [weak self] _ in
            guard let self = self, self.isActive else { return }
            self.playNextFromPlaylist()
        }
    }

    private func stopRotation() {
        rotateTimer?.invalidate()
        rotateTimer = nil
    }

    // MARK: - 开关

    func start(file name: String? = nil) {
        guard isSupported, let c = pipController else {
            emit("failed", "不可用 supported=\(isSupported) controller=\(pipController != nil)")
            return
        }
        if c.isPictureInPictureActive { return }

        let lw = Int(playerLayer?.frame.width ?? 0)
        let lh = Int(playerLayer?.frame.height ?? 0)
        emit("starting", "possible=\(c.isPictureInPicturePossible) 图层=\(lw)x\(lh) 素材=\(playlist.count)")
        play(file: name ?? currentFile)
        setupAudioSession()

        if c.isPictureInPicturePossible {
            beginStart(c)
            return
        }

        possibleObs?.invalidate()
        possibleObs = c.observe(\.isPictureInPicturePossible, options: [.new]) { [weak self] ctrl, change in
            guard let self = self, change.newValue == true else { return }
            self.possibleObs?.invalidate()
            self.possibleObs = nil
            self.beginStart(ctrl)
        }

        startTimer?.invalidate()
        startTimer = Timer.scheduledTimer(withTimeInterval: 6, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            self.possibleObs?.invalidate()
            self.possibleObs = nil
            if !(self.pipController?.isPictureInPictureActive ?? false) {
                let it = self.queuePlayer?.currentItem
                self.emit("failed", "6 秒还没就绪 · 尺寸=\(it?.presentationSize.width ?? 0)x\(it?.presentationSize.height ?? 0) 状态=\(it?.status.rawValue ?? -1)")
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
        possibleObs?.invalidate(); possibleObs = nil
        startTimer?.invalidate(); startTimer = nil
        stopRotation()
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
        emit("active", "她在小窗里了")
        startRotation()
    }

    func pictureInPictureControllerDidStopPictureInPicture(_ controller: AVPictureInPictureController) {
        queuePlayer?.pause()
        stopRotation()
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
