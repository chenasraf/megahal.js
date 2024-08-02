import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import MegaHAL from '../src/index'
import '@/personalities/sherlock'

describe('megahal', () => {
  let tmpDir: string
  jest.retryTimes(6, { logErrorsBeforeRetry: true })

  let megahal: MegaHAL

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'megahal'))
  })

  beforeEach(async () => {
    megahal = new MegaHAL()
  })

  describe('list', () => {
    it('returns an array of all personalities', () => {
      const ls = MegaHAL.list()
      expect(ls).toContain('sherlock')
      expect(ls).toContain('default')
    })
  })

  describe('clear', () => {
    it('should clear all internal state', () => {
      megahal = new MegaHAL()
      megahal.clear()
      megahal.reply('one two three four five')
      expect(megahal.mapLength(megahal.dictionary)).toBe(15)
      expect(megahal.mapLength(megahal.brain)).toBe(33)
      expect(megahal.seed.count(1)).toBeGreaterThan(0)
      expect(megahal.fore.count(0)).toBeGreaterThan(0)
      expect(megahal.back.count(0)).toBeGreaterThan(0)
      expect(megahal.case.count(13)).toBeGreaterThan(0)
      expect(megahal.punc.count(27)).toBeGreaterThan(0)

      megahal.clear()
      expect(megahal.mapLength(megahal.dictionary)).toBe(3)
      expect(megahal.mapLength(megahal.brain)).toBe(0)
      expect(megahal.seed.count(1)).toBe(0)
      expect(megahal.fore.count(0)).toBe(0)
      expect(megahal.back.count(0)).toBe(0)
      expect(megahal.case.count(13)).toBe(0)
      expect(megahal.punc.count(27)).toBe(0)
    })
  })

  describe('save', () => {
    it('should save the internal state', async () => {
      const tmpFile = path.join(tmpDir, 'megahal-save.zip')
      megahal.clear()
      megahal.reply('one two three four five')

      const state = await megahal.save(tmpFile)
      expect(state).toBe(true)

      megahal.clear()
      expect(megahal.reply('')).toBe('...')
      await megahal.load(tmpFile)

      expect(megahal.reply('')).toBe('one two three four five')
    })
  })

  describe('become', () => {
    it('switches to another personality', () => {
      expect(megahal.reply('holmes')).not.toMatch(/watson/i)
      megahal.become('sherlock')
      expect(megahal.reply('holmes')).toMatch(/watson/i)
    })
  })

  describe('reply', () => {
    it('swaps keywords', () => {
      expect(megahal.reply('why')).toMatch(/because/i)
    })
  })

  describe('train', () => {
    it('learns from a text file', async () => {
      const tmpFile = path.join(tmpDir, 'megahal-train.txt')
      await fs.writeFile(tmpFile, 'one two three four five')

      megahal.clear()
      expect(megahal.reply('')).toBe('...')
      await megahal.train(tmpFile)
      expect(megahal.reply('')).toBe('one two three four five')
    })
  })
})
