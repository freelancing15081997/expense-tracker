# Byjan Business Frontend

React 19 + Vite frontend for Byjan Business application.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment to Cloudflare Pages

1. Connect this directory to Cloudflare Pages
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variables:
   - `VITE_API_URL=https://api.easypado.com`
   - `VITE_APP_URL=https://business.easypado.com`

## Custom Domain

Configure `business.easypado.com` in Cloudflare Pages settings.
