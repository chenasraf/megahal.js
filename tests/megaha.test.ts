import MegaHAL from '@/index'

describe('megahal', () => {
  const megahal = new MegaHAL()

  describe('clear', () => {
    it('should clear all internal state', () => {
      console.log('TEST START')
      megahal.clear()
      // prettier-ignore
      // megahal.dictionary = { '<error>': 0, '<fence>': 1, '<blank>': 2, ONE: 3, TWO: 4, THREE: 5, FOUR: 6, FIVE: 7, }
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
})
