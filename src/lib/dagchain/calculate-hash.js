import ipldLfc from 'ipld-lfc';
import { hashFromMultihash } from './../../utils.js';
const { LFCNode, util } = ipldLfc
export default async block => {
  block = await new LFCNode(block);
  const cid = await util.cid(block.serialize())
  return hashFromMultihash(cid.toBaseEncodedString());
}
