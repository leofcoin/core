import { read, write } from 'crypto-io-fs';
import { APPDATAPATH, network, configPath } from './params';
import { join } from 'path';
import { buildTransaction } from './lib/transaction';
import { mempool, getBalanceForAddress, getBalanceForAddressAfter } from './lib/dagchain/dagchain-interface';
import { loadWallet, generateWallet, discoverAccounts } from './lib/wallet-utils';
import { or } from './shorten';
import bus from './lib/bus';
import Miner from './lib/miner';
import MultiWallet from 'multi-wallet';
// TODO: multiwallet in browser
const miners = [];

globalThis.bus = globalThis.bus || bus

globalThis.states = globalThis.states || {
  ready: false,
  syncing: false,
  connecting: false,
  mining: false
};
export const blockHashSet = globalThis.blockHashSet;
/**
* state - get current app state
*
* @param {string} key - event name
* @param {boolean|string} [wait=false|wait='event'] - wait untill next event when asked state is false
* or wait untill next event when set to 'event'
*/
export const state = (key, wait) => new Promise(async (resolve, reject) => {
  const state = await globalThis.states[key];
  if (wait && !state || wait && wait === 'event') bus.once(key, state => resolve(state));
  else resolve(state);
});

export const getConfig = async () => await read(configPath, 'json');

export const setConfig = async data => await write(configPath, JSON.stringify(data));

export const setMinerConfig = async minerConfig => {
  const data = await getConfig();
  data.miner = minerConfig;
  await setConfig(data);
  return;
}

/**
 *
 * @param {string|number} height hash or height
 */
export const block = async (height) => {
  await state('ready', true)
  if (!height) return chain[chain.length - 1];
  if (typeof height !== 'string') return chain[height]
  return chain[blockHashSet[height]];
};

export const blocks = async (number, last) => {
  await state('ready', true)
  console.log(number, last);
  if (!number) return leofcoin.chain.get();
  else if (last) {
    return chain.slice((chain.length - number), chain.length);
  } else return block(number);
};

export const transactions = async (number, last) => {
  await state('ready', true)
  if (!number) return chain[chain.length - 1].transactions.map(tx => {
    tx.parentHash = chain[chain.length - 1].hash
    return tx;
  });
  let blocks;
  if (last) blocks = chain.slice((chain.length - number), chain.length);
  else blocks = chain.slice(0, number + 1);

  const tx = blocks.reduce((p, c) => [...p, ...c.transactions.map(tx => {
    tx.parentHash = c.hash;
    return tx;
  })], [])
  if (tx.length < number) {
    return transactions(number + 10, last)
  }
  if (last) return tx.slice((tx.length - number), tx.length)
  else return tx.slice(0, number)


};

export const mine = async config => {
  await state('ready', true)
  let { address, intensity, donationAddress, donationAmount } = config;
  if (!intensity) intensity = 1;
  if (intensity && typeof intensity === 'string') intensity = Number(intensity);
  console.log({ address, intensity, donationAddress, donationAmount });
  if (donationAddress && donationAmount === 'undefined') donationAmount = 3; //procent
  const addMiner = count => {
    for (var i = 0; i < count; i++) {
      const miner = new Miner();
      miner.address = address;
      // miner.donationAddress = donationAddress;
      // miner.donationAmount = donationAmount;
      miner.start();
      miners.push(miner);
    }
  }
  if (globalThis.states.mining && miners.length === intensity) {
    miners.forEach(miner => miner.stop());
    globalThis.states.mining = false;
  } else if (!globalThis.states.mining && miners.length === intensity) {
    miners.forEach(miner => miner.start());
    globalThis.states.mining = true;
  } else {
    if (miners.length > 0 && miners.length === intensity) {
      miners.forEach(miner => {
        miner.address = address;
      });
    } else if (miners.length > intensity) {
      const removeCount = miners.length - intensity
      const removed = miners.slice(0, removeCount);
      removed.forEach(miner => miner.stop());
    } else if (miners.length < intensity && miners.length > 0) {
      const addCount = intensity - miners.length;
      addMiner(addCount);
    } else {
      addMiner(intensity);
    }
    globalThis.states.mining = true;
  }
  // TODO: add donationAddress
  // TODO: add donation option in ui
  // if (!address) address = donationAddress;

}

