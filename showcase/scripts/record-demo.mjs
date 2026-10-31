// Records the README walkthrough from the real demo: a production build served locally, driven by
// Playwright, captured frame by frame with the Chrome DevTools screencast and encoded with FFmpeg.
//
//   npm run build && npx vite preview --port 4180 &
//   node scripts/record-demo.mjs --base http://localhost:4180 --site reklamaton-demo.vercel.app --out scripts/out
//
// Three things are drawn on top of the page for the video: the pointer, a short chapter caption,
// and the closing card. Everything else is the app as a visitor sees it, at its own pace. Nothing
// here generates text: the chat is the demo's scripted one and the drafts come from its composer.

import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { chromium } from "playwright"

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
)
const BASE = args.base ?? "http://localhost:4180"
const SITE = args.site ?? "reklamaton-demo.vercel.app"
const OUT = path.resolve(args.out ?? "scripts/out")
const FRAMES = path.join(OUT, "frames")
const FPS = 30
// 1536×864 CSS pixels at 1.25× gives 1920×1080 frames with UI text large enough to read in a video.
const VIEWPORT = { width: 1536, height: 864 }
const SCALE = 1.25

rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => m.type() === "error" && errors.push(m.text()))

// A visible pointer with a click ring (headless screenshots have no cursor) and a caption pill.
await context.addInitScript(() => {
  window.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style")
    style.textContent = `
      #rec-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
        background:rgba(31,28,23,.82);border:2.5px solid #fff;box-shadow:0 4px 14px rgba(31,28,23,.35);
        z-index:2147483647;pointer-events:none;transition:transform 650ms cubic-bezier(.22,1,.36,1)}
      .rec-ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #c4502e;
        z-index:2147483646;pointer-events:none;animation:rec-ring 600ms ease-out forwards}
      @keyframes rec-ring{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}
      #rec-caption{position:fixed;left:50%;top:74px;transform:translate(-50%,-10px);z-index:2147483645;pointer-events:none;
        padding:11px 20px;border-radius:999px;background:rgba(31,28,23,.9);color:#f6f2ea;font:600 19px/1.2 'Inter Variable',sans-serif;
        letter-spacing:-.005em;box-shadow:0 12px 30px -12px rgba(31,28,23,.6);opacity:0;transition:opacity 380ms ease,transform 380ms cubic-bezier(.22,1,.36,1);white-space:nowrap}
      #rec-caption.on{opacity:1;transform:translate(-50%,0)}`
    document.head.appendChild(style)
    const c = document.createElement("div")
    c.id = "rec-cursor"
    c.style.transform = "translate(330px, 700px)"
    document.body.appendChild(c)
    const cap = document.createElement("div")
    cap.id = "rec-caption"
    document.body.appendChild(cap)
    window.__rec = {
      move(x, y) {
        c.style.transform = `translate(${x}px, ${y}px)`
      },
      ring(x, y) {
        const r = document.createElement("div")
        r.className = "rec-ring"
        r.style.left = `${x}px`
        r.style.top = `${y}px`
        document.body.appendChild(r)
        setTimeout(() => r.remove(), 700)
      },
      caption(text, top) {
        if (!text) return cap.classList.remove("on")
        cap.textContent = text
        cap.style.top = `${top}px`
        cap.classList.add("on")
      },
    }
  })
})

const wait = (ms) => page.waitForTimeout(ms)
// Captions sit below the landing page's header, and in the empty centre of the app's title row.
const caption = (text, top = 16) => page.evaluate(([t, y]) => window.__rec?.caption(t, y), [text, top])
async function pointAt(locator, settle = 600) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.evaluate(([x, y]) => window.__rec.move(x, y), [x, y])
  await wait(settle)
  return { x, y }
}
async function click(locator, after = 500) {
  const { x, y } = await pointAt(locator)
  await page.evaluate(([x, y]) => window.__rec.ring(x, y), [x, y])
  await wait(110)
  await locator.click()
  await wait(after)
}
async function hover(locator, after = 900) {
  await pointAt(locator, 650)
  await locator.hover()
  await wait(after)
}

// Fresh workspace.
await page.goto(`${BASE}/app/overview`)
await page.evaluate(() => localStorage.clear())

// Screencast: every composited frame, with its timestamp.
const cdp = await context.newCDPSession(page)
const frames = []
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = path.join(FRAMES, `${String(frames.length).padStart(5, "0")}.jpg`)
  writeFileSync(file, Buffer.from(data, "base64"))
  frames.push({ file, t: metadata.timestamp })
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
})

