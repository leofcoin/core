import { config, median, multihashFromHex, hashFromMultihash, debug } from './../../utils';
import { validateTransaction, consensusSubsidy } from './../transaction.js';
import { TransactionError } from './../errors.js';
import { DAGBlock, validate } from './dagblock';
import { encode, decode } from 'bs58';
import { GENESISBLOCK, genesisCID } from '../../params';
import calculateHash from  './calculate-hash';
import ipldLfc from 'ipld-lfc';

const { LFCNode, util } = ipldLfc

const invalidTransactions = {};

global.chain = global.chain || [
  GENESISBLOCK
];
global.mempool = global.mempool || [];
global.blockHashSet = global.blockHashSet || [];

export const chain = (() => global.chain)();

export const mempool = (() => global.mempool)();

export const blockHashSet = (() => global.blockHashSet)();

// TODO: needs 3 nodes running
export const invalidTransaction = data => {
  // console.log(data.data.toString());
  data = JSON.parse(data.data.toString());
  if (!invalidTransactions[data.tx]) invalidTransactions[data.tx] = 0;
  ++invalidTransactions[data.tx]
  const count = invalidTransactions[data.tx];
  if (count === 3) {
    const memIndex = mempool.indexOf(data)
    mempool.splice(memIndex, 1)
    delete invalidTransactions[data.tx];
  }
}

/**
 * Get the transactions for the next Block
 *
 * @return {object} transactions
 */
export const nextBlockTransactions = async () => {
	const unspent = await getUnspent(false);
	return mempool.filter(async (transaction) => {
    const multihash = transaction.multihash
    const value = await leofcoin.transaction.get(multihash)
    console.log({value});
		try {
			await validateTransaction(multihash, value, unspent);
      return transaction
		} catch (e) {
      // TODO: push to pubus
      global.ipfs.pubsub.publish('invalid-transaction', new Buffer.from(JSON.stringify(transaction)));
			console.error(e);
		}
	});
};

export const getTransactions = async (withMempool = true, index = 0) => {
  const _chain = [...chain];
  _chain.slice(index, chain.length)
	let transactions = _chain.reduce((transactions, block) => [ ...transactions, ...block.transactions], []);
	if (withMempool) transactions = transactions.concat(mempool);
  let _transactions = []
  for (const tx of transactions) {
    const {multihash} = tx
    if (multihash) {
      const {value} = await global.ipfs.dag.get(multihash, {format: LFCNode.codec, hashAlg: LFCNode.faultHashAlg, version: 1, baseFormat: 'base58btc'})
      _transactions.push(value)
    } else {
      _transactions.push(tx)
    }
    
  }
  return _transactions
};

export const getTransactionsForAddress = async (address, index = 0) => {
  const transactions = await getTransactions(false, index);
	return transactions.filter(tx => tx.inputs.find(i => i.address === address) ||
  tx.outputs.find(o => o.address === address));
};

