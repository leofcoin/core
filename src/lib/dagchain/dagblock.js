import { validateTransactions, createRewardTransaction } from './../transaction';
import { getDifficulty, hashFromMultihash } from './../../utils';
import { isValid } from './../network/validate.js';
import { BlockError } from '../errors';
import calculateHash from  './calculate-hash';


class DAGBlock {
	constructor(ipfs, options) {
    if (!ipfs) return console.warn('options and ipfs expected');

		this.ipfs = ipfs

		// if (typeof options === 'object' && !Buffer.isBuffer(options)) this.newBlock(options);
		// else this.get(options);
	}

	/**
	 * Create new block
	 *
	 * @param transactions {array}
	 * @param previousBlock {object}
	 * @param address {string}
	 * @return {index, prevHash, time, transactions, nonce}
	 */
	async newBlock({transactions = [], previousBlock, address}) {
		const index = previousBlock.index + 1
		const minedTx = await createRewardTransaction(address, index)
		transactions.push(minedTx);
		this.data = {
			index,
			prevHash: previousBlock.hash,
			time: Math.floor(new Date().getTime() / 1000),
			transactions,
			nonce: 0
		};
		this.data.hash = await calculateHash(this.data);
		return this.data;
	}
	transformBlock({data, size}, cid) {
	  data = JSON.parse(data.toString());
    data.size = size;
	  return data;
	};
  // TODO: split into header and block
  /**
   * get header only
   */
  async getHeader(hash) {
    this.node = await this.ipfs.dag.get(hash)
    return this.node.value;
  }
  /**
   * get block only
   */
  async getBlock() {

  }

  /**
   * combines getHeader & getBlock
   */
	async get(multihash) {
		this.node = await this.ipfs.dag.get(multihash);
		this.data = JSON.parse(this.node.value.data.toString());
		this.data.hash = hashFromMultihash(multihash);
    return this.data;
	}
}

/**
 * validate block
 *
 * @param {object} previousBlock
 * @param {object} block
 * @param {number} difficulty
 * @param {number} unspent
 */
const validate = async (previousBlock, block, difficulty, unspent) => {
	console.log(previousBlock.hash, block.prevHash);
	console.log(previousBlock, block);
	// console.log(await calculateHash(), block.hash);
	console.log(isValid('block', block));
	if (!isValid('block', block)) throw BlockError('data');
	// console.log(block, previousBlock);
	if (previousBlock.index + 1 !== block.index) throw BlockError('index');
	if (previousBlock.hash !== block.prevHash) throw BlockError('prevhash');
	if (await calculateHash(block) !== block.hash) throw BlockError('hash');
	if (getDifficulty(block.hash) > difficulty) throw BlockError('difficulty');
	return validateTransactions(block.transactions, unspent);
};

export {
  DAGBlock,
  validate
};
