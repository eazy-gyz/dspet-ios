import AVFoundation
import AVKit
import UIKit

/// 画中画悬浮：让桌宠以「视频小窗」的形式浮在其他 App 上面。
///
/// 原理：iOS 不允许普通 App 造悬浮窗，但允许「画中画」。
/// 所以这里挂一个 1×1 的隐形 AVPlayerLayer（播放 bundle 里的 HEVC-alpha .mov），
/// 再挂一个 AVPictureInPictureController —— 按 Home 键时她就会浮起来。
///
/// 注意：画中画窗口是系统画的圆角窗，**带自己的背景**，
/// 所以看起来是「一个小窗里她在动」，不是无缝贴在桌面上。
final class PiPManager: NSObject {

    static let shared = PiPManager()

    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var pipController: AVPictureInPictureController?
    private var loopObserver: NSObjectProtocol?

    /// 当前播放的动画文件名（不带扩展名，比如 a032）
    private(set) var currentFile = "a032"

    /// 通知网页「画中画开了 / 关了 / 失败了」——由 ContentView 注入
    /// state: starting / active / stopped / failed / unsupported
    var onEvent: ((String, String) -> Void)?

    private func emit(_ state: String, _ detail: String = "") {
        NSLog("DSPet: pip \(state) \(detail)")
        onEvent?(state, detail)
    }

    private override init() { super.init() }

    var isActive: Bool { pipController?.isPictureInPictureActive ?? false }
    var isSupported: Bool { AVPictureInPictureController.isPictureInPictureSupported() }

    // MARK: - 挂到页面视图上（必须在可见窗口里才能起画中画）

    func attach(to view: UIView) {
        guard playerLayer == nil else { return }

        let layer = AVPlayerLayer()
        // 1×1 藏在屏幕左上角：系统要求「图层在可见窗口里」才允许起画中画，
        // 所以不能设 opacity=0，只能做得足够小
        layer.frame = CGRect(x: 0, y: 0, width: 2, height: 2)
        layer.videoGravity = .resizeAspect
        view.layer.addSublayer(layer)
        playerLayer = layer

        let p = AVPlayer()
        p.isMuted = true             // 画面是桌宠，声音走网页那一套
        p.actionAtItemEnd = .none
        player = p
        layer.player = p

        guard isSupported else {
            NSLog("DSPet: 这台设备不支持画中画")
            emit("unsupported")
            return
        }
        // ★ 音频会话要在判断支持之前设好，否则某些系统版本会报「不支持」
        setupAudioSession()

        let c = AVPictureInPictureController(playerLayer: layer)
        c?.delegate = self
        // v1 先不做「按 Home 自动浮起」—— 手动点按钮更可控，
        // 免得开关一次窗口后每次回桌面都自己蹦出来
        c?.canStartPictureInPictureAutomaticallyFromInline = false
        // 去掉快进/快退按钮（她又不是视频）
        c?.requiresLinearPlayback = true
        pipController = c

        NSLog("DSPet: 画中画已就绪，supported=\(isSupported)")
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

    // MARK: - 播放哪一段

    /// 切到某个动画（file 是 aNNN 这种文件名）
    func play(file name: String) {
        currentFile = name
        guard let url = Bundle.main.url(forResource: name,
                                        withExtension: "mov",
                                        subdirectory: "web/assets") else {
            NSLog("DSPet: 找不到素材 \(name).mov")
            return
        }
        let item = AVPlayerItem(url: url)
        player?.replaceCurrentItem(with: item)

        if let ob = loopObserver { NotificationCenter.default.removeObserver(ob) }
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
        emit("starting")
        play(file: name ?? currentFile)
        setupAudioSession()
        if !c.isPictureInPictureActive {
            // 注意：刚 replaceCurrentItem 时 isPictureInPicturePossible 还是 false，
            // 所以不能拿它当门槛 —— 直接起，失败了代理会回报
            NSLog("DSPet: 尝试启动画中画（possible=\(c.isPictureInPicturePossible)）")
            c.startPictureInPicture()
        }
    }

    func stop() {
        pipController?.stopPictureInPicture()
    }
}

// MARK: - 代理

extension PiPManager: AVPictureInPictureControllerDelegate {

    func pictureInPictureControllerDidStartPictureInPicture(_ controller: AVPictureInPictureController) {
        emit("active")
    }

    func pictureInPictureControllerDidStopPictureInPicture(_ controller: AVPictureInPictureController) {
        // 小窗关掉了就别在后台空转解码
        player?.pause()
        emit("stopped")
    }

    func pictureInPictureController(_ controller: AVPictureInPictureController,
                                    failedToStartPictureInPictureWithError error: Error) {
        emit("failed", error.localizedDescription)
    }

    func pictureInPictureControllerWillStartPictureInPicture(_ controller: AVPictureInPictureController) {
        // 需要实现，否则某些系统版本不给起
    }
}
