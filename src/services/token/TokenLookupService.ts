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
  admissionMode = 'output-script' as any
  spendNotificationMode = 'all' as any

  constructor(public storageManager: TokenStorageManager) {}

  /**
   * Called when a new token output is admitted to the overlay
   */
  async outputAdmittedByTopic(payload: any): Promise<void> {
    try {
      const tx = (payload as any).beef ? Transaction.fromBEEF((payload as any).beef) :
                  (payload as any).atomicBEEF ? Transaction.fromBEEF((payload as any).atomicBEEF) : null

      if (!tx) {
        console.error('No transaction data in payload')
        return
      }

      const output = tx.outputs[payload.outputIndex]
      const txid = (payload as any).txid || tx.id('hex') as string

      // Decode token data
      const result = PushDrop.decode({
        script: output.lockingScript.toHex(),
        fieldFormat: 'buffer'
      } as any)

      const tokenId = Utils.toHex(result.fields[1] as number[])
      const amountBuffer = result.fields[2] as number[]
      const amount = this.parseAmount(amountBuffer)

      // Parse owner (field 3)
      const ownerKey = result.fields.length >= 4 ? Utils.toHex(result.fields[3] as number[]) : undefined

      // Parse metadata if present (field 4)
      let metadata = undefined
      if (result.fields.length >= 5) {
        try {
          const metadataStr = Utils.toUTF8(result.fields[4] as number[])
          metadata = JSON.parse(metadataStr)
        } catch {
          // Ignore invalid metadata
        }
      }

      // Store in database
      await this.storageManager.storeToken(
        txid,
        payload.outputIndex,
        tokenId,
        amount,
        metadata,
        output.lockingScript.toHex(),
        output.satoshis || 0,
        ownerKey
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
  async lookup(question: LookupQuestion): Promise<LookupFormula | any> {
    const { query } = question as any

    try {
      switch (query.type) {
        case 'balance': {
          // Query: { type: 'balance', tokenId: '...' }
          const balance = await this.storageManager.getBalance(query.tokenId)
          // Return array of UTXO objects
          return balance.utxos.map(utxo => ({
            txid: utxo.txid,
            outputIndex: utxo.outputIndex,
            amount: utxo.amount,
            tokenId: balance.tokenId,
            name: balance.name,
            symbol: balance.symbol,
            decimals: balance.decimals
          })) as any
        }

        case 'balances': {
          // Query: { type: 'balances' }
          const balances = await this.storageManager.getAllBalances()
          console.log('📊 [LOOKUP] getAllBalances returned:', balances.length, 'tokens')
          // Return array of balance objects
          const result = balances.map(b => ({
            tokenId: b.tokenId,
            name: b.name,
            symbol: b.symbol,
            decimals: b.decimals,
            totalAmount: b.totalAmount,
            utxoCount: b.utxos.length
          }))
          console.log('📊 [LOOKUP] Returning:', result)
          return result as any
        }

        case 'history': {
          // Query: { type: 'history', tokenId: '...', limit?: number }
          const history = await this.storageManager.getHistory(
            query.tokenId,
            query.limit
          )
          // Return array of transaction records
          return history.map(h => ({
            txid: h.txid,
            outputIndex: h.outputIndex,
            tokenId: h.tokenId,
            amount: h.amount,
            spent: h.spent,
            createdAt: h.createdAt.toISOString()
          })) as any
        }

        case 'utxos': {
          // Query: { type: 'utxos', tokenId: '...' }
          const records = await this.storageManager.findUnspentByTokenId(query.tokenId)
          // Return array of UTXO objects
          return records.map(r => ({
            txid: r.txid,
            outputIndex: r.outputIndex,
            amount: r.amount,
            lockingScript: r.lockingScript,
            satoshis: r.satoshis
          })) as any
        }

        default:
          throw new Error(`Unknown query type: ${(query as any).type}`)
      }
    } catch (error) {
      console.error('Lookup error:', error)
      return [] as any
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
