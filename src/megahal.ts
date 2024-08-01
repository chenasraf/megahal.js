import { Keywords } from './keywords'
import { loadPersonalities } from './personalities'
import { SoothPredictor } from './sooth'
import { contextHash, notNull, zip } from './utils'

export class MegaHAL {
  learning = true
  seed = new SoothPredictor()
  fore = new SoothPredictor()
  back = new SoothPredictor()
  case = new SoothPredictor()
  punc = new SoothPredictor()
  brain: Record<string, number> = {}

  dictionary: Record<string, number> = { '<error>': 0, '<fence>': 1, '<blank>': 2 }

  constructor() {
    loadPersonalities().then(() => {
      this.become('default')
    })
  }

  clear() {
    this.seed.clear()
    this.fore.clear()
    this.back.clear()
    this.case.clear()
    this.punc.clear()
    this.dictionary = { '<error>': 0, '<fence>': 1, '<blank>': 2 }
    this.brain = {}
  }

  mapLen(map: Record<string, unknown>): number {
    return Object.keys(map).length
  }

  _train(data: string[], _bar: unknown = null) {
    data = data.map((x) => x.trim())
    for (const line of data) {
      const [puncs, norms, words] = this._decompose(line)
      this._learn(puncs ?? [], norms ?? [], words ?? [])
    }
  }

  static personalities: Record<string, string[]> = {}

  static addPersonality(name: string, data: string[]) {
    if (MegaHAL.personalities[name]) {
      return
    }
    this.personalities[name] = data
  }

  static list() {
    return Object.keys(this.personalities)
  }

  become(name = 'default', _bar: unknown = null) {
    if (!MegaHAL.personalities[name]) {
      throw new Error('No such personality')
    }
    this.clear()
    this._train(MegaHAL.personalities[name])
  }

  _getBrain(context: number[]) {
    return (this.brain[contextHash(context)] ??= this.mapLen(this.brain))
  }

  reply(input: string, error = '...') {
    const [puncs, norms, words] = this._decompose(input?.trim())

    const kwSymbols = [...Keywords.extract(norms)].map((kw) => this.dictionary[kw!]).filter(notNull)
    const inputSymbols = (norms ?? []).map((norm) => this.dictionary[norm])

    let utterances: (number[] | null)[] = []
    for (let i = 0; i < 9; i++) {
      utterances.push(this._generate(kwSymbols))
    }
    utterances.push(this._generate([]))

    utterances = utterances.filter((u) => inputSymbols.join(',') !== u?.join(',')).filter(notNull)

    let reply: string | null = null

    while (reply == null && utterances.length > 0) {
      let utterance: number[] | null = null
      utterance = this._selectUtterance(utterances, kwSymbols)
      if (!utterance) {
        break
      }
      reply = this._rewrite(utterance)
      utterances.splice(utterances.indexOf(utterance), 1)
      utterances = utterances.filter(notNull)
    }

    if (this.learning && norms) {
      this._learn(puncs!, norms, words!)
    }

    return reply || error
  }

  _learn(puncs: string[], norms: string[], words: string[]) {
    if (!words.length) return

    const puncSyms = puncs.map((p) => (this.dictionary[p] ||= this.mapLen(this.dictionary)))
    const normSyms = norms.map((n) => (this.dictionary[n] ||= this.mapLen(this.dictionary)))
    const wordSyms = words.map((w) => (this.dictionary[w] ||= this.mapLen(this.dictionary)))

    let context: [number, number]
    let prev = 1

    // Seed
    for (const norm of normSyms.concat([1])) {
      context = [prev, 2]
      let id = this._getBrain(context)
      this.seed.observe(id, norm)
      context = [2, norm]
      id = this._getBrain(context)
      this.seed.observe(id, prev)
      prev = norm
    }

    // Fore
    context = [1, 1]
    for (const norm of normSyms) {
      const id = this._getBrain(context)
      this.fore.observe(id, norm)
      context.push(norm)
      context.shift()
    }
    let id = this._getBrain(context)
    this.fore.observe(id, 1)

    // Back
    context = [1, 1]
    for (const norm of [...normSyms].reverse()) {
      id = this._getBrain(context)
      this.back.observe(id, norm)
      context.push(norm)
      context.shift()
    }
    id = this._getBrain(context)
    this.back.observe(id, 1)

    // Case
    context = [1, 1]
    for (const [word, norm] of zip(wordSyms, normSyms)) {
      context[1] = norm!
      id = this._getBrain(context)
      this.case.observe(id, word!)
      context[0] = word!
    }

    // Punc
    context = [1, 1]
    for (const [punc, word] of zip(puncSyms, wordSyms.concat([1]))) {
      context.push(word!)
      context.shift()
      id = this._getBrain(context)
      this.punc.observe(id, punc!)
    }
  }

  _selectUtterance(utterances: (number[] | null)[], kwSymbols: number[]) {
    let bestScore = -1
    let bestUtterance: number[] | null = null
    for (const utterance of utterances) {
      const score = this._calculateScore(utterance, kwSymbols)
      if (score <= bestScore) {
        continue
      }
      bestScore = score
      bestUtterance = utterance
    }

    return bestUtterance
  }

