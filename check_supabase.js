const https = require('https');
const url = 'https://otyfyfucfqbdboltelsw.supabase.co/rest/v1/hangyodon?select=*';
const key = 'sb_publishable_jmt7PPVYn_L7MNDBJ69otg_s6u_ulGy';

function request(path, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const req = https.request(path, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    const res = await request(url);
    console.log('STATUS', res.status);
    console.log('BODY', res.body.slice(0, 2000));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
