import Hash from './../../../node_modules/@leofcoin/lib/src/hash';
import getDifficulty from '../../difficulty';

const hash = new Hash()

const hashes = nonce => {
	const hashrates = [10000];
	for (let i = hashrates.length; --i > 0;) {
		if (nonce % hashrates[i - 1] === 0) return hashrates[i - 1];
	}
	return hashrates.filter(hashrate => {
		if (nonce % hashrate === 0) return hashrate;
	});
};

export default (() => {
	process.on('message', async ({block, difficulty}) => {
  	const stop = () => resolve(null);
  	let hashCount = 0;
		// TODO: A block it's hash should be a multihash
		// and converted to normal hash whenever dev needs
		block.hash = await hash.blockHash(block);
		let hexHash = await hash.hashFromMultihash(block.hash)
  	while (getDifficulty(hexHash) >= difficulty) {
  		block.nonce += 1
  		block.hash = await hash.blockHash(block);
			hexHash = await hash.hashFromMultihash(block.hash)
  		hashCount = hashCount + Number(hashes(block.nonce));
  	}
  	process.send({ block, hashCount });
	});

})();
