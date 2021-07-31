const readFileSync = require('fs').readFileSync;
const npmPackage = readFileSync('package.json', 'utf8');
const { version, name } = JSON.parse(npmPackage);
const production = Boolean(process.argv[2] === 'production');
const json = require('rollup-plugin-json');
import modify from 'rollup-plugin-modify';
import resolve from '@rollup/plugin-node-resolve'
import cmjs from '@rollup/plugin-commonjs'

export default [
	// ES module version, for modern browsers


	{
		input: ['src/lib/workers/miner-worker.js'],
		output: {
			dir: 'dist/module',
			format: 'es',
			sourcemap: true,
			intro: `const ENVIRONMENT = {version: '${version}', production: true};`,
			banner: `/* ${name} version ${version} */`,
			footer: '/* follow Leofcoin on Twitter! @leofcoin */'
		},
		plugins:[json()]
	},

	// CommonJS version, for Node, Browserify & Webpack
	{
		input: ['src/core.js'],
		output: {
			dir: 'dist/commonjs',
			format: 'cjs',
			sourcemap: true,
			intro: `const ENVIRONMENT = {version: '${version}', production: true};\nlet QRCode;\nlet Ipfs;`,
			banner: `/* ${name} version ${version} */`,
			footer: '/* follow Leofcoin on Twitter! @leofcoin */'
		},
		plugins:[
			json(),
			modify({
		    STORAGE_IMPORT: `new Promise((resolve, reject) => {
		      if (!LeofcoinStorage) LeofcoinStorage = require('@leofcoin/storage');
		      resolve()
		    });`,
	      QRCODE_IMPORT: `if (!QRCode) QRCode = require('qrcode');`,
	      IPFS_IMPORT: `new Promise((resolve, reject) => {
	        if (!Ipfs) Ipfs = require('ipfs');
	        resolve()
	      })`,
				FETCH_IMPORT: `const fetch = require('node-fetch')`
			})
		]
		// plugins: [
		// 	uglify()
		// ],
	}, {
		input: ['src/core.js'],
		output: {
			dir: 'dist/browser',
			format: 'cjs',
			sourcemap: true,
			intro: `const ENVIRONMENT = {version: '${version}', production: true};\nlet QRCode;\nlet Ipfs;`,
			banner: `/* ${name} version ${version} */`,
			footer: '/* follow Leofcoin on Twitter! @leofcoin */'
		},
		plugins:[
			json(),
			modify({
		    STORAGE_IMPORT: `new Promise((resolve, reject) => {
		      if (!LeofcoinStorage) LeofcoinStorage = require('@leofcoin/storage');
		      resolve()
		    });`,
	      QRCODE_IMPORT: `if (!QRCode) QRCode = require('qrcode');`,
	      IPFS_IMPORT: `new Promise((resolve, reject) => {
	        if (!Ipfs) Ipfs = require('ipfs');
	        resolve()
	      })`,
				"import fetch from 'node-fetch'": ''
			})
		]
	},
	{
		input: ['src/lib/workers/miner-worker.js'],
		output: {
			dir: 'dist/commonjs',
			format: 'cjs',
			sourcemap: false,
			intro: `const ENVIRONMENT = {version: '${version}', production: true};`,
			banner: `/* ${name} version ${version} */`,
			footer: '/* follow Leofcoin on Twitter! @leofcoin */'
		},
		plugins:[json()],
	},
	{
		input: ['src/core.js', 'src/bus.js'],
		output: {
			dir: 'dist/module',
			format: 'es',
			sourcemap: false,
			intro: `const ENVIRONMENT = {version: '${version}', production: true};`,
			banner: `/* ${name} version ${version} */`,
			footer: '/* follow Leofcoin on Twitter! @leofcoin */'
		},
		plugins:[
			json(),
			modify({
				"import fetch from 'node-fetch'": ``
			})
		],
	},
	{
		input: ['src/http/http-client.js'],
		output: {
			dir: 'dist/module',
			format: 'es',
			sourcemap: false,
			intro: `const ENVIRONMENT = {version: '${version}', production: true};`,
			banner: `/* ${name} version ${version} */`,
			footer: '/* follow Leofcoin on Twitter! @leofcoin */'
		},
		plugins:[
			json(),
			resolve(),
			cmjs()
		],
	}
];
