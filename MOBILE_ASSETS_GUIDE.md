# Mobile App Assets Guide

This guide covers all visual assets needed for your mobile app and Google Play Store listing.

## App Icons

### Required Sizes

Create your app icon in these sizes and place them in the Android project:

#### Launcher Icons
- **mdpi** (48x48) → `android/app/src/main/res/mipmap-mdpi/ic_launcher.png`
- **hdpi** (72x72) → `android/app/src/main/res/mipmap-hdpi/ic_launcher.png`
- **xhdpi** (96x96) → `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`
- **xxhdpi** (144x144) → `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`
- **xxxhdpi** (192x192) → `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`

### Quick Icon Generation

#### Option 1: Use Android Studio
1. Right-click `res` folder in Android Studio
2. New → Image Asset
3. Upload your 512x512 icon
4. Select "Launcher Icons (Adaptive and Legacy)"
5. Click "Next" then "Finish"

#### Option 2: Use Online Tools
- https://easyappicon.com/
- https://appicon.co/
- https://icon.kitchen/

Upload a 1024x1024 PNG and download all sizes.

#### Option 3: Use imagemagick (CLI)
```bash
# Install imagemagick
# macOS: brew install imagemagick
# Ubuntu: sudo apt install imagemagick

# Generate all sizes from a 1024x1024 source
convert source-icon.png -resize 48x48 mipmap-mdpi/ic_launcher.png
convert source-icon.png -resize 72x72 mipmap-hdpi/ic_launcher.png
convert source-icon.png -resize 96x96 mipmap-xhdpi/ic_launcher.png
convert source-icon.png -resize 144x144 mipmap-xxhdpi/ic_launcher.png
convert source-icon.png -resize 192x192 mipmap-xxxhdpi/ic_launcher.png
```

### Icon Design Guidelines

**DO:**
- ✅ Use simple, recognizable design
- ✅ Use your brand colors
- ✅ Make it look good at small sizes
- ✅ Use PNG format with transparency
- ✅ Center the important elements
- ✅ Test on different backgrounds

