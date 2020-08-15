import IpfsClientApi from './client/ipfs.js'
import ApiClientApi from './client/api.js'

export default class HttpClient {
  constructor(config = {}) {
    return (async () => {
      this.ipfs = await new IpfsClientApi({pubsub: globalThis.pubsub, port: 5051})
      globalThis.pubsub = globalThis.pubsub || {
        publish: this.ipfs.client.publish,
        subscribe: this.ipfs.client.subscribe,
        unsubscribe: this.ipfs.client.unsubscribe,
        subscribers: this.ipfs.client.subscribers
      }
      
      this.api = await new ApiClientApi({pubsub: globalThis.pubsub, port: 5050})
      
      return this
    })()
  }  
}