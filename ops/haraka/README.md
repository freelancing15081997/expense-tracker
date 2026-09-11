# Byjan inbound with Haraka (no Brevo inbound plan)

Goal: mail to *@in.easypado.com hits your VPS (Haraka), which POSTs JSON to
https://www.easypado.com/api/email/inbound
Attachments are sent inline (base64) so Byjan does not call Brevo.

## 1) DNS (at your domain host)

Create MX only for the subdomain in.easypado.com (leave easypado.com MX alone):

  Host: in.easypado.com
  Type: MX
  Priority: 10
  Value: mail.in.easypado.com   (or the hostname of your VPS)

Also create an A (or AAAA) record:

  Host: mail.in.easypado.com
  Type: A
  Value: YOUR_VPS_PUBLIC_IP

Optional but recommended:
  SPF TXT on in.easypado.com: v=spf1 mx -all
  Open TCP 25 inbound on the VPS firewall / security group.

## 2) Vercel env (Byjan app)

  INBOUND_WEBHOOK_SECRET=71ae7b626af325d57cade1d59c4a41e11c8d77c3d0061bb3baafeac69935ace9

(BREVO_INBOUND_SECRET still works as a fallback name.)
Redeploy after saving. You do NOT need a Brevo inbound / webhook plan for this path.
Keep Brevo SMTP only if you still use it to *send* team notification emails.

## 3) Install Haraka on a small VPS (Ubuntu example)

  sudo apt update
  sudo apt install -y nodejs npm
  # Node 18+ recommended

  cd /opt
  sudo mkdir -p byjan-haraka && sudo chown $USER:$USER byjan-haraka
  # Copy this ops/haraka folder to /opt/byjan-haraka
  cd /opt/byjan-haraka
  npm install

  export BYJAN_INBOUND_URL=https://www.easypado.com/api/email/inbound
  export BYJAN_INBOUND_SECRET=71ae7b626af325d57cade1d59c4a41e11c8d77c3d0061bb3baafeac69935ace9

  # Test without binding 25 first:
  # edit config/smtp.ini listen=0.0.0.0:2525 then:
  npx haraka -c .

  # Production on port 25 (needs root or setcap):
  sudo BYJAN_INBOUND_URL=... BYJAN_INBOUND_SECRET=... npx haraka -c /opt/byjan-haraka

Use systemd so it restarts on reboot (example unit at bottom).

## 4) Smoke test

From any machine after MX propagates:

  Send mail FROM a ledger member address
  TO expense-sample@in.easypado.com
  Attach a small JPG/PNG or put "Amount paid: Rs. 100" in the body.

Then open the ledger → Email Activity. You should see status Added or Not added.

Local webhook test (no DNS):

  curl -sS -X POST "https://www.easypado.com/api/email/inbound?secret=YOUR_SECRET" \
    -H "content-type: application/json" \
    -H "x-inbound-secret: YOUR_SECRET" \
    -d '{"source":"haraka","from":"member@gmail.com","to":["expense-sample@in.easypado.com"],"subject":"Petrol","text":"Amount paid: Rs. 199.00","attachments":[]}'

## 5) Speed notes

- Haraka posts as soon as the message is received.
- Byjan stores the entry before finishing notification emails.
- Keep attachments under ~3.5MB (Vercel request body limit).
- Prefer text amount in the mail body for the fastest parse; photos need GEMINI_API_KEY only when amount is not in text.

## systemd unit example (/etc/systemd/system/byjan-haraka.service)

[Unit]
Description=Byjan Haraka inbound
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/byjan-haraka
Environment=BYJAN_INBOUND_URL=https://www.easypado.com/api/email/inbound
Environment=BYJAN_INBOUND_SECRET=REPLACE_ME
ExecStart=/usr/bin/npx haraka -c /opt/byjan-haraka
Restart=always
User=root

[Install]
WantedBy=multi-user.target
