import {
  LookupService,
  LookupFormula,
  LookupQuestion,
  OutputAdmittedByTopic
} from '@bsv/overlay'
import { Db } from 'mongodb'
import { Transaction, PushDrop, Utils } from '@bsv/sdk'
import TokenStorageManager from './TokenStorageManager.js'

/**
 * TokenLookupService provides query capabilities for token data
 */
class TokenLookupService implements LookupService {
  admissionMode = 'output-script' as const
  spendNotificationMode = 'all' as const

  constructor(public storageManager: TokenStorageManager) {}

  /**
   * Called when a new token output is admitted to the overlay
   */
  async outputAdmittedByTopic(payload: OutputAdmittedByTopic): Promise<void> {
    try {
      const tx = Transaction.fromBEEF(payload.beef)
      const output = tx.outputs[payload.outputIndex]

      // Decode token data
      const result = PushDrop.decode({
        script: output.lockingScript.toHex(),
        fieldFormat: 'buffer'
      })

      const tokenId = Utils.toHex(result.fields[1] as number[])
      const amountBuffer = result.fields[2] as number[]
      const amount = this.parseAmount(amountBuffer)

      // Parse metadata if present
      let metadata = undefined
      if (result.fields.length >= 4) {
        try {
          const metadataStr = Utils.toUTF8(result.fields[3] as number[])
          metadata = JSON.parse(metadataStr)
        } catch {
          // Ignore invalid metadata
        }
      }

      // Store in database
      await this.storageManager.storeToken(
        payload.txid,
        payload.outputIndex,
        tokenId,
        amount,
        metadata,
        output.lockingScript.toHex(),
        output.satoshis || 0
      )

      console.log(`✓ Token admitted: ${tokenId} amount=${amount}`)

    } catch (error) {
      console.error('Error processing admitted output:', error)
    }
  }

  /**
   * Called when a token output is spent
   */
  async outputSpent(payload: {
    txid: string
    outputIndex: number
    topic: string
  }): Promise<void> {
    try {
      await this.storageManager.markAsSpent(payload.txid, payload.outputIndex)
      console.log(`✓ Token spent: ${payload.txid}:${payload.outputIndex}`)
    } catch (error) {
      console.error('Error marking output as spent:', error)
    }
  }

  /**
   * Called when a token output is evicted from the overlay
   */
  async outputEvicted(txid: string, outputIndex: number): Promise<void> {
    try {
      await this.storageManager.deleteToken(txid, outputIndex)
      console.log(`✓ Token evicted: ${txid}:${outputIndex}`)
    } catch (error) {
      console.error('Error deleting evicted output:', error)
    }
  }

  /**
   * Handle lookup queries for token data
   */
  async lookup(question: LookupQuestion): Promise<LookupFormula> {
    const { query } = question

    try {
      switch (query.type) {
        case 'balance': {
          // Query: { type: 'balance', tokenId: '...' }
          const balance = await this.storageManager.getBalance(query.tokenId)
          // Return array of UTXO objects (LookupFormula is an array)
          return balance.utxos.map(utxo => ({
            txid: utxo.txid,
            outputIndex: utxo.outputIndex,
            amount: utxo.amount,
            tokenId: balance.tokenId,
            name: balance.name,
            symbol: balance.symbol,
            decimals: balance.decimals
          }))
        }

        case 'balances': {
          // Query: { type: 'balances' }
          const balances = await this.storageManager.getAllBalances()
          console.log('📊 [LOOKUP] getAllBalances returned:', balances.length, 'tokens')
          // Return array of balance objects (LookupFormula is an array)
          const result = balances.map(b => ({
            tokenId: b.tokenId,
            name: b.name,
            symbol: b.symbol,
            decimals: b.decimals,
            totalAmount: b.totalAmount,
            utxoCount: b.utxos.length
          }))
          console.log('📊 [LOOKUP] Returning:', result)
          return result
        }

        case 'history': {
          // Query: { type: 'history', tokenId: '...', limit?: number }
          const history = await this.storageManager.getHistory(
            query.tokenId,
            query.limit
          )
          // Return array of transaction records (LookupFormula is an array)
          return history.map(h => ({
            txid: h.txid,
            outputIndex: h.outputIndex,
            tokenId: h.tokenId,
            amount: h.amount,
            spent: h.spent,
            createdAt: h.createdAt.toISOString()
          }))
        }

        case 'utxos': {
          // Query: { type: 'utxos', tokenId: '...' }
          const records = await this.storageManager.findUnspentByTokenId(query.tokenId)
          // Return array of UTXO objects (LookupFormula is an array)
          return records.map(r => ({
            txid: r.txid,
            outputIndex: r.outputIndex,
            amount: r.amount,
            lockingScript: r.lockingScript,
            satoshis: r.satoshis
          }))
        }

        default:
          throw new Error(`Unknown query type: ${(query as any).type}`)
      }
    } catch (error) {
      console.error('Lookup error:', error)
      return {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
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
    return `# Token Lookup Service

## Query Types

### Balance Query
Get balance for a specific token:
\`\`\`json
{
  "type": "balance",
  "tokenId": "a1b2c3d4..."
}
\`\`\`

### All Balances Query
Get all token balances:
\`\`\`json
{
  "type": "balances"
}
\`\`\`

### History Query
Get transaction history for a token:
\`\`\`json
{
  "type": "history",
  "tokenId": "a1b2c3d4...",
  "limit": 50
}
\`\`\`

### UTXOs Query
Get unspent outputs for a token:
\`\`\`json
{
  "type": "utxos",
  "tokenId": "a1b2c3d4..."
}
\`\`\`
`
  }

  async getMetaData() {
    return {
      name: 'Token Lookup',
      shortDescription: 'Query token balances and transaction history',
      version: '1.0.0'
    }
  }
}

/**
 * Factory function to create TokenLookupService with MongoDB
 */
export default (db: Db): TokenLookupService => {
  const storageManager = new TokenStorageManager(db)
  return new TokenLookupService(storageManager)
}
