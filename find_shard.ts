import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const totalShards = 16
const targetShard = 9

function getShardId(path: string, total: number) {
  const hash = createHash('sha1').update(path).digest('hex')
  const decimal = parseInt(hash.slice(0, 8), 16)
  return (decimal % total) + 1
}

const files = readFileSync('test_files.txt', 'utf-8').split('\n').filter(Boolean)

for (const file of files) {
  // Vitest sharding uses relative path starting with /
  const normalizedPath = file.startsWith('/') ? file : '/' + file
  if (getShardId(normalizedPath, totalShards) === targetShard) {
    console.log(file)
  }
}
