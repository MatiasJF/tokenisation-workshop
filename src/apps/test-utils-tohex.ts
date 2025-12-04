import { Utils, Script } from '@bsv/sdk'

console.log('=== Testing Utils.toHex() with different inputs ===\n')

// Test 1: Array of numbers
const arr1 = [0x02, 0xba, 0xb8, 0xe5]
console.log('Test 1: number[]')
console.log(`  Input: [${arr1.slice(0, 4).join(', ')}]`)
try {
  const hex1 = Utils.toHex(arr1)
  console.log(`  Output: ${hex1}`)
} catch (e: any) {
  console.log(`  Error: ${e.message}`)
}

// Test 2: Uint8Array
const arr2 = new Uint8Array([0x02, 0xba, 0xb8, 0xe5])
console.log('\nTest 2: Uint8Array')
console.log(`  Input type: ${arr2.constructor.name}`)
try {
  const hex2 = Utils.toHex(arr2)
  console.log(`  Output: ${hex2}`)
} catch (e: any) {
  console.log(`  Error: ${e.message}`)
}

// Test 3: What does writeBin actually store?
console.log('\nTest 3: What does script.writeBin() store in chunks?')
const script = new Script()
const testData = Utils.toArray('02bab8e5', 'hex')
console.log(`  testData type: ${testData.constructor.name}`)
console.log(`  testData: ${JSON.stringify(testData).slice(0, 50)}`)

script.writeBin(testData)
const chunkData = script.chunks[0].data

console.log(`  chunk.data type: ${chunkData?.constructor.name}`)
console.log(`  chunk.data: ${chunkData ? JSON.stringify(Array.from(chunkData)).slice(0, 50) : 'null'}`)

if (chunkData) {
  try {
    const hexFromChunk = Utils.toHex(chunkData)
    console.log(`  Utils.toHex(chunk.data): ${hexFromChunk}`)
  } catch (e: any) {
    console.log(`  Utils.toHex(chunk.data) ERROR: ${e.message}`)
  }
}

// Test 4: What about after serialization?
console.log('\nTest 4: After serialize + deserialize')
const script2 = Script.fromHex(script.toHex())
const chunkData2 = script2.chunks[0].data

console.log(`  chunk.data type: ${chunkData2?.constructor.name}`)
if (chunkData2) {
  try {
    const hexFromChunk2 = Utils.toHex(chunkData2)
    console.log(`  Utils.toHex(chunk.data): ${hexFromChunk2}`)
  } catch (e: any) {
    console.log(`  Utils.toHex(chunk.data) ERROR: ${e.message}`)
  }
}
