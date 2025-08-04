# DigitalOcean Setup Guide

## Quick Setup Steps

### 1. Create a DigitalOcean Droplet

1. Go to [DigitalOcean](https://digitalocean.com) and create an account
2. Click "Create" → "Droplets"
3. Choose these settings:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic (1GB RAM, 1 CPU is fine to start)
   - **Datacenter**: Choose closest to your users
   - **Authentication**: SSH Key (recommended) or Password
   - **Hostname**: `xmtp-wellness-bot`

### 2. Connect to Your Droplet

```bash
ssh root@your-droplet-ip
```

### 3. Initial Server Setup

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install Git
apt install git -y

# Install PM2 globally
npm install -g pm2
```

### 4. Deploy Your Bot

```bash
# Clone your repository
git clone https://github.com/your-username/your-repo.git
cd your-repo

# Create .env file
nano .env
```

Add your environment variables to `.env`:
```
WALLET_KEY=your_wallet_private_key_here
ENCRYPTION_KEY=your_encryption_key_here
XMTP_ENV=production
OPENAI_API_KEY=your_openai_api_key_here
```

```bash
# Run the deployment script
./deploy.sh
```

### 5. Verify It's Working

```bash
# Check if the bot is running
pm2 status

# View logs
pm2 logs xmtp-wellness-bot

# Monitor the process
pm2 monit
```

## Cost Estimate

- **Basic Droplet**: $6-12/month (1GB RAM, 1 CPU)
- **Standard Droplet**: $12-24/month (2GB RAM, 1 CPU) - recommended for production

## Security Tips

1. **Set up firewall**:
   ```bash
   ufw allow ssh
   ufw allow 80
   ufw allow 443
   ufw enable
   ```

2. **Keep your private keys secure**:
   - Never commit `.env` files to git
   - Use strong encryption keys
   - Regularly rotate keys

3. **Monitor your bot**:
   ```bash
   # Check logs regularly
   pm2 logs xmtp-wellness-bot --lines 50
   
   # Monitor system resources
   htop
   ```

## Troubleshooting

- **Bot not responding**: Check logs with `pm2 logs xmtp-wellness-bot`
- **High memory usage**: Consider upgrading to a larger droplet
- **Connection issues**: Check firewall settings and network connectivity

## Useful Commands

```bash
# Restart the bot
pm2 restart xmtp-wellness-bot

# Stop the bot
pm2 stop xmtp-wellness-bot

# Start the bot
pm2 start xmtp-wellness-bot

# View real-time logs
pm2 logs xmtp-wellness-bot --lines 100 -f

# Monitor all processes
pm2 monit
``` 