import { join } from 'path';
import { homedir } from 'os';
import * as bs58 from 'bs58';
import coinTicker from 'coin-ticker';
import {median} from './utils';
import {hour} from './ms'
const { decode, encode } = bs58
const argv = process.argv;

export const networks = {
	'leofcoin': join(homedir(), '.leofcoin'),
	'olivia': join(homedir(), '.leofcoin/olivia')
};

export const network = (() => {
  const index = argv.indexOf('--network');
  return process.env.NETWORK || (index > -1) ? argv[index + 1] : 'olivia';
})()

export const fixIndex = argv.indexOf('fixIndex') !== -1 ? true : false;

export const genesis = (() => {
	if (argv.indexOf('genesis') !== -1) return true;
	if (argv.indexOf('init') !== -1) return true;
  return false;
})()

export const verbose = argv.indexOf('--verbose') !==  -1

if (verbose) {
  process.env.DEBUG = true;
}

export const olivia = process.argv.includes('olivia') || process.argv.includes('testnet');
export const AppData = join(homedir(), 'AppData', 'Roaming', olivia ? 'Leofcoin/olivia' : 'Leofcoin');
// const netHash = net => encode(keccak(Buffer.from(`${net}-`), 256)).slice(0, 24);
export const APPDATAPATH = (() => {
  switch (process.platform) {
    case 'win32':
      return join(homedir(), 'AppData', 'Roaming', 'Leofcoin', olivia ? 'olivia' : '')
      break;
    case 'linux':
      return join(homedir(), '.leofcoin', olivia ? 'olivia' : '')
      break;
    case 'darwin':
      // TODO: implement darwin path
      break;
    case 'android':
      // TODO: implement android path
      // experimental
      break;
  }
})();


// export const netPrefix = (async () => await dapnets('leofcoin').netPrefix)()

export const walletPath = join(APPDATAPATH, 'wallet.dat');

export const signalServers = (() => {
  if (network === 'olivia') return [
		// '/dns4/star.leofcoin.org/tcp/4003/wss/ipfs/QmbRqQkqqXbEH9y4jMg1XywAcwJCk4U8ZVaYZtjHdXKhpL',
		// '/dns4/star.leofcoin.org/tcp/4020/p2p/QmbRqQkqqXbEH9y4jMg1XywAcwJCk4U8ZVaYZtjHdXKhpL'
    ]
  else return [
		// '/dns4/star.leofcoin.org/tcp/4003/wss/ipfs/QmbRqQkqqXbEH9y4jMg1XywAcwJCk4U8ZVaYZtjHdXKhpL',
    // '/dns4/star.leofcoin.org/tcp/4020/p2p/QmbRqQkqqXbEH9y4jMg1XywAcwJCk4U8ZVaYZtjHdXKhpL'
    ]
})()

export const netKeys = {
  olivia: `/key/swarm/psk/1.0.0/
  /base16/
  b37e0b6f3574931ce7a0ef863f64b0f01ba111bb7fabb6a661fc67b51b4ddd15`,
  leofcoin: `/key/swarm/psk/1.0.0/
  /base16/
  0b78a0dcb430dd77311ab6629aa6b75fa05c6779a567dcc176b2299853e6f746`
}

export const netKey = netKeys[network];
export const networkPath = networks[network];
export const networkConfigPath = join(networkPath, 'config');
export const netKeyPath = join(networkPath, 'swarm.key');
export const localCurrent = join(networkPath, 'db', 'current');
export const localIndex = join(networkPath, 'db', 'index');
export const localDAGAddress = join(networkPath, 'db', 'dag.multiaddress');
// export const
// TODO: remove seed once we have a static ip for our ipfs daemon node
// untill seed is removed we retrieve the keys using socket.io
// TODO: make AppData overwriteable
export const seed = 'https://septimal-balinese-2547.dataplicity.io';
export const seeds = 'QmNeApjecrZezN8Hp24BbScuM1Y9f1Mgxbd9hBxfNoNrMP';
export const configPath = join(AppData, 'core.config');
export const reward = 150;
export const consensusSubsidyInterval = 52500;
export const consensusSubsidyPercentage = 12.5; // quarterlings
// export const genesisCID = '122045f96ab0a6c8a689eaec29eb71333294b985fb25b7409a938b6879702a38b659';
export const genesisLink = 'zsNS6wZiHUW66J9M1iZ6wnsWS7z52acyZTTWUFgoZPaWaAevd7EQg7u91zRKkoNBHsgH33XY6xPDSbcZJp4Rtfst5K863z';
export const genesisCID = 'zsNS6wZiHUW66J9M1iZ6wnsWS7z52acyZTTWUFgoZPaWaAevd7EQg7u91zRKkoNBHsgH33XY6xPDSbcZJp4Rtfst5K863z';
export const GENESISBS58 = 'EKBqhKsFG14thpzEKUbbb94WG9a1p9sm82YQ2YwK6wkme4C1df2dMwggnDgh74zZsBx2UbWi1qDQLysrrU3YKJ6V73sLtASepYieNpx8Fwjxyjh6xWNYToTNbNkp1geiSWq6fneGvn76H2cqMnq';
export const GENESISBLOCK = {
	index: 0,
  prevHash: Buffer.alloc(47).toString('hex'),
  time: 1581375185,
  transactions: [],
  nonce: 33336
};

export const checkpoints = [
];
/**
 * stablecoin support
 *
 * set to true for a pegged coin
 */
const pegged = true
const stable = {}
const exchanges = coinTicker()
globalThis.priceMap = new Map();
const getPairValue = async (pairs) => {
	const value = {}
		const prices = {}
	for (const exchange of exchanges) {
		try {
			for (const pair of pairs) {
				const result = await coinTicker(exchange, pair);
				prices[pair] = []
				if (result && result.last) {
				  prices[pair].push(1 / Number(result.last))
				} else {
					exchanges.splice(exchanges.indexOf(exchange))
				}	
			}
			
			
		} catch (e) {
		 exchanges.splice(exchanges.indexOf(exchange))
		}
		// stable.pairs.set('BTC', getValueFor('BTC'))
	}
	
	for (const key of Object.keys(prices)) {
		priceMap.set(key, median(prices[key]))
	}
	console.log(priceMap.entries());
	// const name = 
}

if (pegged) {
	stable.currency = 'EUR';
	stable.value = 1;	
	stable.pairs  = new Map();
	(async () => await getPairValue(['BTC_EUR', 'LTC_EUR', 'ETH_EUR']))();
	setInterval(async () => {
		const values = await getPairValue(['BTC_EUR', 'LTC_EUR', 'ETH_EUR'])
		// stable.pairs.set('BTC', getValueFor('BTC'))
	}, hour(1));
}




export default {
	seed,
	AppData,
	configPath,
	localCurrent,
	localIndex,
	reward,
	consensusSubsidyInterval,
	consensusSubsidyPercentage
};
