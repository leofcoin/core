import { util as LFCTxUtil, LFCTx } from 'ipld-lfc-tx'
import {util, LFCNode} from 'ipld-lfc'
import Chain from './../node_modules/@leofcoin/lib/src/chain';
import { genesisCID, GENESISBLOCK, fixIndex } from './params'
import { log } from './utils';
// import SocketClient from 'socket-request-client';
import { debug } from './utils'
import { hour } from './ms'
import db from 'level-mem'
const chain = new Chain()
import * as api from './api'

globalThis.leofcoin = globalThis.leofcoin || {}
leofcoin.api = leofcoin.api || {}
const Level = require('datastore-level')
globalThis.memStore = new Level('/leofcoin/mem/', {db})
const sync = async () => {
  try {

    if (fixIndex) {
      await chainStore.put(0, genesisCID)
      await chainStore.put('localBlock', genesisCID)
      await chainStore.put('localIndex', 0)
      const node = await new LFCNode(GENESISBLOCK)
      await leofcoin.api.block.put(node)
    }
    const { localIndex, multihash } = await localBlock();
    const { hash, index } = await chain.longestChain();
    if (index > Number(localIndex)) {
      leofcoin.currentBlockHash = hash;
      leofcoin.currentBlockNode = await leofcoin.api.block.get(leofcoin.curentBlockHash)
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
    await chainStore.put('localBlock', genesisCID)
    await chainStore.put('localIndex', 0)
    return await localBlock();
  }
}

const resolveBlocks = (node, index) => new Promise(async (resolve, reject) => {
  const cid = await util.cid(await node.serialize())
  globalThis.chain[node.index] = node.toJSON();
  globalThis.chain[node.index].hash = cid.toBaseEncodedString()
  const _tx = [];
  debug(`loading transactions`)
  try {
    for (let tx of globalThis.chain[node.index].transactions) {
      const hash = tx.multihash
      if (hash) {
        const timeout = setTimeout(async () => {
          debug(`Resolving transaction ${hash} timedout`)
          await resolveBlocks(node, index)
          resolve()
        }, 30000)
        const has = await leofcoin.api.transaction.has(hash)
        tx = await leofcoin.api.transaction.get(hash)
        debug(`tx: ${hash} loaded from network: ${has ? false : true}`)
        clearTimeout(timeout)
        if (!has) await leofcoin.api.transaction.put(tx)
        tx = tx.toJSON()
      }
      _tx.push(tx)
      debug(`loaded tx: ${hash}`)
    }
  } catch (e) {
    console.warn(e);
    return reject(e)
  }
  globalThis.chain[node.index].transactions = _tx
  leofcoin.hashMap.set(node.index, cid.toBaseEncodedString())
  debug(`loaded block: ${node.index} - ${globalThis.chain[node.index].hash}`);
  if (node.index - 1 !== -1) {
    const hash = node.prevHash

    const timeout = setTimeout(async () => {
      debug(`Resolving block ${hash} timedout`)
      await resolveBlocks(node, index)
      resolve()
    }, 10000)

    node = await leofcoin.api.block.get(node.prevHash)
    const has = await leofcoin.api.block.has(hash)
    debug(`${hash} loaded from network: ${has ? false : true}`)
    if (!has) {
      await leofcoin.api.block.put(node)
      await chainStore.put(node.index, hash)
      debug(`added block: ${node.index} ${hash}`);
    }
    clearTimeout(timeout)
    // }
    try {
      // store them in memory
      // global.blockHashSet[hash] = block.index;
      if (node.prevHash && node.prevHash !== Buffer.alloc(47).toString('hex')) {
        await resolveBlocks(node, index);
      }
      resolve()
    } catch (e) {
      return reject(e)
    }
  }
  resolve()
})
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
  if (globalThis.states.syncing) return
  globalThis.states.syncing = true
  try {
    // global.states.syncing = true;
    // bus.emit('syncing', true);
    if (!block) {
      if (!await leofcoin.api.block.has(genesisCID)) {
        await leofcoin.api.block.put(GENESISBLOCK)
        await updateLocals(genesisCID, 0)
      }
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
      } else {
        await resolveBlocks(leofcoin.currentBlockNode, height)
      }
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
    console.error('syncChain', e);
    return resync(block);
  }
  globalThis.states.syncing = false
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
        node = await new LFCTx({
          time: node.time,
          id: node.id,
          inputs: node.inputs,
          outputs: node.outputs,
          reward: node.reward
        })

        const data = await node.serialize()
        const cid = await LFCTxUtil.cid(data)
        const hash = cid.toString('base58btc')
        await peernet.transaction.put(hash, data)
        return hash
        // return globalThis.ipfs.dag.put(node, { format: LFCTxUtil.codec, hashAlg: LFCTxUtil.defaultHashAlg, version: 1, baseFormat: 'base58btc' })

      },
      has: hash => peernet.transaction.has(hash)
    }
    leofcoin.api.block = {
      put: async (node) => {
        if (!node.isLFCNode) {
          node = await new LFCNode(node)
        }
        const data = await node.serialize()
        const cid = await util.cid(data)
        const hash = cid.toString('base58btc')
        await peernet.block.put(hash, data)
        return hash
      },
      get: async multihash => {
        // Promise.race(promises)
        const node = await peernet.block.get(multihash)
        return await new LFCNode(node)
      },
      has: multihash => peernet.block.has(multihash)
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