  _calculateScore(utterance: number[] | null, kwSymbols: number[]): number {
    let score = 0
    let context = [1, 1]
    if (!utterance) return 0
    for (const norm of utterance) {
      if (kwSymbols.includes(norm)) {
        const id = this._getBrain(context)
        const surprise = this.fore.surprise(id, norm)
        if (surprise != null) {
          score += surprise
        }
      }
      context.push(norm)
      context.shift()
    }

    context = [1, 1]

    const utteranceReverse = [...utterance].reverse()
    for (const norm of utteranceReverse) {
      if (kwSymbols.includes(norm)) {
        const id = this._getBrain(context)
        const surprise = this.fore.surprise(id, norm)
        if (surprise != null) {
          score += surprise
        }
      }
      context.push(norm)
      context.shift()
    }

    if (utterance.length >= 8) {
      score /= Math.sqrt(utterance.length - 1)
    }
    if (utterance.length >= 16) {
      score /= utterance.length
    }

    return score
  }

  _generate(kwSymbols: number[]) {
    const result = this._getResult(kwSymbols)
    return !result?.length ? null : result
  }

  _getResult(kwSymbols: number[]) {
    const keyword = this._selectKeyword(kwSymbols)
    if (keyword) {
      const contexts = [
        [2, keyword],
        [keyword, 2],
      ].map((context) => {
        let id = this._getBrain(context)
        const count = this.seed.count(id)
        if (count > 0) {
          id = this._getBrain(context)
          const limit = this.seed.count(id)
          context[context.indexOf(2)] = this.seed.select(id, limit)
          return context
        }
        return null
      })

      const contextsShuffled = contexts.filter(notNull)
      contextsShuffled.sort(() => Math.random() - Math.random())
      const context = contextsShuffled[0]
      if (!context) return null
      const glue = context.filter((s) => s !== 1)
      return this._randomWalk(this.back, [...context].reverse(), kwSymbols)
        .reverse()
        .concat(glue)
        .concat(this._randomWalk(this.fore, context, kwSymbols))
    }

    const context = [1, 1]
    return this._randomWalk(this.fore, context, kwSymbols)
  }

  _selectKeyword(kwSymbols: number[]) {
    const aux = Keywords.AUXILIARY.map((a) => this.dictionary[a])
    const syms = kwSymbols.filter((s) => !aux.includes(s))
    return syms[Math.floor(Math.random() * syms.length)]
  }

  _randomWalk(model: SoothPredictor, staticContext: number[], kwSymbols: number[]): number[] {
    const context = [...staticContext]
    const results: number[] = []
    let id = this._getBrain(context)
    if (model.count(id) === 0) {
      return []
    }
    let localKws = [...kwSymbols]
    while (true) {
      let symbol = 0
      for (let i = 0; i < 10; i++) {
        id = this._getBrain(context)
        const limit = Math.floor(Math.random() * model.count(id)) + 1
        symbol = model.select(id, limit)
        if (localKws.includes(symbol)) {
          localKws = localKws.filter((s) => s !== symbol)
          break
        }
      }

      if (symbol === 0) return []
      if (symbol === 1) break
      results.push(symbol)
      context.push(symbol)
      context.shift()
    }

    return results
  }

  _decompose(line: string | undefined | null, maxLen = 1024) {
    if (!line) return [null, null, null]

    if (line.length > maxLen) {
      line = ''
    }

    if (!line.length) {
      return [[], [], []]
    }

    const [puncs, words] = this._segment(line)
    const norms = words.map((word) => word.toUpperCase())

    return [puncs, norms, words]
  }

  _segment(line: string) {
    let sequence = this._characterSegmentation(line) ? line.split(/(\w)/) : line.split(/(\w+)/)

    if (/\w+/.test(sequence[sequence.length - 1])) {
      sequence.push('')
    }

    if (/\w+/.test(sequence[0])) {
      sequence.unshift('')
    }

    while (true) {
      const index = sequence.slice(1, -1).findIndex((item) => /^['-]$/.test(item))
      if (index === -1) break

      sequence[index + 1] = sequence.slice(index, index + 3).join('')
      sequence[index] = ''
      sequence[index + 2] = ''
      sequence = sequence.filter((item) => item !== '')
    }

    const separators: string[] = []
    const words: string[] = []

    sequence.forEach((symbol, index) => {
      if (index % 2 === 0) {
        separators.push(symbol)
      } else {
        words.push(symbol)
      }
    })

    return [separators, words]
  }

  _rewrite(normSymbols: number[]): string | null {
    const decode: Record<number, string> = Object.fromEntries(
      Object.entries(this.dictionary).map((x) => x.reverse()),
    )

    let wordSymbols: number[] = []
    let context = [1, 1]
    let i = 0
    let retries = 0

    while (wordSymbols.length != normSymbols.length) {
      if (retries > 9) return null
      let failed = false
      context[0] = i == 0 ? 1 : wordSymbols[i - 1]
      context[1] = normSymbols[i]
      let id = this._getBrain(context)
      const count = this.case.count(id)
      if (!(failed = count == 0)) {
        const limit = Math.floor(Math.random() * count) + 1
        wordSymbols.push(this.case.select(id, limit))
      }

      if (wordSymbols.length == normSymbols.length) {
        context[0] = wordSymbols[wordSymbols.length - 1]
        context[1] = 1
        id = this._getBrain(context)
        failed = this.punc.count(id) == 0
      }
      if (failed) {
        retries += 1
        wordSymbols = []
        i = 0
        continue
      }
      i += 1
    }

    const puncSymbols: number[] = []
    context = [1, 1]
    for (const word of wordSymbols.concat([1])) {
      context.push(word)
      context.shift()
      const id = this._getBrain(context)
      const limit = Math.floor(Math.random() * this.punc.count(id)) + 1
      puncSymbols.push(this.punc.select(id, limit))
    }

    return zip(puncSymbols, wordSymbols)
      .flat()
      .map((x) => decode[x as number])
      .join('')
  }

  _characterSegmentation(_line: string) {
    // TODO implement more languages
    return false
  }
}
