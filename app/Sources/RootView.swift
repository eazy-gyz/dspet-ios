import SwiftUI
import AVKit

/// 原生调试面板：直接用 Swift 调画中画，不经过网页那一层。
/// 这样能一次性区分「网页没把消息传过来」还是「画中画本身起不来」。
struct RootView: View {

    @State private var state = "还没点过"
    @State private var detail = ""
    @State private var appVersion = "?"
    @State private var supported = AVPictureInPictureController.isPictureInPictureSupported()

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ContentView()
                .ignoresSafeArea()

            VStack(alignment: .trailing, spacing: 8) {
                // 版本号（用来确认装的到底是不是新包）
                Text("v\(appVersion)")
                    .font(.caption2)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.black.opacity(0.65))
                    .foregroundColor(.white)
                    .clipShape(Capsule())

                Text(supported ? "PiP 支持 ✓" : "PiP 不支持 ✗")
                    .font(.caption2)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(supported ? Color.green.opacity(0.8) : Color.red.opacity(0.8))
                    .foregroundColor(.white)
                    .clipShape(Capsule())

                Text("状态：\(state)")
                    .font(.caption2)
                    .padding(6)
                    .background(Color.black.opacity(0.65))
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 6))

                if !detail.isEmpty {
                    Text(detail)
                        .font(.caption2)
                        .frame(maxWidth: 240, alignment: .trailing)
                        .multilineTextAlignment(.trailing)
                        .padding(6)
                        .background(Color.black.opacity(0.65))
                        .foregroundColor(.yellow)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }

                Button {
                    PiPManager.shared.start()
                } label: {
                    Text("🪟 浮到桌面（原生）")
                        .font(.subheadline).bold()
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .clipShape(Capsule())
                }

                Button {
                    PiPManager.shared.start()
                } label: {
                    Text("再试一次")
                        .font(.caption2)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(Color.white.opacity(0.15))
                        .foregroundColor(.white)
                        .clipShape(Capsule())
                }
            }
            .padding(.top, 56)
            .padding(.trailing, 12)
        }
        .onAppear {
            appVersion = (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?")
                       + "(" + (Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?") + ")"
            // 接住原生侧的状态/错误
            PiPManager.shared.onEventUI = { s, d in
                DispatchQueue.main.async {
                    state = s
                    detail = d
                }
            }
            // 补一次：attach 阶段就报的错（那时 UI 还没挂上）
            let last = PiPManager.shared.lastEvent
            if !last.0.isEmpty { state = last.0; detail = last.1 }
            supported = AVPictureInPictureController.isPictureInPictureSupported()
            NSLog("DSPet: RootView onAppear version=\(appVersion) supported=\(supported)")
        }
    }
}
