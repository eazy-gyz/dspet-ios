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

    /// 通知网页「画中画开了 / 关了」——由 ContentView 注入
    var onStateChanged: ((Bool) -> Void)?

    private override init() { super.init() }

    var isActive: Bool { pipController?.isPictureInPictureActive ?? false }
    var isSupported: Bool { AVPictureInPictureController.isPictureInPictureSupported() }

    // MARK: - 挂到页面视图上（必须在可见窗口里才能起画中画）

    func attach(to view: UIView) {
        guard playerLayer == nil else { return }

        let layer = AVPlayerLayer()
        layer.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
        layer.videoGravity = .resizeAspect
        layer.opacity = 0            // 页面上不露脸，只在画中画里出现
        view.layer.addSublayer(layer)
        playerLayer = layer

        let p = AVPlayer()
        p.isMuted = true             // 画面是桌宠，声音走网页那一套
        p.actionAtItemEnd = .none
        player = p
        layer.player = p

        guard isSupported else {
            NSLog("DSPet: 这台设备不支持画中画")
            return
        }
        let c = AVPictureInPictureController(playerLayer: layer)
        c?.delegate = self
        // 按 Home 键自动浮起来
        c?.canStartPictureInPictureAutomaticallyFromInline = true
        // 去掉快进/快退按钮（她又不是视频）
        c?.requiresLinearPlayback = true
        pipController = c

        setupAudioSession()
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
            NSLog("DSPet: 画中画不可用")
            return
        }
        play(file: name ?? currentFile)
        setupAudioSession()
        if !c.isPictureInPictureActive {
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
        NSLog("DSPet: 画中画已开始")
        onStateChanged?(true)
    }

    func pictureInPictureControllerDidStopPictureInPicture(_ controller: AVPictureInPictureController) {
        NSLog("DSPet: 画中画已结束")
        onStateChanged?(false)
    }

    func pictureInPictureController(_ controller: AVPictureInPictureController,
                                    failedToStartPictureInPictureWithError error: Error) {
        NSLog("DSPet: 画中画启动失败 \(error)")
        onStateChanged?(false)
    }

    func pictureInPictureControllerWillStartPictureInPicture(_ controller: AVPictureInPictureController) {
        // 需要实现，否则某些系统版本不给起
    }
}
