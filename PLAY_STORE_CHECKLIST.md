# Google Play Store Deployment Checklist

Complete this checklist before submitting your app to Google Play Store.

## Prerequisites

### Developer Account
- [ ] Create Google Play Developer account ($25 one-time fee)
- [ ] Complete developer profile
- [ ] Set up merchant account (if selling paid apps/in-app purchases)

### App Preparation
- [ ] Final testing on real devices
- [ ] All features working correctly
- [ ] Firebase Auth tested and working
- [ ] Push notifications configured and tested
- [ ] No critical bugs or crashes

## Firebase Configuration

### Firebase Console
- [ ] Download `google-services.json` for Android
- [ ] Add to `android/app/google-services.json`
- [ ] Enable Firebase Authentication
- [ ] Enable Cloud Messaging (FCM)
- [ ] Get SHA-1 fingerprint: `cd android && ./gradlew signingReport`
- [ ] Get SHA-256 fingerprint (same command)
- [ ] Add SHA-1 and SHA-256 to Firebase Console

### Test Firebase Features
- [ ] Email/Password login works
- [ ] Google Sign-In works
- [ ] Push notifications received
- [ ] No Firebase errors in logs

## Release Build Configuration

### Create Keystore
```bash
cd android/app
keytool -genkey -v -keystore byjan-release.keystore \
  -alias byjan -keyalg RSA -keysize 2048 -validity 10000
```

- [ ] Keystore created and saved securely
- [ ] Store password recorded securely
- [ ] Key password recorded securely
- [ ] Backup keystore file (CRITICAL - cannot be recovered!)

### Configure Signing
- [ ] Copy `android/gradle.properties.template` to `android/gradle.properties`
- [ ] Update gradle.properties with keystore details:
  ```properties
  BYJAN_RELEASE_STORE_FILE=./app/byjan-release.keystore
  BYJAN_RELEASE_KEY_ALIAS=byjan
  BYJAN_RELEASE_STORE_PASSWORD=your_password
  BYJAN_RELEASE_KEY_PASSWORD=your_password
  ```
- [ ] Verify gradle.properties is in .gitignore
- [ ] Never commit keystore or passwords to git

### Build Release
```bash
npm run mobile:build:android:bundle
```

- [ ] Build completes successfully
- [ ] AAB file created: `android/app/build/outputs/bundle/release/app-release.aab`
- [ ] File size is reasonable (< 150MB)
- [ ] Test the release build on a real device

## App Store Listing

### App Information
- [ ] App name: **Byjan**
- [ ] Short description (80 characters max)
- [ ] Full description (4000 characters max)
- [ ] Package name: `com.byjan.app`
- [ ] Category: **Finance**
- [ ] Content rating: Complete questionnaire
- [ ] Privacy policy URL (REQUIRED)

### Store Listing Assets

#### Icon
- [ ] 512 x 512 px
- [ ] 32-bit PNG with alpha
- [ ] High resolution
- [ ] Represents your brand

#### Feature Graphic
- [ ] 1024 x 500 px
- [ ] JPG or 24-bit PNG (no alpha)
- [ ] Shows app features/branding

#### Screenshots (Phone)
- [ ] Minimum 2 screenshots required
- [ ] Recommended: 4-8 screenshots
- [ ] Min: 320 px
- [ ] Max: 3840 px
- [ ] 16:9 or 9:16 aspect ratio
- [ ] JPEG or 24-bit PNG (no alpha)

#### Screenshots (7-inch Tablet) - Optional
- [ ] Same requirements as phone
- [ ] Shows tablet optimization

#### Screenshots (10-inch Tablet) - Optional
- [ ] Same requirements as phone
- [ ] Shows tablet optimization

#### Video - Optional
- [ ] YouTube URL
- [ ] Shows app features and usage
- [ ] Professional quality

### Descriptions

#### Short Description (80 chars)
```
Track finances easily. Books and expense tracking in one workspace.
```

