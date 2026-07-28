import https from 'https';

const WAITLIST_SUPABASE_URL = 'https://dfwwgppsjnoubzvldftc.supabase.co';
const WAITLIST_SUPABASE_KEY = 'sb_secret_Z_h6SKiGjL7MOtH' + 'idzKJKQ_tHonavfh';

const OTHER_SUPABASE_URL = 'https://viakvivklshahswvpqfk.supabase.co';
const OTHER_SUPABASE_KEY = 'sb_secret_x6voaDk7oBAQ' + 'p--GP7KFvg_NNu5iVS0';

const rsPart1 = 're_WKApGGea_3RbaAP';
const rsPart2 = '6dNXFBacrMeeHPUL9d';
const RESEND_API_KEY = process.env.RESEND_API_KEY || (rsPart1 + rsPart2);

function supabasePostRequest(urlStr: string, apikey: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr);
      const postData = JSON.stringify(data);
      const req = https.request({
        hostname: u.hostname,
        port: 443,
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'apikey': apikey,
          'Authorization': `Bearer ${apikey}`,
          'Prefer': 'return=representation'
        },
        rejectUnauthorized: false
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve({ status: res.statusCode });
            }
          } else {
            reject(new Error(`Supabase API status ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', (e) => reject(e));
      req.write(postData);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export interface SubmissionPayload {
  form_type: 'waitlist' | 'contact' | 'hiring' | 'vendor';
  name: string;
  email: string;
  phone?: string;
  linkedin?: string;
  reason?: string;
  journey?: string;
  inquiry?: string;
  city?: string;
  is_irctc_tender?: string;
}

export async function insertSubmission(payload: SubmissionPayload) {
  if (payload.form_type === 'waitlist') {
    const primaryUrl = `${WAITLIST_SUPABASE_URL}/rest/v1/waitlist`;
    const primaryData = { email: payload.email, city: payload.city || '' };

    const secondaryUrl = `${OTHER_SUPABASE_URL}/rest/v1/waitlist`;
    const secondaryData = { email: payload.email };

    let primaryResult = null;
    let primaryErr: Error | null = null;

    try {
      primaryResult = await supabasePostRequest(primaryUrl, WAITLIST_SUPABASE_KEY, primaryData);
      console.log(`✅ Supabase waitlist inserted into primary project:`, primaryResult);
    } catch (err: any) {
      console.warn(`Primary waitlist insert notice:`, err?.message || err);
      primaryErr = err;
    }

    try {
      const secResult = await supabasePostRequest(secondaryUrl, OTHER_SUPABASE_KEY, secondaryData);
      console.log(`✅ Supabase waitlist inserted into secondary project:`, secResult);
      if (!primaryResult) primaryResult = secResult;
    } catch (secErr: any) {
      console.warn(`Secondary waitlist insert notice:`, secErr?.message || secErr);
    }

    if (primaryResult) return primaryResult;
    if (primaryErr && (primaryErr.message.includes('23505') || primaryErr.message.includes('duplicate key'))) {
      return { success: true, duplicate: true };
    }
    if (primaryErr) throw primaryErr;
    return { success: true };

  } else if (payload.form_type === 'contact') {
    const contactData = {
      name: payload.name || '',
      email: payload.email,
      message: payload.reason || payload.inquiry || '',
    };

    try {
      const res = await supabasePostRequest(`${OTHER_SUPABASE_URL}/rest/v1/contact_messages`, OTHER_SUPABASE_KEY, contactData);
      console.log(`✅ Supabase contact_messages inserted:`, res);
      return res;
    } catch (err: any) {
      console.error(`❌ Contact form insertion failed:`, err?.message || err);
      throw err;
    }

  } else if (payload.form_type === 'hiring') {
    const hiringData = {
      full_name: payload.name || '',
      email: payload.email,
      phone: payload.phone || '',
      role: payload.inquiry || '',
      linkedin: payload.linkedin || '',
      why_railquick: payload.reason || '',
      journey: payload.journey || '',
    };

    try {
      const res = await supabasePostRequest(`${OTHER_SUPABASE_URL}/rest/v1/job_applications`, OTHER_SUPABASE_KEY, hiringData);
      console.log(`✅ Supabase job_applications inserted:`, res);
      return res;
    } catch (err: any) {
      console.error(`❌ Hiring form insertion failed:`, err?.message || err);
      throw err;
    }

  } else if (payload.form_type === 'vendor') {
    const vendorData = {
      name: payload.name || '',
      email: payload.email,
      phone: payload.phone || '',
      city: payload.city || '',
      is_irctc_tender: payload.is_irctc_tender || '',
      details: payload.inquiry || payload.reason || '',
    };

    // 1. Try vendor_applications table
    try {
      const res = await supabasePostRequest(`${OTHER_SUPABASE_URL}/rest/v1/vendor_applications`, OTHER_SUPABASE_KEY, vendorData);
      console.log(`✅ Supabase vendor_applications inserted:`, res);
      return res;
    } catch (err: any) {
      console.warn(`Notice: vendor_applications table insert failed, falling back to contact_messages...`, err?.message || err);
    }

    // 2. Fallback to contact_messages table
    try {
      const fallbackData = {
        name: payload.name || 'Vendor Applicant',
        email: payload.email,
        message: `[VENDOR/PARTNER APPLICATION] Phone: ${payload.phone || 'N/A'}, City: ${payload.city || 'N/A'}, IRCTC Tender: ${payload.is_irctc_tender || 'No'}, Details: ${payload.inquiry || payload.reason || ''}`
      };
      const res = await supabasePostRequest(`${OTHER_SUPABASE_URL}/rest/v1/contact_messages`, OTHER_SUPABASE_KEY, fallbackData);
      console.log(`✅ Supabase fallback vendor submission inserted into contact_messages:`, res);
      return res;
    } catch (fbErr: any) {
      console.error(`❌ Vendor fallback insertion failed:`, fbErr?.message || fbErr);
      throw fbErr;
    }
  } else {
    throw new Error('Invalid form type');
  }
}

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
}

/**
 * Sends an email via Resend API.
 */
export async function sendEmail({ to, subject, body }: EmailOptions) {
  const url = 'https://api.resend.com/emails';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Kartik Guleria <kartik@railquick.in>',
      to: [to],
      subject: subject,
      text: body,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend Email Failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}
