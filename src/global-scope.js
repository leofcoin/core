import { util as LFCTxUtil, LFCTx } from 'ipld-lfc-tx'
import {util, LFCNode} from 'ipld-lfc'
import Chain from './../node_modules/@leofcoin/lib/src/chain';
import { genesisCID, GENESISBLOCK, fixIndex } from './params'
import { log } from './utils';
// import SocketClient from 'socket-request-client';
import { debug } from './utils'
import { hour } from './ms'

const chain = new Chain()
import * as api from './api'

globalThis.leofcoin = globalThis.leofcoin || {}
leofcoin.api = leofcoin.api || {}

const sync = async () => {
  try {

    if (fixIndex) {
      await chainStore.put(0, genesisCID)
      await chainStore.put('localBlock', genesisCID)
      await chainStore.put('localIndex', 0)
      const node = await new LFCNode(GENESISBLOCK)
      await leofcoin.api.block.put(node)
      // await blockStore.put(genesisCID, node.serialize())
    }
    // console.log(await leofcoin.block.dag.get("zsNS6wZiHT3AuWEsd6sE6oPEcCnd2pWcNKPfNUofoEybxx57Y45N4xJKBAdZH1Uh8Wm3e1k2nNhhuSai9z3WAK6pHtpmjg"));
    const { localIndex, multihash } = await localBlock();
    // const localIndex = await chainStore.get('localIndex')
    // const c = await chainStore.get('localBlock')
    // globalThis.ipfs.name.publish(multihash)
    const { hash, index } = await chain.longestChain();
    if (index > Number(localIndex)) {
      // const job = () => new Promise(async (resolve, reject) => {
      //   setTimeout(async () => {
      //     reject()
      //   }, 5000);
        leofcoin.currentBlockHash = hash;
        leofcoin.currentBlockNode = await leofcoin.api.block.get(leofcoin.curentBlockHash)
      //   resolve()
      // })

      // try {
      //   await job()
      // } catch (e) {
      //   try {
      //     await job()
      //   } catch (e) {
      //     console.warn("couldn't sync chain");
      //   }
      // }
    } else {
      if (index === 0) leofcoin.currentBlockHash = genesisCID
      else leofcoin.currentBlockHash = multihash || await localDAGMultiaddress();

      leofcoin.currentBlockNode = await leofcoin.api.block.get(leofcoin.currentBlockHash)
    }
    log(`current block index : ${localIndex}`);
    log(`current block hash : ${leofcoin.currentBlockHash}`);
    log(`current block size: ${Math.round(Number(leofcoin.currentBlockNode.size) * 1e-6 * 100) / 100} Mb (${leofcoin.currentBlockNode.size} bytes)`);
    return leofcoin.currentBlockHash
  } catch (e) {
    throw e
  }
}

const localBlock = async () => {
  try {
    let multihash = await chainStore.get('localBlock')
    multihash = multihash.toString()
    const index = await chainStore.get('localIndex')
    // probably recovering local chain
    if (index === undefined) {
      debug(`invalid block detected, recovering local chain`);
      await chainStore.put('localBlock', genesisCID)
      await chainStore.put('localIndex', 0)
      return localBlock();
    } else {
      debug(`current local block: ${index} - ${multihash}`);
    }
    return {
      localIndex: index,
      index,
      multihash
    }
  } catch (e) {
    console.log(e);
    await chainStore.put('localBlock', genesisCID)
    await chainStore.put('localIndex', 0)
    return await localBlock();
  }
}

const resolveBlocks = async (node, index) => {
  const cid = await util.cid(await node.serialize())
  globalThis.chain[node.index] = node.toJSON();
  globalThis.chain[node.index].hash = cid.toBaseEncodedString()
  const _tx = [];
  debug(`loading transactions`)
  for (let tx of globalThis.chain[node.index].transactions) {
    const hash = tx.multihash
    if (hash) {
      tx = await leofcoin.api.transaction.get(hash)
      tx = tx.toJSON()
    }
    _tx.push(tx)
    debug(`loaded tx: ${hash}`)
  }
  globalThis.chain[node.index].transactions = _tx
  leofcoin.hashMap.set(node.index, cid.toBaseEncodedString())
  debug(`loaded block: ${node.index} - ${globalThis.chain[node.index].hash}`);
  if (node.index - 1 !== -1) {
      const hash = node.prevHash
      node = await leofcoin.api.block.get(node.prevHash)
      const has = await leofcoin.api.block.has(hash)
      if (!has) {
        await leofcoin.api.block.put(node)
        await chainStore.put(node.index, hash)
        debug(`added block: ${node.index} ${hash}`);
      }
    // }
    try {
      // store them in memory
      // global.blockHashSet[hash] = block.index;
      if (node.prevHash && node.prevHash !== Buffer.alloc(47).toString('hex')) {

        return resolveBlocks(node, index);
      }
      return;
    } catch (e) {
      console.error(e);
    }
  }
  return
}
/**
 * last resolved, mined or minted block
 *
 * @param {object} cid - cid instance or baseEncodedString
 */
