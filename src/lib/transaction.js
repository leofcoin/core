import { config, debug } from './../utils';
import { isValid } from './network/validate.js';
import { TransactionError } from './errors.js';
import { transactionInputHash, transactionHash } from './hash.js';
import { randomBytes } from 'crypto';
// import { getUnspentForAddress } from './dagchain/dagchain-interface';
import MultiWallet from '@leofcoin/multi-wallet';
import { network, consensusSubsidyInterval, reward } from '../params.js';
import * as ipldLfcTx from 'ipld-lfc-tx';

const { LFCTx, util } = ipldLfcTx
/**
 * validate transaction
 *
 * @param transaction
 * @param unspent
 */
export const validateTransaction = async (multihash, transaction, unspent) => {
	if (!transaction.reward) delete transaction.reward
	const outputs = transaction.outputs.map(o => {
		// TODO: fix script
		if (!o.script) delete o.script
		return o
	})
	transaction.outputs = outputs
	if (!transaction.script) delete transaction.script
	if (!isValid('transaction', transaction)) throw new TransactionError('Invalid transaction');
	if (multihash !== await transactionHash(transaction)) throw TransactionError('Invalid transaction hash');
	// TODO: versions should be handled here...
	// Verify each input signature
	
	if (transaction.inputs) {
		transaction.inputs.forEach(input => {
	  	const { signature, address } = input;
			const hash = transactionInputHash(input);

	  	let wallet = new MultiWallet(network);
	    wallet.fromAddress(address, null, network);
			
			if (!wallet.verify(Buffer.from(signature, 'hex'), Buffer.from(hash, 'hex')))
				throw TransactionError('Invalid input signature');
		});
	
		// Check if inputs are in unspent list
		transaction.inputs.forEach((input) => {
			if (!unspent.find(out => out.tx === input.tx && out.index === input.index)) { throw TransactionError('Input has been already spent: ' + input.tx); }
		});	
	}
	
	if (transaction.reward === 'mined') {
		// For reward transaction: check if reward output is correct
		if (transaction.outputs.length !== 1) throw TransactionError('Reward transaction must have exactly one output');
		if (transaction.outputs[0].amount !== reward) throw TransactionError(`Mining reward must be exactly: ${reward}`);
	} else if (transaction.inputs) {
		// For normal transaction: check if total output amount equals input amount
		if (transaction.inputs.reduce((acc, input) => acc + input.amount, 0) !==
      transaction.outputs.reduce((acc, output) => acc + output.amount, 0)) { throw TransactionError('Input and output amounts do not match'); }
	}

	return true;
};

/**
 * validate transactions list for current block
 *
 * @param {array} transactions
 * @param unspent
 */
export const validateTransactions = async (transactions, unspent) => {
	const _transactions = []
	for (const {multihash} of transactions) {
		const { value } = await global.ipfs.dag.get(multihash)
		const tx = new LFCTx(value)
		_transactions.push({multihash, value: tx.toJSON()})
		
	}
	for (const {value, multihash} of _transactions) {
		// TODO: fix value.scrip
		await validateTransaction(multihash, value, unspent)
	}
	
	if (_transactions.filter(({value}) => value.reward === 'mined').length !== 1)
		throw TransactionError('Transactions cannot have more than one reward')	
};

/**
 * Create transaction
 *
 * @param inputs
 * @param outputs
 * @param reward
 * @return {{id: string, reward: boolean, inputs: *, outputs: *, hash: string}}
 */
const newTransaction = async (inputs, outputs, reward = null) => {
	try {
		const tx = new LFCTx({
			id: randomBytes(32).toString('hex'),
			time: Math.floor(new Date().getTime() / 1000),
			reward,
			outputs,
			inputs
		});
		const cid = await util.cid(tx.serialize())
		debug(`create transaction: ${tx}`);
		await global.ipfs.dag.put(tx, {format: util.codec, hashAlg: util.defaultHashAlg, version: 1, baseFormat: 'base58btc'})
		return { multihash: cid.toBaseEncodedString(), size: tx.size};
	} catch (e) {
		throw e
	}
};

export const consensusSubsidy = height => {
	const quarterlings = height / consensusSubsidyInterval;
	if (quarterlings >= 256) {
		return 0;
	}
	//subsidy is lowered by 12.5 %, approx every year
	const minus = quarterlings >= 1 ? (quarterlings * (reward / 256)) : 0;
	return reward - minus;
};

/**
 * Create reward transaction for block mining
 *
 * @param {string} address
 * @return {id: string, reward: boolean, inputs: *, outputs: *, hash: string}
 */
export const createRewardTransaction = async (address, height) => {
	return newTransaction([], [{index: 0, amount: consensusSubsidy(height), address}], 'mined');
};

const verifySignature = (address, signature, hash) => {
	const wallet = new MultiWallet(network);
	return wallet.verify(signature, hash, address);
};

/**
 * Create and sign input
 *
 * @param transaction Based on transaction id
 * @param index Based on transaction output index
 * @param amount
 * @param wallet
 * @return {transaction, index, amount, address}
 */
const createInput = (tx, index, amount, wallet) => {
	const input = {
		tx,
		index,
		amount,
		address: wallet.address,
	};
	// TODO: show notification the tx got signed
	// Sign transactionHash
	input.signature = wallet.sign(Buffer.from(transactionInputHash(input), 'hex')).toString('hex');
	return input;
};

/**
 * Create a transaction
 *
 * @param wallet
 * @param toAddress
 * @param amount
 * @param unspent
 * @return {id, reward, inputs, outputs, hash,}
 */
export const buildTransaction = async (wallet, toAddress, amount) => {
	let inputsAmount = 0;
	const unspent = await getUnspentForAddress(wallet.address);
	const inputsRaw = unspent.filter(i => {
		const more = inputsAmount < amount;
		if (more) inputsAmount += i.amount;
		return more;
	});
	if (inputsAmount < amount) throw TransactionError('Not enough funds');
	// TODO: Add multiSigning
	const inputs = inputsRaw.map(i => createInput(i.tx, i.index, i.amount, wallet));
	// Send amount to destination address
	const outputs = [{index: 0, amount, address: toAddress}];
	// Send back change to my wallet
	if (inputsAmount - amount > 0) {
		outputs.push({index: 1, amount: inputsAmount - amount, address: wallet.address});
	}
	return newTransaction(inputs, outputs);
};
