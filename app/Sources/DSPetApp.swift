import SwiftUI

/// DS桌宠 · iOS 原生外壳
///
/// 整个桌宠的逻辑（106 个动作、物理、气泡、碎碎念、语音）都还是网页那一套
/// （Resources/web/pet.js），这里只提供一个「全屏、无浏览器外框」的原生壳子。
/// 右上角还有一个**原生调试面板**：用来确认画中画到底卡在哪一步。
@main
struct DSPetApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .statusBarHidden(true)
        }
    }
}
