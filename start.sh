#!/bin/bash

# ============================================
# AI Autonomous Vehicle Simulator - Start Script
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   🚗 AI Autonomous Vehicle Simulator             ║"
echo "║   Training & Testing Self-Driving Algorithms      ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Load .env
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
else
    echo -e "${RED}❌ .env file not found! Please create one.${NC}"
    exit 1
fi

BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

# ============================================
# Clean used ports
# ============================================
echo -e "${YELLOW}🔄 Cleaning used ports...${NC}"

cleanup_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}   Killing processes on port $port: $pids${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

cleanup_port $BACKEND_PORT
cleanup_port $FRONTEND_PORT

echo -e "${GREEN}✅ Ports cleaned${NC}"

# ============================================
# Check PostgreSQL
# ============================================
echo -e "${BLUE}🔍 Checking PostgreSQL...${NC}"

if command -v pg_isready &> /dev/null; then
    if pg_isready -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} &> /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL is running${NC}"
    else
        echo -e "${YELLOW}⚠️  PostgreSQL is not running. Attempting to start...${NC}"
        if command -v brew &> /dev/null; then
            brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
        elif command -v pg_ctl &> /dev/null; then
            pg_ctl start -D /usr/local/var/postgres 2>/dev/null || true
        fi
        sleep 3
        if pg_isready -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} &> /dev/null; then
            echo -e "${GREEN}✅ PostgreSQL started${NC}"
        else
            echo -e "${RED}❌ Could not start PostgreSQL. Please start it manually.${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠️  pg_isready not found, assuming PostgreSQL is running${NC}"
fi

# ============================================
# Create database if not exists
# ============================================
echo -e "${BLUE}🗄️  Setting up database...${NC}"

DB_NAME=${DB_NAME:-av_simulator}
DB_USER=${DB_USER:-postgres}

createdb -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U "$DB_USER" "$DB_NAME" 2>/dev/null && \
    echo -e "${GREEN}✅ Database '$DB_NAME' created${NC}" || \
    echo -e "${GREEN}✅ Database '$DB_NAME' already exists${NC}"

# ============================================
# Install dependencies
# ============================================
echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
cd "$PROJECT_DIR/backend"
npm install --silent 2>&1 | tail -1

echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
cd "$PROJECT_DIR/frontend"
npm install --silent 2>&1 | tail -1

echo -e "${GREEN}✅ Dependencies installed${NC}"

# ============================================
# Seed database
# ============================================
echo -e "${PURPLE}🌱 Seeding database with sample data...${NC}"
cd "$PROJECT_DIR/backend"
node src/seeds/index.js
echo -e "${GREEN}✅ Database seeded${NC}"

# ============================================
# Start services with hot reload
# ============================================
echo -e "${CYAN}🚀 Starting services with hot reload...${NC}"

# Start backend with nodemon for hot reload
cd "$PROJECT_DIR/backend"
npx nodemon src/server.js --watch src &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend starting on port $BACKEND_PORT (PID: $BACKEND_PID)${NC}"

# Start frontend with React dev server (has built-in hot reload)
cd "$PROJECT_DIR/frontend"
PORT=$FRONTEND_PORT BROWSER=none npm start &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend starting on port $FRONTEND_PORT (PID: $FRONTEND_PID)${NC}"

# ============================================
# Wait and show info
# ============================================
sleep 3

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗"
echo -e "║                                                  ║"
echo -e "║   🚗 AV Simulator is running!                    ║"
echo -e "║                                                  ║"
echo -e "║   Frontend:  http://localhost:$FRONTEND_PORT              ║"
echo -e "║   Backend:   http://localhost:$BACKEND_PORT              ║"
echo -e "║                                                  ║"
echo -e "║   Demo Login:                                    ║"
echo -e "║   📧 Email:    admin@avsimulator.com              ║"
echo -e "║   🔑 Password: admin123                           ║"
echo -e "║                                                  ║"
echo -e "║   Hot reload is enabled for both servers.        ║"
echo -e "║   Press Ctrl+C to stop all services.             ║"
echo -e "║                                                  ║"
echo -e "╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Trap to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    cleanup_port $BACKEND_PORT
    cleanup_port $FRONTEND_PORT
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
