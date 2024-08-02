# megahal.js

This is a JavaScript implementation of the
[MegaHAL algorithm](https://en.wikipedia.org/wiki/MegaHAL), more specifically a direct, nearly
one-to-one port of [kranzky/megahal](https://github.com/kranzky/megahal). Major credits to kranzky,
without whom this wouldn't exist.

It is not currently usable as a CLI application, but you can embed it into your own Node.js code.

TypeScript types are provided within the package.

Training a personality is rather slow and may take a few seconds to complete. Anyone is more than
welcome to suggest any performance improvements, I am sure many can be made.

A [Sooth](https://rubygems.org/gems/sooth) stochastic predictive model is also implemented almost
one-to-one and may later be extracted into a separate package.

Both are licensed under the [Unlicense](./UNLICENSE) license, in the spirit of the original
packages. So basically, do whatever you want with it, but no warranty!

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

### Loading personalities

You can load all the default personalities at once, individually, or create your own personalities
instead. Only the `default` personality is loaded by default.

```typescript
// load all personalities
import 'megahal.js/personalities'

// load individual personalities
import 'megahal.js/personalities/starwars'

// load a custom personality
MegaHAL.addPersonality('name', [
  'line 1',
  'line 2',
  // ...
])
```

### Using MegaHAL

Create a new instance of MegaHAL, and provide the personality you would like to use, using the name.

> If you omit the personality name, `default` will be used, but you _have to ensure_ that you have
> loaded it through one of the methods mentioned above.

Use `.reply(line)` to get a response for a a given line of text, and also learn from that line in
the process.

You can use `.train(filename)` or `.train(lines)` to manually train the bot on the go.

```typescript
import { MegaHAL } from 'megahal.js'
import 'megahal.js/personalities/default'

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
