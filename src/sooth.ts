import fs from 'node:fs'

export interface SoothContext {
  id: number
  count: number
  statisticsSize: number
  statistics: SoothStatistic[]
}

export interface SoothStatistic {
  event: number
  count: number
}

export class SoothPredictor {
  public errorEvent: number
  private contexts: SoothContext[] = []
  private contextsSize = 0

  constructor(errorEvent = 0) {
    this.errorEvent = errorEvent
  }

  /**
   * Clears all contexts.
   */
  public clear(): void {
    this.contexts = []
    this.contextsSize = 0
  }

  /**
   * Saves the predictor state to a file.
   */
  public save(filename: string): boolean {
    try {
      const file = fs.openSync(filename, 'w')

      // Write the header
      fs.writeSync(file, 'MH11')
      const buffer = Buffer.alloc(8)
      buffer.writeInt32LE(this.errorEvent, 0)
      buffer.writeInt32LE(this.contextsSize, 4)
      fs.writeSync(file, buffer)

      // Write each context
      for (let i = 0; i < this.contextsSize; i++) {
        const context = this.contexts[i]
        const contextBuffer = Buffer.alloc(12)
        contextBuffer.writeInt32LE(context.id, 0)
        contextBuffer.writeInt32LE(context.count, 4)
        contextBuffer.writeInt32LE(context.statisticsSize, 8)
        fs.writeSync(file, contextBuffer)

        // Write each statistic
        for (let j = 0; j < context.statisticsSize; j++) {
          const statisticBuffer = Buffer.alloc(8)
          statisticBuffer.writeInt32LE(context.statistics[j].event, 0)
          statisticBuffer.writeInt32LE(context.statistics[j].count, 4)
          fs.writeSync(file, statisticBuffer)
        }
      }

      fs.closeSync(file)
      return true
    } catch (error) {
      console.error('Error saving SoothPredictor:', error)
      return false
    }
  }

  /**
   * Loads the predictor state from a file.
   */
  public load(filename: string): boolean {
    try {
      const fileBuffer = fs.readFileSync(filename)

      // Verify the header
      if (fileBuffer.toString('utf8', 0, 4) !== 'MH11') {
        return false
      }

      this.clear()

      this.errorEvent = fileBuffer.readInt32LE(4)
      this.contextsSize = fileBuffer.readInt32LE(8)

      if (this.contextsSize === 0) {
        return true
      }

      let offset = 12
      this.contexts = new Array(this.contextsSize)

      for (let i = 0; i < this.contextsSize; i++) {
        const id = fileBuffer.readInt32LE(offset)
        const count = fileBuffer.readInt32LE(offset + 4)
        const statisticsSize = fileBuffer.readInt32LE(offset + 8)
        offset += 12

        const statistics = new Array(statisticsSize)
        for (let j = 0; j < statisticsSize; j++) {
          const event = fileBuffer.readInt32LE(offset)
          const count = fileBuffer.readInt32LE(offset + 4)
          statistics[j] = { event, count }
          offset += 8
        }

        this.contexts[i] = { id, count, statisticsSize, statistics }
      }

      return true
    } catch (error) {
      console.error('Error loading SoothPredictor:', error)
      this.clear()
      return false
    }
  }

  /**
   * Finds or creates a context for the given ID.
   */
  private findContext(id: number): SoothContext {
    let context: SoothContext | undefined
    let low = 0
    let mid = 0
    let high = this.contextsSize - 1

    // Binary search for the context
    if (this.contextsSize > 0) {
      while (low <= high) {
        mid = Math.floor(low + (high - low) / 2)
        context = this.contexts[mid]
        if (context.id < id) {
          low = mid + 1
        } else if (context.id > id) {
          if (mid === 0) {
            break
          }
          high = mid - 1
        } else {
          return context
        }
      }
      mid = low
    }

    // Create a new context if not found
    this.contextsSize += 1
    this.contexts.push({ id: -1, count: 0, statisticsSize: 0, statistics: [] })

    if (mid + 1 < this.contextsSize) {
      this.contexts.splice(mid + 1, 0, ...this.contexts.splice(mid, this.contextsSize - mid - 1))
    }

    context = {
      id,
      count: 0,
      statisticsSize: 0,
      statistics: [],
    }

    this.contexts[mid] = context

    return context
  }

