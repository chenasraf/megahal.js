import { Keywords } from './keywords'
import { SoothPredictor } from './sooth'
import { contextHash, notNull, zip } from './utils'
import JSZip from 'jszip'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

export class MegaHAL {
  /** Whether the model is in learning mode. */
  public learning: boolean

  /** The brain context. */
  public brain: Record<string, number>

  /** The dictionary of words to symbols. */
  public dictionary: Record<string, number>

  /** The list of used words in the last generated reply. */
  public usedWords: string[] = []

  public seed: SoothPredictor
  public fore: SoothPredictor
  public back: SoothPredictor
  public case: SoothPredictor
  public punc: SoothPredictor

  public static specialDictionaryTokens = ['<error>', '<fence>', '<blank>']

  constructor(personality?: string) {
    this.learning = true
    this.seed = new SoothPredictor(0)
    this.fore = new SoothPredictor(0)
    this.back = new SoothPredictor(0)
    this.case = new SoothPredictor(0)
    this.punc = new SoothPredictor(0)
    this.brain = {}
    this.dictionary = { '<error>': 0, '<fence>': 1, '<blank>': 2 }
    this.usedWords = []
    this.become(personality || 'default')
  }

  /**
   * Clears all predictors and dictionaries.
   */
  public clear(): void {
    this.brain = {}
    this.dictionary = { '<error>': 0, '<fence>': 1, '<blank>': 2 }
    this.usedWords = []
    this.seed.clear()
    this.fore.clear()
    this.back.clear()
    this.case.clear()
    this.punc.clear()
  }

  /**
   * Returns the length of a map object.
   */
  public mapLength(map: Record<string, unknown>): number {
    return Object.keys(map).length
  }

  /**
   * Trains the model using a file or an array of lines.
   */
  // eslint-disable-next-line no-unused-vars
  public async train(filename: string): Promise<void>
  // eslint-disable-next-line no-unused-vars
  public async train(lines: string[]): Promise<void>
  public async train(linesOrFilename: string[] | string): Promise<void> {
    if (typeof linesOrFilename === 'string') {
      const buff = await fs.readFile(linesOrFilename)
      const lines = buff.toString().split('\n')
      this._train(lines)
    } else if (Array.isArray(linesOrFilename)) {
      this._train(linesOrFilename)
    }
  }

  /**
   * Internal training method to process and learn from data lines.
   */
  private _train(data: string[]): void {
    data = data.map((x) => x.trim()).filter(Boolean)
    for (const line of data) {
      const [puncs, norms, words] = this._decompose(line)
      this._learn(puncs ?? [], norms ?? [], words ?? [])
    }
  }

  private static personalities: Record<string, string[]> = {}

  /**
   * Adds a new personality with the given name and data.
   */
  public static addPersonality(name: string, data: string[]): void {
    if (this.personalities[name]) {
      return
    }
    this.personalities[name] = data
  }

  /**
   * Lists all available personalities.
   */
  public static list(): string[] {
    return Object.keys(this.personalities)
  }

  /**
   * Saves the current state to a file.
   */
  public async save(filename: string): Promise<boolean> {
    try {
      const zip = new JSZip()
      const data = {
        version: 'MH11',
        learning: this.learning,
        brain: this.brain,
        dictionary: this.dictionary,
      }
      zip.file('dictionary', JSON.stringify(data))
      for (const name of ['seed', 'fore', 'back', 'case', 'punc'] as const) {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'megahal'))
        const tmpFile = path.join(tmp, name)
        this[name].save(tmpFile)
        const content = await fs.readFile(tmpFile)
        zip.file(name, content)
      }

