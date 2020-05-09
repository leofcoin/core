/**
 * Create message
 *
 * @param value - 
 * @param receiver - 
 * @return {{id: string, reward: boolean, inputs: *, outputs: *, hash: string}}
 */
const newMessage = async (value, receiver) => {
	try {
		const tx = new LFCMessage({
			id: randomBytes(32).toString('hex'),
			time: Math.floor(new Date().getTime() / 1000),
			prevHash,
			value,
			receiver
		});
		const cid = await util.cid(tx.serialize())
		debug(`create transaction: ${tx}`);
		await global.ipfs.dag.put(tx, {format: util.codec, hashAlg: util.defaultHashAlg, version: 1, baseFormat: 'base58btc'})
		return { multihash: cid.toBaseEncodedString(), size: tx.size};
	} catch (e) {
		throw e
	}
};