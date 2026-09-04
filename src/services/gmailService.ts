import { getAccessToken, getCurrentUser } from './googleAuth';

/**
 * Send real email through Gmail API
 */
export const sendGmailEmail = async ({
  recipients,
  subject,
  htmlBody,
}: {
  recipients: string[];
  subject: string;
  htmlBody: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const token = await getAccessToken();
  if (!token) {
    return {
      success: false,
      error: 'Google Workspace sign-in required to dispatch real Gmail messages.',
    };
  }

  if (!recipients || recipients.length === 0) {
    return {
      success: false,
      error: 'No active recipient email addresses configured.',
    };
  }

  const currentUser = getCurrentUser();
  const senderEmail = currentUser?.email || 'me';

  // Construct RFC 2822 email format
  const toHeader = recipients.join(', ');
  
  // RFC 2822 message construction
  const emailLines = [
    `From: ${senderEmail}`,
    `To: ${toHeader}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(htmlBody))),
  ];

  const rawMessage = emailLines.join('\r\n');

  // URL-safe base64 encoding (RFC 4648 §5)
  const base64UrlEncoded = btoa(rawMessage)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: base64UrlEncoded,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Gmail API send error:', err);
      return {
        success: false,
        error: `Gmail API error: ${err}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error: any) {
    console.error('Network error sending Gmail:', error);
    return {
      success: false,
      error: error.message || 'Unknown network error occurred',
    };
  }
};
