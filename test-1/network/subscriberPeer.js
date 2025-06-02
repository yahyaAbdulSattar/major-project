import { node } from './peer.js'

const topic = '/fl/weights/1.0.0'

// No need to call subscribe again here — already done in peer.js
// Just listen to pubsub messages via event listener set up in peer.js

console.log(`Subscriber node started with id ${node.peerId.toString()}`)
console.log('Listening on:')
node.getMultiaddrs().forEach(addr => {
  console.log(addr.toString() + '/p2p/' + node.peerId.toString())
})

// Keep process alive to listen for messages
process.stdin.resume()
