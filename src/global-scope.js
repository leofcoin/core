import { LFCTx } from 'ipld-lfc-tx'
import {util, LFCNode} from 'ipld-lfc'
import { longestChain } from './lib/dagchain/dagchain-interface';
import { genesisCID, GENESISBLOCK, fixIndex } from './params'
import { log } from './utils';
// import SocketClient from 'socket-request-client';
import { debug } from './utils'

globalThis.leofcoin = globalThis.leofcoin || {}

const sync = async () => {
  try {
    console.log(fixIndex);
    if (fixIndex) {
      await chainStore.put(0, genesisCID)
      await chainStore.put('localBlock', genesisCID)
      await chainStore.put('localIndex', 0)
    }
    console.log(await chainStore.get());
    // console.log(await leofcoin.block.dag.get("zsNS6wZiHT3AuWEsd6sE6oPEcCnd2pWcNKPfNUofoEybxx57Y45N4xJKBAdZH1Uh8Wm3e1k2nNhhuSai9z3WAK6pHtpmjg"));
    const { localIndex, multihash } = await localBlock();
    // const localIndex = await chainStore.get('localIndex')
    // const c = await chainStore.get('localBlock')
    ipfs.name.publish(multihash)
    const { hash, index } = await longestChain();
    console.log(index, localIndex, multihash);
    if (index > Number(localIndex)) {
      leofcoin.currentBlockHash = hash;  
      leofcoin.currentBlockNode = await leofcoin.block.dag.get(leofcoin.currentBlockHash)
    } else {
      if (index === 0) leofcoin.currentBlockHash = genesisCID
      else leofcoin.currentBlockHash = multihash || await localDAGMultiaddress();    
        console.log('ge');
      leofcoin.currentBlockNode = await leofcoin.block.dag.get(leofcoin.currentBlockHash)
    }
    
    log(`current block hash : ${leofcoin.currentBlockHash}`);
    log(`current block size: ${Math.round(Number(leofcoin.currentBlockNode.size) * 1e-6 * 100) / 100} Mb (${leofcoin.currentBlockNode.size} bytes)`);
    return leofcoin.currentBlockHash
  } catch (e) {
    throw e
  }
}

const localBlock = async () => {
  try {
    const multihash = await chainStore.get('localBlock')
    const index = await chainStore.get('localIndex')
    // let multihash = await read(localCurrent, 'string'); // read local chain state
    // const { value, remainderPath } = await ipfs.dag.get(multihash, { format: LFCNode.codec, hashAlg: LFCNode.defaultHashAlg, version: 1, pin: true});
    
    // const current = value
    // const node = new LFCNode(current)
    // 
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
  console.log(node.toString());
  const cid = await util.cid(node.serialize())
  chain[node.index] = node.toJSON();
  chain[node.index].hash = cid.toBaseEncodedString()
  leofcoin.hashMap.set(node.index, cid.toBaseEncodedString())
  debug(`loaded block: ${node.index} - ${chain[node.index].hash}`);
  if (node.prevHash !== Buffer.alloc(47).toString('hex')) {
    debug('loading block')
      node = await leofcoin.block.dag.get(node.prevHash)
      if (node.index > index) {
        await chainStore.put(node.index, leofcoin.hashMap.get(node.index))
        debug(`added block: ${node.index}`);
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
      await leofcoin.chain.sync();
    } else {
      leofcoin.currentBlockNode = new LFCNode(block)
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
        const value = await leofcoin.block.dag.get(multihash)
        await resolveBlocks(value, index);
      }
      else await resolveBlocks(leofcoin.currentBlockNode, height);
      const end = Date.now();
      const time = end - start;
      debug(time / 1000);
      if (syncCount > 0) {
        await updateLocals(chain[leofcoin.currentBlockNode.index].hash, height);
      }
    } else {
      chain[0] = GENESISBLOCK
      chain[0].index = 0;
      chain[0].hash = genesisCID;
    }
  } catch (e) {
    chain[0] = GENESISBLOCK
    chain[0].index = 0;
    chain[0].hash = genesisCID;
    await updateLocals(genesisCID, 0)
    console.error('syncChain', e);
  }
  return;
}

const timedRequest = (request) => new Promise(async (resolve, reject) => {
  setTimeout(() => {
    reject('request timeout')
  }, 60000);
  const requested = await request
  resolve(requested)
});

export default class GlobalScope {
  constructor(api) {
    globalThis.api = api
    return this._init(api)
  }
  
