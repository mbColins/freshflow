export type StreamEvent = { event: string; data: string }

// Reads a text/event-stream body and calls onEvent for each complete event.
// Comments (": ping") are skipped
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: StreamEvent) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    // `stream: true` keeps a character split across chunks intact
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n')
    let end = buffer.indexOf('\n\n')
    while (end !== -1) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      let event = 'message'
      const data: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) continue
        const colon = line.indexOf(':')
        const field = colon === -1 ? line : line.slice(0, colon)
        const text = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
        if (field === 'event') event = text
        else if (field === 'data') data.push(text)
      }
      if (data.length) onEvent({ event, data: data.join('\n') })
      end = buffer.indexOf('\n\n')
    }
  }
}
