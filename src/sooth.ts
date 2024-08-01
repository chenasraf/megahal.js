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
  errorEvent: number
  contexts: SoothContext[] = []
  contextsSize = 0

  constructor(errorEvent = 0) {
    this.errorEvent = errorEvent
  }

  clear() {
    this.contexts = []
    this.contextsSize = 0
  }

  serializeStatistic(statistic: SoothStatistic): Buffer {
    const buffer = Buffer.alloc(8)
    buffer.writeInt32LE(statistic.event, 0)
    buffer.writeInt32LE(statistic.count, 4)
    return buffer
  }

  parseStatistic(buffer: Buffer, offset: number): SoothStatistic {
    const event = buffer.readInt32LE(offset)
    const count = buffer.readInt32LE(offset + 4)
    return { event, count }
  }

  save(filename: string): boolean {
    try {
      // Open file in write-binary mode
      const file = fs.openSync(filename, 'w')

      // Create a buffer for the initial header and predictor data
      const header = Buffer.from('MH11')
      const errorEventBuffer = Buffer.alloc(4)
      const contextsSizeBuffer = Buffer.alloc(4)

      errorEventBuffer.writeInt32LE(this.errorEvent, 0)
      contextsSizeBuffer.writeInt32LE(this.contextsSize, 0)

      // Write the header and predictor data to the file
      fs.writeSync(file, header)
      fs.writeSync(file, errorEventBuffer)
      fs.writeSync(file, contextsSizeBuffer)

      // Iterate over contexts and write each context's data
      for (let i = 0; i < this.contextsSize; ++i) {
        const context = this.contexts[i]
        const idBuffer = Buffer.alloc(4)
        const countBuffer = Buffer.alloc(4)
        const statisticsSizeBuffer = Buffer.alloc(4)

        idBuffer.writeInt32LE(context.id, 0)
        countBuffer.writeInt32LE(context.count, 0)
        statisticsSizeBuffer.writeInt32LE(context.statisticsSize, 0)

        // Write context's basic data to the file
        fs.writeSync(file, idBuffer)
        fs.writeSync(file, countBuffer)
        fs.writeSync(file, statisticsSizeBuffer)

        for (let j = 0; j < context.statisticsSize; j++) {
          const statisticBuffer = this.serializeStatistic(context.statistics[j])

          fs.writeSync(file, statisticBuffer)
        }
      }

      // Close the file
      fs.closeSync(file)

      return true
    } catch (error) {
      console.error('Error saving SoothPredictor:', error)
      return false
    }
  }
  load(filename: string): boolean {
    try {
      const fileBuffer = fs.readFileSync(filename)

      // Check the file size
      if (fileBuffer.length < 12) {
        return false
      }

      // Read and verify the code
      const code = fileBuffer.subarray(0, 4).toString()
      if (code !== 'MH11') {
        return false
      }

      this.clear()

      // Read error_event and contexts_size
      this.errorEvent = fileBuffer.readInt32LE(4)
      this.contextsSize = fileBuffer.readInt32LE(8)

      if (this.contextsSize === 0) {
        return true
      }

      let offset = 12
      this.contexts = new Array(this.contextsSize)

      for (let i = 0; i < this.contextsSize; ++i) {
        const id = fileBuffer.readInt32LE(offset)
        const count = fileBuffer.readInt32LE(offset + 4)
        const statisticsSize = fileBuffer.readInt32LE(offset + 8)
        offset += 12

        const statistics = new Array(statisticsSize)
        for (let j = 0; j < statisticsSize; ++j) {
          statistics[j] = this.parseStatistic(fileBuffer, offset)
          offset += 12 // Update based on the size of SoothStatistic
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

  findContext(id: number): SoothContext {
    let context: SoothContext | undefined
    let low = 0
    let mid = 0
    let high = this.contextsSize - 1

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

  findStatistic(context: SoothContext, event: number): SoothStatistic {
    let low = 0
    let high = context.statisticsSize - 1
    let mid = 0
    let statistic: SoothStatistic | null = null

    if (context.statisticsSize > 0) {
      while (low <= high) {
        mid = low + Math.floor((high - low) / 2)
        statistic = context.statistics[mid]
        if (statistic.event < event) {
          low = mid + 1
        } else if (statistic.event > event) {
          if (mid == 0) {
            break
          }
          high = mid - 1
        } else {
          return statistic
        }
      }

      mid = low
    }

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

  size(id: number) {
    const context = this.findContext(id)
    return context.statisticsSize
  }

  count(id: number) {
    const context = this.findContext(id)
    return context.count
  }

  observe(id: number, event: number) {
    const context = this.findContext(id)

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

  select(id: number, limit: number) {
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

  distribution(id: number) {
    const context = this.findContext(id)
    return context.statistics
  }

  uncertainty(id: number) {
    const context = this.findContext(id)
    let uncertainty = 0
    for (let i = 0; i < context.statisticsSize; i++) {
      if (context.statistics[i].count == 0) {
        const frequency = context.statistics[i].count / context.count
        uncertainty -= frequency * Math.log2(frequency)
      }
    }
    return uncertainty
  }

  surprise(id: number, event: number) {
    const context = this.findContext(id)
    if (context.count == 0) {
      return -1
    }

    const statistic = this.findStatistic(context, event)
    if (statistic.count == 0) {
      return -1
    }

    const frequency = statistic.count / context.count
    return -Math.log2(frequency)
  }

  frequency(id: number, event: number) {
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
