import Koa from 'koa'
import Router from '@koa/router'
import {version} from './../package.json'
import * as api from './api'

export default () => {
  const client = '@leofcoin/core/http'
  const app = new Koa();
  const router = new Router()
  
  router.get('/api/version/', ctx => {
    ctx.body = {client, version}
  })
  
  router.get('/api/config', ctx => {
    if (ctx.request.query.miner) ctx.body = api.getMinerConfig()
    else ctx.body = api.getConfig()
  })
  
  router.put('/api/config', ctx => {
    if (ctx.request.query === 'miner') api.setMinerConfig(ctx.request.query.miner)
    else api.setConfig(ctx.request.query.value)
  })
  
  router.put('/api/config/miner', ctx => {
    console.log(ctx.request.query, ctx.request.query.intensity);
    if (ctx.request.query.intensity) api.setMinerConfig({intensity: ctx.request.query.intensity})
    // else api.setConfig(ctx.request.query.value)
  })
  
  router.get('/api/mine', ctx => {
    api.mine(api.getMinerConfig())
  })
  
  app.use(router.routes())
  app.use(router.allowedMethods())
  
  app.listen(5050, () => console.log('api listening on 5050'))
}