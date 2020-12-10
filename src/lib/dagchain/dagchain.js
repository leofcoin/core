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

    await globalThis.pubsub.subscribe('announce-transaction', this.announceTransaction);
    // await globalThis.ipfs.pubsub.subscribe('invalid-transaction', this.invalidTransaction);
    log(`Running on the ${network} network`);
        // TODO: finishe the genesis module
    if (genesis) {
      log(`Creating genesis block on the ${network} network`);
      await this.newDAGChain();
    }

    try {
      if (!genesis) await this.loadChain();
      leofcoin.publisher.start()
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
    globalThis.states.syncing = true;
    globalThis.pubsub.publish('syncing', true);
    await leofcoin.api.chain.resync()
    globalThis.pubsub.publish('syncing', false)
    globalThis.states.syncing = false;
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
        if (!block.isLFCNode) {
          block = await new LFCNode(block)
        }
        console.log({block});
        await leofcoin.api.block.dag.put(block)
        block.hash = hash;
        chain[block.index] = block.toJSON();
        leofcoin.hashMap.set(block.index, hash)
        // TODO: blockHashSet
        // block.transactions = block.transactions.map(link => link.toJSON())

        const _transactions = [];
        for (const {multihash} of chain[block.index].transactions) {
          const node = await leofcoin.api.transaction.dag.get(multihash)
          await leofcoin.api.transaction.dag.put(node)

          try {
            debug(`pinning: ${multihash}`);
            await leofcoin.api.pin.add(multihash)
            // await this.publish(multihash);
          } catch (e) {
            console.warn(e);
          }

          debug(`${multihash} pinned`)
          // _transactions.push(node.toJSON())
        }
        console.log('pinned');
        // chain[block.index].transactions = _transactions
        pubsub.publish('local-block-added', block);
        debug(`updating current local block: ${hash}`)

        await leofcoin.api.chain.updateLocals(hash, block.index);
        try {
          debug(`pinning: ${'/ipfs/' + hash}`);
          await leofcoin.api.pin.add('/ipfs/' + hash)
        } catch (e) {
          console.warn(e);
        }
        console.log('epubus');
        try {
          debug(`Publishing ${'/ipfs/' + hash}`)
          await globalThis.ipfs.name.publish('/ipfs/' + hash)
          // await this.publish(multihash);
        } catch (e) {
          console.warn(e);
        }
        block.transactions.forEach(async tx => {
          // const {value} = await globalThis.ipfs.dag.get(multihash, { format: LFCTx.codec, hashAlg: defaultHashAlg})
          const index = mempool.indexOf(tx)
          mempool.splice(index)
        })
        console.log('ok');
        resolve()
      } catch (e) {

        console.error(e);
        reject(e)
      }
    });
  }

  async announceTransaction({data, from}) {
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

  // TODO: go with previous block instead off lastBlock
  // TODO: validate on sync ...
  async announceBlock(block) {
    if (block.data) block = JSON.parse(block.data.toString())
    console.log({transactions: block.transactions});

    if (this.chain[block.index]) {
      if (globalThis.pubsub.subscribers['invalid-block']) globalThis.pubsub.publish('invalid-block', block);

      // await globalThis.ipfs.pubsub.publish('invalid-block', Buffer.from(JSON.stringify(block)));
      return
    }
    // TODO: decent testing needed
    if (block.index > this.chain[this.chain.length - 1].index + 1) await leofcoin.api.chain.resync(block)
    try {
      if (block.transactions[0].multihash) {
        const transactions = []
        for (const {multihash} of block.transactions) {
          const tx = await leofcoin.api.transaction.get(multihash)
          transactions.push(tx)
        }

        block.transactions = transactions
      }
      // const previousBlock = await lastBlock(); // test
      await this.validateBlock(this.chain[this.chain.length - 1], block, this.difficulty(), await this.getUnspent());
      console.log({block});
      for await (let tx of block.transactions) {
        tx = await new LFCTx(tx)
        await leofcoin.api.transaction.dag.put(tx.toJSON())
      }

      await this.addBlock(block); // add to chai

      if (peernet) {
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
