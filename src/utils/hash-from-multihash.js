import CID from 'cids'

export default multihash => {
  const cid = new CID(multihash.replace('/ipfs/', ''))
  return cid.multihash.slice(cid.prefix.length - 3).toString('hex')
}