import { Transaction, PushDrop, Utils } from '@bsv/sdk'

async function main() {
  const txid = 'e6c5170cf38713badb8a62b34bbfc829009eceb5e3ad498288a294ed41c890a2'

  const response = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`)
  const txHex = await response.text()

  const tx = Transaction.fromHex(txHex)
  console.log(`Transaction has ${tx.outputs.length} outputs\n`)

  for (let i = 0; i < tx.outputs.length; i++) {
    console.log(`\n===== Output ${i} =====`)
    const output = tx.outputs[i]
    console.log(`Satoshis: ${output.satoshis}`)
    const scriptHex = output.lockingScript.toHex()
    console.log(`Script hex: ${scriptHex}`)
    console.log(`Script length: ${scriptHex.length / 2} bytes`)

    // Show first few opcodes
    console.log(`First byte: 0x${scriptHex.slice(0, 2)} (${parseInt(scriptHex.slice(0, 2), 16)})`)
    if (scriptHex.length > 2) {
      console.log(`Second byte: 0x${scriptHex.slice(2, 4)}`)
    }

    try {
      const result = PushDrop.decode({
        script: output.lockingScript.toHex(),
        fieldFormat: 'buffer'
      } as any)

      console.log(`\n✅ PushDrop decoded successfully!`)
      console.log(`Number of fields: ${result.fields.length}`)

      for (let j = 0; j < result.fields.length; j++) {
        const field = result.fields[j] as number[]
        console.log(`\nField ${j}:`)
        console.log(`  Length: ${field.length} bytes`)
        console.log(`  Hex: ${Utils.toHex(field)}`)

        // Try to interpret
        if (field.length === 33 && (field[0] === 2 || field[0] === 3)) {
          console.log(`  Type: Compressed public key`)
        } else if (field.length <= 20) {
          try {
            const str = Utils.toUTF8(field)
            if (/^[a-zA-Z0-9 \.\-]+$/.test(str)) {
              console.log(`  String: "${str}"`)
            }
          } catch {}
        }
      }
    } catch (e: any) {
      console.log(`\n❌ Failed to decode as PushDrop: ${e.message}`)
    }
  }
}

main().catch(console.error)