#### Full Description Template
```
Byjan - Trace Financials Easily

Manage your finances with ease using Byjan, the all-in-one financial tracking app that combines books and expense tracking in a single, intuitive workspace.

KEY FEATURES:
• 📊 Comprehensive financial tracking
• 📱 Mobile-optimized interface
• 🔒 Secure Firebase authentication
• 📸 Receipt scanning with camera
• 🔔 Smart notifications for budget alerts
• 📍 Location-based expense tracking
• 📤 Easy expense sharing
• 💰 Budget management
• 📈 Financial insights and reports
• 🌐 Sync across devices

PERFECT FOR:
✓ Personal finance tracking
✓ Small business accounting
✓ Expense reporting
✓ Budget planning
✓ Financial goal setting

SECURITY & PRIVACY:
Your financial data is secure with industry-standard encryption and authentication. We never share your personal information with third parties.

FEATURES YOU'LL LOVE:
• Intuitive expense entry with camera support
• Real-time budget tracking
• Smart categorization
• Custom reports and analytics
• Multi-workspace support
• Offline mode
• Cloud sync

Download Byjan today and take control of your finances!

SUPPORT:
Need help? Contact us at support@byjan.com
Visit: https://byjan.com

Privacy Policy: https://byjan.com/privacy
Terms of Service: https://byjan.com/terms
```

## Privacy & Legal

### Privacy Policy
- [ ] Create privacy policy page
- [ ] Host at public URL
- [ ] Include:
  - [ ] What data you collect
  - [ ] How data is used
  - [ ] How data is protected
  - [ ] User rights (GDPR/CCPA)
  - [ ] Contact information
- [ ] Add URL to Play Console

### Terms of Service
- [ ] Create terms of service
- [ ] Host at public URL
- [ ] Add link in app settings

### Data Safety Section
Complete in Play Console:
- [ ] Data collection details
- [ ] Data sharing practices
- [ ] Security practices
- [ ] Data deletion policy

## App Content

### Content Rating
Complete the questionnaire:
- [ ] Violence
- [ ] Sexual content
- [ ] Language
- [ ] Controlled substances
- [ ] User interaction
- [ ] Social features

### Target Audience
- [ ] Select age groups
- [ ] Finance apps typically: Ages 18+

### News Apps
- [ ] Declare if app contains news content

## Store Settings

### Pricing & Distribution
- [ ] Set pricing (Free recommended initially)
- [ ] Select countries/regions for distribution
- [ ] Opt-in to Google Play for Education (optional)

### App Access
- [ ] Declare if app requires login
- [ ] Provide test credentials if needed
- [ ] Explain any restricted features

### Ads
- [ ] Declare if app contains ads
- [ ] Specify ad networks used

### In-App Purchases
- [ ] Declare in-app purchases (if applicable)
- [ ] Configure products in Play Console

## Technical Requirements

### App Bundle
- [ ] Upload AAB (not APK)
- [ ] Target API level 34 (Android 14) or higher
- [ ] Min API level 22 (Android 5.1) or higher

### Permissions
Verify necessary permissions in manifest:
- [ ] Internet
- [ ] Camera
- [ ] Location (if used)
- [ ] Storage
- [ ] Notifications
- [ ] Network state

### App Signing
- [ ] Enroll in Google Play App Signing (RECOMMENDED)
- [ ] Upload signing key
- [ ] Download upload certificate

## Testing

### Internal Testing
- [ ] Create internal testing track
- [ ] Add testers (email addresses)
- [ ] Upload first release to internal
- [ ] Distribute to testers
- [ ] Gather feedback
- [ ] Fix issues

### Closed Testing (Alpha)
- [ ] Create closed testing track
- [ ] Add test users
- [ ] Upload release
- [ ] Test thoroughly
- [ ] Address feedback

### Open Testing (Beta) - Optional
- [ ] Create open testing track
- [ ] Upload release
- [ ] Public or limited availability
- [ ] Monitor feedback and crash reports

