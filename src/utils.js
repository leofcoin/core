import { configPath } from './params';
import bs58 from 'bs58';
import chalk from 'chalk';
import { readFile, writeFile } from 'fs'
import { promisify } from 'util'
const { encode } = bs58

const read = promisify(readFile)
const write = promisify(writeFile)


if (process.platform === 'win32') {
  const readLine = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readLine.on('SIGINT', () => {
    process.emit('SIGINT');
  });
};

export const debug = (text) => {
	if (process.env.DEBUG || process.argv.indexOf('--verbose') !== -1) {
    const stack = new Error().stack;
    const caller = stack.split('\n')[2].trim();
    console.groupCollapsed(chalk.blue(text));
    console.log(caller)
    console.groupEnd();
  };
};

export const log = text => {
  console.log(chalk.cyan(text));
}

export const succes = text => {
  console.log(chalk.green(text));
}

export const fail = text => {
  console.log(chalk.red(text));
}

export const groupCollapsed = (text, cb) => {
  console.groupCollapsed(chalk.gray.bold(text));
  cb();
  console.groupEnd();
}

export const textlog = async text => {
  let content = '';
  try {
    // content = await read('log');
  } catch (e) {
    console.log('creating new log file');
  }

  content += '\n';
  content += text;
  return
  // await write('log', content);
};

export const timeout = (ms = 1000, cb) => {
	setTimeout(() => {
		cb();
	}, ms);
};

export const interval = (cb, ms = 1000) => {
	setInterval(() => {
		cb();
	}, ms);
};

export const hashes = nonce => {
	const hashrates = [10, 100, 1000, 10000, 100000, 1000000, 1000000000, 1000000000000, 1000000000000000];
	for (let i = hashrates.length; i-- > 0;) {
		if (nonce % hashrates[i - 1] === 0) return hashrates[i - 1];
	}
	return hashrates.filter(hashrate => {
		if (nonce % hashrate === 0) return hashrate;
	});
};

let previousDate = Date.now();
let previousMinuteDate = Date.now();
let hashCount = 0;
let timeoutRunning = false;
let rates = []
export const hashLog = nonce => {
	if (typeof(hashes(nonce)) === 'number') {
		hashCount = hashCount + hashes(nonce);
	}
  const now = Date.now()
  // if (now - previousMinuteDate >= 60000) {
    // previousMinuteDate = now;
    // const middle = median(rates);
  if (now - previousDate >= 1000) {
    previousDate = now;
    rates[hashCount]
    hashCount = 0;
    return rates;
  }


};

export const config = {
	server: {
		port: 3030,
		host: 'localhost',
	},
	p2p: {
		port: 6001,
		peers: [],
	},
	reward: 150,
	peers: []
};

const defaultConfig = async () => {
  // const wallet = generateWallet();
  // TODO: prompt for password
  // bus.on('initial-setup', message => {
    // console.log(message);
  // bus.emit('initial', wallet.mnemonic);
  // })
  // await writeWallet(wallet.save());
  // const account = wallet.derive('m/0\'/0/0');
	return {
  	miner: {
  		// address: account.address,
  		intensity: 1
  	}
  }
};

export const getUserConfig = async () => {
	let config;
  try {
    config = await read(configPath)
    config = JSON.parse(config.toString())
  } catch (e) {
    config = await defaultConfig()
    await write(configPath, JSON.stringify(config))
    debug(`new config file created @${configPath}`);
  }
  return config
}

/**
 * allow retry upto "amount" times
 * @param {number} amount
 */
export const allowFailureUntillEnough = (func, amount = 5) => new Promise(async (resolve, reject) => {
  if (typeof func !== 'function') reject('function undefined');
  if (typeof amount !== 'number') reject(`Expected amount to be a typeof Number`);
  let count = 0;
  for (var i = 0; i < amount; i++) {
    try {
      await func();
      resolve();
    } catch (error) {
      if (amount === count) reject(error);
    }
  }
});

export { read }