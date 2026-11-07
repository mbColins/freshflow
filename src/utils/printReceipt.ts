// Prints just the receipt. The page behind the dialog is not involved: the
// receipt's markup and the app's styles are copied into a hidden frame, which
// is what the browser prints, on a sheet of its own.

// 80 mm wide, the width of a receipt printer's roll; on an A4 or Letter sheet
// it is centred at the top
const PRINT_CSS = `
@page { size: auto; margin: 8mm; }
html, body { margin: 0; padding: 0; background: #fff; }
body { color: #0f172a; font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.receipt-sheet { width: 80mm; max-width: 100%; margin: 0 auto; font-size: 12px; line-height: 1.4; }
.receipt-sheet .print-area { padding: 0 !important; }
.receipt-sheet table { width: 100%; border-collapse: collapse; }
.receipt-sheet tr, .receipt-sheet dl > div { break-inside: avoid; page-break-inside: avoid; }
`

const STYLES_WAIT_MS = 5_000
// Last resort for removing the frame; afterprint normally does it, and clears this
const CLEANUP_MS = 10 * 60_000

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)

// The page the frame prints: the app's styles plus the receipt on its own
export function receiptHtml(source: Element, title: string) {
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((node) => node.outerHTML).join('')
  return (
    `<!doctype html><html lang="${document.documentElement.lang || 'en'}"><head><meta charset="utf-8">` +
    `<base href="${escapeHtml(document.baseURI)}"><title>${escapeHtml(title)}</title>${styles}` +
    `<style>${PRINT_CSS}</style></head><body><main class="receipt-sheet">${source.outerHTML}</main></body></html>`
  )
}

export async function printReceipt(selector = '.print-area', title = 'Receipt') {
  const source = document.querySelector(selector)
  if (!source) return

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const win = frame.contentWindow
  const doc = frame.contentDocument
  if (!win || !doc) {
    frame.remove()
    return
  }

  doc.open()
  doc.write(receiptHtml(source, title))
  doc.close()

  // Print once the styles and fonts are in, so the sheet isn't unstyled
  const sheets = [...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
  // A sheet that never reports load or error must not leave the button dead: after
  // STYLES_WAIT_MS the receipt prints with whatever has arrived
  const stylesLoaded = Promise.all(
    sheets.map(
      (link) =>
        new Promise<void>((resolve) => {
          if (link.sheet) resolve()
          else {
            link.onload = () => resolve()
            link.onerror = () => resolve()
          }
        }),
    ),
  ).then(() => doc.fonts?.ready)
  await Promise.race([stylesLoaded, new Promise((resolve) => window.setTimeout(resolve, STYLES_WAIT_MS))])

  let fallback = 0
  const cleanup = () => {
    window.clearTimeout(fallback)
    frame.remove()
  }
  win.addEventListener('afterprint', cleanup, { once: true })
  // Some browsers never report afterprint for a frame
  fallback = window.setTimeout(cleanup, CLEANUP_MS)
  win.focus()
  win.print()
}