**DON'T:**
- ❌ Use text (too small to read)
- ❌ Use photos (won't scale well)
- ❌ Use complex gradients
- ❌ Copy other app icons
- ❌ Use too many colors
- ❌ Include padding (Android adds this)

### Current Icon
The default Capacitor icon is currently in place. Replace it with your brand icon.

## Splash Screen

### Required Sizes

Splash screens for different orientations and densities:

#### Portrait
- **mdpi** (320x480) → `drawable-port-mdpi/splash.png`
- **hdpi** (480x800) → `drawable-port-hdpi/splash.png`
- **xhdpi** (720x1280) → `drawable-port-xhdpi/splash.png`
- **xxhdpi** (1080x1920) → `drawable-port-xxhdpi/splash.png`
- **xxxhdpi** (1440x2560) → `drawable-port-xxxhdpi/splash.png`

#### Landscape
- **mdpi** (480x320) → `drawable-land-mdpi/splash.png`
- **hdpi** (800x480) → `drawable-land-hdpi/splash.png`
- **xhdpi** (1280x720) → `drawable-land-xhdpi/splash.png`
- **xxhdpi** (1920x1080) → `drawable-land-xxhdpi/splash.png`
- **xxxhdpi** (2560x1440) → `drawable-land-xxxhdpi/splash.png`

### Splash Screen Design

**Recommended Design:**
```
┌─────────────────────┐
│                     │
│                     │
│      [LOGO]         │  ← Your app logo/icon
│                     │
│      Byjan          │  ← App name
│                     │
│                     │
└─────────────────────┘
```

**Colors:**
- Background: `#0B1F3A` (dark blue - matches your theme)
- Logo/Text: White or light color

**Tips:**
- Keep it simple
- Use your brand colors
- Center the logo
- Match your app theme
- Don't put too much content

### Generate Splash Screens

Use Capacitor's splash screen generator:

```bash
npm install -g @capacitor/assets

# Place a 2732x2732 splash.png in resources folder
mkdir resources
# Add resources/splash.png (2732x2732)

# Generate all sizes
npx capacitor-assets generate --splash resources/splash.png
```

Or use: https://apetools.webprofusion.com/app/#/tools/imagegorilla

## Google Play Store Assets

### Required Assets

#### 1. App Icon (512x512)
- Format: 32-bit PNG with alpha
- Size: 512 x 512 pixels
- Used: Play Store listing icon

#### 2. Feature Graphic (1024x500)
- Format: JPG or 24-bit PNG (no alpha)
- Size: 1024 x 500 pixels
- Used: Top of Play Store listing
- Design: Show app features/branding

#### 3. Phone Screenshots
- **Required**: At least 2 screenshots
- **Recommended**: 4-8 screenshots
- **Min**: 320px
- **Max**: 3840px
- **Aspect ratio**: 16:9 or 9:16
- **Format**: JPG or 24-bit PNG (no alpha)

#### 4. Tablet Screenshots (Optional)
Same requirements as phone screenshots, showing tablet layout.

#### 5. Promo Video (Optional)
- **Format**: YouTube URL
- **Length**: 30 seconds to 2 minutes
- **Content**: App demo/features

### Screenshot Guidelines

**What to Capture:**
1. **Login/Onboarding** - First impression
2. **Dashboard/Home** - Main screen
3. **Key Features** - Expense tracking, reports
4. **Camera/Receipt** - Mobile-specific features
5. **Settings/Profile** - User customization

**Best Practices:**
- ✅ Use real (or realistic) data
- ✅ Show the best features
- ✅ Highlight mobile-specific features
- ✅ Use clean, organized layouts
- ✅ Remove personal data
- ✅ Use light AND dark mode screenshots
- ✅ Add text overlays (optional)

**Screenshot Tools:**
- Android Studio Emulator (Ctrl+S / Cmd+S)
- Real device: Volume Down + Power
- adb: `adb shell screencap -p /sdcard/screen.png`
- Edit with: Figma, Canva, Photoshop

### Creating Feature Graphic

**Design Template:**

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  📱 [App Icon]     Byjan                              │
│                    Trace Financials Easily             │
│                                                        │
│  💰 Budget Tracking   📊 Reports   📸 Receipt Scan   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Design Tools:**
- Canva (easy): https://www.canva.com/
- Figma (professional): https://figma.com/
- Photoshop (advanced)

**Templates:**
- Search "Play Store feature graphic template"
- Many free templates available

## Asset Checklist

### App Assets
- [ ] App icon (all sizes)
- [ ] Splash screens (all sizes and orientations)
- [ ] Notification icon (optional, can use app icon)
- [ ] Status bar icon (optional)

### Play Store Assets
- [ ] 512x512 high-res icon
- [ ] 1024x500 feature graphic
- [ ] 2-8 phone screenshots
- [ ] 2-8 tablet screenshots (optional)
- [ ] Promo video (optional)

### Branding
- [ ] App name decided
- [ ] Color scheme defined
- [ ] Typography chosen
- [ ] Consistent visual style

## Current Assets Location

```
android/app/src/main/res/
├── mipmap-mdpi/
│   ├── ic_launcher.png           ← Replace with your icon
│   └── ic_launcher_round.png
├── mipmap-hdpi/
│   ├── ic_launcher.png
│   └── ic_launcher_round.png
├── mipmap-xhdpi/
│   ├── ic_launcher.png
│   └── ic_launcher_round.png
├── mipmap-xxhdpi/
│   ├── ic_launcher.png
│   └── ic_launcher_round.png
├── mipmap-xxxhdpi/
│   ├── ic_launcher.png
│   └── ic_launcher_round.png
├── drawable-port-mdpi/
│   └── splash.png                ← Replace with your splash
├── drawable-port-hdpi/
│   └── splash.png
└── ... (more splash screens)
```

## Asset Optimization

### Compression
Compress PNG files without quality loss:

```bash
# Install tools
npm install -g pngquant

# Compress
pngquant icon.png --quality=70-85 --output icon-compressed.png
```

Online tools:
- https://tinypng.com/
- https://compressor.io/

### Validation
Check your assets meet requirements:
- Android Studio: Analyze → Inspect Code
- Online validator: https://www.norio.be/android-feature-graphic-generator/

## Automation

### Capacitor Assets (Recommended)

```bash
# Install
npm install -g @capacitor/assets

# Setup resources folder
mkdir resources
# Add resources/icon.png (1024x1024)
# Add resources/splash.png (2732x2732)

# Generate all assets
npx capacitor-assets generate
```

This generates all icon and splash screen sizes automatically!

## Testing Assets

### Preview Icon
1. Install app on device
2. Check home screen icon
3. Check app drawer icon
4. Check recent apps icon

### Preview Splash
1. Close app completely
2. Open app
3. Watch splash screen
4. Verify timing (2 seconds configured)

### Preview on Play Store
Use internal testing track to preview how assets look on Play Store.

## Resources

### Design Inspiration
- Material Design: https://material.io/
- Dribble: https://dribbble.com/tags/app-icon
- Behance: https://www.behance.net/

### Icon Tools
- Android Asset Studio: https://romannurik.github.io/AndroidAssetStudio/
- App Icon Generator: https://appicon.co/
- Icon Kitchen: https://icon.kitchen/

### Design Tools
- Figma: https://figma.com/
- Canva: https://canva.com/
- GIMP (free): https://www.gimp.org/

### Color Palette
Current app colors:
- Primary: `#0B1F3A` (dark blue)
- Secondary: Various blues and grays
- Accent: Use from your existing web design

## Quick Start Checklist

For a quick launch (replace defaults later):

1. **Quick Icon** (5 min)
   - Use Android Studio Image Asset generator
   - Upload a simple logo
   - Generate all sizes

2. **Quick Splash** (5 min)
   - Create 2732x2732 image
   - Dark blue background
   - White logo/text centered
   - Use Capacitor Assets to generate

3. **Quick Screenshots** (10 min)
   - Run app on emulator
   - Take 4 screenshots
   - Crop to consistent size

4. **Feature Graphic** (15 min)
   - Use Canva template
   - Add app name and tagline
   - Export as 1024x500

**Total time: ~35 minutes to get basic assets**

Then improve them later before official launch!

---

**Remember**: Good assets significantly impact install rates. Invest time in quality visuals!
