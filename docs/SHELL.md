# The shell contract

How a host — a native app's web view or a page that iframes the game — talks to Tally Two, and what the game does on its own. The code this describes is `src/platform/bridgeProtocol.ts` (the types and the pure encode/decode/validate, unit-tested with no DOM), `src/platform/bridge.ts` (host detection, delivery, requests), `src/platform/bridgeStorage.ts` (settings through the host) and `src/platform/useBridge.ts` (pause, insets, ready as React state). Nothing in `game/`, `engine/`, `ai/` or `audio/` knows a host exists: `GameProvider` receives a three-method `ShellPort` as a prop, the way it receives `audio`.

## 1. Detection

Once, at module load, in this order:

| Host | Detected by | App → host delivery | Host → app delivery |
| --- | --- | --- | --- |
| `ios` | `window.webkit.messageHandlers.tally` exists | `postMessage(jsonString)` on that handler | `window.tallyReceive(jsonString)` via `evaluateJavaScript` |
| `android` | `window.TallyBridge.postMessage` is a function | `TallyBridge.postMessage(jsonString)` | `window.tallyReceive(jsonString)` via `evaluateJavascript` |
| `iframe` | `window.parent !== window` | `parent.postMessage(object, "*")` | `iframe.contentWindow.postMessage(object, "*")` — only messages whose `source` is the parent are read |
| none | — | every send is a no-op | nothing is installed |

`bridge.host` is that value (`"ios" | "android" | "iframe" | null`). With no host the app is exactly the plain web app: localStorage settings, `document.hidden` the only pause, no `window.tallyReceive`, no `message` listener.

## 2. The envelope

Every message, both ways, is

```json
{ "tally": 1, "type": "<type>", "payload": { ... }, "id": 7 }
```

`tally: 1` is the protocol version and the filter: anything without it is ignored. `id` appears only on a request (app → host) and the host echoes it inside the reply's payload. Native handlers receive the envelope as a JSON string; an iframe parent receives it as a structured object (and may send either form back — `decode()` accepts both, never `eval`s, and drops anything malformed: an unknown `type`, a `settings` reply with no id, `insets` that are not four finite numbers).

## 3. App → host

