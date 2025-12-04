import 'dotenv/config'
import OverlayExpress from '@bsv/overlay-express'
import TokenTopicManager from './services/token/TokenTopicManager.js'
import createTokenLookupService from './services/token/TokenLookupService.js'
import TokenStorageManager from './services/token/TokenStorageManager.js'
import { MongoClient } from 'mongodb'
import { PushDrop } from '@bsv/sdk'

const {
  NODE_NAME = 'tokenworkshop',
  SERVER_PRIVATE_KEY,
  HOSTING_URL = 'http://localhost:8080',
  ADMIN_TOKEN = 'admin',
  MONGO_URL = 'mongodb://localhost:27017/tokenworkshop',
  KNEX_URL = 'mysql://root:password@localhost:3306/tokenworkshop',
  GASP_ENABLED = 'false'
} = process.env

if (!SERVER_PRIVATE_KEY) {
  throw new Error('SERVER_PRIVATE_KEY environment variable is required')
}

async function main() {
  console.log('🚀 Starting Tokenisation Workshop Overlay Server...')

  // Create OverlayExpress server
  const server = new OverlayExpress(
    NODE_NAME,
    SERVER_PRIVATE_KEY as string,
    HOSTING_URL,
    ADMIN_TOKEN
  )

  // Configure port (from HOSTING_URL or default 8080)
  const port = new URL(HOSTING_URL).port || '8080'
  server.configurePort(Number(port))

  // Configure databases using OverlayExpress methods
  await server.configureKnex(KNEX_URL)
  console.log('✓ MySQL/Knex connected')

  await server.configureMongo(MONGO_URL)
  console.log('✓ MongoDB connected')

  // Create persistent MongoDB client for custom endpoints
  const persistentMongoClient = new MongoClient(MONGO_URL)
  await persistentMongoClient.connect()
  const dbName = MONGO_URL.split('/').pop()?.split('?')[0] || 'tokenworkshop'
  const lookupDbName = `${dbName}_lookup_services`
  const persistentDb = persistentMongoClient.db(lookupDbName)

  // Configure body parser middleware for JSON
  server.app.use((await import('express')).json())

  // Register Token Service
  server.configureTopicManager('tm_tokens', new TokenTopicManager())
  server.configureLookupServiceWithMongo('ls_tokens', createTokenLookupService as any)

  console.log('✓ Token service registered')

  // Configure GASP sync based on environment variable
  const enableGasp = GASP_ENABLED === 'true'
  server.configureEnableGASPSync(enableGasp)

  if (enableGasp) {
    console.log('✅ GASP synchronization enabled - tokens will be automatically tracked')
  } else {
    console.log('⚠️  GASP synchronization disabled - manual token insertion required')
  }

  // Configure the overlay engine
  await server.configureEngine()

  // Add custom endpoint for health check
  server.app.get('/health', async (req, res) => {
    res.json({
      status: 'healthy',
      node: NODE_NAME,
      services: ['tokens'],
      timestamp: new Date().toISOString()
    })
  })

  // Add custom endpoint for token balances (bypasses overlay engine enrichment)
  server.app.get('/token-balances', async (req, res) => {
    try {
      const ownerKey = req.query.ownerKey as string | undefined

      const storage = new TokenStorageManager(persistentDb)
      const balances = await storage.getAllBalances(ownerKey)

      res.json(balances)
    } catch (error: any) {
      console.error('Error in /token-balances:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Add custom endpoint for token UTXOs (bypasses overlay engine enrichment)
  server.app.get('/token-utxos/:tokenId', async (req, res) => {
    try {
      const { tokenId } = req.params

      const storage = new TokenStorageManager(persistentDb)
      const records = await storage.findUnspentByTokenId(tokenId)

      // Map to UTXO format expected by wallet
      const utxos = records.map(r => ({
        txid: r.txid,
        outputIndex: r.outputIndex,
        amount: r.amount,
        lockingScript: r.lockingScript,
        satoshis: r.satoshis
      }))

      res.json(utxos)
    } catch (error: any) {
      console.error('Error in /token-utxos:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Add custom endpoint for direct token submission (for workshop - bypasses GASP)
  server.app.post('/submit-token', async (req, res) => {
    try {
      const { txid } = req.body

      if (!txid) {
        return res.status(400).json({ error: 'txid is required' })
      }

      console.log(`\n📥 Direct token submission received for TXID: ${txid}`)

      // Fetch transaction from blockchain
      const wocResponse = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`)
      if (!wocResponse.ok) {
        return res.status(404).json({ error: 'Transaction not found on blockchain' })
      }

      const rawTx = await wocResponse.text()
      const { Transaction, Utils } = await import('@bsv/sdk')
      const tx = Transaction.fromHex(rawTx)

      console.log(`   Parsing transaction with ${tx.outputs.length} outputs...`)

      // Parse each output looking for token outputs
      let tokensFound = 0
      const storage = new TokenStorageManager(persistentDb)

      for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
        const output = tx.outputs[outputIndex]

        try {
          // Try to decode as PushDrop token
          const result = PushDrop.decode({
            script: output.lockingScript.toHex(),
            fieldFormat: 'buffer'
          } as any)

          // Validate PushDrop token format
          // Field 0: lockingKey (33 bytes)
          // Field 1: protocol ('TOKEN')
          // Field 2: tokenId (32 bytes)
          // Field 3: amount (8 bytes)
          // Field 4: ownerKey (33 bytes)
          // Field 5: metadata (optional JSON)
          if (result.fields.length < 5) continue

          const lockingKey = Utils.toHex(result.fields[0] as number[])
          const protocol = Utils.toUTF8(result.fields[1] as number[])

          if (protocol !== 'TOKEN') continue
          if (lockingKey.length !== 66) continue // 33 bytes = 66 hex chars

          const tokenId = Utils.toHex(result.fields[2] as number[])
          if (tokenId.length !== 64) continue // 32 bytes = 64 hex chars

          // Parse amount (8-byte little-endian)
          const amountBytes = result.fields[3] as number[]
          if (amountBytes.length !== 8) continue

          let amount = 0
          for (let i = 0; i < 8; i++) {
            amount += amountBytes[i] * Math.pow(256, i)
          }

          if (amount <= 0) continue

          // Parse owner (field 4)
          const ownerKey = Utils.toHex(result.fields[4] as number[])
          if (ownerKey.length !== 66) continue // 33 bytes = 66 hex chars

          // Parse metadata if present (field 5)
          let metadata = undefined
          if (result.fields.length >= 6) {
            try {
              const metadataStr = Utils.toUTF8(result.fields[5] as number[])
              metadata = JSON.parse(metadataStr)
            } catch {
              // Ignore invalid metadata
            }
          }

          console.log(`   ✓ Found PushDrop token output at index ${outputIndex}:`)
          console.log(`     Token ID: ${tokenId}`)
          console.log(`     Amount: ${amount}`)
          console.log(`     Owner: ${ownerKey}`)
          console.log(`     Locking Key: ${lockingKey}`)

          // Store in database
          await storage.storeToken(
            txid,
            outputIndex,
            tokenId,
            amount,
            metadata,
            output.lockingScript.toHex(),
            output.satoshis || 0,
            ownerKey
          )

          tokensFound++
        } catch (parseError: any) {
          // Not a valid PushDrop token output, skip silently
          continue
        }
      }

      if (tokensFound > 0) {
        console.log(`   ✅ Successfully stored ${tokensFound} token output(s)`)
        res.json({
          status: 'success',
          txid,
          tokensFound,
          message: `Successfully indexed ${tokensFound} token output(s)`
        })
      } else {
        console.log(`   ⚠️  No token outputs found in transaction`)
        res.status(400).json({
          error: 'No token outputs found in transaction',
          txid
        })
      }
    } catch (error: any) {
      console.error('❌ Error in /submit-token:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Start the server
  await server.start()

  console.log(`
✨ Tokenisation Workshop Server Running!

🌐 Overlay URL: ${HOSTING_URL}
📦 Node Name: ${NODE_NAME}
🎯 Services: Token Mint & Wallet

Available Services:
  - Token Topic Manager: tm_tokens
  - Token Lookup Service: ls_tokens

Health Check: ${HOSTING_URL}/health
`)
}

main().catch(error => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