  async _init({discoClientMap, ipfs, peerId, discoServer}) {
    // this.discoServer = discoServer
    // globalThis.pubsubRequest = await new PubsubRequest({ipfs, peerId}, this.api)
    globalThis.peerId = peerId
    globalThis.ipfs = ipfs
    globalThis.getTx = async multihash => ipfs.dag.get(multihash, { format: LFCTx.codec, hashAlg: LFCTx.defaultHashAlg, vesion: 1, baseFormat: 'base58btc' })
    leofcoin.sync = sync
    leofcoin.dial = async (addr, protocol = 'disco') => {
      // peer already connected
      // if () return
      console.log(addr);
      // connect
      // await SocketClient(addr, protocol)
      // blacklist after "amount" attempts
    }
    // leofcoin.peers = this.discoServer.connections
    // leofcoin.peerMap = this.discoServer.peerMap
    // leofcoin.discoClientMap = discoClientMap
    leofcoin.request = async (url, params) => {
      const requests = []
      for (const connection of leofcoin.peers.values()) {
        if (connection.request) {
          requests.push(connection.request({url, params}))
        }
      }
      // get request as soon as possible
      return Promise.race(requests)
    }
    leofcoin.block = {
      get: async multihash => {
        const node = await leofcoin.block.dag.get(multihash)
        return node.toJSON()
      },
      dag: {
        get: async multihash => {
          try {
            const { value } = await ipfs.dag.get(multihash)
            value.transactions = [...value.transactions]
            return new LFCNode({...value})
          } catch (e) {
            throw e
          }
        }
      }
    }
    leofcoin.message = {
      get: async multihash => {
        const node = await leofcoin.block.dag.get(multihash)
        return node.toJSON()
      },
      dag: {
        get: async multihash => {
          const { value, remainderPath } = await ipfs.dag.get(multihash, { format: LFCNode.codec, hashAlg: LFCNode.defaultHashAlg, vesion: 1, baseFormat: 'base58btc'})
          value.transactions = [...value.transactions]
          return new LFCNode({...value})
        }
      }
    }
    leofcoin.pin = {
      add: async hash => await ipfs.pin.add(hash),
      rm: async hash => await ipfs.pin.rm(hash)
    }
    leofcoin.transaction = {
      get: async multihash => {
        const node = await leofcoin.transaction.dag.get(multihash)
        return node.toJSON()
      },
      dag: {
        get: async multihash => {
          const {value} = await ipfs.dag.get(multihash, { format: LFCTx.codec, hashAlg: LFCTx.defaultHashAlg, vesion: 1, baseFormat: 'base58btc' })
          return new LFCTx(value)
        },
        put: async node => {
          await ipfs.dag.put(node, { format: 'leofcoin-tx', hashAlg: 'keccak-256', version: 1})
          return
        }
      }
    }
    leofcoin.hashMap = new Map()
    leofcoin.chain = {
      sync: sync,
      resync: resync,
      updateLocals:  updateLocals,
      get: async hash => {
        if (!hash) {
          const blocks = []
          for (const [index, multihash] of leofcoin.hashMap.entries()) {
            const block = await leofcoin.block.dag.get(multihash)
            const _transactions = []
            for (const {multihash} of block.transactions) {
              const transaction = await leofcoin.transaction.get(multihash)
              _transactions.push(transaction)
            }
            block.transactions = _transactions
            blocks[index] = block
          }
          return blocks
        }
        if (!isNaN(hash)) hash = await leofcoin.hashMap.get(hash)
        return leofcoin.block.get(hash)
      },
      dag: {
        get: async hash => {
          if (!hash) {
            const blocks = []
            for (const [index, multihash] of leofcoin.hashMap.entries()) {
              const block = await leofcoin.block.dag.get(multihash)
              blocks[index] = block
            }
            return blocks
          }
          if (!isNaN(hash)) hash = await leofcoin.hashMap.get(hash)
          
          return leofcoin.block.dag.get(hash)
        }
      }
    }
    
    leofcoin.pubsub = {
      publish: async (topic, value) => {
        for (const connection of this.discoServer.connections.values()) {
          if (connection.pubsub) {
            await connection.pubsub.publish(topic, value)
          }
        }
        return
      },
      subscribe: async (topic, handler) => {
        for (const connection of this.discoServer.connections.values()) {
          if (connection.pubsub) {
            await connection.pubsub.subscribe(topic, handler)
          }
        }
        return
      },
      unsubscribe: async (topic, handler) => {
        for (const connection of this.discoServer.connections.values()) {
          if (connection.pubsub) {
            await connection.pubsub.unsubscribe(topic, handler)
          }
        }
        return
      }
    }
  }
    
  get api() {
    return {
      chainHeight: () => (globalThis.chain.length - 1),
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
