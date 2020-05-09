export default class MessagePool {
  get pool() {
    return this._pool
  }
  constructor() {
    this._pool = []
  }
  
  add(multihash) {
    leofcoin.message.dag.get(multihash)
    this._pool.push(multihash)
    leofcoin.pin.add(multihash)
  }
  
  remove(multihash) {
    const index = this._pool.indexOf(multihash)
    this._pool.splice(index, 1)
    leofcoin.message.dag.remove(multihash)
  }
}