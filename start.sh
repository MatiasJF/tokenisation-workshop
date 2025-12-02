#!/bin/bash

# Tokenisation Workshop - Quick Start Script
# This script helps you get started quickly

set -e  # Exit on error

echo "╔════════════════════════════════════════╗"
echo "║   BSV Tokenisation Workshop           ║"
echo "║   Quick Start Helper                   ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "🐳 Checking Docker..."
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo ""
    echo "Please start Docker Desktop and try again."
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Check if databases exist
echo "📦 Checking databases..."

if ! docker ps -a | grep -q "mongo"; then
    echo -e "${YELLOW}⚠️  MongoDB container 'mongo' not found${NC}"
    echo "Creating MongoDB container..."
    docker run -d \
        --name mongo \
        -p 27017:27017 \
        -v mongodb_data:/data/db \
        mongo:latest
    echo -e "${GREEN}✓ MongoDB container created${NC}"
else
    echo -e "${GREEN}✓ MongoDB container exists${NC}"
fi

if ! docker ps -a | grep -q "mysql"; then
    echo -e "${YELLOW}⚠️  MySQL container 'mysql' not found${NC}"
    echo "Creating MySQL container..."
    docker run -d \
        --name mysql \
        -p 3306:3306 \
        -e MYSQL_ROOT_PASSWORD=password \
        -e MYSQL_DATABASE=tokenworkshop \
        -v mysql_data:/var/lib/mysql \
        mysql:latest
    echo -e "${GREEN}✓ MySQL container created${NC}"
else
    echo -e "${GREEN}✓ MySQL container exists${NC}"
fi
echo ""

# Start databases if not running
echo "🚀 Starting databases..."
docker start mongo > /dev/null 2>&1 || true
docker start mysql > /dev/null 2>&1 || true

# Wait for databases to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 5

# Check database health
if docker ps | grep -q "mongo" && docker ps | grep -q "mysql"; then
    echo -e "${GREEN}✓ Databases are running${NC}"
else
    echo -e "${RED}❌ Failed to start databases${NC}"
    exit 1
fi
echo ""

# Check if database exists
echo "🗄️  Checking tokenworkshop database..."
if ! docker exec mysql mysql -u root -ppassword -e "USE tokenworkshop" 2>/dev/null; then
    echo "Creating tokenworkshop database..."
    docker exec mysql mysql -u root -ppassword -e "CREATE DATABASE tokenworkshop" 2>/dev/null
    echo -e "${GREEN}✓ Database created${NC}"
else
    echo -e "${GREEN}✓ Database exists${NC}"
fi
echo ""

# Check if .env exists
echo "⚙️  Checking configuration..."
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo "Generating private keys..."

    # Generate .env from example
    cp .env.example .env

    # Generate keys
    SERVER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    MINTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    WALLET_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

    # Update .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/SERVER_PRIVATE_KEY=.*/SERVER_PRIVATE_KEY=$SERVER_KEY/" .env
        sed -i '' "s/MINTER_PRIVATE_KEY=.*/MINTER_PRIVATE_KEY=$MINTER_KEY/" .env
        sed -i '' "s/WALLET_PRIVATE_KEY=.*/WALLET_PRIVATE_KEY=$WALLET_KEY/" .env
        sed -i '' "s|KNEX_URL=.*|KNEX_URL=mysql://root:password@localhost:3306/tokenworkshop|" .env
    else
        # Linux
        sed -i "s/SERVER_PRIVATE_KEY=.*/SERVER_PRIVATE_KEY=$SERVER_KEY/" .env
        sed -i "s/MINTER_PRIVATE_KEY=.*/MINTER_PRIVATE_KEY=$MINTER_KEY/" .env
        sed -i "s/WALLET_PRIVATE_KEY=.*/WALLET_PRIVATE_KEY=$WALLET_KEY/" .env
        sed -i "s|KNEX_URL=.*|KNEX_URL=mysql://root:password@localhost:3306/tokenworkshop|" .env
    fi

    echo -e "${GREEN}✓ Configuration created with new keys${NC}"
else
    echo -e "${GREEN}✓ Configuration exists${NC}"
fi
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies..."
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
else
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
fi

# Kill any process on port 8080
echo "🔌 Checking port 8080..."
if lsof -ti :8080 > /dev/null 2>&1; then
    echo "Killing existing process on port 8080..."
    lsof -ti :8080 | xargs kill -9 2>/dev/null || true
    sleep 2
fi
echo -e "${GREEN}✓ Port 8080 is available${NC}"
echo ""

echo "════════════════════════════════════════"
echo "✨ Setup Complete!"
echo "════════════════════════════════════════"
echo ""
echo "Now you can start using the workshop:"
echo ""
echo "1️⃣  Start the overlay server:"
echo "   ${GREEN}npm run dev${NC}"
echo ""
echo "2️⃣  In a new terminal, mint tokens:"
echo "   ${GREEN}npm run mint${NC}"
echo ""
echo "3️⃣  In another terminal, use the wallet:"
echo "   ${GREEN}npm run wallet${NC}"
echo ""
echo "📖 For detailed instructions, see:"
echo "   ${YELLOW}GETTING_STARTED.md${NC}"
echo ""
echo "🚀 Happy tokenizing on BSV!"
