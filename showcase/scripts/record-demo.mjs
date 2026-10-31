// Records the README walkthrough from the real demo: a production build served locally, driven by
// Playwright, captured frame by frame with the Chrome DevTools screencast and encoded with FFmpeg.
//
//   npm run build && npx vite preview --port 4180 &
//   node scripts/record-demo.mjs --base http://localhost:4180 --site reklamaton-demo.vercel.app --out scripts/out
//
// The pointer and the closing card are drawn on top of the page for the video; everything else is
// the app as a visitor sees it. Nothing here generates text: the chat is the demo's scripted one.

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

// A visible pointer with a click ring; headless screenshots have no cursor of their own.
await context.addInitScript(() => {
  window.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style")
    style.textContent = `
      #rec-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
        background:rgba(31,28,23,.82);border:2.5px solid #fff;box-shadow:0 4px 14px rgba(31,28,23,.35);
        z-index:2147483647;pointer-events:none;transition:transform 700ms cubic-bezier(.22,1,.36,1)}
      .rec-ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #c4502e;
        z-index:2147483646;pointer-events:none;animation:rec-ring 600ms ease-out forwards}
      @keyframes rec-ring{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}`
    document.head.appendChild(style)
    const c = document.createElement("div")
    c.id = "rec-cursor"
    c.style.transform = "translate(1100px, 600px)"
    document.body.appendChild(c)
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
    }
  })
})

const wait = (ms) => page.waitForTimeout(ms)
async function pointAt(locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.evaluate(([x, y]) => window.__rec.move(x, y), [x, y])
  await wait(750)
  return { x, y }
}
async function click(locator, after = 500) {
  const { x, y } = await pointAt(locator)
  await page.evaluate(([x, y]) => window.__rec.ring(x, y), [x, y])
  await wait(120)
  await locator.click()
  await wait(after)
}
async function smoothScrollTo(locator, offset = 140) {
  await page.evaluate(
    ([sel, offset]) => {
      const el = document.querySelector(sel)
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: "smooth" })
    },
    [locator, offset],
  )
  await wait(1100)
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

// 1. Landing: the idea.
mark("landing")
await wait(3400)
await click(page.getByTestId("hero-explore"), 1400)

// 2. Overview → Ines's conversation.
mark("overview")
await click(page.getByRole("link", { name: /Open conversation/ }), 900)

// 3. Play the conversation; the profile fills in.
mark("conversation")
await click(page.getByTestId("play-turn"), 0)
await page.getByTestId("profile-updated").waitFor()
await wait(1400)
await pointAt(page.getByTestId("profile-panel").getByText("Qualified").first())
await wait(900)
await click(page.getByTestId("play-all"), 0)
await page.getByText("Conversation complete.").waitFor({ timeout: 40_000 })
await wait(1600)

// 4. The campaign: Ines is now in the segment.
mark("campaign")
await click(page.getByRole("link", { name: "Open campaign" }), 1300)
await pointAt(page.getByTestId("recipients").getByText("Ines Calder"))
await wait(1000)

// 5. Drafts personalized from each profile.
mark("drafts")
await click(page.getByTestId("generate-drafts"), 1600)
await smoothScrollTo('[data-testid="draft-1"]', 120)
await pointAt(page.getByTestId("draft-1").getByTestId("draft-factors"))
await wait(2200)

// 6. Approve; the 24-hour rule refuses Theo.
mark("approve")
await click(page.getByTestId("approve-1"), 1300)
await smoothScrollTo('[data-testid="draft-2"]', 260)
await click(page.getByTestId("approve-2"), 1700)

// 7. Export: preview the CSV, then download it.
mark("export")
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }))
await wait(1000)
await click(page.getByTestId("preview-csv"), 2400)
const download = page.waitForEvent("download")
await click(page.getByTestId("csv-preview").getByRole("button", { name: "Download CSV" }), 600)
await (await download).saveAs(path.join(OUT, "walkthrough-export.csv"))
await page.keyboard.press("Escape")
await wait(1600)

// 8. Closing card.
mark("end card")
await page.evaluate((site) => {
  const card = document.createElement("div")
  card.style.cssText =
    "position:fixed;inset:0;z-index:2147483645;display:grid;place-items:center;background:#f6f2ea;opacity:0;transition:opacity 500ms ease"
  card.innerHTML = `<div style="text-align:center;font-family:'Inter Variable',sans-serif;color:#1f1c17">
      <div style="display:flex;align-items:center;justify-content:center;gap:16px">
        <svg width="56" height="56" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#1f1c17"/><rect x="8" y="9" width="16" height="2.6" rx="1.3" fill="#f6f2ea"/><rect x="8" y="14.7" width="11" height="2.6" rx="1.3" fill="#f6f2ea" opacity=".72"/><rect x="8" y="20.4" width="7" height="2.6" rx="1.3" fill="#e0734f"/><circle cx="20.6" cy="21.7" r="1.9" fill="#e0734f"/></svg>
        <span style="font-family:'Fraunces Variable',serif;font-weight:600;font-size:56px;letter-spacing:-0.02em">reklamaton</span>
      </div>
      <p style="margin-top:22px;font-size:22px;color:#48433b">Conversation → profile → segment → draft → approval → export</p>
      <p style="margin-top:34px;font-size:24px;font-weight:600">${site}</p>
      <p style="margin-top:10px;font-size:16px;color:#686157">github.com/tolyaho/reklamaton · synthetic demo data</p>
    </div>`
  document.body.appendChild(card)
  document.getElementById("rec-cursor")?.remove()
  requestAnimationFrame(() => (card.style.opacity = "1"))
}, SITE)
await wait(3200)
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
