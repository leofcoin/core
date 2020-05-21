#!/usr/bin/env node
const {core, api} = require('./../dist/commonjs/core.js');
const fetch = require('node-fetch');

const args = process.argv.slice(2, process.argv.length);


(async () => {
  let response
  try {
    response = await fetch('http://localhost:5050/api/version')
    response = await response.json()
  } catch (e) {
    
  }
  console.log(response);
  for (const action of args) {
    if (action === 'mine') {
      if (!response) core();
      await fetch('http://localhost:5050/api/mine')
      // api.mine(api.getMinerConfig())
    } else if (action === 'run') {
      if (!response) core({network: 'leofcoin'})
    } else if (action === '--intensity') {
      if (!response) core({network: 'leofcoin'})
      const value = args[args.indexOf('--intensity') + 1]
      await fetch('http://localhost:5050/api/config/miner?intensity=' + value, {method: 'put'})
    }
  }

})()