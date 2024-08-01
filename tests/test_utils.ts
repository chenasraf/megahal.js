export function retry(fn: () => unknown, retries = 3): unknown {
  let error: unknown
  for (let i = 0; i < retries; ++i) {
    try {
      console.log('retrying', i)
      return fn()
    } catch (err) {
      error = err
    }
  }
  throw error
}

export function retryWithCondition(
  fn: () => unknown,
  condition: (_result: unknown) => boolean,
  retries = 3,
): unknown {
  let error: unknown
  for (let i = 0; i < retries; ++i) {
    try {
      const res = fn()
      if (condition(res)) {
        return res
      }
      error = new Error(`Condition not met: ${res}`)
    } catch (err) {
      error = err
    }
  }
  throw error || new Error('Condition not met')
}
