# megahal.js

[MegaHAL](https://en.wikipedia.org/wiki/MegaHAL) is a simple, learning chatterbot.

This is a JavaScript implementation of the MegaHAL algorithm, more specifically a direct, nearly
one-to-one port of [kranzky/megahal](https://github.com/kranzky/megahal). Major credits to kranzky,
without whom this wouldn't exist.

## Features & Caveats

- TypeScript types are provided within the package.

- A [Sooth](https://rubygems.org/gems/sooth) stochastic predictive model is also implemented almost
  one-to-one and may later be extracted into a separate package.

- Both are licensed under the [Unlicense](./UNLICENSE) license, in the spirit of the original
  packages. So basically, do whatever you want with it, but no warranty!

- Training a personality is rather slow and may take a few seconds to complete. Anyone is more than
  welcome to suggest any performance improvements, I am sure many can be made.

- It is not currently usable as a CLI application, but you can embed it into your own Node.js code.

## Installation

Use your favorite package manager:

```sh
pnpm install megahal.js
```

```sh
yarn add megahal.js
```

```sh
npm install megahal.js
```

## Usage

To start you must import the main class from the module.

```typescript
import MegaHAL from 'megahal.js'
```

### Using MegaHAL

Create a new instance of MegaHAL, and provide the personality you would like to use, using the name.

> If you omit the personality name, `default` will be used.

Use `.reply(line)` to get a response for a a given line of text, and also learn from that line in
the process.

You can use `.train(filename)` or `.train(lines)` to manually train the bot on the go.

```typescript
import { MegaHAL } from 'megahal.js'

const bot = new MegaHAL('default')

const input = 'hello!'
const message = bot.reply(input)
```

### Loading personalities

MegaHAL comes with several personalities pre-loaded. You can list them using `MegaHAL.list()`.

To add a custom personality, use the `addPersonality` method.

To switch personalities on an existing instance, use the `become` method.

```typescript
// list all personalities

console.log(MegaHAL.list())

// load a custom personality
MegaHAL.addPersonality('name', [
  'line 1',
  'line 2',
  // ...
])

// switch personality on-the-fly
import { MegaHAL } from 'megahal.js'
const bot = new MegaHAL('default')
bot.become('sherlock')
```

### Continuous learning

You can save & load your continuous learning to a file, at your discretion so do it as often as you
feel appropriate.

```typescript
import { MegaHAL } from 'megahal.js'

const bot = new MegaHAL('default')

// save bot:
await bot.save('/path/to/file.zip')

// load bot at a later time:
await bot.load('/path/to/file.zip')
```
