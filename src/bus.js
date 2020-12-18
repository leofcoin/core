import PubSub from './../node_modules/@vandeurenglenn/little-pubsub/src/index.js'

globalThis.pubsub = globalThis.pubsub || new PubSub()