export const getUnspent = async (withMempool = false, index = 0) => {
	const transactions = await getTransactions(withMempool, index);
	// Find all inputs with their tx ids
	const inputs = transactions.reduce((inputs, tx) => inputs.concat(tx.inputs), []);

	// Find all outputs with their tx ids
	const outputs = transactions.reduce((outputs, tx) =>
		outputs.concat(tx.outputs.map(output => Object.assign({}, output, {tx: tx.id}))), []);

	// Figure out which outputs are unspent
	const unspent = outputs.filter(output =>
		typeof inputs.find(input => input.tx === output.tx && input.index === output.index && input.amount === output.amount) === 'undefined');
	return unspent;
};
export const getUnspentForAddress = async (address, index = 0) => {
  const unspent = await getUnspent(true, index)
	return unspent.filter(u => u.address === address);
};
export const getBalanceForAddress = async address => {
  debug(`Getting balance for ${address}`)
  const unspent = await getUnspentForAddress(address)
  const amount = unspent.reduce((acc, u) => acc + u.amount , 0);
  debug(`Got ${amount} for ${address}`)
	return amount
};
export const getBalanceForAddressAfter = async (address, index) => {
  debug(`Getting balance for ${address} @${index}`)
  const unspent = await getUnspentForAddress(address, index)
  const amount = unspent.reduce((acc, u) => acc + u.amount , 0);
  debug(`Got ${amount} for ${address} @${index}`)
  return amount
}
export const difficulty = () => {
	// TODO: lower difficulty when transactionpool contain more then 500 tx ?
	// TODO: raise difficulty when pool is empty

  // or

  // TODO: implement iTX (instant transaction)
  // iTX is handled by multiple peers, itx is chained together by their hashes
  // by handlng a tx as itx the block well be converted into a iRootBlock
  // this results into smaller chains (tangles, tails) which should improve
  // resolving transactions, wallet amounts etc ...
	const start = chain.length >= 128 ? (chain.length - 128) : 0;
	const blocks = chain.slice(start, (chain.length - 1)).reverse();
	const stamps = [];
	for (var i = 0; i < blocks.length; i++) {
		if (blocks[i + 1]) {
			stamps.push(blocks[i].time - blocks[i + 1].time);
		}
	}
	if (stamps.length === 0) {
		stamps.push(30);
	}
	let blocksMedian = median(stamps) || 30;
  const offset = blocksMedian / 30
   // offset for quick recovery
	if (blocksMedian < 30) {
		blocksMedian -= (offset / 2);
	} else if (blocksMedian > 30) {
		blocksMedian += (offset * 2);
	}
  if (blocksMedian < 0) blocksMedian = -blocksMedian
  console.log(`Average Block Time: ${blocksMedian}`);
  console.log(`Difficulty: ${30 / blocksMedian}`);
	return ((100000 / ((30 / blocksMedian) * 100)) * 3); // should result in a block every 10 seconds
};//10000

export const transformBlock = ({multihash, data}) => {
  data = JSON.parse(data.toString());
  data.hash = hashFromMultihash(multihash);
  return data;
};

const timedRequest = (peer, request) => new Promise(async (resolve, reject) => {
  setTimeout(() => {
    reject()
  }, 1000);
  const requested = await peer.request(request)
  resolve(requested)
});

const readyState = (state) => {
  switch (state) {
    case 0:
      return 'connecting'
      break;
    case 1:
      return 'open'
      break;
    case 2:
      return 'closing'
      break;
    case 3:
      return 'closed'
      break;
  }
}

const connectAfterClose = client => new Promise(async (resolve, reject) => {
  if (readyState(client.readyState) === 'closed') {
    await leofcoin.dial(client.url)
    resolve()
  } else if (readyState(client.readyState) === 'closing') setTimeout(async () => {
    await connectAfterClose(client)
    resolve()
  }, 1000);
})

const filterPeers = (peers, localPeer) => {
  const set = []
  return peers.reduce((p, c) => {
    if (set.indexOf(c.peer) === -1 && c.peer !== localPeer) {
      set.push(c.peer)
      p.push(c)
    }
    return p
  }, [])
}

