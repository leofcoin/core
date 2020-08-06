import api from './api.js'
import ipfs from './ipfs.js'
import server from './../../node_modules/socket-request-server/src/index'

export default (config = {}) => {
  if (typeof config !== 'object') config = {}
  if (!config.protocol) config.protocol = 'ws'
  if (!config.port) config.port = 5050
  if (!config.host) config.host = '127.0.0.1'
    
  server({port: config.port, protocol: 'lfc-v0.1.0'}, api)
  
  server({port: Number(config.port) + 1, protocol: 'lfc-v0.1.0'}, ipfs)
}