const updateLocals = async (cid, index) => {
  if (cid.isCid && cid.isCid()) cid = cid.toBaseEncodedString();


  try {
    debug(`updating chainStore to ${index}`);
    await chainStore.put(index, cid)
    debug(`writing cid ${cid} to chainStore`);
    await chainStore.put('localBlock', cid)
    debug(`writing index ${index} to chainStore`);
    await chainStore.put('localIndex', index)
  } catch (error) {
    throw error
  }

}

const resync = async (block) => {
  try {
    // global.states.syncing = true;
    // bus.emit('syncing', true);
    if (!block) {
      await leofcoin.api.chain.sync();
    } else {
      leofcoin.currentBlockNode = await new LFCNode(block)
      leofcoin.currentBlockHash = leofcoin.currentBlockNode.hash
    }
    debug(leofcoin.currentBlockNode.toString())
    if (leofcoin.currentBlockNode) {
      const { index, multihash } = await localBlock();
      debug(`local block index: ${index}`)
      const height = leofcoin.currentBlockNode.index
      let syncCount = height - index;
      debug(`local chain height: ${index}`);
      debug(`network chain height: ${height}`);
      debug(`syncing ${syncCount > 0 ? syncCount : 0} block(s)`)
      // whenever prevHash is undefined & syncCount is zero or lower
      // write latest network chain to locals
      const start = Date.now();
      if (index > height) {
        const value = await leofcoin.api.block.get(multihash)
        await resolveBlocks(value, index);
      }
      else await resolveBlocks(leofcoin.currentBlockNode, height);
      const end = Date.now();
      const time = end - start;
      debug(time / 1000);
      if (syncCount > 0) {
        await updateLocals(globalThis.chain[leofcoin.currentBlockNode.index].hash, height);
      }
    } else {
      globalThis.chain[0] = GENESISBLOCK
      globalThis.chain[0].index = 0;
      globalThis.chain[0].hash = genesisCID;
    }
  } catch (e) {
    globalThis.chain[0] = GENESISBLOCK
    globalThis.chain[0].index = 0;
    globalThis.chain[0].hash = genesisCID;
    await updateLocals(genesisCID, 0)
    console.error('syncChain', e);
  }
  return;
}

const timedRequest = (fn, params) => new Promise(async (resolve, reject) => {
  setTimeout(() => {
    reject('request timeout')
  }, 10000);
  const requested = await fn(params)
  resolve(requested)
});

export default class GlobalScope {
  constructor(api) {
    return this._init()
  }

