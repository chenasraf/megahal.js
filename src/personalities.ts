import fs from 'node:fs'
import path from 'node:path'

const files = fs.readdirSync(path.resolve(process.cwd(), 'src', 'personalities'))
let loaded = false

export async function loadPersonalities() {
  if (loaded) return
  for (const file of files) {
    await import(`./personalities/${file}`)
  }
  loaded = true
}