      const res = await zip.generateAsync({ type: 'uint8array' })
      await fs.writeFile(filename, res)
      return true
    } catch (e) {
      console.error(e)
      return false
    }
  }

  /**
   * Loads the state from a file.
   */
  public async load(filename: string): Promise<void> {
    const zip = new JSZip()
    const data = await fs.readFile(filename)
    const loaded = await zip.loadAsync(data)
    const dict: {
      version: string
      learning: boolean
      brain: Record<string, number>
      dictionary: Record<string, number>
    } = await zip
      .file('dictionary')
      ?.async('string')
      .then((x) => JSON.parse(x))

    this.learning = dict.learning
    this.brain = dict.brain
    this.dictionary = dict.dictionary

    for (const name of ['seed', 'fore', 'back', 'case', 'punc'] as const) {
      const content = await loaded.file(name)?.async('uint8array')
      if (!content) {
        throw new Error('Missing file')
      }
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'megahal'))
      const tmpFile = path.join(tmp, name)
      await fs.writeFile(tmpFile, content)
      this[name].load(tmpFile)
    }
  }

  /**
   * Changes the current personality and clears previous state.
   */
  public become(name = 'default'): void {
    if (!MegaHAL.personalities[name]) {
      throw new Error('No such personality')
    }
    this.clear()
    this._train(MegaHAL.personalities[name])
  }

  /**
   * Retrieves or creates a brain context.
   */
  private _getBrain(context: number[]): number {
    return (this.brain[contextHash(context)] ??= this.mapLength(this.brain))
  }

  /**
   * Generates a reply for the given input string.
   */
  public reply(input: string, error = '...'): string {
    this.usedWords = []
    const [puncs, norms, words] = this._decompose(input?.trim())

    const kwSymbols = [...Keywords.extract(norms)].map((kw) => this.dictionary[kw!]).filter(notNull)
    const inputSymbols = (norms ?? []).map((norm) => this.dictionary[norm])

    let utterances: (number[] | null)[] = []
    for (let i = 0; i < 9; i++) {
      utterances.push(this._generate(kwSymbols))
    }
    utterances.push(this._generate([]))

    // Filter out exact matches and null values
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
    }
    utterances = utterances.filter(notNull)

    if (reply) {
      this.usedWords.push(...this._symbolsToStrings(kwSymbols))
    }

    if (this.learning && norms) {
      this._learn(puncs!, norms, words!)
    }

    return reply || error
  }

  /**
   * Learns from punctuation, normalized, and word symbols.
   */
  private _learn(puncs: string[], norms: string[], words: string[]): void {
    if (!words.length) return

    const puncSyms = puncs.map((p) => (this.dictionary[p] ||= this.mapLength(this.dictionary)))
    const normSyms = norms.map((n) => (this.dictionary[n] ||= this.mapLength(this.dictionary)))
    const wordSyms = words.map((w) => (this.dictionary[w] ||= this.mapLength(this.dictionary)))

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

  /**
   * Selects the best utterance based on keyword symbols.
   */
  private _selectUtterance(utterances: (number[] | null)[], kwSymbols: number[]): number[] | null {
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

  /**
   * Calculates the score of an utterance based on keyword symbols.
   */
  private _calculateScore(utterance: number[] | null, kwSymbols: number[]): number {
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

  /**
   * Generates an utterance based on keyword symbols.
   */
  private _generate(kwSymbols: number[]): number[] | null {
    const result = this._getResult(kwSymbols)
    return !result?.length ? null : result
  }

  /**
   * Gets a result based on keyword symbols.
   */
  private _getResult(kwSymbols: number[]): number[] | null {
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

  /**
   * Selects a keyword from the keyword symbols.
   */
  private _selectKeyword(kwSymbols: number[]): number | undefined {
    const aux = Keywords.AUXILIARY.map((a) => this.dictionary[a])
    const syms = kwSymbols.filter((s) => !aux.includes(s))
    return syms[Math.floor(Math.random() * syms.length)]
  }

  /**
   * Performs a random walk to generate symbols based on the model.
   */
  private _randomWalk(
    model: SoothPredictor,
    staticContext: number[],
    kwSymbols: number[],
  ): number[] {
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

  /**
   * Decomposes a line of text into punctuation, normalized, and word symbols.
   */
  private _decompose(
    line: string | undefined | null,
    maxLen = 1024,
  ): [string[] | null, string[] | null, string[] | null] {
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

  /**
   * Segments a line of text into punctuation and words.
   */
  private _segment(line: string): [string[], string[]] {
    let sequence = this._characterSegmentation(line) ? line.split(/(\w)/) : line.split(/(\w+)/)

    if (/\w+/.test(sequence[sequence.length - 1])) {
      sequence.push('')
    }

    if (/\w+/.test(sequence[0])) {
      sequence.unshift('')
    }

    // Combine hyphenated words
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

  /**
   * Rewrites a sequence of normalized symbols into a sentence.
   */
  private _rewrite(normSymbols: number[]): string | null {
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

  private _symbolsToStrings(symbols: number[]): string[] {
    return symbols.map((s) => Object.keys(this.dictionary).find((k) => this.dictionary[k] === s)!)
  }

  /**
   * Checks if a line requires character segmentation.
   */
  private _characterSegmentation(_line: string): boolean {
    // TODO implement more languages
    return false
  }
}
