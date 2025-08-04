#!/bin/bash

# DigitalOcean Deployment Script for XMTP Wellness Bot

echo "🚀 Deploying XMTP Wellness Bot to DigitalOcean..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with the following variables:"
    echo "WALLET_KEY=your_wallet_private_key_here"
    echo "ENCRYPTION_KEY=your_encryption_key_here"
    echo "XMTP_ENV=production"
    echo "OPENAI_API_KEY=your_openai_api_key_here"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:planbase

# Check if PM2 is installed globally
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Start the application with PM2
echo "🤖 Starting XMTP Wellness Bot with PM2..."
pm2 start planbase/index.ts --name "xmtp-wellness-bot" --interpreter npx --interpreter-args tsx

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save
pm2 startup

echo "✅ Deployment complete!"
echo ""
echo "📊 Useful commands:"
echo "  pm2 status                    - Check bot status"
echo "  pm2 logs xmtp-wellness-bot   - View logs"
echo "  pm2 restart xmtp-wellness-bot - Restart bot"
echo "  pm2 monit                     - Monitor processes"
echo ""
echo "🔗 Your bot is now running and listening for XMTP messages!" 