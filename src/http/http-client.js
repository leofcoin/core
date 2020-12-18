// import IpfsClientApi from './client/ipfs.js'
import ApiClientApi from './client/api.js'

export default class HttpClient {
  constructor(config = {}) {
    return (async () => {
      // this.ipfs = await new IpfsClientApi({pubsub: globalThis.pubsub, port: 5051})

      this.api = await new ApiClientApi({pubsub: globalThis.pubsub, port: 5050})
      this.api.client.pubsub.publish('ready', true)
      return this
    })()
  }
}
