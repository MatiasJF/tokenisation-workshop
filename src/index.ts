import { WalletAdvertiser } from '@bsv/overlay-discovery-services'
import OverlayExpress from '@bsv/overlay-express'
import TokenTopicManager from './services/token/TokenTopicManager'
import TokenLookupService from './services/token/TokenLookupService'
import { config } from 'dotenv'
import packageJson from '../package.json'
config()

const {
  NODE_NAME = 'tokenworkshop',
  SERVER_PRIVATE_KEY,
  HOSTING_URL = 'https://deggen.ngrok.app',
  ADMIN_TOKEN = 'admin',
  MONGO_URL = 'mongodb://localhost:27017/tokenworkshop',
  KNEX_URL = 'mysql://root:password@localhost:3306/tokenworkshop',
  GASP_ENABLED = 'false'
} = process.env

// Hi there! Let's configure Overlay Express!
const main = async () => {

    // We'll make a new server for our overlay node.
    const server = new OverlayExpress(

        // Name your overlay node with a one-word lowercase string
        NODE_NAME!,

        // Provide the private key that gives your node its identity
        SERVER_PRIVATE_KEY!,

        // Provide the HTTPS URL where your node is available on the internet
        HOSTING_URL!,
        
        // Provide an adminToken to enable the admin API
        ADMIN_TOKEN!
    )

    const wa = new WalletAdvertiser(
        'main',
        SERVER_PRIVATE_KEY!,
        'https://storage.babbage.systems',
        'https://deggen.ngrok.app'
    )

    await wa.init()

    server.configureEngineParams({
        advertiser: wa
    })

    // Set the ARC API key
    server.configureArcApiKey(process.env.ARC_API_KEY!)

    // Decide what port you want the server to listen on.
    server.configurePort(8080)

    // Connect to your SQL database with Knex
    await server.configureKnex(KNEX_URL!)

    // Also, be sure to connect to MongoDB
    await server.configureMongo(MONGO_URL!)

    // Here, you will configure the overlay topic managers and lookup services you want.
    // - Topic managers decide what outputs can go in your overlay
    // - Lookup services help people find things in your overlay
    
    // Protocols
    server.configureTopicManager('tm_tokens', new TokenTopicManager())
    server.configureLookupServiceWithMongo('ls_tokens', TokenLookupService)

    // For simple local deployments, sync can be disabled.
    server.configureEnableGASPSync(process.env?.GASP_ENABLED === 'true')

    // Lastly, configure the engine and start the server!
    await server.configureEngine()

    // Configure verbose request logging
    server.configureVerboseRequestLogging(true)

    server.app.get('/version', (req, res) => {
        res.json(packageJson)
    })

    // Start the server
    await server.start()
}

// Happy hacking :)
main()