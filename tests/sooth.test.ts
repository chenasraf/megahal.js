import { SoothPredictor } from '../src/sooth' // Adjust the import according to your file structure
import fs from 'node:fs/promises'

describe('SoothPredictor', () => {
  const errorEvent = 42
  let predictor: SoothPredictor
  beforeEach(() => {
    predictor = new SoothPredictor(errorEvent)
  })

  describe('observe', () => {
    it('increments counts', () => {
      expect(predictor.observe(1, 3)).toBe(1)
      expect(predictor.observe(1, 3)).toBe(2)
      expect(predictor.observe(1, 3)).toBe(3)
    })

    it('sorts and finds contexts', () => {
      expect(predictor.observe(2, 3)).toBe(1)
      expect(predictor.observe(1, 2)).toBe(1)
      expect(predictor.observe(3, 1)).toBe(1)
      expect(predictor.observe(1, 2)).toBe(2)
      expect(predictor.observe(2, 3)).toBe(2)
      expect(predictor.observe(3, 1)).toBe(2)
    })
  })

  describe('count', () => {
    it('returns zero for an unobserved context', () => {
      expect(predictor.count(1)).toBe(0)
    })

    it('returns the number of observations', () => {
      predictor.observe(1, 2)
      predictor.observe(1, 1)
      predictor.observe(1, 4)
      predictor.observe(1, 3)
      predictor.observe(1, 0)
      predictor.observe(1, 1)
      predictor.observe(1, 4)
      expect(predictor.count(1)).toBe(7)
    })
  })

  describe('size', () => {
    it('returns zero for an unobserved context', () => {
      expect(predictor.size(1)).toBe(0)
    })

    it('returns the number of distinct events', () => {
      predictor.observe(1, 2)
      predictor.observe(1, 1)
      predictor.observe(1, 4)
      predictor.observe(1, 3)
      predictor.observe(1, 0)
      predictor.observe(1, 1)
      predictor.observe(1, 4)
      expect(predictor.size(1)).toBe(5)
    })
  })

  describe('select', () => {
    it('returns the error event for an unobserved context', () => {
      expect(predictor.select(1, 1)).toBe(errorEvent)
    })

    it('returns the correct event for an observed context', () => {
      predictor.observe(1, 4)
      predictor.observe(1, 3)
      predictor.observe(1, 4)
      predictor.observe(1, 5)
      expect(predictor.select(1, 1)).toBe(3)
      expect(predictor.select(1, 2)).toBe(4)
      expect(predictor.select(1, 3)).toBe(4)
      expect(predictor.select(1, 4)).toBe(5)
    })

    it('returns the error event for a limit that is out of range', () => {
      predictor.observe(1, 4)
      predictor.observe(1, 3)
      predictor.observe(1, 5)
      expect(predictor.select(1, 0)).toBe(errorEvent)
      expect(predictor.select(1, 4)).toBe(errorEvent)
    })

    it('selects the correct event with many contexts', () => {
      predictor.observe(2, 4)
      predictor.observe(1, 5)
      predictor.observe(3, 6)
      predictor.observe(1, 7)
      predictor.observe(2, 8)
      predictor.observe(3, 9)
      predictor.observe(1, 1)
      predictor.observe(2, 2)
      predictor.observe(3, 3)
      expect(predictor.select(2, 0)).toBe(errorEvent)
      expect(predictor.select(2, 1)).toBe(2)
      expect(predictor.select(2, 2)).toBe(4)
      expect(predictor.select(2, 3)).toBe(8)
      expect(predictor.select(2, 4)).toBe(errorEvent)
      expect(predictor.select(1, 0)).toBe(errorEvent)
      expect(predictor.select(1, 1)).toBe(1)
      expect(predictor.select(1, 2)).toBe(5)
      expect(predictor.select(1, 3)).toBe(7)
      expect(predictor.select(1, 4)).toBe(errorEvent)
      expect(predictor.select(3, 0)).toBe(errorEvent)
      expect(predictor.select(3, 1)).toBe(3)
      expect(predictor.select(3, 2)).toBe(6)
      expect(predictor.select(3, 3)).toBe(9)
      expect(predictor.select(3, 4)).toBe(errorEvent)
    })
  })

  describe('clear', () => {
    it('resets to a blank slate', () => {
      expect(predictor.observe(1, 3)).toBe(1)
      expect(predictor.observe(1, 3)).toBe(2)
      expect(predictor.observe(1, 3)).toBe(3)
      predictor.clear()
      expect(predictor.observe(1, 3)).toBe(1)
      expect(predictor.observe(1, 3)).toBe(2)
      expect(predictor.observe(1, 3)).toBe(3)
    })
  })

  describe('save and load', () => {
    it('can save a file and load it back again', async () => {
      const filePath = './sooth_spec.tmp'

      try {
        expect(predictor.observe(1, 3)).toBe(1)
        expect(predictor.observe(2, 3)).toBe(1)
        expect(predictor.observe(1, 3)).toBe(2)
        expect(predictor.observe(1, 3)).toBe(3)
        expect(() => predictor.save(filePath)).not.toThrow()
        expect(predictor.count(1)).toBe(3)
        expect(predictor.count(2)).toBe(1)
        predictor.clear()
        expect(predictor.count(1)).toBe(0)
        expect(predictor.count(2)).toBe(0)
        expect(() => predictor.load(filePath)).not.toThrow()
        expect(predictor.count(1)).toBe(3)
        expect(predictor.count(2)).toBe(1)
        expect(predictor.observe(1, 3)).toBe(4)
        expect(predictor.observe(1, 1)).toBe(1)
        expect(predictor.observe(2, 3)).toBe(2)
        expect(predictor.observe(2, 1)).toBe(1)
      } finally {
        await fs.unlink(filePath)
      }
    })
  })

  describe('distribution', () => {
    it('has no distribution for a new context', () => {
      expect(predictor.distribution(1)).toBeNull()
      expect(predictor.count(1)).toBe(0)
      expect(predictor.uncertainty(1)).toBeNull()
    })

    it('has a correct probability distribution', () => {
      predictor.observe(1, 4)
      predictor.observe(1, 2)
      predictor.observe(1, 4)
      predictor.observe(1, 3)
      const dist = predictor.distribution(1)!
      expect(dist[1]).toBeUndefined()
      expect(dist[2]).toBe(0.25)
      expect(dist[3]).toBe(0.25)
      expect(dist[4]).toBe(0.5)
    })
  })

  describe('uncertainty', () => {
    it('has no uncertainty for a new context', () => {
      expect(predictor.uncertainty(1)).toBeNull()
      expect(predictor.count(1)).toBe(0)
      expect(predictor.uncertainty(1)).toBeNull()
    })

    it('has zero uncertainty for a lone context', () => {
      predictor.observe(1, 3)
      expect(predictor.uncertainty(1)).toBe(0)
    })

    it('has maximal uncertainty for a uniform distribution', () => {
      for (let i = 1; i <= 256; i++) {
        predictor.observe(1, i)
      }
      expect(predictor.uncertainty(1)).toBe(8)
    })
  })

  describe('surprise', () => {
    it('has no surprise for a new context', () => {
      expect(predictor.surprise(1, 3)).toBeNull()
    })

    it('has no surprise for a new event', () => {
      predictor.observe(1, 3)
      expect(predictor.surprise(1, 4)).toBeNull()
    })

    it('has zero surprise for a lone event', () => {
      predictor.observe(1, 3)
      expect(predictor.surprise(1, 3)).toBe(0)
    })

    it('has uniform surprise for a uniform distribution', () => {
      for (let i = 1; i <= 256; i++) {
        predictor.observe(1, i)
      }
      expect(predictor.surprise(1, 3)).toBe(8)
    })
  })

  describe('frequency', () => {
    it('returns zero for a new context', () => {
      expect(predictor.frequency(1, 3)).toBe(0)
    })

    it('returns zero for a new event', () => {
      predictor.observe(1, 3)
      expect(predictor.frequency(1, 4)).toBe(0)
    })

    it('is one for a lone event', () => {
      predictor.observe(1, 3)
      expect(predictor.frequency(1, 3)).toBe(1)
    })

    it('is uniform for a uniform distribution', () => {
      for (let i = 1; i <= 100; i++) {
        predictor.observe(1, i)
      }
      expect(predictor.frequency(1, 3)).toBe(0.01)
    })
  })
})