| Type | Payload | When |
| --- | --- | --- |
| `ready` | `{}` | once, after the first render. Send `insets` (and `pause`, if the app is already in the background) in response. |
| `score` | `{ round, totals }` | a round has been scored; `totals` is the running match tally, one number per seat (seat 0 is the player). |
| `matchOver` | `{ winner, totals }` | the eighth round has been scored; `winner` is a seat index. Sent in the same tick as that round's `score`. |
| `haptic` | `{ kind: "slap" \| "win" \| "deal" }` | `slap`: a play landed on the felt (any seat); `win`: that play emptied a hand; `deal`: a deal roll started. Map to `UIImpactFeedbackGenerator` light / `UINotificationFeedbackGenerator` success / a soft tick, or ignore. |
| `settings:get` | `{}` | **request** (carries `id`): the app is hydrating. Reply with `settings`. |
| `settings:set` | `{ json }` | **request** (carries `id`): persist `json` (an opaque string — the app's whole settings blob, one per install). Reply with `settings` to acknowledge. |

## 4. Host → app

| Type | Payload | Effect |
| --- | --- | --- |
| `pause` | `{}` (optional) | no AI timer fires and the audio context suspends until `resume`. Send it on `applicationWillResignActive` / `onPause`; the hidden-tab pause still works on its own. |
| `resume` | `{}` (optional) | the AI loop and the audio resume. |
| `settings` | `{ id, json }` | the reply to `settings:get` (`json`: the stored string, or `null` when nothing is stored yet) and to `settings:set` (echo the json). `id` must be the request's. |
| `insets` | `{ top, right, bottom, left }` | CSS px. Set as `--inset-top/right/bottom/left` on the `.game` element; the layout reads `var(--inset-left, env(safe-area-inset-left))`, so a web view that cannot see the safe area still clears the notch and the home indicator. Resend on rotation. Negative values clamp to 0. |

Anything else is dropped silently.

## 5. Settings: the host owns durable storage

In a host the app's `StoragePort` is `bridgeStorage`: `get` sends `settings:get` and waits **1500 ms** for the `settings` reply; `set` sends `settings:set` and waits the same for its acknowledgement. The host's answer wins — a `null` json means "fresh install", not "read localStorage". If a request times out (a parent page that does not implement the protocol), the port falls back to `webStorage` (localStorage) for that call and for the rest of the page's life, so a host that is silent once costs one 1.5-s wait, not one per write.

Why: Safari partitions an iframe's localStorage by the top-level site and can clear it under storage pressure, and a WKWebView's website data goes with the app's cache. `UserDefaults` / `SharedPreferences` / the parent page's own storage is the only place the settings survive.

## 6. Embed recipes

### WKWebView (iOS)

```swift
let config = WKWebViewConfiguration()
config.allowsInlineMediaPlayback = true                 // the audio context plays inline, no fullscreen player
config.mediaTypesRequiringUserActionForPlayback = []    // a tap on "Deal me in" unlocks audio; let it
config.userContentController.add(self, name: "tally")   // window.webkit.messageHandlers.tally
let webView = WKWebView(frame: .zero, configuration: config)
webView.scrollView.isScrollEnabled = false
webView.scrollView.contentInsetAdjustmentBehavior = .never
webView.isOpaque = false; webView.backgroundColor = UIColor(red: 0.14, green: 0.08, blue: 0.03, alpha: 1)  // #241408, the wood

// Landscape only, status bar hidden: UIViewController
override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
override var prefersStatusBarHidden: Bool { true }
override var prefersHomeIndicatorAutoHidden: Bool { true }

// Receive
func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
  guard m.name == "tally", let text = m.body as? String,
        let data = text.data(using: .utf8),
        let msg = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        msg["tally"] as? Int == 1, let type = msg["type"] as? String else { return }
  switch type {
  case "ready": sendInsets(); if UIApplication.shared.applicationState != .active { send("pause") }
  case "settings:get": reply(id: msg["id"], json: UserDefaults.standard.string(forKey: "tallytwo.settings"))
  case "settings:set":
    let json = (msg["payload"] as? [String: Any])?["json"] as? String
    UserDefaults.standard.set(json, forKey: "tallytwo.settings"); reply(id: msg["id"], json: json)
  case "haptic": haptic((msg["payload"] as? [String: Any])?["kind"] as? String)
  case "score", "matchOver": break   // Game Center, analytics, whatever you like
  default: break
  }
}

// Send: everything goes through window.tallyReceive(jsonString)
func send(_ type: String, _ payload: [String: Any] = [:]) {
  let obj: [String: Any] = ["tally": 1, "type": type, "payload": payload]
  let s = String(data: try! JSONSerialization.data(withJSONObject: obj), encoding: .utf8)!
  let escaped = s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
  webView.evaluateJavaScript("window.tallyReceive && window.tallyReceive('\(escaped)')")
}
func reply(id: Any?, json: String?) { send("settings", ["id": id ?? 0, "json": json as Any]) }
func sendInsets() {
  let i = view.safeAreaInsets
  send("insets", ["top": i.top, "right": i.right, "bottom": i.bottom, "left": i.left])
}
// viewSafeAreaInsetsDidChange() -> sendInsets();  sceneWillResignActive -> send("pause");  sceneDidBecomeActive -> send("resume")
```

`JSONSerialization` turns a Swift `nil` into JSON `null`, which is what the app expects for "nothing stored". Keep the web content served over https (or bundled and loaded with `loadFileURL(_:allowingReadAccessTo:)`); the service worker is not needed inside the app.

### Android WebView

```kotlin
webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true
webView.settings.mediaPlaybackRequiresUserGesture = false
webView.addJavascriptInterface(TallyBridge(), "TallyBridge")       // window.TallyBridge.postMessage(string)
activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
WindowCompat.setDecorFitsSystemWindows(window, false)             // then forward the cutout as insets

inner class TallyBridge {
  @JavascriptInterface fun postMessage(text: String) {            // runs on a background thread
    val msg = JSONObject(text); if (msg.optInt("tally") != 1) return
    when (msg.optString("type")) {
      "ready" -> runOnUiThread { sendInsets() }
      "settings:get" -> reply(msg.optInt("id"), prefs.getString("tallytwo.settings", null))
      "settings:set" -> { val json = msg.getJSONObject("payload").optString("json"); prefs.edit().putString("tallytwo.settings", json).apply(); reply(msg.optInt("id"), json) }
      "haptic" -> runOnUiThread { vibrate(msg.getJSONObject("payload").optString("kind")) }
    }
  }
}
fun send(type: String, payload: JSONObject = JSONObject()) = runOnUiThread {
  val s = JSONObject().put("tally", 1).put("type", type).put("payload", payload).toString()
  webView.evaluateJavascript("window.tallyReceive && window.tallyReceive(${JSONObject.quote(s)})", null)
}
fun reply(id: Int, json: String?) = send("settings", JSONObject().put("id", id).put("json", json ?: JSONObject.NULL))
// onPause -> send("pause"); onResume -> send("resume"); insets from ViewCompat.getRootWindowInsets(...).getInsets(displayCutout() or systemBars()) in px / density
```

### iframe

```html
<iframe id="tally" src="https://…/tallytwo/" allow="autoplay" style="border:0; width:852px; height:393px"></iframe>
<script>
  const frame = document.getElementById("tally").contentWindow;
  const send = (type, payload = {}) => frame.postMessage({ tally: 1, type, payload }, "*");
  window.addEventListener("message", (e) => {
    const m = e.data;
    if (e.source !== frame || !m || m.tally !== 1) return;
    if (m.type === "ready") send("insets", { top: 0, right: 0, bottom: 0, left: 0 });
    if (m.type === "settings:get") send("settings", { id: m.id, json: localStorage.getItem("tallytwo.settings") });
    if (m.type === "settings:set") { localStorage.setItem("tallytwo.settings", m.payload.json); send("settings", { id: m.id, json: m.payload.json }); }
    if (m.type === "haptic" && navigator.vibrate) navigator.vibrate(m.payload.kind === "win" ? [30, 40, 30] : 10);
  });
  document.addEventListener("visibilitychange", () => send(document.hidden ? "pause" : "resume"));
</script>
```

`allow="autoplay"` lets the audio context start from the tap inside the frame; without it the game is silent but otherwise fine. The frame itself never checks the parent's origin (the game holds nothing worth stealing), but it reads only messages whose `source` is its parent. A parent that does not implement the protocol costs the game one 1.5-s wait on load, after which it runs on its own localStorage.

## 7. Without a host

No host means no bridge: `bridge.host === null`, `bridge.send` does nothing, `bridge.request` rejects at once (and `App.tsx` never builds `bridgeStorage` in that case — settings go to localStorage as before), `useBridgePause()` is always false, no `--inset-*` properties are set so the CSS falls through to `env(safe-area-inset-*)`, and `window.tallyReceive` does not exist. The webview hygiene (`styles/shell.css`: `overscroll-behavior: none`, no touch callout; the viewport meta's `maximum-scale=1, user-scalable=no`) applies everywhere, host or not — a game page never wants rubber-banding, pull-to-refresh or pinch-zoom.

## 8. Testing it

`src/platform/bridgeProtocol.test.ts` pins the envelope and the validator; `bridge.test.ts` drives `createBridge()` over fake windows (detection order, the three delivery forms, request/reply by id, timeouts, the parent-only rule); `bridgeStorage.test.ts` runs the port against a fake bridge (reply wins, timeout falls back and stays fallen back, set writes through). All run under vitest's node environment. The end-to-end check (Playwright, an `about:blank` page that iframes the dev server and plays host) was run by hand on 2026-10-07 in Chromium and WebKit: `ready` once, `settings:get` answered and applied, `settings:set` written through with localStorage left empty, insets on `.game`, `pause` holding an AI lead for 4.5 s and `resume` releasing it, `haptic` deal and slap, no console errors.
