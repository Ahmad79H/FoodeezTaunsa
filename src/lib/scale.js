/**
 * Fluid page scale.
 *
 * The layout is tuned for roughly 1400px of width. Below that a browser window
 * gives the page proportionally less room, and reflowing every section into a
 * cramped stack makes the site feel oversized — you end up zooming the browser
 * out to read it as one design.
 *
 * Instead, the whole page is scaled down to match the window. One number, no
 * per-breakpoint surprises, and images, spacing and type all stay in the same
 * proportion they were drawn in.
 *
 * Above the design width the scale stays at 1: there is no reason to blow the
 * layout up on a large monitor, the container simply grows.
 *
 * Chromium, Safari and Firefox 126+ all implement `zoom` as a real layout
 * scale, so text stays crisp (unlike transform: scale) and position:fixed keeps
 * working against the viewport.
 */

const DESIGN_WIDTH = 1400
const MIN = 0.84
const MAX = 1

/** The scale that would be used for a given viewport width. Exported for tests. */
export function scaleFor(width) {
  if (!Number.isFinite(width) || width <= 0) return MAX
  return Math.min(MAX, Math.max(MIN, width / DESIGN_WIDTH))
}

export function installAutoScale() {
  let frame = 0

  const apply = () => {
    frame = 0
    const scale = scaleFor(window.innerWidth)
    document.documentElement.style.setProperty('--ui-scale', scale.toFixed(3))
    // Handy in devtools and for the print stylesheet.
    document.documentElement.dataset.scale = String(Math.round(scale * 100))
  }

  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(apply)
  }

  apply()
  window.addEventListener('resize', schedule, { passive: true })
  window.addEventListener('orientationchange', schedule, { passive: true })
}