export const importWallet = async (wif) => {
  // wallet = await generateWallet();
  // console.log(wallet.mnemonic);
  // const account = wallet.derive(`m/0\'/0/0`)
  // return { mnemonic: wallet.mnemonic, accounts: [account.address] }
}

export const createWallet = async () => {
  const wallet = await generateWallet();

  // await setAccountNames()
  console.log(wallet);
  console.log(wallet.mnemonic);
  return wallet;
}

const accounts = async (discoverDepth = 0) => {
  let wallet;
  let accounts = undefined;
  try {
    wallet = await loadWallet();
    await state('ready', true);
    accounts = discoverAccounts(wallet, discoverDepth);
  } catch (e) {
    console.log('readied');
  }
  return accounts;
}

export const accountNames = async () => {
  const path = join(APPDATAPATH, 'account');
  let data;
  try {
    data = await read(path)
    data = JSON.parse(data.toString())
  } catch (e) {
    if (e.code === 'ENOENT') {
      data = ['main account']
      await write(path, JSON.stringify(data))
    }
  }
  return data;
}
// TODO: whenever a address is used update depth...
// IOW
// external(0).addr => internal(0).addr => external(1).addr => internal(1).addr ...
/**
 * @param {object} account - hdaccount
 * @param {number} depth - account depth
 * @return {array} [external, internal] - addresses
 */
const _addresses = ([account], depth = 0) => {
  // const external = account.external(0);
  // const external = account.external(0);
  // console.log([account.external(0), account.internal(0).address]);
  return [account.external(0).address, account.internal(0).address];
}

const addresses = async () => {
  let call = 0;
  let _accounts = await accounts();
  const names = await accountNames();
  // TODO: allow account by name (even when there aren't any transactions...)
  // if (_accounts && _accounts.length < names.length) _account = [..._accounts, ...await accounts(names.length)]
  if (_accounts) return _accounts.map((account, i) => [or(names[i], i), _addresses(account, i)]);
  return undefined;
}

const getMinerConfig = async () => {
  const data = await getConfig();
  if (!data.miner.address) {
    const _ = await addresses()
    data.miner.address = _[0][1][0];
    await setMinerConfig(data.miner)
  }
  return data.miner;
}

export const send = async ({from, to, amount, message}, response) => {
  // TODO:
  // const service = await mss({globalThis.ipfs, chain: chain.get()})
	// 	const wallet = new MultiWallet('leofcoin:olivia')
	// 	wallet.import(mwif)
	// 	const account = wallet.account(0)
	// 	const change = account.internal(0).address;
	// 	const pub = account.external(0);
  //   const address = pub.address;
  //   const olivia = {
  //   	payments: {
  //       version: 0,
  //       unspent: 0x1fa443d7 // ounsp
  //     }
  //   };
	// 	const buildAndBroadcast = service.build(olivia, { address }, change)
	// 	service.participate(olivia, pub);
	// 	buildAndBroadcast.unspent(to, amount)
  // TODO: implement multi-script-service

  // TODO: validate transaction
  // await state('ready', true)
  let value;
  try {
    let wallet = loadWallet();
    // account ...
    let _accounts = await accounts();
    const names = await accountNames();
    // TODO: cleanup wallet internal/external...
    // something like accounts: [{ name, internal: [internal(0), internal(1), ...]}]
    value = await buildTransaction(_accounts[names.indexOf(from[1])][0].external(0), to, parseInt(amount))

    const tx = await leofcoin.transaction.get(value.multihash)
    
    globalThis.ipfs.pubsub.publish('announce-transaction', JSON.stringify(value))
    tx.hash = value.multihash
    value = tx

  } catch (e) {
    throw e;
  }

  return value;
}

export const balance = getBalanceForAddress;

export const balanceAfter = getBalanceForAddressAfter;

const on = (ev, cb) => bus.on(ev, cb);

const emit = (ev, data) => bus.emit(ev, data);

export {network, on, emit, addresses, getMinerConfig, accounts}
