import * as api from './../api'
import {version} from './../../package.json'

export default {
  version: ({send}) => send({client: '@leofcoin/api/http', version}),
  setConfig: async (params, {send, error}) => {
    try {
      await api.setConfig(params)
      send('ok')
    } catch (e) {
      error(e)
    }
  },
  getConfig: async (params, {send, error}) => {
    try {
      const config = await api.getConfig(params)
      send(config)
    } catch (e) {
      error(e)
    }
  },
  setMinerConfig: async (params, {send, error}) => {
    try {
      await api.setMinerConfig(params)
      send('ok')
    } catch (e) {
      error(e)
    }
  },
  getMinerConfig: async ({send, error}) => {
    try {
      const config = await api.getMinerConfig()
      send(config)
    } catch (e) {
      error(e)
    }
  },
  wallet: async ({send}) => {
    const wallet = await walletStore.get()
    send(wallet)
  },
  addresses: async ({send, error}) => {
    try {
      const adresses = await api.addresses()
      send(adresses)
    } catch (e) {
      error(e)
    }
  },
  accountNames: async (params, {send, error}) => {
    try {
      const adresses = await api.accountNames(params.index)
      send(adresses)
    } catch (e) {
      error(e)
    }
  },
  accounts: async ({send}) => {
    const accounts = await accountStore.get()
    send(accounts)
  },
  account: async (params, {send}) => {
    const account = await accountStore.get(params)
    send(account)
  },
  balance: async (params, {send, error}) => {
    console.log('balance');
    try {
      console.log(await api.getBalanceForAddress(params.address));
      const value = await api.getBalanceForAddress(params.address)
      send(value)
    } catch (e) {
      console.log(e);
      error(e)
    }
  },  
  balanceAfter: async (params, {send, error}) => {
    try {
      const value = await api.getBalanceForAddressAfter(params.address, params.index)
      send(value)
    } catch (e) {
      error(e)
    }
  },
  mine: async (params, {send, error}) => {
    api.mine(params)
    send('ok')
  },
  lastBlock: async ({send, error}) => {
    try {
      const value = await api.lastBlock()
      send(value)
    } catch (e) {
      error(e)
    }
  }
}