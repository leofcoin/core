import HttpClientApi from './http-client-api.js'

export default class extends HttpClientApi {
  constructor(config = {}) {
    config.apiPath = 'api';
    return (async () => {
      await super(config)
      
      this.properties = {
        wallet: 'get',
        version: 'get',
        addresses: 'get',
        config: 'get',
        account: 'get',
        accounts: 'get',
        transaction: 'any',
        transactions: 'get',
        block: 'get',
        blocks: 'get'   
      }
      this.keys = Object.keys(this.properties)
      return this
    })()
    
  }
  
  async request(url, data) {
    return await this.client.request({url, params: data})
  }  
  
  async ready() {
    return await this.request('ready')
  }
  
  async version() {
    return await this.request('version')
  }
  
  async wallet() {
    return await this.request('wallet')
  }
  
  async accounts() {
    return await this.request('accounts')
  }
  
  async account(index) {
    return await this.request('account', {index})
  }
  
  async accountNames(index) {
    return await this.request('accountNames', {index})
  }
  
  async balanceAfter (address, index) {    
    return await this.request('balanceAfter', {address, index})
  }
  
  async balance(address) {
    console.log('balance');
    return this.request('balance', {address})
  }
  
  async mine(config) {
    if (typeof config !== 'object') config = undefined
    return await this.request('mine', config)
  }
  
  async addresses() {
    return await this.request('addresses')
  }
  
  async transactions() {
    return await this.request('transactions')
  }
  
  async transaction(hash) {
    return await this.request('transaction', {hash})
  }
  
  async blocks() {
    return await this.request('blocks')
  }
  
  async block() {
    return await this.request('block', {index})
  }
  
  async config() {
    return {
      get: () => {},
      put: () => {}
    }
  }
  
  async getMinerConfig() {
    return await this.request('getMinerConfig')
  }
  
  async setMinerConfig(config) {
    return await this.request('setMinerConfig', config)
  }
  
  async lastBlock() {
    return await this.request('lastBlock')
  }
}