#!/bin/bash

echo "🚀 Starting WorshipOS..."

# Start Colima if not running
if ! colima status &> /dev/null; then
    echo "Starting Colima..."
    colima start
fi

# Navigate to project directory
cd ~/worship-os

# Start Docker containers
echo "Starting Docker containers..."
docker-compose up -d

# Wait for DB to be ready
echo "Waiting for database..."
sleep 3

# Start API in background
echo "Starting Express API..."
cd api
node index.js &
API_PID=$!
cd ..

# Start UI
echo "Starting Svelte dev server..."
cd ui
npm run dev

# Cleanup on exit
trap "kill $API_PID" EXIT
