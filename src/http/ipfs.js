import {dependencies} from './../../node_modules/lfc-api/package.json'

const version = dependencies.ipfs.replace('^', '');

export default {
  version: ({send}) => send({client: '@leofcoin/ipfs/http', version}),
  addFromFs: async (params, {send, error}) => {    
    try {
      if (!globalThis.globSource) {
        GLOBSOURCE_IMPORT
      }
      const files = []
      const glob = await globSource(params.path, {recursive: true})
      for await (const file of ipfs.addAll(glob)) {
        files.push(file)
      }
      
      send(files.map(file => {
        file.cid = file.cid.toString()
        return file
      }))
    } catch (e) {
      error(e)
    }
  },
  block: async (params, {send, error}) => {
    try {
      let value
      if (params.put) value = await ipfs.block.put(params.path, params.options)
      else value = await ipfs.block.get(params.path, params.options);
      
      send(value)
    } catch (e) {
      error(e)
    }
  },
  swarmPeers: async ({error, send}) => {
    try {
      const value = await ipfs.swarm.peers()
      console.log(value);
      send(value)
    } catch (e) {
      console.log(e);
      error(e)
    }
  },
  swarmConnect: async({error, send}) => {
    try {
      const value = await ipfs.swarm.connect()
      send(value)
    } catch (e) {
      error(e)
    }
  },
  'key.list': async ({send, error}) => {
    try {
      const value = await ipfs.key.list()
      send(value)
    } catch (e) {
      error(e)
    }
  },
  'key.gen': async (params, {send, error}) => {
    try {
      const value = await ipfs.key.gen(params)
      send(value)
    } catch (e) {
      error(e)
    }
  },
  'pin.add': async (params, {send, error}) => {
    try {
      const value = await ipfs.pin.add(params)
      send(value)
    } catch (e) {
      error(e)
    }
  },
  'dag': async (params, {send, error}) => {
    try {
      const { dag, format, hashAlg, mode } = params
      let value = params.value
      
      if (mode==='put') value = await ipfs.dag.put(value, {format, hashAlg})
      else value = await ipfs.dag.get(value);
      
      send(value)
    } catch (e) {
      error(e)
    }
  },
  'dag.tree': async (params, {send, error}) => {
    try {
      const { path, hash } = params
      const value = await ipfs.dag.tree(hash, path)
      send(value)
    } catch (e) {
      error(e)
    }
  },
  'name.resolve': async (params, {error, send}) => {
    try {
      const value = await ipfs.name.resolve(params)
      send(value)
    } catch (e) {
      error(e)
    }
  },
  'name.publish': async (params, {error, send}) => {
    try {
      const value = await ipfs.name.publish(params)
      send(value)
    } catch (e) {
      error(e)
    }
  }
}