import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { yamux } from '@chainsafe/libp2p-yamux'
import { noise } from '@chainsafe/libp2p-noise'
import { bootstrap } from '@libp2p/bootstrap'
import { multiaddr } from '@multiformats/multiaddr'

async function createBootstrapNode() {
    const bootstrapMultiaddrStrings = [

    ];

    const node = await createLibp2p({
        transports: [tcp(), webSockets()],
        streamMuxers: [yamux()],
        connectionEncryption: [noise()],
        // peerDiscovery: [
        //     bootstrap({
        //         interval: 60e3,
        //         list: bootstrapMultiaddrStrings
        //     })
        // ],
        addresses: {
            listen: [
                '/ip4/0.0.0.0/tcp/4001',
                '/ip4/0.0.0.0/tcp/4002/ws'
            ]
        }
    })

    // Start the node
    await node.start();

    console.log('Bootstrap node started with id:', node.peerId.toString())
    console.log('Listening on:')
    node.getMultiaddrs().forEach(addr => {
        console.log(addr.toString() + '/p2p/' + node.peerId.toString())
    })

    // Keep running
    return node
}

createBootstrapNode().catch(console.error)