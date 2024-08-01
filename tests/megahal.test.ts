import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import MegaHAL from '@/index'

describe('megahal', () => {
  jest.retryTimes(3)
  let megahal: MegaHAL

  beforeEach(async () => {
    megahal = new MegaHAL()
    await megahal.init()
  })

  describe('clear', () => {
    it('should clear all internal state', () => {
      megahal = new MegaHAL()
      megahal.clear()
      megahal.reply('one two three four five')
      expect(megahal.mapLen(megahal.dictionary)).toBe(15)
      expect(megahal.mapLen(megahal.brain)).toBe(33)
      expect(megahal.seed.count(1)).toBeGreaterThan(0)
      expect(megahal.fore.count(0)).toBeGreaterThan(0)
      expect(megahal.back.count(0)).toBeGreaterThan(0)
      expect(megahal.case.count(13)).toBeGreaterThan(0)
      expect(megahal.punc.count(27)).toBeGreaterThan(0)

      megahal.clear()
      expect(megahal.mapLen(megahal.dictionary)).toBe(3)
      expect(megahal.mapLen(megahal.brain)).toBe(0)
      expect(megahal.seed.count(1)).toBe(0)
      expect(megahal.fore.count(0)).toBe(0)
      expect(megahal.back.count(0)).toBe(0)
      expect(megahal.case.count(13)).toBe(0)
      expect(megahal.punc.count(27)).toBe(0)
    })
  })

  describe('save', () => {
    it('should save the internal state', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'megahal'))
      const tmpFile = path.join(tmpDir, 'megahal.zip')
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
})