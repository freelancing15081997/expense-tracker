import { getAccessToken } from './googleAuth';

let cachedFolderId: string | null = null;

/**
 * Ensures or creates a designated folder in Google Drive for expense receipts
 */
export const getOrCreateReceiptsFolder = async (): Promise<string> => {
  if (cachedFolderId) return cachedFolderId;

  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required to access Google Drive.');

  // 1. Search for existing folder
  const query = encodeURIComponent("name = 'Expense Tracker Receipts' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      cachedFolderId = data.files[0].id;
      return cachedFolderId!;
    }
  }

  // 2. If not found, create new folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Expense Tracker Receipts',
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Proof receipts uploaded from Shared Sheet Expense Tracker app',
    }),
  });

  if (!createRes.ok) {
    throw new Error('Failed to create receipts folder in Google Drive.');
  }

  const newFolder = await createRes.json();
  cachedFolderId = newFolder.id;
  return cachedFolderId!;
};

/**
 * Upload a receipt image (base64 or Blob) to Google Drive and return accessible links
 */
export const uploadReceiptImageToDrive = async (
  base64OrUrl: string,
  fileName: string = `Receipt_${Date.now()}.png`
): Promise<{ fileId: string; webViewLink: string; downloadLink: string }> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required to upload to Google Drive.');

  // If it's already a drive or http link and not base64, return as is
  if (base64OrUrl.startsWith('https://drive.google.com') || base64OrUrl.startsWith('http')) {
    return {
      fileId: 'external',
      webViewLink: base64OrUrl,
      downloadLink: base64OrUrl,
    };
  }

  const folderId = await getOrCreateReceiptsFolder();

  // Convert base64 data URL to Blob and determine MIME
  let mimeType = 'image/png';
  let binaryData: Uint8Array;

  if (base64OrUrl.startsWith('data:')) {
    const parts = base64OrUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch) mimeType = mimeMatch[1];
    const b64 = parts[1];
    const byteChars = atob(b64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    binaryData = new Uint8Array(byteNumbers);
  } else {
    // Treat as raw base64 string
    const byteChars = atob(base64OrUrl);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    binaryData = new Uint8Array(byteNumbers);
  }

  // Construct Multipart body
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType,
    parents: [folderId],
    description: 'Expense receipt photo proof',
  };

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaHeader = `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;

  // Encode binary to base64 for multipart
  let b64Media = '';
  const chunkSize = 8192;
  for (let i = 0; i < binaryData.length; i += chunkSize) {
    const chunk = binaryData.subarray(i, i + chunkSize);
    b64Media += String.fromCharCode.apply(null, chunk as any);
  }
  const base64Content = btoa(b64Media);

  const multipartBody = `${metadataPart}${mediaHeader}${base64Content}${closeDelimiter}`;

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive upload failed: ${errText}`);
  }

  const uploadedFile = await uploadRes.json();
  const fileId = uploadedFile.id;
  const webViewLink = uploadedFile.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  const downloadLink = uploadedFile.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`;

  // Make file readable to anyone with the link so sheet collaborators can see receipt
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (permErr) {
    console.warn('Could not set public permission on receipt:', permErr);
  }

  return {
    fileId,
    webViewLink,
    downloadLink,
  };
};

/**
 * Share the Google Spreadsheet with a roommate via Google Drive API
 * Google Drive sends an official email invitation to accept and edit the sheet directly
 */
export const shareSpreadsheetWithRoommate = async (
  spreadsheetId: string,
  emailAddress: string,
  role: 'writer' | 'commenter' | 'reader' = 'writer'
): Promise<{ success: boolean; permissionId?: string; error?: string }> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Google authentication required to share spreadsheet.');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions?sendNotificationEmail=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role,
        type: 'user',
        emailAddress: emailAddress.trim(),
      }),
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message = errData.error?.message || `Failed to share sheet with ${emailAddress}`;
    return { success: false, error: message };
  }

  const data = await res.json();
  return { success: true, permissionId: data.id };
};

/**
 * List active collaborators/permissions on the spreadsheet
 */
export const listSpreadsheetCollaborators = async (
  spreadsheetId: string
): Promise<Array<{ id: string; displayName?: string; emailAddress?: string; role: string; photoLink?: string }>> => {
  const token = await getAccessToken();
  if (!token) return [];

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions?fields=permissions(id,displayName,emailAddress,role,photoLink)`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.permissions || [];
};

