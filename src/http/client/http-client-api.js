// import fetch from 'node-fetch'
import Client from './../../../node_modules/socket-request-client/src/index.js'

export default class HttpClientApi {
  constructor(config) {
    if (!config.protocol) config.protocol = 'ws'
    if (!config.port) config.port = 5050
    if (!config.host) config.host = '127.0.0.1'
    if (!config.apiPath) config.apiPath = 'api'
    
    const address = `${config.protocol}://${config.host}:${config.port}/${config.apiPath}`
    
    this.apiUrl = url => `${address}/${url}`;
    return (async () => {
      this.client = await Client(address, 'lfc-v0.1.0', {pubsub: config.pubsub, retry: 3000})
      return this
    })()
  }
  
  async get (url, obj) {
    const headers = {}
    let body = null
    let method = 'GET'
    if (obj) {
      method = 'POST'
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(obj)
    }
    let response = await this.client.request(url, { headers, body, method })
    const type = response.headers.get('content-type').split(';')[0]
    if (type==='application/json') response = await response.json()
    return response
  }
  
  async put (url, obj) {
    const headers = {}
    let body = {}
    if (obj) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(obj)
    }
    
    let response = await fetch(this.apiUrl(url), { method: 'PUT', headers, body})
    const type = response.headers.get('content-type').split(';')[0]
    if (type==='application/json') response = await response.json()
    return response
  }
}