// TODO: global peerlist
export const longestChain = () => new Promise(async (resolve, reject) => {
  
  try {
    let peers = await ipfs.swarm.peers()
    console.log(peers);
    peers = await filterPeers(peers, globalThis.peerId)
    console.log(peers);
    // if (peers.length < 2) return setTimeout(async () => {
    //   const res = await longestChain()
    //   resolve(res)
    // }, 100);
    
    const set = []
    for (const {peer} of peers) {
      const chunks = []
      try {
        for await (const chunk of ipfs.name.resolve(peer)) {
          chunks.push(chunk)
        }
      } catch (e) {
        console.warn(e)
      }
      if (chunks.length > 0) set.push({peer, path: chunks});
    }
    const _peers = []
    let _blocks = []
    for (const {peer, path} of set) {    
      if (_peers.indexOf(peer) === -1) {
        _peers.push(peer)
        const block = await leofcoin.block.dag.get(path[0] || path)      
        _blocks.push({block, path: path[0] || path})        
      }        
    }
    const localIndex = await chainStore.get('localIndex')
    const localHash = await chainStore.get('localBlock')
    console.log({localHash});
    const history = {}
    _blocks = _blocks.reduce((set, {block, path}) => {
      if (set.block.index < block.index) {
        history[set.block.index] = set;
        set.block = block
        set.hash = path.replace('/ipfs/', '')
        set.seen = 1
      } else if (set.block.index === block.index) {
        set.seen = Number(set.seen) + 1
      }
      return set
    }, {block: { index: localIndex }, hash: localHash, seen: 0})
    // temp 
    // if (_blocks.seen < 2) {
    //   _blocks = history[_blocks.block.index - 1]
    // 
    // }
    // const localIndex = await chainStore.get('localIndex')
    // const localHash = await chainStore.get('localBlock')
    return resolve({index: _blocks.block.index, hash: _blocks.hash})
    
  } catch (e) {
    console.warn(e);
    debug(e)
    reject(e)
  }
  // return resolve({index: 0, hash: genesisCID})
  // try {
  //   if (!globalThis.ipfs) return
  //   // console.log(peerMap.entries());
  //   let addresses = await global.ipfs.swarm.peers();
  //   addresses = addresses.map(({peer}) => peer.toB58String());
  //   if (addresses.length < 1) return resolve(setTimeout(async () => {
  //     return await longestChain()
  //   }, 2000));
  //   addresses = addresses.filter((id) => id !== 'QmQRRacFueH9iKgUnHdwYvnC4jCwJLxcPhBmZapq6Xh1rF')
  //   let stat = {
  //     index: 0,
  //     hash: genesisCID
  //   };
  //   for (const addr of addresses) {
  //     await ipfs.swarm.connect(`/p2p-circuit/ipfs/${addr}`)
  //     const value = await globalThis.pubsubRequest.request('chainHeight', addr)
  //     if (stat.index < value) {
  //       stat = {
  //         index: value,
  //         addr
  //       }
  //     }      
  //   }
  //   // reduce to longest chain
  //   // TODO: consider using candidates for validating
  //   // canditates.push({hash, height})
  //   // if c.height > p.height => newCanditatesSet ...
  //   if (stat.addr) {
  //     const hash = await globalThis.pubsubRequest.request('blockHash', stat.addr, stat.index)
  //     return resolve({ index: stat.index, hash });  
  //   }
  //   resolve({index: 0, hash: genesisCID})
  // } catch (e) {
  //   reject(e);
  // }
});

export const lastBlock = () => new Promise(async (resolve, reject) => {
  // setTimeout(async () => {
  //   const hash = leofcoin.hashMap.get(leofcoin.hashMap.size - 1)
  //   console.log(leofcoin.hashMap.get(leofcoin.hashMap.size - 1));
  //   console.log(hash);
  //   const {index} = await leofcoin.block.get(hash)
  //   console.log(index);
  //   resolve({hash, index})
  // }, 1000);
  const result = await longestChain();
  
  resolve(result); // retrieve links
});

export const nextBlock = async address => {
  let transactions;
  let previousBlock;
  try {
    previousBlock = await lastBlock()
    console.log({previousBlock});
    if (previousBlock.index > chain.length - 1) {
      await leofcoin.chain.sync()
      previousBlock = await lastBlock()
    }
    if (!previousBlock.index) previousBlock = chain[chain.length - 1]
    // previousBlock = chain[chain.length - 1]; // TODO: await lastBlock
    transactions = await nextBlockTransactions();
  } catch (e) {
    console.log(e);
    previousBlock = GENESISBLOCK
    previousBlock.hash = genesisCID
    transactions = await nextBlockTransactions();
  } finally {
    // console.log(transactions, previousBlock, address);
    return await new DAGBlock(global.ipfs).newBlock({transactions, previousBlock, address});
  }
};

const goodBlock = (block, difficulty) => new Promise(async (resolve, reject) => {
  // return setTimeout(async () => {
    block.hash = await calculateHash(block);
    if (parseInt(block.hash.substring(0, 8), 16) >= difficulty) {
      block.nonce++
      block = await goodBlock(block, difficulty)
    }      
    resolve(block)
  // }, 500);
})

/**
 * Create a new genesis block
 */
export const newGenesisDAGNode = async (difficulty = 1, address = Buffer.alloc(32).toString('hex')) => {
  let block = {
    index: 0,
    prevHash: Buffer.alloc(47).toString('hex'),
    time: Math.floor(new Date().getTime() / 1000),
    transactions: [
      // ms.unspent(network, [], wallet.account()).create(index: 0, amount: consensusSubsidy(0), address)
    ],
    nonce: 0
  }
  block.hash = await calculateHash(block);
  block = await goodBlock(block, difficulty)
  console.log({block});
  const node = new LFCNode(block)
  return node;
}
