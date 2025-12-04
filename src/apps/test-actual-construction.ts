import { Script, Utils } from '@bsv/sdk'

// Replicate our actual token script construction
console.log('=== Replicating actual token script construction ===\n')

const lockingKey = '02bab8e5984fd25618e2350fd4df8371c9afd90a7745d25751d52a519e31084eca'
const tokenId = 'a15a336cd7581b2a7424c53c68b678c7a2e89beb64d6df3e3ee18e410d5f404f'
const amountBuffer = [12, 0, 0, 0, 0, 0, 0, 0]
const ownerKey = '03b1b8a7dd0231e0bde4f1adf8f5fe54db8c0bc7647d95d62a6d66d5900d6da077'
const metadata = {name: "123", symbol: "123", decimals: 0, totalSupply: 12, description: "123"}

const script = new Script()

// Push locking key (33 bytes)
script.writeBin(Utils.toArray(lockingKey, 'hex'))
console.log('After locking key:')
console.log(`  Hex: ${script.toHex()}`)
console.log(`  Chunks: ${script.chunks.length}`)

// OP_DROP (0x75)
script.writeOpCode(117)
console.log('After first OP_DROP:')
console.log(`  Hex: ${script.toHex()}`)
console.log(`  Chunks: ${script.chunks.length}`)

// Push protocol
script.writeBin(Utils.toArray('TOKEN', 'utf8'))
console.log('After TOKEN:')
console.log(`  Hex (last 20): ...${script.toHex().slice(-20)}`)
console.log(`  Chunks: ${script.chunks.length}`)

// Push tokenId
script.writeBin(Utils.toArray(tokenId, 'hex'))

// Push amount
script.writeBin(amountBuffer)

// Push owner key
script.writeBin(Utils.toArray(ownerKey, 'hex'))

// Push metadata
script.writeBin(Utils.toArray(JSON.stringify(metadata), 'utf8'))

console.log('\nBefore final OP_DROP:')
console.log(`  Hex (last 40): ...${script.toHex().slice(-40)}`)
console.log(`  Chunks: ${script.chunks.length}`)

// OP_DROP (0x75)
script.writeOpCode(117)

console.log('\nAfter final OP_DROP:')
const finalHex = script.toHex()
console.log(`  Hex (last 40): ...${finalHex.slice(-40)}`)
console.log(`  Full length: ${finalHex.length / 2} bytes`)
console.log(`  Chunks: ${script.chunks.length}`)

console.log('\nFinal chunks:')
script.chunks.forEach((c, i) => {
  const dataPreview = c.data ? `${c.data.length}b: ${Utils.toHex(c.data).slice(0, 20)}...` : 'null'
  console.log(`  ${i}: op=${c.op} (0x${c.op.toString(16)}), data=${dataPreview}`)
})

console.log(`\n=== Comparing to actual transaction ===`)
const actualHex = '2102bab8e5984fd25618e2350fd4df8371c9afd90a7745d25751d52a519e31084eca7505544f4b454e20a15a336cd7581b2a7424c53c68b678c7a2e89beb64d6df3e3ee18e410d5f404f080c000000000000002103b1b8a7dd0231e0bde4f1adf8f5fe54db8c0bc7647d95d62a6d66d5900d6da0774c4f7b226e616d65223a22313233222c2273796d626f6c223a22313233222c22646563696d616c73223a302c22746f74616c537570706c79223a31322c226465736372697074696f6e223a22313233227d0175'

console.log(`Generated hex (last 10): ...${finalHex.slice(-10)}`)
console.log(`Actual hex (last 10):    ...${actualHex.slice(-10)}`)
console.log(`Match: ${finalHex === actualHex}`)
