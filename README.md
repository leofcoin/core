# core

[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
TODO: Put more badges here.

Leofcoin core (daemon, api and apiServer)

- 30 sec block times
- 30 sec timeout for miners (to give others a chance)

* note: blocktime/timeout could change in the future

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Install

### module
```sh
npm i --save @leafocin/core
```

### cli
```sh
npm i -g --save @leafocin/core
```

## Usage

### module
```js
import { core, api } from '@leofcoin/core'
```

### cli
```sh
leofcoin help
```

## Maintainers

[@vandeurenglenn](https://github.com/vandeurenglenn)

## Contributing

PRs accepted.

Small note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT © 2020 Vandeuren Glenn
