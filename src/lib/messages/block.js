import proto from './block.proto.js'
import protons from 'protons'

import FormatInterface from './../../node_modules/@leofcoin/peernet/dist/codec/codec-format-interface'


export default class LeofcoinBlockMessage extends FormatInterface {
  get keys() {
    return ['index', 'prevHash', 'time', 'transactions', 'nonce']
  }

  constructor(data) {
    const name = 'leofcoin-block'
    super(data, protons(proto).LeofcoinBlock, {name})
  }
}
