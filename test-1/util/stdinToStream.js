import { pipe } from 'it-pipe'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'

// Read from stdin and send to stream
export async function stdinToStream(data, stream) {
  await pipe(
    [uint8ArrayFromString(JSON.stringify(data))],
    stream.sink
  )
}