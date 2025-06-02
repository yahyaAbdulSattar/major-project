import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { kadDHT } from '@libp2p/kad-dht'
import { identify } from '@libp2p/identify'
import { createFromJSON } from '@libp2p/peer-id-factory'
import { streamToConsole } from '../util/streamtoConsole.js'
import { stdinToStream } from '../util/stdinToStream.js'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { bootstrap } from '@libp2p/bootstrap'
import { setInterval } from 'timers/promises';


// Protocols
const protocol = '/fl/weights-exchange/1.0.0';

const BOOTSTRAP_MULTIADDRS = [
  '/ip4/192.168.0.132/tcp/4001/p2p/12D3KooWBxND8tdWD1YmWKmc91Q4fsfuSxqiw8HjoxjiUwRZRfpi'
]

// Start a libp2p node
const node = await createLibp2p({
    //  addresses: {
    //   listen: [
    //     '/ip4/0.0.0.0/tcp/0',           // Listen on any IPv4 interface, random TCP port
    //     '/ip4/127.0.0.1/tcp/0/ws'       // Listen on localhost with WebSockets on random port
    //   ]
    // },
    transports: [tcp(), webSockets()],
    connectionEncrypters: [noise()],
    dht: kadDHT(),
    services: {
        identify: identify(),
        pubsub: gossipsub()
    },
    streamMuxers: [yamux()],
    peerDiscovery: [
      bootstrap({
        interval: 60e3, // poll for new peers every 60 seconds
        list: []
      })
    ]
});

await node.start();

const topic = '/fl/weights/1.0.0';

await node.services.pubsub.subscribe(topic);
console.log(`[PubSub] Subscribed to topic: ${topic}`);

node.services.pubsub.addEventListener('message', (evt) => {
    const msg = new TextDecoder().decode(evt.detail.data);
    console.log(`[PubSub] Received weights from ${evt.detail.from}:`, msg);
});

console.log(`Libp2p node started with id ${node.peerId.toString()}`)
console.log('Listening on:')
node.getMultiaddrs().forEach(addr => {
  console.log(addr.toString() + '/p2p/' + node.peerId.toString())
})


// Handle incoming weight data
node.handle(protocol, async ({ stream }) => {
    console.log('[+] Incoming weights received:')
    await streamToConsole(stream);
});

// send weights to another peer
const sendWeights = async (multiaddr, weightData) => {
    const { stream } = await node.dialProtocol(multiaddr, protocol)
    await stdinToStream(weightData, stream)
}

const publishWeights = async (weights) => {
    const msg = JSON.stringify(weights);
    await node.services.pubsub.publish(topic, new TextEncoder().encode(msg));
    console.log(`[PubSub] Published weights to topic ${topic}`);
};

setInterval(10000, async () => {
  const peers = node.getPeers();
  console.log(`[DISCOVERY] Connected peers: ${peers.map(p => p.toString()).join(', ')}`);
});

// Export for external use
export { node, sendWeights, publishWeights }

