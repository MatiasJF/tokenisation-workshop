import { TopicManager, AdmittanceInstructions } from '@bsv/overlay'
import { Transaction, PushDrop, Utils } from '@bsv/sdk'

/**
 * TokenTopicManager validates token transactions for the overlay.
 *
 * Token Protocol:
 * - Output format: OP_0 OP_RETURN <protocol> <tokenId> <amount> [<metadata>]
 * - protocol: 'TOKEN' (UTF-8)
 * - tokenId: 32-byte hex identifier
 * - amount: 8-byte integer (satoshis represent token amount)
 * - metadata: optional JSON data
 */
export default class TokenTopicManager implements TopicManager {

  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []

    try {
      // Parse transaction from BEEF
      const tx = Transaction.fromBEEF(beef)

      // Check each output
      for (let i = 0; i < tx.outputs.length; i++) {
        try {
          const output = tx.outputs[i]

          // Decode using PushDrop (BRC-48)
          const result = PushDrop.decode({
            script: output.lockingScript.toHex(),
            fieldFormat: 'buffer'
          } as any)

          // Validate token protocol
          if (result.fields.length < 3) continue

          const protocol = Utils.toUTF8(result.fields[0] as number[])
          if (protocol !== 'TOKEN') continue

          const tokenId = Utils.toHex(result.fields[1] as number[])
          const amountBuffer = result.fields[2] as number[]

          // Validate tokenId (32 bytes)
          if (tokenId.length !== 64) continue

          // Validate amount (8 bytes)
          if (amountBuffer.length !== 8) continue

          // Parse amount as 64-bit integer
          const amount = this.parseAmount(amountBuffer)
          if (amount <= 0) continue

          // Optional metadata validation
          if (result.fields.length >= 4) {
            try {
              const metadata = Utils.toUTF8(result.fields[3] as number[])
              JSON.parse(metadata) // Ensure valid JSON
            } catch {
              // Invalid metadata, skip
              continue
            }
          }

          // Output is valid
          outputsToAdmit.push(i)

        } catch (err) {
          // Skip invalid outputs silently
          continue
        }
      }

    } catch (error) {
      console.error('Error processing transaction:', error)
    }

    return {
      outputsToAdmit,
      coinsToRetain: []
    }
  }

  /**
   * Parse 8-byte buffer to integer (little-endian)
   */
  private parseAmount(buffer: number[]): number {
    let amount = 0
    for (let i = 0; i < 8; i++) {
      amount += buffer[i] * Math.pow(256, i)
    }
    return amount
  }

  async getDocumentation(): Promise<string> {
    return `# Token Overlay Service

## Purpose
Validates and tracks fungible token transactions on the BSV blockchain.

## Token Protocol

### Output Format
\`\`\`
OP_0 OP_RETURN <protocol> <tokenId> <amount> [<metadata>]
\`\`\`

### Fields
- **protocol**: 'TOKEN' (UTF-8 string)
- **tokenId**: 32-byte hex identifier (unique per token type)
- **amount**: 8-byte integer (token units, little-endian)
- **metadata**: Optional JSON object with token information

### Examples

#### Mint New Token
\`\`\`
protocol: 'TOKEN'
tokenId: 'a1b2c3d4...' (32 bytes)
amount: 1000000 (1 million tokens)
metadata: {
  "name": "Workshop Token",
  "symbol": "WST",
  "decimals": 6,
  "description": "Example fungible token"
}
\`\`\`

#### Transfer Token
\`\`\`
protocol: 'TOKEN'
tokenId: 'a1b2c3d4...' (same as minted)
amount: 50000 (50k tokens)
metadata: {} (optional)
\`\`\`

## Validation Rules
1. Protocol must be 'TOKEN'
2. TokenId must be exactly 32 bytes
3. Amount must be 8 bytes and greater than 0
4. Metadata must be valid JSON if present
5. Outputs not matching these rules are rejected

## Usage
- Mint Service: Creates new token outputs
- Wallet Service: Transfers tokens between addresses
- Lookup Service: Queries balances and transaction history
`
  }

  async getMetaData() {
    return {
      name: 'Token Overlay',
      shortDescription: 'Fungible token minting and transfers',
      iconURL: 'https://example.com/token-icon.png',
      version: '1.0.0',
      informationURL: 'https://example.com/token-docs'
    }
  }
}
