import MultiWallet from 'multi-wallet';
import { readFile, writeFile } from 'fs';
import { network, networkConfigPath, walletPath } from '../params';
import { debug } from './../utils'
import {promisify} from 'util'

const write = promisify(writeFile)
const read = promisify(readFile)

globalThis.leofcoin = globalThis.leofcoin || {}
// TODO: encrypt
export const writeWallet = async multiWIF => {
	await write(walletPath, JSON.stringify(multiWIF))
};

export const readWallet = async () => {
	const wallet = await read(walletPath);
	return JSON.parse(wallet.toString())
}

export const generateWallet = async () => {
	console.log(`Generating wallet for network ${network}`);
  const config = await read(networkConfigPath, 'json');
  // console.log(config.Identity.PrivKey);
  // console.warn('wallet encrypted using your peer privatKey');
  // TODO: encrypt the wallet
  // TODO: update network param, support <net> & <net>:<purpose> scheme
	let wallet = new MultiWallet(network === 'olivia' ? 'leofcoin:olivia' : 'leofcoin');
	const mnemonic = wallet.generate();
  const account = wallet.account(0);
  wallet = {
    mnemonic,
    multiWIF: wallet.export(),
    accounts: ['main account', account.external(0).address]
  }
  await writeWallet(wallet);
	return wallet;
};

export const accountTree = () => {
  const { accounts } = discoverAccounts();
}

export const _discoverAccounts = async (account, depth = 0) => {
  const accounts = [];
  const discover = async (account, depth) => {
    const external = account.external(depth);
    const internal = account.internal(depth);
    const tx = [];
    accounts.push(account);
    for (const { transactions } of global.chain) {
      if (accounts[external.address] || accounts[internal.address]) return;
			for (let transaction of transactions) {
				const {multihash} = transaction
				let inputs
				let outputs
				
				if (multihash) {
					transaction = await leofcoin.transaction.get(multihash)
				}
				if (tx[internal.address] || tx[external.address]) return;
				if (transaction.inputs) transaction.inputs.forEach((i) => {
					if (i.address === internal.address) return tx.push(internal.address);
					if (i.address === external.address) return tx.push(external.address);
				})
				if (transaction.outputs) transaction.outputs.forEach((o) => {
					if (o.address === internal.address) return tx.push(internal.address);
					if (o.address === external.address) return tx.push(external.address);
				})	
			}
    }
    // discover untill we find no transactions for given address
    if (tx.length > 0) return discover(account, depth + 1);
    return accounts;
  }

  return discover(account, 0);

}

/**
 * @param {object} root Instance of MultiWallet
 */
export const discoverAccounts = async (root) => {
  let accounts = [];
  /**
   * @param {number} depth account depth
   */
  const discover = async depth => {
		const tx = [];
		
			debug('discovering accounts')
    const account = root.account(depth);
    const _accounts = await _discoverAccounts(account);
    accounts = [...accounts, _accounts];
		
		debug('done discovering accounts')
		if (_accounts.length > 1) return discover(depth + 1);
    return accounts;
  }

  return discover(0);

}

export const discoverAccountsByName = (root, depth) => {
	debug('discovering accounts by name')
  const accounts = [];
  /**
   * @param {number} depth account depth
   */
  const discover = depth => {
		const tx = []
    const account = root.derive(`m/${depth}\'/0/0`);
		accounts.push(account);
    if (call < depth) return discover(depth)
    return accounts;
  }
	debug('finished discovering accounts by name')
  return discover(depth);

}

export const loadAccounts = wallet => {
	debug('loading accounts')
  const accounts = discoverAccounts(wallet);
	debug('finished loading accounts')
  return accounts;
}

export const loadWallet = async () => {
	debug('loading wallet')
  try {
    const saved = await readWallet();
    // TODO: update network param, support <net> & <net>:<purpose> scheme
    const root = new MultiWallet(network === 'olivia' ? 'leofcoin:olivia' : 'leofcoin');
    // TODO: https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Account_discovery @AndrewVanardennen @vandeurenglenn
    // last account is without tx
    // disallow account creation when previous account has no tx
    root.import(saved.multiWIF);
		debug('done loading wallet')
    return root;
  } catch (e) {
    throw e;
  }
}
