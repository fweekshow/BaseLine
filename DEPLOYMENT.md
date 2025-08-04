# Deployment Guide

## Deploying to DigitalOcean

This project is configured to deploy to DigitalOcean for persistent XMTP bot operation.

### 1. Prerequisites

- DigitalOcean account
- SSH key set up
- Domain name (optional but recommended)

### 2. Create a DigitalOcean Droplet

1. **Create a new droplet:**
   - Choose Ubuntu 22.04 LTS
   - Select a plan (Basic is fine for starting)
   - Choose a datacenter region close to your users
   - Add your SSH key
   - Choose a hostname (e.g., `xmtp-wellness-bot`)

2. **Connect to your droplet:**
   ```bash
   ssh root@your-droplet-ip
   ```

### 3. Server Setup

1. **Update the system:**
   ```bash
   apt update && apt upgrade -y
   ```

2. **Install Node.js 20:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   apt-get install -y nodejs
   ```

3. **Install PM2 for process management:**
   ```bash
   npm install -g pm2
   ```

4. **Install Git:**
   ```bash
   apt install git -y
   ```

### 4. Deploy Your Application

1. **Clone your repository:**
   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   ```

2. **Install dependencies:**
   ```bash
   npm run install:planbase
   ```

3. **Create environment file:**
   ```bash
   nano .env
   ```
   
   Add your environment variables:
   ```
   WALLET_KEY=your_wallet_private_key_here
   ENCRYPTION_KEY=your_encryption_key_here
   XMTP_ENV=production
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Start the application with PM2:**
   ```bash
   pm2 start planbase/index.ts --name "xmtp-wellness-bot" --interpreter npx --interpreter-args tsx
   ```

5. **Save PM2 configuration:**
   ```bash
   pm2 save
   pm2 startup
   ```

### 5. Environment Variables

Make sure to set these environment variables in your `.env` file:

- `WALLET_KEY`: Your wallet private key
- `ENCRYPTION_KEY`: Your encryption key for the local database
- `XMTP_ENV`: XMTP environment (production or dev)
- `OPENAI_API_KEY`: Your OpenAI API key

### 6. Monitoring and Logs

- **View logs:**
  ```bash
  pm2 logs xmtp-wellness-bot
  ```

- **Monitor the process:**
  ```bash
  pm2 monit
  ```

- **Restart the bot:**
  ```bash
  pm2 restart xmtp-wellness-bot
  ```

### 7. Security Considerations

1. **Firewall setup:**
   ```bash
   ufw allow ssh
   ufw allow 80
   ufw allow 443
   ufw enable
   ```

2. **Keep your private keys secure:**
   - Never commit `.env` files to git
   - Use strong encryption keys
   - Regularly rotate keys

### 8. Local Development

To run locally:
```bash
npm run dev
```

Make sure you have a `.env` file in the root directory with the required environment variables.

### 9. Troubleshooting

- **Check if the bot is running:**
  ```bash
  pm2 status
  ```

- **View detailed logs:**
  ```bash
  pm2 logs xmtp-wellness-bot --lines 100
  ```

- **Restart if needed:**
  ```bash
  pm2 restart xmtp-wellness-bot
  ``` 