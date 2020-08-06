import Chain from './../../node_modules/@leofcoin/lib/src/chain';
import errors from './../../node_modules/@leofcoin/lib/src/errors'
import { fork } from 'child_process';
import { join } from 'path';

const chain = new Chain()

export default class Miner {

  get donationAddress() {
    return 'cpc';
  }

  set job(value) {
    this._job = value;
  }

  get job() {
    return this._job;
  }

  constructor(address, intensity, autostart) {
    // TODO: limit intensity when pool is empty
    this.workerPath = join(__dirname, 'miner-worker.js')
    if (!address) {
      chain.MinerWarning('All profit will be donated until address is set');
    }
    this.address = address;
    this.running = 0;


    if (autostart) {
      this.start();
    }
  }

  /**
   * keep node(s) in sync
   */
  onBlockAdded() {
    return new Promise((resolve, reject) => {
      this._onBlockAdded = block => {
        this.mineStop()
        globalThis.pubsub.unsubscribe('block-added', this._onBlockAdded);
        globalThis.pubsub.unsubscribe('invalid-block', this._onBlockInvalid);
        resolve(block);
      }
      this._onBlockInvalid = block => {
        this.mineStop()
        globalThis.pubsub.unsubscribe('block-added', this._onBlockAdded);
        globalThis.pubsub.unsubscribe('invalid-block', this._onBlockInvalid);
        resolve(null);
      }
      globalThis.pubsub.subscribe('block-added', this._onBlockAdded);
      globalThis.pubsub.subscribe('invalid-block', this._onBlockInvalid);
    });
  }


  async start() {
    // ipfs.pubsub.subscribe('invalid-block');
    try {
      this.mining = true;
      if (!this.job) this.job = Math.random().toString(36).slice(-11);
      await this.mine(this.job);
    } catch (e) {
      console.error(e)
    }
  }

  stop() {
    this.mining = false;
    this.mineStop();
  }

  async mine(job, lastValidBlock) {
    const address = this.address || this.donationAddress;
    const start = Date.now();
    const {block, hashes, index} = await this.mineBlock(chain.difficulty(), address, job);

    if (hashes) {
      const now = Date.now();
      const seconds = (now - start) / 1000;
      const rate = (hashes / seconds) / 1000;
      globalThis.pubsub.publish('miner.hashrate', {uid: job, hashrate: (Math.round(rate * 100) / 100)});
    }

    if (block) {
      global.ipfs.pubsub.publish('block-added', Buffer.from(JSON.stringify(block)));
      console.log(`${job}::Whooooop mined block ${block.index}`);
      if (this.mining) {
        await this.onBlockAdded();
        this.mine(job, block);
      }
    } else {
      console.log(`${job}::cancelled mining block ${index}`);
      if (this.mining) this.mine(job);
    }

  }

  /**
   * Mine a block in separate process
   *
   * @param transactions Transactions list to add to the block
   * @param lastBlock Last block in the blockchain
   * @param difficulty Current difficulty
   * @param address Addres for reward transaction
   * @return {*}
   */
  async mineBlock(difficulty, address, job) {
    const block = await chain.nextBlock(address);
    console.log(`${job}::Started mining block ${block.index}`);

    return this.findBlockHash(block, difficulty);
  }

  /**
   * Find block hash according to difficulty
   *
   * @param block
   * @param difficulty
   * @return {Promise}
   */
  findBlockHash (block, difficulty) {
    return new Promise((resolve, reject) => {
      const worker = fork(this.workerPath);
      /*
       * Create worker to find hash in separate process
       */


       /*
        * Hadnle events to stop mining when needed
        */
      this.mineStop = () => {
       removeListeners()
       worker.kill('SIGINT')
       resolve({block: null, hashCount: null, index: block.index});
      }

      // Listeners for stopping mining
      const blockAddedListener = b => {
        if (b.index >= block.index) this.mineStop()
      }
      const mineStopListener = b => this.mineStop
      const removeListeners = () => {
       globalThis.pubsub.unsubscribe('block-added', blockAddedListener)
       globalThis.pubsub.unsubscribe('mine-stop', mineStopListener)
      }
      // If other process found the same block faster, kill current one
      globalThis.pubsub.subscribe('block-added', blockAddedListener)
      globalThis.pubsub.subscribe('mine-stop', mineStopListener)
      // const result = await minerWorker({block, difficulty})
      worker.on('message', (data) => {
        removeListeners();

        resolve({block: data.block, hashes: data.hashCount});
        worker.kill('SIGINT');
      })
      worker.send({block, difficulty});

    });
  }

}
