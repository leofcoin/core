import Pubsub from '@vandeurenglenn/little-pubsub'
import LfcApi from 'lfc-api';
import { debug, log, groupCollapsed } from './utils';
import bus from './lib/bus';
import GlobalScope from './global-scope';
import { join } from 'path';
import { configPath, networkPath, network } from './params';
// import ipfsdNode from './../../ipfsd-node/src/node';
// import ipfsStar from './lib/network/ipfs-star';
// import { connect, connectBootstrap } from './lib/network/peernet';
import { DAGChain } from './lib/dagchain/dagchain.js';
// import Room from './lib/network/room.js';
// import DiscoRoom from '@leofcoin/disco-room';
import { platform } from 'os';
import * as _api from './api'
import http from './http/http'
import Server from './../node_modules/socket-request-server/src/index'
import Client from './../node_modules/socket-request-client/src/index'

globalThis.bus = globalThis.bus || bus
globalThis.peerMap = globalThis.peerMap || new Map()

export {_api as api}
export const core = async (config = {}, genesis = false) => {
  if (config.debug) process.env.DEBUG = true
	try {
    const now = Date.now();
    bus.emit('stage-one');
    
    debug('starting ipfs');
    const api = await new LfcApi({ init: true, start: true, bootstrap: 'lfc', forceJS: true, star: config.star, network: config.network})
    // apiServer()
    
    globalThis.pubsub = new Pubsub()
    globalThis.clients = http()
    
    
     // if (!globalThis) 
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
          await globalThis.ipfs.pubsub.unsubscribe('block-added');
          await globalThis.ipfs.pubsub.unsubscribe('announce-transaction');
          await globalThis.ipfs.pubsub.unsubscribe('invalid-transaction');
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
    
    if (config.star) {
      const server = Server({port: 5555, protocol: 'peernet-v0.1.0', pubsub: globalThis.pubsub})
      peerMap.set(api.peerId, api.addresses)
      
      server.pubsub.subscribe('block-added', chain.announceBlock)
    } else {
      const address = 'wss://star.leofcoin.org:5555'
      globalThis.client = await Client(address, 'peernet-v0.1.0', {pubsub: globalThis.pubsub, retry: 3000})
      
      
      const peers = await client.peernet.join({peerId: api.peerId, address: api.addresses})
    }
    
    const chain = new DAGChain({ genesis, network });
    await chain.init(genesis);
    
    
    return chain;
	} catch (e) {
    if (e.code === 'ECONNREFUSED' || e.message && e.message.includes('cannot acquire lock')) {
      // await cleanRepo();
      console.log('retrying');
      // return core({ genesis, network });
    }
		console.error(`load-error::${e}`);
    console.error(e.stack);
    // process.exit()
	}
}
