import Chain from './../../../node_modules/@leofcoin/lib/src/chain'
import bs58 from 'bs58';
import { join } from 'path';
import { network } from './../../params';
import { debug, log } from './../../utils';
import ipldLfc from 'ipld-lfc';
import ipldLfcTx from 'ipld-lfc-tx';
const {util, LFCNode} = ipldLfc
const {LFCTx} = ipldLfcTx


globalThis.states = globalThis.states || {
  ready: false,
  syncing: false,
  connecting: false,
  mining: false
};
// const blockHashSet = []

export class DAGChain extends Chain {
  constructor({genesis}) {
    super();
    this.announceBlock = this.announceBlock.bind(this);
    this.blockMined = this.blockMined.bind(this);
    this.announceMessage = this.announceMessage.bind(this);
    this.announceTransaction = this.announceTransaction.bind(this);
    this.invalidTransaction = this.invalidTransaction.bind(this);
    this.blockAdded = this.blockAdded.bind(this)
  }

  async init(genesis) {
    // await globalThis.ipfs.pubsub.subscribe('message-added', this.announceMessage);
    // await globalThis.ipfs.pubsub.subscribe('block-added', this.announceBlock);
    // v1.0.0
    await globalThis.pubsub.subscribe('block-added', this.announceBlock);
    await globalThis.pubsub.subscribe('block-mined', this.blockMined);

    if (peernet) {
      peernet.subscribe('block-added', this.announceBlock)
      peernet.subscribe('announce-transaction', this.announceTransaction)
    }

    // await globalThis.pubsub.subscribe('announce-transaction', this.announceTransaction);
    // await globalThis.ipfs.pubsub.subscribe('invalid-transaction', this.invalidTransaction);
    log(`Running on the ${network} network`);
        // TODO: finishe the genesis module
    if (genesis) {
      log(`Creating genesis block on the ${network} network`);
      await this.newDAGChain();
    }

    try {
      if (!genesis) await this.loadChain();
      pubsub.publish('core:ready', true)
    } catch (error) {
      debug(error)
      return error
    }
  }

  async resolve(name) {
    return await globalThis.ipfs.name.resolve(name, {recursive: true});
  }

  async get(multihash) {
    console.log(`deprecated get for ${multihash} @DagChain.get is deprecated`);
    const { value, remainderPath } = await globalThis.ipfs.dag.get(multihash, { format: LFCNode.codec, hashAlg: LFCNode.defaultHashAlg, version: 1, pin: true});
    return value
  }

  async put(DAGNode) {

      console.log(`deprecated put @DagChain.put is deprecated`);
    return await globalThis.ipfs.object.put(DAGNode);
  }

  async pin(multihash) {
    console.log(`deprecated add @DagChain.add is deprecated`);
    return await globalThis.ipfs.pin.add(multihash, {recursive: true});
  }

  async syncChain() {
    await leofcoin.api.chain.resync()
    return;
  }

  async loadChain() {
    await this.syncChain();
    globalThis.states.ready = true;
    globalThis.pubsub.publish('ready', true);


    // leofcoin.publisher.start()
  }

  async blockAdded(data) {
    console.log(data);
    console.log(peerMap);

  }

  addBlock(block) {
    return new Promise(async (resolve, reject) => {
      try {
        const { index, hash } = block

        log(`add block: ${index}  ${hash}`);
        const _tx = []
        for await (let tx of block.transactions) {
          const node = await leofcoin.api.transaction.get(tx.multihash)
          if (await !leofcoin.api.transaction.has(tx.multihash)) await leofcoin.api.transaction.put(node)

          _tx.push(node.toJSON())
        }

        block.hash = hash;
        chain[block.index] = block
        chain[block.index].transactions = _tx

        if (!await leofcoin.api.block.has(hash)) await leofcoin.api.block.put({...block})

        // await leofcoin.api.block.get(hash)

        // await leofcoin.api.block.dag.put(block)

        leofcoin.hashMap.set(block.index, hash)
        // TODO: blockHashSet
        // block.transactions = block.transactions.map(link => link.toJSON())

        // chain[block.index].transactions = _transactions
        pubsub.publish('local-block-added', block);
        debug(`updating current local block: ${hash}`)

        await leofcoin.api.chain.updateLocals(hash, block.index);
        // try {
        //   debug(`pinning: ${'/ipfs/' + hash}`);
        //   await leofcoin.api.pin.add('/ipfs/' + hash)
        // } catch (e) {
        //   console.warn(e);
        // }
        block.transactions.forEach(async tx => {
          console.log(tx);
          // const {value} = await globalThis.ipfs.dag.get(multihash, { format: LFCTx.codec, hashAlg: defaultHashAlg})
          const index = mempool.indexOf(tx)
          mempool.splice(index)
        })
        console.log('done');
        resolve()
      } catch (e) {

        console.error(e);
        reject(e)
      }
    });
  }