  /**
   * Finds or creates a statistic for the given event within the context.
   */
  private findStatistic(context: SoothContext, event: number): SoothStatistic {
    let low = 0
    let high = context.statisticsSize - 1
    let mid = 0
    let statistic: SoothStatistic | null = null

    // Binary search for the statistic
    if (context.statisticsSize > 0) {
      while (low <= high) {
        mid = low + Math.floor((high - low) / 2)
        statistic = context.statistics[mid]
        if (statistic.event < event) {
          low = mid + 1
        } else if (statistic.event > event) {
          if (mid === 0) {
            break
          }
          high = mid - 1
        } else {
          return statistic
        }
      }

      mid = low
    }

    // Create a new statistic if not found
    context.statisticsSize += 1
    const newMemory = new Array<SoothStatistic>(context.statisticsSize)

    for (let i = 0; i < context.statisticsSize - 1; i++) {
      newMemory[i] = context.statistics[i]
    }

    context.statistics = newMemory

    if (mid + 1 < context.statisticsSize) {
      for (let i = context.statisticsSize - 1; i > mid; i--) {
        context.statistics[i] = context.statistics[i - 1]
      }
    }

    statistic = { event, count: 0 }
    context.statistics[mid] = statistic

    return statistic
  }

  /**
   * Returns the size of the statistics for the given context ID.
   */
  public size(id: number): number {
    const context = this.findContext(id)
    return context.statisticsSize
  }

  /**
   * Returns the count of observations for the given context ID.
   */
  public count(id: number): number {
    const context = this.findContext(id)
    return context.count
  }

  /**
   * Observes an event for the given context ID.
   */
  public observe(id: number, event: number): number {
    const context = this.findContext(id)

    // Handle overflow by halving the counts
    if (context.count === Number.MAX_SAFE_INTEGER) {
      context.count = 0
      for (let i = 0; i < context.statisticsSize; i++) {
        const statistic = context.statistics[i]
        statistic.count /= 2
        context.count += statistic.count
      }
    }

    const statistic = this.findStatistic(context, event)

    statistic.count += 1
    context.count += 1

    return statistic.count
  }

  /**
   * Selects an event based on the limit for the given context ID.
   */
  public select(id: number, limit: number): number {
    const context = this.findContext(id)
    if (limit === 0 || limit > context.count) {
      return this.errorEvent
    }

    for (let i = 0; i < context.statisticsSize; i++) {
      const statistic = context.statistics[i]
      if (limit > statistic.count) {
        limit -= statistic.count
        continue
      }
      return statistic.event
    }

    return this.errorEvent
  }

  /**
   * Returns the probability distribution of events for the given context ID.
   */
  public distribution(id: number): Record<number, number> | null {
    const context = this.findContext(id)
    if (!context.statisticsSize) return null

    const total = context.count
    return context.statistics.reduce(
      (acc, stat) => {
        acc[stat.event] = stat.count / total
        return acc
      },
      {} as Record<number, number>,
    )
  }

  /**
   * Returns the uncertainty (entropy) for the given context ID.
   */
  public uncertainty(id: number): number | null {
    const context = this.findContext(id)
    if (!context.statisticsSize) return null

    let uncertainty = 0
    for (let i = 0; i < context.statisticsSize; i++) {
      const frequency = context.statistics[i].count / context.count
      if (frequency > 0) {
        uncertainty -= frequency * Math.log2(frequency)
      }
    }

    return uncertainty
  }

  /**
   * Returns the surprise for the given event and context ID.
   */
  public surprise(id: number, event: number): number | null {
    const context = this.findContext(id)
    if (context.count === 0) {
      return null
    }

    const statistic = this.findStatistic(context, event)
    if (statistic.count === 0) {
      return null
    }

    const frequency = statistic.count / context.count
    const surpriseValue = -Math.log2(frequency)

    return Object.is(surpriseValue, -0) ? 0 : surpriseValue
  }

  /**
   * Returns the frequency of the given event for the context ID.
   */
  public frequency(id: number, event: number): number {
    const context = this.findContext(id)
    if (context.count == 0) {
      return 0
    }

    const statistic = this.findStatistic(context, event)
    if (statistic.count == 0) {
      return 0
    }

    return statistic.count / context.count
  }
}
