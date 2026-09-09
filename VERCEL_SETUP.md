# Vercel Deployment Setup Guide

## Required Environment Variables

To fix the HTTP 405 login error and enable authentication, you need to configure the following environment variables in your Vercel project dashboard:

### 1. Neon Auth Configuration

Go to your [Vercel Project Settings](https://vercel.com/dashboard) → Environment Variables and add:

```
VITE_NEON_AUTH_URL=your_neon_auth_url
NEON_AUTH_BASE_URL=your_neon_auth_base_url
```

### 2. Database Configuration

```
DATABASE_URL=your_postgres_connection_string
POSTGRES_URL=your_postgres_connection_string
DATABASE_URL_UNPOOLED=your_postgres_unpooled_connection_string
POSTGRES_URL_NON_POOLING=your_postgres_unpooled_connection_string
```

### 3. Vercel Blob Storage (Optional - for file uploads)

```
BLOB_STORE_ID=your_blob_store_id
BLOB_READ_WRITE_TOKEN=your_blob_token
```

## How to Add Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project (`expense-tracker`)
3. Click on **Settings** tab
4. Click on **Environment Variables** in the left sidebar
5. Add each variable with its value
6. Select which environments (Production, Preview, Development) should have access
7. Click **Save**
8. **Redeploy** your application for changes to take effect

## After Configuration

Once environment variables are set:

1. Trigger a new deployment (or wait for automatic deployment)
2. The login functionality should work without 405 errors
3. Authentication will be handled through Neon Auth service

## Troubleshooting

### Still Getting 405 Errors?

- Verify all environment variables are saved correctly
- Check that you've redeployed after adding variables
- Ensure `VITE_NEON_AUTH_URL` includes the full URL with protocol (https://)
- Check Vercel deployment logs for any configuration errors

### Need Help Setting Up Neon Auth?

Refer to [Neon Auth Documentation](https://neon.tech/docs/guides/auth) for:
- Creating a Neon Auth instance
- Getting your auth URL
- Configuring authentication providers
