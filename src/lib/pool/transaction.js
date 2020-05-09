export default class TransactionPool {
  get pool() {
    return this._pool
  }
  constructor() {
    this._pool = []
  }
  
  add(tx) {
    this._pool.push(tx)
  }
  
  remove(tx) {
    const index = this._pool.indexOf(tx)
    this._pool.splice(index, 1)
  }
}