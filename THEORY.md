# BSV Token Theory: PushDrop, Overlays, and P2P Transfers

## Table of Contents
1. [Introduction to BSV Tokens](#introduction-to-bsv-tokens)
2. [The PushDrop Pattern](#the-pushdrop-pattern)
3. [Token Lifecycle](#token-lifecycle)
4. [Overlay Networks](#overlay-networks)
5. [BEEF and SPV](#beef-and-spv)
6. [Wallet Architecture](#wallet-architecture)
7. [Transfer Flow](#transfer-flow)
8. [Key Challenges and Solutions](#key-challenges-and-solutions)

---

## Introduction to BSV Tokens

### What Are BSV Tokens?

In Bitcoin SV, tokens are **unspent transaction outputs (UTXOs)** with special data embedded in their locking scripts. Unlike other blockchain systems that use smart contracts or account-based models, BSV tokens are native to the UTXO model.

**Core Principle**: "Outputs are tokens" (BRC-45)

Every UTXO can be considered a token because it:
- Has a specific value (satoshis)
- Has ownership rules (locking script)
- Can carry arbitrary data
- Can be spent (transferred) once
- Cannot be double-spent

### Why UTXOs as Tokens?

1. **Native Security**: Uses Bitcoin's proven UTXO model and mining security
2. **No Smart Contract Complexity**: No separate token contract layer needed
3. **Parallel Processing**: Different tokens can be processed simultaneously
4. **SPV Verification**: Lightweight clients can verify ownership without full blockchain
5. **Privacy**: Each token output can use different keys

---

## The PushDrop Pattern

### What is PushDrop?

PushDrop (BRC-48) is a Bitcoin Script pattern that allows data to be embedded in **spendable** outputs. Unlike OP_RETURN (which creates unspendable outputs), PushDrop outputs can be transferred.

### Script Structure

**Locking Script Format**:
```
<data...> OP_DROP <lockingPublicKey> OP_CHECKIG
```

**How It Works**:
1. The script starts with a public key that "locks" the output
2. A push data followed by an `OP_DROP` simply adds adds data from the stack and then removes it therefore leaving locking conditions unaffected.
3. Multiple data fields can be pushed (protocol identifier, token ID, amount, owner, metadata)
4. A series of `OP_DROP`s or `OP_2DROP`s removes the data fields
5. The remaining script can comprise whatever locking conditions are required.

### Why PushDrop for Tokens?

**Traditional OP_RETURN Problems**:
- Creates unspendable outputs (0 satoshis) we can refer to as "markers"
- Cannot be spent, since script execution will always result in FALSE
- No way to implement token transfers on-chain

**PushDrop Advantages**:
- Outputs remain spendable
- Data is immutable since it's within the tx.
- The token be transferred like any UTXO
- Supports complex token logic

### Token Script Anatomy

A typical PushDrop token contains:

1. **Locking Key**: Public key for cryptographic ownership verification
2. **Protocol Identifier**: "TOKEN" marker to identify this as a token output
3. **Token ID**: Unique 32-byte identifier for this token type
4. **Amount**: 8-byte little-endian encoded token quantity
5. **Owner Key**: Public key of the current owner
6. **Metadata**: JSON with name, symbol, decimals, total supply, description

### Unlocking Requirements

To spend (transfer) a PushDrop token:
1. Provide a valid signature from the private key matching the locking key
2. The script must verify: signature is from the public key in the locking script.

---

## Token Lifecycle

### 1. Minting (Token Creation)

**Process**:
- Generate unique token ID (hash of identity key + timestamp)
- Create token metadata (name, symbol, supply, etc.)
- Build PushDrop locking script with initial supply and owner
- Create transaction with wallet (wallet selects satoshi UTXOs for fees)
- Broadcast to BSV network
- Submit to overlay for indexing

**Key Points**:
- Wallet handles satoshi input selection automatically
- Token output contains 1 satoshi minimum to be spendable
- Transaction is validated by miners and included in a block
- Overlay indexes the token to enforce any needed rules

### 2. Discovery

**Problem**: How do users find their tokens?

**Solution**: Overlay Networks

Tokens exist as regular UTXOs on the blockchain, but finding them requires:
- Scanning all transactions (impractical)
- Parsing locking scripts looking for token patterns (slow)
- Knowing which UTXOs belong to you (privacy/efficiency issue)

Overlays solve this by indexing tokens off-chain for efficient querying.

### 3. Transfer

**Process**:
- Query overlay to discover owned tokens
- Select token UTXO(s) to spend
- Create new PushDrop outputs for recipient and change
- Build transaction with proper inputs and outputs
- Generate unlocking script (signature + public key)
- Broadcast transaction
- Submit to overlay for indexing

**Key Requirements**:
- Must provide proof data (BEEF) for input transactions
- Must create valid unlocking script matching locking requirements
- Change outputs must be created if not spending full amount
- Recipient must index the transfer to see their new tokens

---

## Overlay Networks

### What is an Overlay?

An overlay is an **off-chain indexing layer** that watches the blockchain for specific patterns and provides query interfaces. For tokens, overlays:

- Monitor blockchain for token transactions
- Parse PushDrop scripts to extract token data
- Index tokens by owner, token ID, and other attributes
- Provide REST APIs for querying balances and UTXOs
- Enable efficient token discovery

### Overlay Architecture

**Components**:

1. **Blockchain Monitor**: Watches for new blocks and transactions
2. **Parser**: Extracts token data from PushDrop scripts
3. **Database**: Stores indexed token information
4. **API Server**: Provides query endpoints

**Key Endpoints**:
- `/token-balances?ownerKey=<publicKey>` - Get all tokens owned by a key
- `/token-utxos/<tokenId>` - Get spendable UTXOs for a specific token
- `/submit-token` - Submit a new token transaction for indexing

### Overlay vs Wallet

**Important Distinction**:

- **Overlay**: Read-only discovery layer, anyone can query, indexes ALL tokens on-chain
- **Wallet**: Manages private keys, creates transactions, tracks owned outputs, signs transactions

### Trust Model

Overlays are **untrusted**:
- You verify token data using SPV (Simple Payment Verification)
- Overlay might be wrong/malicious - always verify on-chain
- Use BEEF (proof data) to validate token history
- Multiple overlays can index the same tokens

---

## BEEF and SPV

### What is BEEF?

**BEEF** = Binary Extended Envelope Format (BRC-62)

A compact format that contains:
- Transaction data
- Merkle proof paths
- Block headers (optional)
- Ancestor transaction data

### Why BEEF?

**Problem**: Wallets need to verify transactions without downloading the entire blockchain.

**Solution**: BEEF provides sufficient data for SPV validation:
1. Transaction you want to verify
2. Merkle proof it's in a specific block
3. Block header to verify proof of work
4. Ancestor transactions if inputs reference unknown UTXOs

### SPV Verification

**Simple Payment Verification** allows lightweight verification:

1. **Step 1**: Check transaction is well-formed
2. **Step 2**: Verify merkle proof shows transaction in block
3. **Step 3**: Verify block header has valid proof of work
4. **Step 4**: Check sufficient confirmations (block depth)

**Result**: Cryptographic certainty transaction is valid without full blockchain

### BEEF in Token Transfers

When spending a token UTXO:
- Wallet needs BEEF to verify the UTXO exists and is unspent
- Even if wallet created the output itself, it needs BEEF for SPV
- BEEF must include full transaction chain back to known transactions

**Challenge**: Generating valid BEEF with proper merkle proofs requires:
- Access to blockchain data
- Merkle tree computation
- Ancestor transaction resolution

---

## Wallet Architecture

### BSV Desktop Wallet

**Key Capabilities**:
- Manages private keys and identities
- Creates and signs transactions
- Tracks owned UTXOs in "baskets"
- Provides SPV verification
- Broadcasts transactions to network

### Baskets (BRC-46)

**Output Baskets** are logical groupings of UTXOs:
- Default basket: general satoshi outputs
- Custom baskets: application-specific outputs (e.g., "tokens")
- Each basket tracks outputs with metadata

**Basket Purpose**:
- Organize outputs by use case
- Prevent accidental spending of special outputs
- Simplify UTXO management

### Key Derivation

Wallets use hierarchical deterministic (HD) key derivation:

- **Identity Key**: Root key for wallet identity
- **Protocol Keys**: Derived keys for specific protocols
  - Format: `protocolID=[0, 'tokens']`, `keyID='<token-specific>'`
- **Deterministic**: Same inputs always produce same keys
- **Privacy**: Different key per output

### Transaction Creation Flow

1. **User Request**: Application requests transaction creation
2. **UTXO Selection**: Wallet selects inputs (satoshis for fees, tokens if specified)
3. **Output Generation**: Wallet creates outputs based on request
4. **Fee Calculation**: Wallet calculates and adds miner fees
5. **Signing**: Wallet signs inputs with appropriate keys
6. **Broadcast**: Wallet broadcasts to BSV network
7. **Tracking**: Wallet stores transaction for future reference

---

## Transfer Flow

### Complete Token Transfer Process

#### Phase 1: Discovery (Sender)

1. Sender queries overlay for owned tokens
2. Overlay returns token balances and available UTXOs
3. Sender selects token(s) to transfer

#### Phase 2: Transaction Construction

1. **Input Preparation**:
   - Identify token UTXO(s) to spend
   - Fetch transaction data for inputs
   - Generate or retrieve BEEF for SPV validation

2. **Output Creation**:
   - Create recipient output with transfer amount
   - Create change output with remaining balance
   - Both use PushDrop format with new locking keys

3. **Unlocking Script Generation**:
   - Use PushDrop.unlock() to create signature generator
   - Sign transaction with private key
   - Construct unlocking script (signature + public key)

#### Phase 3: Broadcast and Indexing

1. Submit signed transaction to BSV network
2. Transaction validated by miners
3. Included in next block
4. Submit TXID to overlay for indexing

#### Phase 4: Recipient Discovery

1. Recipient queries overlay for their tokens
2. Overlay returns updated balance including received tokens
3. Recipient can now spend their tokens

### Peer-to-Peer Transfer Model

**Important Concept**: Token transfers are direct peer-to-peer:

- No intermediary approvals needed
- No token contract to update
- No central registry
- Just Bitcoin UTXO transfers with token data

**Overlay Role**: Discovery only, not custody or transfer

---

## Key Challenges and Solutions

### Challenge 1: BEEF Validation

**Problem**: Wallet requires valid BEEF even for outputs it created itself.

**Why**: SPV security requires proof chain validation, even for known transactions.

**Solution**:
- Query wallet's basket outputs with `include: 'entire transactions'`
- Use wallet's own BEEF data for inputs
- Wallet trusts its own transaction data

### Challenge 2: Locking Script Access

**Problem**: Need locking script to create unlocking script, but wallet APIs return either locking scripts OR BEEF, not both.

**Solution**:
- Make two API calls: one for locking scripts, one for BEEF
- Or store locking scripts when minting
- Or query overlay for locking script data

### Challenge 3: Basket vs Non-Basket Outputs

**Problem**: Should tokens be stored in baskets or just tracked via overlay?

**Options**:

**A) Use Baskets**:
- ✅ Wallet tracks outputs automatically
- ✅ Prevents accidental spending
- ✅ Provides BEEF data
- ❌ Wallet-dependent (can't move wallets easily)

**B) Overlay Only**:
- ✅ Wallet-independent
- ✅ Works across different wallets
- ✅ True peer-to-peer model
- ❌ Must fetch BEEF from blockchain
- ❌ More complex BEEF generation

**Hybrid Approach**: Use baskets during minting for convenience, but design transfers to work overlay-first for maximum compatibility.

### Challenge 4: Unlocking Script Format

**Problem**: PushDrop locking script expects specific unlocking format.

**Script Verification Process**:
1. Unlocking script runs first, pushes data to stack
2. Locking script runs second, validates stack data
3. Script succeeds if final stack element is truthy

**For PushDrop**:
- Locking script starts with public key
- Unlocking must provide signature + public key
- Verification checks signature matches public key

**Common Error**: Only providing signature without public key causes stack validation to fail.

### Challenge 5: Change Outputs

**Problem**: Token transfers rarely spend exact amounts.

**Solution**: Create change output back to sender with remaining balance.

**Implementation**:
- Calculate: `change = totalInputAmount - transferAmount`
- Create second PushDrop output with change amount
- Use sender's public key as owner
- Same token ID as input

**Important**: If change is 0, don't create change output (wastes satoshis).

---

## Best Practices

### For Token Creators

1. **Use unique token IDs**: Hash(identity + timestamp) ensures uniqueness
2. **Include rich metadata**: Name, symbol, decimals, description
3. **Submit to overlays**: Don't rely on users to discover your tokens
4. **Document token purpose**: README or website explaining token utility

### For Application Developers

1. **Query overlays for discovery**: Don't scan blockchain directly
2. **Verify with SPV**: Don't trust overlay data blindly
3. **Handle BEEF properly**: Ensure complete proof chains
4. **Create proper change outputs**: Don't lose tokens in transfers
5. **Index transfers**: Submit completed transfers to overlay

### For Wallet Integration

1. **Use baskets for organization**: Separate tokens from regular satoshis
2. **Provide BEEF with outputs**: Make spending easier for applications
3. **Support protocol-specific keys**: Enable proper key derivation
4. **Cache transaction data**: Avoid re-fetching from blockchain

### Security Considerations

1. **Private Key Management**: Never expose private keys
2. **BEEF Verification**: Always validate proof chains
3. **Double-Spend Protection**: Check for spent outputs before accepting
4. **Malicious Overlays**: Verify token data on-chain, don't trust blindly
5. **Dust Limits**: Ensure outputs meet minimum satoshi requirements

---

## Future Directions

### Smart Token Features

- **Time-locked tokens**: Tokens that can't be spent until a certain time
- **Multi-signature tokens**: Tokens requiring multiple signatures to spend
- **Conditional transfers**: Tokens with spending conditions
- **Royalty enforcement**: Automatic fees on each transfer

### Scaling Considerations

- **Batch transfers**: Multiple token transfers in one transaction
- **Atomic swaps**: Direct token-for-token exchanges
- **Layer 2 solutions**: Off-chain token transfers with on-chain settlement
- **Overlay federation**: Multiple interconnected overlays

### Standardization

- **BRC-20 equivalent**: Community-agreed token standard
- **Metadata schemas**: Standard JSON formats for different token types
- **Overlay APIs**: Standardized query interfaces
- **Cross-platform compatibility**: Tokens work across all BSV applications

---

## Glossary

**AtomicBEEF**: Byte array representation of BEEF format

**Basket**: Logical grouping of outputs in a wallet

**BEEF**: Binary Extended Envelope Format - compact transaction proof data

**BRC**: Bitcoin Request for Comment - BSV standards

**Locking Script**: Script that defines spending conditions for a UTXO

**Merkle Proof**: Cryptographic proof a transaction is in a block

**OP_DROP**: Bitcoin opcode that removes top stack element

**Overlay**: Off-chain indexing layer for blockchain data

**PushDrop**: Script pattern for spendable data outputs

**SPV**: Simple Payment Verification - lightweight transaction verification

**UTXO**: Unspent Transaction Output - Bitcoin's fundamental unit

**Unlocking Script**: Script that satisfies locking script conditions

---

## Conclusion

BSV token implementation using PushDrop and overlays represents a powerful approach to tokenization that:

- Leverages Bitcoin's native UTXO model
- Maintains security through SPV verification
- Enables peer-to-peer transfers without intermediaries
- Provides efficient discovery through overlay indexing
- Supports complex token logic through Bitcoin Script

The key insight is that **outputs ARE tokens** - there's no separate token layer needed. By embedding data in spendable outputs and using overlays for discovery, we get a scalable, secure, and truly peer-to-peer token system.

Understanding the interplay between wallets (transaction creation), overlays (discovery), BEEF (verification), and PushDrop scripts (transfer logic) is essential for building robust token applications on BSV.
