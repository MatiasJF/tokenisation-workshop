import { Script, Utils } from '@bsv/sdk'

// Test different ways to construct a PushDrop script with OP_DROP

console.log('\n=== Method 1: Script.fromBinary with raw bytes ===')
const lockingKey = '02bab8e5984fd25618e2350fd4df8371c9afd90a7745d25751d52a519e31084eca'
const protocol = 'TOKEN'
const tokenId = 'a15a336cd7581b2a7424c53c68b678c7a2e89beb64d6df3e3ee18e410d5f404f'
const amount = [12, 0, 0, 0, 0, 0, 0, 0]

// Build script manually using writeBuffer/writeBin
const script = new Script()

// Push locking key (33 bytes)
script.writeBin(Utils.toArray(lockingKey, 'hex'))

// OP_DROP (0x75)
script.writeOpCode(117) // 117 = 0x75 = OP_DROP

// Push protocol
script.writeBin(Utils.toArray(protocol, 'utf8'))

// Push tokenId
script.writeBin(Utils.toArray(tokenId, 'hex'))

// Push amount
script.writeBin(amount)

// Push owner key
script.writeBin(Utils.toArray(lockingKey, 'hex'))

// Push metadata
script.writeBin(Utils.toArray(JSON.stringify({ name: 'test' }), 'utf8'))

// OP_DROP (0x75)
script.writeOpCode(117)

const hex = script.toHex()
console.log('Script hex:', hex)
console.log('Script length:', hex.length / 2, 'bytes')

// Check for OP_DROP (0x75)
const dropIndices: number[] = []
for (let i = 0; i < hex.length; i += 2) {
  if (hex.slice(i, i + 2) === '75') {
    dropIndices.push(i / 2)
  }
}
console.log('Found 0x75 at byte positions:', dropIndices)