await page.goto(`${BASE}/`)
await page.waitForLoadState("networkidle")
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 })
const t0 = Date.now()
const mark = (label) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s  ${label}`)

// 1. The landing page: the product replaying a conversation.
mark("hero")
await wait(600)
await caption("Customer chat in. Structured memory out.", 76)
await wait(4600)
await caption("")
await click(page.getByTestId("hero-explore"), 1000)

// 2. What needs attention → Ines's conversation.
mark("overview")
await click(page.getByTestId("attention-action"), 500)

// 3. Each message updates her profile.
mark("conversation")
await caption("Each message updates her profile")
await click(page.getByTestId("play-turn"), 0)
await page.getByTestId("profile-updated").waitFor()
await wait(1400)
await click(page.getByTestId("play-turn"), 0)
await page.waitForFunction(() => document.querySelector("[data-testid=profile-updated]")?.textContent?.includes("msg 2"))
await wait(1200)
// Every field traces back to the words it came from.
await click(page.getByTestId("profile-panel").getByRole("button", { name: /around €4,000 all in/ }), 1300)
await click(page.getByTestId("play-all"), 0)
await page.getByText("Conversation complete.").waitFor({ timeout: 30_000 })
await wait(900)
await caption("")

// 4. The resulting customer record.
mark("customer")
await click(page.getByRole("button", { name: /CRM/ }), 400)
await caption("Everything she said, remembered")
await wait(2300)
await caption("")
await page.keyboard.press("Escape")
await wait(450)

// 5. A campaign written from it.
mark("campaign")
await click(page.getByRole("link", { name: /^Campaigns/ }).first(), 700)
await caption("She joins the audience")
await pointAt(page.getByTestId("recipients").getByText("Ines Calder"), 800)
await click(page.getByTestId("seg-stage-qualified"), 1000)
await click(page.getByTestId("seg-stage-qualified"), 700)
await caption("One personal draft per customer")
await click(page.getByTestId("generate-drafts"), 900)
await hover(page.getByTestId("draft-1").getByTestId("draft-factors").getByRole("button", { name: /Budget/ }), 1300)
await hover(page.getByTestId("draft-1").getByTestId("draft-factors").getByRole("button", { name: /Objection/ }), 900)
await caption("")

// 6. A person approves; the backend's rules still apply.
mark("approve")
await caption("A person approves. Nothing is sent.")
await click(page.getByTestId("approve-1"), 1400)
await click(page.getByTestId("queue-2"), 400)
await click(page.getByTestId("approve-2"), 1600)
await caption("")

// 7. Export: preview the CSV, then download it.
mark("export")
await click(page.getByTestId("preview-csv"), 1800)
const download = page.waitForEvent("download")
await click(page.getByTestId("csv-preview").getByRole("button", { name: "Download CSV" }), 600)
await (await download).saveAs(path.join(OUT, "walkthrough-export.csv"))
await page.keyboard.press("Escape")
await wait(700)

// 8. Closing card.
mark("end card")
await page.evaluate((site) => {
  const card = document.createElement("div")
  card.style.cssText =
    "position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:#f6f2ea;opacity:0;transition:opacity 500ms ease"
  card.innerHTML = `<div style="text-align:center;font-family:'Inter Variable',sans-serif;color:#1f1c17">
      <div style="display:flex;align-items:center;justify-content:center;gap:16px">
        <svg width="56" height="56" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#1f1c17"/><rect x="8" y="9" width="16" height="2.6" rx="1.3" fill="#f6f2ea"/><rect x="8" y="14.7" width="11" height="2.6" rx="1.3" fill="#f6f2ea" opacity=".72"/><rect x="8" y="20.4" width="7" height="2.6" rx="1.3" fill="#e0734f"/><circle cx="20.6" cy="21.7" r="1.9" fill="#e0734f"/></svg>
        <span style="font-family:'Fraunces Variable',serif;font-weight:600;font-size:58px;letter-spacing:-0.03em">reklamaton</span>
      </div>
      <p style="margin-top:20px;font-family:'Fraunces Variable',serif;font-size:30px;letter-spacing:-0.02em;color:#48433b">Every conversation <span style="color:#c4502e;font-style:italic">becomes an opportunity.</span></p>
      <p style="margin-top:36px;font-size:24px;font-weight:600">${site}</p>
      <p style="margin-top:10px;font-size:16px;color:#686157">github.com/tolyaho/reklamaton · interactive demo · synthetic data · no live AI calls</p>
    </div>`
  document.body.appendChild(card)
  document.getElementById("rec-cursor")?.remove()
  requestAnimationFrame(() => (card.style.opacity = "1"))
}, SITE)
await wait(3300)
mark("done")

await cdp.send("Page.stopScreencast")
await browser.close()

// Encode: each frame is held until the next one arrived, resampled to a constant 30 fps.
const list = frames
  .map((f, i) => {
    const next = frames[i + 1]?.t ?? f.t + 1 / FPS
    return `file '${f.file}'\nduration ${Math.max(next - f.t, 0.001).toFixed(4)}`
  })
  .join("\n")
writeFileSync(path.join(OUT, "frames.txt"), `${list}\nfile '${frames.at(-1).file}'\n`)
const mp4 = path.join(OUT, "reklamaton-walkthrough.mp4")
execFileSync("ffmpeg", [
  "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(OUT, "frames.txt"),
  "-vf", `scale=1920:1080:flags=lanczos:in_range=full:out_range=tv,format=yuv420p,fps=${FPS}`,
  "-c:v", "libx264", "-preset", "slow", "-crf", args.crf ?? "20", "-color_range", "tv",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(FPS), mp4,
])
console.log(`frames: ${frames.length}, page errors: ${errors.length ? errors.join(" | ") : "none"}`)
console.log(`wrote ${mp4}`)