  async announceTransaction(tx) {
    console.log({tx});
    const {multihash, size} = JSON.parse(data.toString());
    // const { value } = await getTx(multihash)
    // value.hash = multihash
    // console.log(value);
    mempool.push({multihash, size})
  }

  async resync(block) {
    await leofcoin.api.chain.resync(block)
  }

  async announceMessage({data, from}) {
    const {multihash} = JSON.parse(data.toString());

    messagePool.add(multihash)
  }

  async blockMined(block) {
    globalThis.states.mining = false;
    leofcoin.miners.forEach(miner => miner.stop());

    if (this.chain[block.index]) {
      if (globalThis.pubsub.subscribers['invalid-block']) globalThis.pubsub.publish('invalid-block', block);
      return
    }
    const _tx = []
    for (const index in block.transactions) {
      let tx;
      tx = await memStore.get(block.transactions[index].multihash)
      console.log(tx.toString());
      const multihash = block.transactions[index].multihash
      if (multihash) {
        tx = await leofcoin.api.transaction.put(JSON.parse(tx.toString()))
        tx = await leofcoin.api.transaction.get(tx)
      } else {
        tx = block.transactions[index]
      }

      _tx.push(tx)
    }
    // block.transactions = _tx
console.log(block.transactions);
    try {
      await this.validateBlock(this.chain[this.chain.length - 1], {...block}, this.difficulty(), await this.getUnspent());
      // add to tx local before sending block

console.log(block.transactions);
      await this.addBlock({...block});
      if (peernet) {
        block = JSON.stringify(block)
        peernet.publish('block-added', block)
      }
    } catch (error) {
      if (await this.blockHash(block) !== block.hash) console.error('hash')
      if (this.getDifficulty(block.hash) > this.difficulty()) console.error('hash')

      // TODO: remove publish invalid-block
      debug(`Invalid block ${block.hash}`)
      if (globalThis.pubsub.subscribers['invalid-block']) globalThis.pubsub.publish('invalid-block', block);

      // await globalThis.ipfs.pubsub.publish('invalid-block', Buffer.from(JSON.stringify(block)));
      console.log('invalid', error);
    }

    leofcoin.miners.forEach(miner => miner.start());
    globalThis.states.mining = true;
  }

  // TODO: go with previous block instead off lastBlock
  // TODO: validate on sync ...
  async announceBlock(block) {
    if (typeof block !== 'object') block = JSON.parse(block)
    if (this.chain[block.index]) {
      if (globalThis.pubsub.subscribers['invalid-block']) globalThis.pubsub.publish('invalid-block', block);

      // await globalThis.ipfs.pubsub.publish('invalid-block', Buffer.from(JSON.stringify(block)));
      return
    }
    // TODO: decent testing needed
    // TODO: validate before resync
    if (block.index > this.chain[this.chain.length - 1].index + 1) await leofcoin.api.chain.resync(block)

    try {
      // const previousBlock = await lastBlock(); // test
      await this.validateBlock(this.chain[this.chain.length - 1], block, this.difficulty(), await this.getUnspent());
      await this.addBlock(block); // add to chain

      // if (block.transactions[0].multihash) {
      //   const transactions = []
      //   for (const {multihash} of block.transactions) {
      //     const tx = await leofcoin.api.transaction.get(multihash)
      //     if (!await leofcoin.api.transaction.has(multihash)) {
      //       await leofcoin.api.transaction.put(tx)
      //     }
      //     transactions.push(tx)
      //   }
      //
      //   block.transactions = transactions
      // }

      if (peernet) {
        block = JSON.stringify(block)
        peernet.publish('block-added', block)
      }

    } catch (error) {
      // if (!ipldLfc.util.isValid(block)) throw this.BlockError('data');
    	// console.log(block, previousBlock);
    	if (await this.blockHash(block) !== block.hash) console.error('hash')
    	if (this.getDifficulty(block.hash) > this.difficulty()) console.error('hash')

      // TODO: remove publish invalid-block
      debug(`Invalid block ${block.hash}`)
      if (globalThis.pubsub.subscribers['invalid-block']) globalThis.pubsub.publish('invalid-block', block);

      // await globalThis.ipfs.pubsub.publish('invalid-block', Buffer.from(JSON.stringify(block)));
      console.log('invalid', error);
      // await this.resync(block)
      return
    }
  }
}
