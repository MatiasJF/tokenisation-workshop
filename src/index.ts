import 'dotenv/config'
import OverlayExpress from '@bsv/overlay-express'
import TokenTopicManager from './services/token/TokenTopicManager.js'
import createTokenLookupService from './services/token/TokenLookupService.js'
import TokenStorageManager from './services/token/TokenStorageManager.js'
import { MongoClient } from 'mongodb'

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
        const script = output.lockingScript

        // Check if it's an OP_RETURN with our token protocol
        // OP_RETURN can be with or without OP_FALSE prefix
        const isOpReturn = (script.chunks[0]?.op === 106) || // Just OP_RETURN
                          (script.chunks[0]?.op === 0 && script.chunks[1]?.op === 106) // OP_FALSE OP_RETURN

        if (isOpReturn) {
          try {
            // Get the full script and parse manually
            // Skip OP_FALSE (if present) and OP_RETURN to get to data
            const scriptHex = output.lockingScript.toHex()
            let dataHex = scriptHex

            // Remove OP_FALSE (00) if present
            if (dataHex.startsWith('00')) {
              dataHex = dataHex.slice(2)
            }
            // Remove OP_RETURN (6a)
            if (dataHex.startsWith('6a')) {
              dataHex = dataHex.slice(2)
            }

            // Parse push data fields manually
            const fields: number[][] = []
            let pos = 0
            while (pos < dataHex.length) {
              const opcode = parseInt(dataHex.slice(pos, pos + 2), 16)
              pos += 2

              if (opcode >= 1 && opcode <= 75) {
                // Direct push of N bytes
                const fieldHex = dataHex.slice(pos, pos + opcode * 2)
                const fieldBytes = []
                for (let i = 0; i < fieldHex.length; i += 2) {
                  fieldBytes.push(parseInt(fieldHex.slice(i, i + 2), 16))
                }
                fields.push(fieldBytes)
                pos += opcode * 2
              } else if (opcode === 76) {
                // OP_PUSHDATA1
                const len = parseInt(dataHex.slice(pos, pos + 2), 16)
                pos += 2
                const fieldHex = dataHex.slice(pos, pos + len * 2)
                const fieldBytes = []
                for (let i = 0; i < fieldHex.length; i += 2) {
                  fieldBytes.push(parseInt(fieldHex.slice(i, i + 2), 16))
                }
                fields.push(fieldBytes)
                pos += len * 2
              } else {
                break
              }
            }

            // Check if first field is 'TOKEN'
            if (fields.length >= 3) {
              const protocol = Utils.toUTF8(fields[0] as number[])

              if (protocol === 'TOKEN') {
                const tokenId = Utils.toHex(fields[1] as number[])

                // Parse amount (8-byte little-endian)
                const amountBytes = fields[2] as number[]
                let amount = 0
                for (let i = 0; i < Math.min(8, amountBytes.length); i++) {
                  amount += amountBytes[i] * Math.pow(256, i)
                }

                // Parse owner (field 3)
                const ownerKey = fields.length >= 4 ? Utils.toHex(fields[3] as number[]) : undefined

                // Parse metadata if present (field 4)
                let metadata = undefined
                if (fields.length >= 5) {
                  try {
                    const metadataStr = Utils.toUTF8(fields[4] as number[])
                    metadata = JSON.parse(metadataStr)
                  } catch {
                    // Ignore invalid metadata
                  }
                }

                console.log(`   ✓ Found token output at index ${outputIndex}:`)
                console.log(`     Token ID: ${tokenId}`)
                console.log(`     Amount: ${amount}`)
                console.log(`     Owner: ${ownerKey || 'none'}`)

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
              }
            }
          } catch (parseError: any) {
            console.log(`   ⚠️  Could not parse output ${outputIndex}: ${parseError.message}`)
          }
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
