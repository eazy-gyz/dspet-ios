import SwiftUI

/// DS桌宠 · iOS 原生外壳
///
/// 整个桌宠的逻辑（106 个动作、物理、气泡、碎碎念、语音）都还是网页那一套
/// （Resources/web/pet.js），这里只提供一个「全屏、无浏览器外框」的原生壳子。
/// 后面要加的画中画悬浮、小组件，也挂在这个壳子上。
@main
struct DSPetApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .ignoresSafeArea()
                .statusBarHidden(true)
        }
    }
}
