import fs from 'fs'
import { publishWeights, node } from './peer.js'
import {multiaddr} from '@multiformats/multiaddr'



const topic = '/fl/weights/1.0.0'
const raw = fs.readFileSync('data/weights.json')
const weights = JSON.parse(raw)

// Replace this with the actual multiaddr printed by the subscriber node
const subscriberMultiaddr = '/ip4/192.168.0.132/tcp/49959/p2p/12D3KooWRJCzhKtSmNxfmH4KtgSEHfXeZJdu72L2X7NY5uFbExEG'

async function waitForPeersToSubscribe(topic) {
  return new Promise((resolve) => {
    const check = () => {
      const peers = node.services.pubsub.getSubscribers(topic)
      if (peers.length > 0) {
        console.log(`[+] Found ${peers.length} peers subscribed to topic.`)
        resolve()
      } else {
        console.log(`[.] Waiting for peers to subscribe to topic...`)
        setTimeout(check, 1000)
      }
    }
    check()
  })
}

async function run() {
  console.log(`[+] Dialing subscriber at ${subscriberMultiaddr}...`)
  await node.dial(multiaddr(subscriberMultiaddr))
  console.log('[+] Dial successful, waiting for subscription...')

  await waitForPeersToSubscribe(topic)
  await publishWeights(weights)

  await node.stop()
  console.log('[+] Node stopped, exiting.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
