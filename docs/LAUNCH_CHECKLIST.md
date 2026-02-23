# Cachet Launch Checklist

## Prerequisites

### 1. Discord Application Setup
> Your Discord application is already configured based on the environment variables.

- [x] Bot token (`DISCORD_BOT_TOKEN`)
- [x] Client ID (`DISCORD_CLIENT_ID`)  
- [x] Client Secret (`DISCORD_CLIENT_SECRET`)

### 2. Paddle Billing Setup (Required for Paid Plans)

Paddle is used for subscription billing. Follow these steps to configure Paddle:

#### 2.1 Create a Paddle Account
1. Go to [paddle.com](https://paddle.com) and sign up for an account
2. Complete the seller verification process (requires business information)
3. Choose "Sandbox" mode for testing or "Production" for live payments

#### 2.2 Create Products and Prices
In the Paddle Dashboard, navigate to **Catalog > Products**:

1. **Growth Plan**
   - Create a new product: "Cachet Growth"
   - Add a recurring price: $19/month
   - Copy the Price ID (e.g., `pri_01h...`) → set as `PADDLE_GROWTH_PRICE_ID`

2. **Pro Plan**
   - Create a new product: "Cachet Pro"
   - Add a recurring price: $49/month
   - Copy the Price ID → set as `PADDLE_PRO_PRICE_ID`

3. **Enterprise Plan**
   - Create a new product: "Cachet Enterprise"
   - Add a recurring price: $149/month (or custom)
   - Copy the Price ID → set as `PADDLE_ENTERPRISE_PRICE_ID`

#### 2.3 Get API Credentials
1. Go to **Developer Tools > Authentication**
2. Generate an API Key → set as `PADDLE_API_KEY`

#### 2.4 Configure Webhooks
1. Go to **Developer Tools > Notifications**
2. Create a new notification destination:
   - **URL**: `https://your-api-domain.com/webhooks/paddle`
   - **Events to send**:
     - `subscription.created`
     - `subscription.activated`
     - `subscription.updated`
     - `subscription.canceled`
     - `subscription.past_due`
     - `transaction.completed`
3. Copy the webhook secret → set as `PADDLE_WEBHOOK_SECRET`

#### 2.5 Set Environment Variables
Add these to your Railway API service:

```bash
PADDLE_API_KEY=your_api_key_here
PADDLE_WEBHOOK_SECRET=pdl_ntfset_xxx
PADDLE_ENVIRONMENT=sandbox  # or "production" for live
PADDLE_GROWTH_PRICE_ID=pri_xxx
PADDLE_PRO_PRICE_ID=pri_xxx
PADDLE_ENTERPRISE_PRICE_ID=pri_xxx
```

### 3. Railway Environment Variables Checklist

#### API Service
- [x] `DATABASE_URL` - PostgreSQL connection string
- [x] `REDIS_URL` - Redis connection string
- [x] `DISCORD_BOT_TOKEN`
- [x] `DISCORD_CLIENT_ID`
- [x] `DISCORD_CLIENT_SECRET`
- [x] `MEGAETH_RPC_URL`
- [x] `JWT_SECRET`
- [x] `JWT_REFRESH_SECRET`
- [x] `BOT_API_SECRET`
- [x] `FRONTEND_URL`
- [ ] `PADDLE_API_KEY`
- [ ] `PADDLE_WEBHOOK_SECRET`
- [ ] `PADDLE_ENVIRONMENT`
- [ ] `PADDLE_GROWTH_PRICE_ID`
- [ ] `PADDLE_PRO_PRICE_ID`
- [ ] `PADDLE_ENTERPRISE_PRICE_ID`
- [ ] `SENTRY_DSN` (optional - for error tracking)

#### Bot Service
- [x] `DISCORD_BOT_TOKEN`
- [x] `API_URL`
- [x] `BOT_API_SECRET`
- [ ] `SENTRY_DSN` (optional)

#### Web Service
- [x] `NEXT_PUBLIC_API_URL`
- [x] `NEXT_PUBLIC_SITE_URL`
- [ ] `NEXT_PUBLIC_DISCORD_CLIENT_ID` → Set to: `1474193316693278915`
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (optional)

#### Worker Service
- [x] `DATABASE_URL`
- [x] `REDIS_URL`
- [x] `MEGAETH_RPC_URL`
- [ ] `SENTRY_DSN` (optional)

### 4. WalletConnect Setup (Optional)

If you want WalletConnect support for mobile wallets:

1. Go to [cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Create a new project
3. Copy the Project ID → set as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

### 5. Sentry Error Tracking (Optional)

1. Create a Sentry project at [sentry.io](https://sentry.io)
2. Get the DSN from project settings
3. Set `SENTRY_DSN` on api, bot, and worker services

## Post-Launch

### Database Migrations
Ensure migrations are run:
```bash
pnpm --filter @megaeth-verify/db db:push
```

### Bot Command Registration
Register Discord slash commands:
```bash
pnpm --filter bot register-commands
```

### Verify Webhooks
1. Test a checkout flow in Paddle sandbox
2. Check Railway logs for API service to verify webhook events are received
3. Confirm subscription status updates in database

## Testing Paddle Integration

### Sandbox Testing
1. Set `PADDLE_ENVIRONMENT=sandbox`
2. Use Paddle's test cards for checkout:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`

### Production Checklist
- [ ] Switch to production API key
- [ ] Update webhook URL to production domain
- [ ] Change `PADDLE_ENVIRONMENT=production`
- [ ] Replace sandbox Price IDs with production Price IDs
- [ ] Test a real transaction (can refund immediately)
