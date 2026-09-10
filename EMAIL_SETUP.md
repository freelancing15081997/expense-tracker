# Email Notification Setup Guide

Your email notifications are failing because SMTP credentials are not configured. Follow this guide to fix it.

## 🚨 Why Emails Are Failing

The application uses nodemailer to send email notifications, but it requires:
- `SMTP_USER` - Your email address
- `SMTP_PASS` - Your email password/app password
- `SMTP_HOST` - SMTP server (defaults to Gmail)
- `SMTP_PORT` - SMTP port (defaults to 587)

**Without these, ALL email notifications will fail!**

---

## ✅ Quick Fix - Gmail Setup (Recommended)

### Step 1: Enable 2-Step Verification
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click on "2-Step Verification"
3. Follow the prompts to enable it (if not already enabled)

### Step 2: Create App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select:
   - **App:** Mail
   - **Device:** Other (Custom name)
3. Name it: "Byjan Expense Tracker"
4. Click **Generate**
5. Copy the 16-character password (it looks like: `abcd efgh ijkl mnop`)
6. Remove spaces: `abcdefghijklmnop`

### Step 3: Add to Environment Variables

**Local Development** (`.env` file):
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcdefghijklmnop
```

**Production** (Vercel/Your hosting):
- Go to your deployment dashboard
- Add environment variables:
  - `SMTP_HOST` = `smtp.gmail.com`
  - `SMTP_PORT` = `587`
  - `SMTP_USER` = `your-email@gmail.com`
  - `SMTP_PASS` = `abcdefghijklmnop` (your app password)

### Step 4: Redeploy
```bash
# Redeploy your application
git push
# or for Vercel: vercel --prod
```

---

## 🔧 Alternative SMTP Providers

### SendGrid (Free tier: 100 emails/day)
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```
Get API key: https://app.sendgrid.com/settings/api_keys

### Mailgun (Free tier: 100 emails/day)
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
```
Get credentials: https://app.mailgun.com/

### AWS SES (Pay as you go, very cheap)
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-aws-smtp-username
SMTP_PASS=your-aws-smtp-password
```
Setup: https://console.aws.amazon.com/ses/

### Resend (Developer friendly, generous free tier)
```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_your-api-key
```
Get API key: https://resend.com/api-keys

---

## 🧪 Testing Email Setup

After configuration, test email sending:

### Method 1: Via Application
1. Go to Settings → Configured Emails
2. Add a test email
3. Try sending a notification
4. Check if email arrives

### Method 2: Via API (curl)
```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "message": "This is a test notification"
  }'
```

---

## ❌ Common Errors & Solutions

### Error: "Email authentication failed"
**Cause:** Wrong username/password or regular password instead of App Password
**Solution:** 
- For Gmail: Use App Password, not your regular password
- For other providers: Check your credentials are correct

### Error: "Cannot connect to email server"
**Cause:** Wrong SMTP host or port, or firewall blocking
**Solution:**
- Verify SMTP_HOST and SMTP_PORT are correct
- Check your hosting provider allows outbound port 587
- Try port 465 (SSL) or 2525 as alternatives

### Error: "Email notifications are not configured"
**Cause:** Missing SMTP_USER or SMTP_PASS environment variables
**Solution:** Add all required environment variables

### Error: "Daily sending quota exceeded"
**Cause:** Gmail has a daily sending limit (100-500 emails/day)
**Solution:** 
- Use a dedicated email service (SendGrid, Mailgun, etc.)
- These have higher limits (thousands/day)

---

## 📊 What Emails Are Sent?

The application sends notifications for:
- ✅ **Add Expense Alert** - When new expense is added
- ✅ **Edit Expense Alert** - When expense is modified
- ✅ **Delete Expense Alert** - When expense is removed
- ✅ **Monthly Digest** - Monthly spending summary
- ✅ **Daily Budget Reminder** - Daily spending alerts
- ✅ **PDF Reports** - Emailed expense reports

---

## 🔒 Security Best Practices

1. **Never commit credentials** - Add `.env` to `.gitignore`
2. **Use App Passwords** - Don't use your main Gmail password
3. **Rotate credentials** - Change passwords periodically
4. **Limit permissions** - Use dedicated email accounts
5. **Monitor usage** - Watch for suspicious activity

---

## 🆘 Still Not Working?

1. **Check environment variables are loaded:**
   ```bash
   # In your server logs, check if they're set
   console.log('SMTP configured:', !!process.env.SMTP_USER);
   ```

2. **Check firewall/network:**
   - Ensure outbound connections on port 587 are allowed
   - Some hosting providers block SMTP by default

3. **Check email logs:**
   - Look in your server logs for detailed error messages
   - Check spam folder for test emails

4. **Try a different provider:**
   - Gmail can be finicky
   - SendGrid/Mailgun are more reliable for apps

---

## ✅ Verification Checklist

- [ ] 2-Step Verification enabled on Gmail
- [ ] App Password generated
- [ ] Environment variables added to `.env`
- [ ] Environment variables added to production
- [ ] Application redeployed
- [ ] Test email sent successfully
- [ ] Email received (check spam folder)
- [ ] All notification types working

---

**Once configured, your email notifications will work perfectly!** 📧✨
