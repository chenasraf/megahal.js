export const notNull = (x: unknown) => x != null

export const contextHash = (context: number[]) => {
  return context.map((e) => (e == null ? 'null' : e)).join(';')
}

export function zip<T>(...arrays: T[][]): (T | undefined)[][] {
  const maxLength = Math.max(...arrays.map((arr) => arr.length))

  const result: (T | undefined)[][] = []

  for (let i = 0; i < maxLength; i++) {
    const row: (T | undefined)[] = arrays.map((arr) => arr[i])
    result.push(row)
  }

  return result
}