  async _init() {
    // this.discoServer = discoServer
    // globalThis.pubsubRequest = await new PubsubRequest({ipfs, peerId}, this.api)
    leofcoin.sync = sync
    // leofcoin.peers = this.discoServer.connections
    // leofcoin.peerMap = this.discoServer.peerMap
    // leofcoin.discoClientMap = discoClientMap
    leofcoin.utils = {
      hashFromMultihash: chain.hashFromMultihash
    }
    leofcoin.api = leofcoin.api ? {...leofcoin.api, ...api} : {...api}
    leofcoin.api.transaction = {
      get: async multihash => {
        const node = await peernet.transaction.get(multihash)
        return await new LFCTx(node)
      },
      put: async node => {
        if (!node.isLFCTx) {
          node = await new LFCTx(node)
        }
        const data = await node.serialize()
        const cid = await LFCTxUtil.cid(data)
        await peernet.transaction.put(cid.toString('base58btc'), data)
        // return globalThis.ipfs.dag.put(node, { format: LFCTxUtil.codec, hashAlg: LFCTxUtil.defaultHashAlg, version: 1, baseFormat: 'base58btc' })

      }
    }
    leofcoin.api.block = {
      put: async (node) => {
        if (!node.isLFCNode) {
          node = await new LFCNode(node)
        }
        const data = await node.serialize()
        const cid = await util.cid(data)
        await peernet.block.put(cid.toString('base58btc'), data)
      },
      get: async multihash => {
        // Promise.race(promises)
        const node = await peernet.block.get(multihash)
        return await new LFCNode(Buffer.from(node))
      },
      has: multihash => peernet.block.has(multihash)
      // dag: {
      //   get: async multihash => {
      //     try {
      //       const { value } = await globalThis.ipfs.dag.get(multihash)
      //       value.transactions = [...value.transactions]
      //       return await new LFCNode({...value})
      //     } catch (e) {
      //       throw e
      //     }
      //   },
      //   put: async node => {
      //     try {
      //       console.log(node.toJSON());
      //       globalThis.ipfs.dag.put(node, { format: util.codec, hashAlg: util.defaultHashAlg, vesion: 1, baseFormat: 'base58btc'})
      //     } catch (e) {
      //       throw e
      //     }
      //   }
      // }
    }
    leofcoin.api.name = {
      /**
       * @params {string} hash - hash to publish
       * @params {string} key - name of the key to use
       */
      publish: async (name, key) => {
        try {
          // const value = await globalThis.ipfs.name.publish(name, {key})
          // return value
        } catch (e) {
          console.warn(e)
          return false
        }
      }
    }
    // TODO: pinning means from now storing(and pinning) on IPFS
    leofcoin.api.pin = {
      add: async hash => {
// await globalThis.ipfs.pin.add(hash),
},
      rm: async hash => {
// await globalThis.ipfs.pin.rm(hash)
      }
    }
    leofcoin.hashMap = new Map()
    leofcoin.api.chain = {
      sync: sync,
      resync: resync,
      updateLocals:  updateLocals,
      get: async hash => {
        if (!hash) {
          const blocks = []
          for (const [index, multihash] of leofcoin.hashMap.entries()) {
            const block = await leofcoin.api.block.get(multihash)
            const _transactions = []
            for (const {multihash} of block.transactions) {
              const transaction = await leofcoin.api.transaction.get(multihash)
              _transactions.push(transaction.toJSON())
            }
            block.transactions = _transactions
            blocks[index] = block
          }
          return blocks
        }
        if (!isNaN(hash)) hash = await leofcoin.hashMap.get(hash)
        return leofcoin.api.block.get(hash)
      },
      dag: {
        get: async hash => {
          if (!hash) {
            const blocks = []
            for (const [index, multihash] of leofcoin.hashMap.entries()) {
              const block = await leofcoin.api.block.get(multihash)
              blocks[index] = block
            }
            return blocks
          }
          if (!isNaN(hash)) hash = await leofcoin.hashMap.get(hash)

          return leofcoin.api.block.get(hash)
        }
      }
    }
    /**
     *
     * @param {string|number} height hash or height
     */
    leofcoin.api.lastBlock = async (height) => {
      if (!height) return globalThis.chain[globalThis.chain.length - 1];
      if (typeof height !== 'string') return globalThis.chain[height]
      return globalThis.chain[blockHashSet[height]];
    }

    leofcoin.publisher = {
      start: () => {
        const publish = async () => {
          /**
           * [hash, key]
           */
          const publishments = [{ hash: leofcoin.currentBlockHash }]
          let promises = []

          for (const { hash, key } of publishments) {
            promises.push(leofcoin.api.name.publish(hash))
          }

          promises = await Promise.all(promises)
        }
        publish()
        setInterval(() => {
          publish()
        }, hour(23))
      }
    }

    leofcoin.resetToLocalIndex = async () => {
      const store = await chainStore.get()
      const keys = Object.keys(store)
      const value = {index: 0}
      console.log(keys.length);
      if (keys.length > 3) {
        for (const key of keys) {
          if (Number(key) && Number(key) > Number(value.index)) {
            value.index = key
            value.hash  = store[key]
          }
        }

      }
      chainStore.put('localBlock', value.hash)
      chainStore.put('localIndex', Number(value.index))
    }

    let ready = false

    pubsub.subscribe('peer:connected', async peer => {
      if (!ready) {
        ready = true
        pubsub.publish('peernet:ready', ready)
      }
      const request = new globalThis.peernet.protos['peernet-request']({request: 'lastBlock'})
      const to = peernet._getPeerId(peer.id)

      if (to) {
        const node = await peernet.prepareMessage(to, request.encoded)
        let response = await peer.request(node.encoded)
        const proto = new globalThis.peernet.protos['peernet-message'](Buffer.from(response.data))
        response = new globalThis.peernet.protos['peernet-response'](Buffer.from(proto.decoded.data))
        let block = JSON.parse(response.decoded.response)
        const { localIndex } = await localBlock();
        if (Number(block.height) > Number(localIndex)) {
          block = await leofcoin.api.block.get(block.hash)
          resync(block.toJSON())
        }
      }
    })
  }

  get api() {
    return {
      chainHeight: () => (leofcoin.chain.length - 1),
      blockHash: ({value}) => {
        return globalThis.chain[value].hash
      },
      lastBlock: () => {
        const index = (globalThis.chain.length - 1)
        return globalThis.chain[index]
      }
    }
  }
}
