
import LfcApi from 'lfc-api';
import { debug, log, groupCollapsed } from './utils';
import bus from './lib/bus';
import GlobalScope from './global-scope';
import { join } from 'path';
import { configPath, networkPath, network, genesis } from './params';
// import ipfsdNode from './../../ipfsd-node/src/node';
// import ipfsStar from './lib/network/ipfs-star';
// import { connect, connectBootstrap } from './lib/network/peernet';
import { DAGChain } from './lib/dagchain/dagchain.js';
// import Room from './lib/network/room.js';
// import DiscoRoom from '@leofcoin/disco-room';
import { platform } from 'os';
import * as _api from './api'
import apiServer from './api-server'
globalThis.bus = globalThis.bus || bus
globalThis.peerMap = globalThis.peerMap || new Map()

export {_api as api}
export const core = async (config = {}) => {
  if (config.debug) process.env.DEBUG = true
	try {
    const now = Date.now();
    bus.emit('stage-one');
    
    debug('starting ipfs');
    const api = await new LfcApi({ init: true, start: true, bootstrap: 'lfc', forceJS: true, star: config.star, network: config.network})
    apiServer()
    try {
      await new GlobalScope(api)
    } catch (e) {
      console.warn(e);
    }
    // globalThis.id = api.peerId;
    // globalThis.ipfs = api.ipfs;
    
    const ipfsd_now = Date.now();
    // await connectBootstrap();

    const bootstrap_now = Date.now();

    // globalThis.getPeers = () => disco.peers || [];
    const signal_now = Date.now();
    process.on('exit', async () => {
      console.log('exit');
        try {
          await ipfs.pubsub.unsubscribe('block-added');
          await ipfs.pubsub.unsubscribe('announce-transaction');
          await ipfs.pubsub.unsubscribe('invalid-transaction');
        } catch (e) {
          console.log(e);
        }
    })
    process.on('close', () => {
      console.log('close');
    })
    process.on('SIGINT', async () => {
      console.log("Caught interrupt signal");
      setTimeout(async () => {
        process.exit();
      }, 50);
    });
    const connection_now = Date.now();
    bus.emit('stage-two');
    groupCollapsed('Initialize', () => {
      log(`ipfs daemon startup took: ${(ipfsd_now - now) / 1000} seconds`);
      log(`connecting with bootstrap took: ${(bootstrap_now - ipfsd_now) / 1000} seconds`);
      log(`signal server startup took: ${(signal_now - bootstrap_now) / 1000} seconds`);
      log(`peer connection took: ${(connection_now - ipfsd_now) / 1000} seconds`);
      log(`total load prep took ${(Date.now() - now) / 1000} seconds`);
    })
    // await write(configPath, JSON.stringify(config, null, '\t'));
    const chain = new DAGChain({ genesis, network, ipfs: api.ipfs });
    await chain.init(genesis);
    return chain;
	} catch (e) {
    if (e.code === 'ECONNREFUSED' || e.message && e.message.includes('cannot acquire lock')) {
      // await cleanRepo();
      console.log('retrying');
      // return core({ genesis, network });
    }
		console.error(`load-error::${e}`);
    // process.exit()
	}
}