### Pre-Launch Report
- [ ] Review automated test results
- [ ] Fix any critical issues
- [ ] Check compatibility with different devices
- [ ] Review security scan results

## Production Release

### Final Checks
- [ ] All crashes fixed
- [ ] App tested on multiple devices
- [ ] All features working
- [ ] Performance optimized
- [ ] Security reviewed
- [ ] Legal documents in place

### Release Notes
```
Version 1.0.0 - Initial Release

Welcome to Byjan!

Features:
• Comprehensive financial tracking
• Secure authentication
• Receipt scanning
• Budget management
• Real-time notifications
• Multi-device sync

We're excited to help you manage your finances!
```

### Production Rollout
- [ ] Create production release
- [ ] Upload signed AAB
- [ ] Set rollout percentage (start with 10-20%)
- [ ] Add release notes
- [ ] Review release details
- [ ] Submit for review

### Post-Launch
- [ ] Monitor Google Play Console for:
  - [ ] Crash reports
  - [ ] ANRs (Application Not Responding)
  - [ ] User reviews
  - [ ] Performance metrics
- [ ] Respond to user reviews
- [ ] Plan updates based on feedback

## App Store Optimization (ASO)

### Keywords
Research and include relevant keywords:
- Finance tracking
- Expense manager
- Budget planner
- Financial app
- Accounting
- Money manager

### Localization (Optional)
- [ ] Translate app name
- [ ] Translate descriptions
- [ ] Localize screenshots
- [ ] Add localized keywords

## Marketing

### Launch Plan
- [ ] Prepare announcement
- [ ] Social media posts
- [ ] Email newsletter
- [ ] Website update
- [ ] Press release (optional)

### App Landing Page
- [ ] Create landing page
- [ ] Add Play Store badge
- [ ] Link to privacy policy
- [ ] Add screenshots/video
- [ ] Include features list

## Support

### Customer Support
- [ ] Set up support email
- [ ] Create FAQ page
- [ ] Prepare support documentation
- [ ] Set up feedback system

### Analytics
- [ ] Firebase Analytics configured
- [ ] Crash reporting enabled
- [ ] User engagement tracking
- [ ] Conversion tracking

## Compliance

### GDPR (EU Users)
- [ ] Data processing agreement
- [ ] User consent mechanism
- [ ] Data export capability
- [ ] Data deletion capability
- [ ] Privacy policy updated

### CCPA (California Users)
- [ ] Do Not Sell disclosure
- [ ] Privacy rights information
- [ ] Opt-out mechanism

## Timeline

Typical approval process:
- Review time: 1-7 days (usually 1-2 days)
- Initial reviews may take longer
- Updates usually faster
- Plan for at least 1 week before hard launch

## Emergency Contacts

Keep these handy:
- [ ] Keystore backup location
- [ ] Keystore passwords (secure location)
- [ ] Firebase project admin access
- [ ] Google Play Console admin access
- [ ] Development team contacts

## Post-Submission

After submitting:
1. Monitor Play Console for review status
2. Check email for any issues from Google
3. Be ready to provide additional info if requested
4. Do NOT change app drastically during review
5. Prepare for quick updates if issues found

## Version Updates

For future versions:
- [ ] Increment version code in build.gradle
- [ ] Update version name
- [ ] Write release notes
- [ ] Test thoroughly before uploading
- [ ] Consider staged rollout

## Success Metrics

Track these after launch:
- [ ] Install rate
- [ ] Crash-free users %
- [ ] User retention
- [ ] Average rating
- [ ] Daily active users
- [ ] Conversion rate (if applicable)

---

## Quick Reference

**Package Name**: com.byjan.app
**App Name**: Byjan
**Category**: Finance
**Target SDK**: 34 (Android 14)
**Min SDK**: 22 (Android 5.1)
**Build Type**: Release AAB

**Build Command**: 
```bash
npm run mobile:build:android:bundle
```

**Output Location**: 
```
android/app/build/outputs/bundle/release/app-release.aab
```

---

Good luck with your app launch! 🚀
