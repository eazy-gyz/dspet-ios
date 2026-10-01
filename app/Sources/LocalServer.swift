import Foundation
import Network

/// 极简本地 HTTP 服务器：把 App 里的 `web/` 目录通过 `http://127.0.0.1:<port>/` 提供出去。
///
/// 为什么不用 `file://` ？
///   WKWebView 对 `file://` 下的 `<video>`（尤其换 src 的时候）支持不稳，
///   而 http 这条路已经在 iPhone 的 Safari 上真机验证过（HEVC-alpha 透明视频正常）。
///   本地回环不走网络权限，也不依赖任何第三方库。
final class LocalServer {

    static let shared = LocalServer()

    private let queue = DispatchQueue(label: "dspet.local.server")
    private var listener: NWListener?
    private(set) var port: UInt16 = 0

    /// App bundle 里的 web 目录
    private var root: URL? {
        Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true)
    }

    var startURL: URL? {
        guard port > 0 else { return nil }
        return URL(string: "http://127.0.0.1:\(port)/index.html")
    }

    func start() {
        guard listener == nil else { return }
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            params.acceptLocalOnly = true          // 只接受本机回环连接

            let l = try NWListener(using: params, on: .any)
            l.stateUpdateHandler = { [weak self] state in
                switch state {
                case .ready:
                    self?.port = l.port?.rawValue ?? 0
                    NSLog("DSPet: server ready on port \(self?.port ?? 0)")
                case .failed(let e):
                    NSLog("DSPet: server failed \(e)")
                default:
                    break
                }
            }
            l.newConnectionHandler = { [weak self] conn in
                guard let self = self else { return }
                conn.start(queue: self.queue)
                self.readRequest(conn, buffer: Data())
            }
            l.start(queue: queue)
            listener = l
        } catch {
            NSLog("DSPet: server start error \(error)")
        }
    }

    // MARK: - 读请求头

    private func readRequest(_ conn: NWConnection, buffer: Data) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, isComplete, error in
            guard let self = self else { conn.cancel(); return }
            var buf = buffer
            if let d = data, !d.isEmpty { buf.append(d) }

            if let r = buf.range(of: Data("\r\n\r\n".utf8)) {
                let head = String(decoding: buf[..<r.lowerBound], as: UTF8.self)
                self.respond(conn, head: head)
                return
            }
            if error != nil || isComplete || buf.count > 64 * 1024 {
                conn.cancel()
                return
            }
            self.readRequest(conn, buffer: buf)
        }
    }

    // MARK: - 回响应

    private func respond(_ conn: NWConnection, head: String) {
        let lines = head.components(separatedBy: "\r\n")
        guard let root = root else { return sendText(conn, "500 Internal Server Error", "no root") }

        let parts = (lines.first ?? "").split(separator: " ")
        guard parts.count >= 2 else { return sendText(conn, "400 Bad Request", "bad request") }

        var path = String(parts[1])
        if let q = path.firstIndex(of: "?") { path = String(path[path.startIndex..<q]) }
        if path.hasSuffix("/") { path += "index.html" }
        path = path.removingPercentEncoding ?? path

        let rel = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let fileURL = root.appendingPathComponent(rel).standardizedFileURL

        // 防目录穿越
        guard fileURL.path.hasPrefix(root.standardizedFileURL.path) else {
            return sendText(conn, "403 Forbidden", "forbidden")
        }
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
              let fileSize = (attrs[.size] as? NSNumber)?.intValue,
              fileSize >= 0,
              let fh = try? FileHandle(forReadingFrom: fileURL) else {
            return sendText(conn, "404 Not Found", "not found")
        }
        defer { try? fh.close() }

        // Range（视频必须要，不然拖动进度/流式播放会出问题）
        var start = 0
        var end = max(0, fileSize - 1)
        var partial = false
        for l in lines where l.lowercased().hasPrefix("range:") {
            let v = l.components(separatedBy: "=").last ?? ""
            let comps = v.components(separatedBy: "-")
            if comps.count > 0, let s = Int(comps[0].trimmingCharacters(in: .whitespaces)) {
                start = s
                partial = true
            }
            if comps.count > 1, let e = Int(comps[1].trimmingCharacters(in: .whitespaces)), e >= start {
                end = min(e, fileSize - 1)
            }
        }
        if start >= fileSize || fileSize == 0 {
            start = 0
            end = max(0, fileSize - 1)
            partial = false
        }
        let length = end - start + 1

        var header = partial
            ? "HTTP/1.1 206 Partial Content\r\n"
            : "HTTP/1.1 200 OK\r\n"
        header += "Content-Type: \(LocalServer.mime(for: fileURL.pathExtension))\r\n"
        header += "Content-Length: \(length)\r\n"
        header += "Accept-Ranges: bytes\r\n"
        if partial { header += "Content-Range: bytes \(start)-\(end)/\(fileSize)\r\n" }
        header += "Cache-Control: no-store\r\n"
        header += "Connection: close\r\n\r\n"

        var out = Data(header.utf8)
        if length > 0 {
            try? fh.seek(toOffset: UInt64(start))
            if let body = try? fh.read(upToCount: length), !body.isEmpty { out.append(body) }
        }
        conn.send(content: out, completion: .contentProcessed { _ in conn.cancel() })
    }

    private func sendText(_ conn: NWConnection, _ status: String, _ text: String) {
        let body = Data(text.utf8)
        var header = "HTTP/1.1 \(status)\r\n"
        header += "Content-Type: text/plain; charset=utf-8\r\n"
        header += "Content-Length: \(body.count)\r\n"
        header += "Connection: close\r\n\r\n"
        var out = Data(header.utf8)
        out.append(body)
        conn.send(content: out, completion: .contentProcessed { _ in conn.cancel() })
    }

    static func mime(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js":          return "text/javascript; charset=utf-8"
        case "css":         return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json; charset=utf-8"
        case "png":         return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif":         return "image/gif"
        case "svg":         return "image/svg+xml"
        case "mp3":         return "audio/mpeg"
        case "m4a":         return "audio/mp4"
        case "mov":         return "video/quicktime"
        case "mp4":         return "video/mp4"
        case "webm":        return "video/webm"
        default:            return "application/octet-stream"
        }
    }
}
