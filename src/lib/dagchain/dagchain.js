import bs58 from 'bs58';
import EventEmitter from 'events';
import { chain, difficulty, getUnspent, newGenesisDAGNode, invalidTransaction } from './dagchain-interface';
import { validate } from './dagblock';
import { join } from 'path';
import { genesis, network } from './../../params';
import { debug, multihashFromHash, succes, log } from './../../utils';
import { homedir } from 'os';
import ipldLfc from 'ipld-lfc';
import ipldLfcTx from 'ipld-lfc-tx';
const { LFCTx } = ipldLfcTx
const {util, LFCNode} = ipldLfc
const { encode } = bs58
globalThis.states = globalThis.states || {
  ready: false,
  syncing: false,
  connecting: false,
  mining: false
};
// const blockHashSet = []

export class DAGChain extends EventEmitter {
  constructor({genesis, ipfs}) {
    super();
    this.announceBlock = this.announceBlock.bind(this);
    this.announceTransaction = this.announceTransaction.bind(this);

    this.chain = chain;
    this.ipfs = ipfs;
    
    globalThis.resolveBlocks = this.resolveBlocks
  }

  async init(genesis) {
    await this.ipfs.pubsub.subscribe('message-added', this.announceMessage);
    await this.ipfs.pubsub.subscribe('block-added', this.announceBlock);
    await this.ipfs.pubsub.subscribe('announce-transaction', this.announceTransaction);
    await this.ipfs.pubsub.subscribe('invalid-transaction', invalidTransaction);
    log(`Running on the ${network} network`);
        // TODO: finishe the genesis module
    if (genesis) {
      log(`Creating genesis block on the ${network} network`);
      await this.newDAGChain();
    }

    try {
      if (!genesis) await this.loadChain();
    } catch (error) {
      debug(error)
      return error
    }
  }
  async resolve(name) {
    return await this.ipfs.name.resolve(name, {recursive: true});
  }

  async get(multihash) {
    const { value, remainderPath } = await this.ipfs.dag.get(multihash, { format: LFCNode.codec, hashAlg: LFCNode.defaultHashAlg, version: 1, pin: true});
    return value
  }

  async put(DAGNode) {
    return await this.ipfs.object.put(DAGNode);
  }

  async pin(multihash) {
    return await this.ipfs.pin.add(multihash, {recursive: true});
  }

  async syncChain() {
      globalThis.states.syncing = true;
      bus.emit('syncing', true);
      await leofcoin.chain.resync()
      bus.emit('syncing', false)
      globalThis.states.syncing = false;
    return;
  }

  async loadChain() {
    await this.syncChain();
    console.log('synced');
    globalThis.states.ready = true;
    bus.emit('ready', true);
  }

  addBlock(block) {
    return new Promise(async (resolve, reject) => {
      try {
        log(`add block: ${block.index}  ${block.hash}`);
        
        const multihash = multihashFromHash(block.hash)
        console.log(block);
        await globalThis.ipfs.dag.put(block, {format: util.codec, hashAlg: util.defaultHashAlg, version: 1, pin: true})
        debug(`multihash: ${multihash}`)
        console.log({block});
        // await globalThis.ipfs.dag.get(multihash, {format: util.codec, hashAlg: util.defaultHashAlg, version: 1, pin: true})
        block.hash = multihash;
        chain[block.index] = block;
        leofcoin.hashMap.set(block.index, multihash)
        // TODO: blockHashSet
        block.transactions = block.transactions.map(link => link.toJSON())
        const _transactions = [];
        for (const {multihash} of block.transactions) {
          const node = await leofcoin.transaction.dag.get(multihash)
          await leofcoin.transaction.dag.put(node)
          
          try {
            debug(`pinning: ${multihash}`);
            await leofcoin.pin.add(multihash)
            // await this.publish(multihash);
          } catch (e) {
            console.warn(e);
          }
          
          debug(`${multihash} pinned`)
          _transactions.push(node.toJSON())
        }
        chain[block.index].transactions = _transactions
        bus.emit('block-added', block);
        debug(`updating current local block: ${multihash}`)

        await leofcoin.chain.updateLocals(multihash, block.index);
        try {
          debug(`pinning: ${'/ipfs/' + multihash}`);
          await this.pin('/ipfs/' + multihash)
          // await this.publish(multihash);
        } catch (e) {
          console.warn(e);
        }
        
        try {
          debug(`Publishing ${'/ipfs/' + multihash}`)
          await ipfs.name.publish('/ipfs/' + multihash)
          // await this.publish(multihash);
        } catch (e) {
          console.warn(e);
        }
        block.transactions.forEach(async tx => {
          // const {value} = await globalThis.ipfs.dag.get(multihash, { format: LFCTx.codec, hashAlg: defaultHashAlg})
          const index = mempool.indexOf(tx)
          mempool.splice(index)
        })
      } catch (e) {
        console.error(e);
      }
    });
  }

  /**
   * Initialize a new chain on the IPFS network
   * Creates creates & saves the genesisBlock to IPFS, blocks are pinned so they aren't removeable on the local side.
   *
   * @param {object} block The genesis block to write
   * @setup PART of Easy setup your own blockchain, more info URL...
   */
   // TODO: switch to itx
  async newDAGChain() {
    try {
      const genesisBlock = await newGenesisDAGNode(difficulty());
      const cid = await ipfs.dag.put(genesisBlock, { format: 'leofcoin-block', hashAlg: util.defaultHashAlg, version: 1, multibaseName: 'base58btc', pin: true});
      await leofcoin.chain.updateLocals(cid.toBaseEncodedString(), 0);
      
      succes('genesisBlock created');
      log(`genesisBlock: ${genesisBlock.toString()}`);
      log(`genesisBlock CID: ${cid}`);
      log(`genesis: ${encode(genesisBlock.serialize())}`);
      log(`DAGChain link ${cid.toBaseEncodedString()}`);
      return;
    } catch (e) {
      console.error(e);
    }
  }
  
  async announceTransaction({data, from}) {
    const {multihash, size} = JSON.parse(data.toString());
    // const { value } = await getTx(multihash)
    // value.hash = multihash
    // console.log(value);
    mempool.push({multihash, size})
  }
  
  async resync(block) {
    await leofcoin.chain.resync(block)
  }
  
  async announceMessage({data, from}) {
    const {multihash} = JSON.parse(data.toString());
    
    messagePool.add(multihash)
  }

  // TODO: go with previous block instead off lastBlock
  // TODO: validate on sync ...
  async announceBlock({data, from}) {
    console.log(data.toString());
      const block = JSON.parse(data.toString());
      if (chain[block.index]) {
        bus.emit('invalid-block', block);
        await ipfs.pubsub.publish('invalid-block', Buffer.from(JSON.stringify(block)));
        return
      }
      if (block.index > chain[chain.length - 1].index + 1) await leofcoin.chain.resync(block)
      try {
        // const previousBlock = await lastBlock(); // test
        await validate(chain[chain.length - 1], block, difficulty(), await getUnspent());
        await this.addBlock(block); // add to chai
        
      } catch (error) {
        // TODO: remove publish invalid-block
        debug(`Invalid block ${block.hash}`)
        bus.emit('invalid-block', block);
        
        await ipfs.pubsub.publish('invalid-block', Buffer.from(JSON.stringify(block)));
        console.log('invalid', error);
        // await this.resync(block)
        return
      }
    }
}
