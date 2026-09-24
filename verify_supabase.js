const url = 'https://otyfyfucfqbdboltelsw.supabase.co/rest/v1/hangyodon?select=*';
const key = 'sb_publishable_jmt7PPVYn_L7MNDBJ69otg_s6u_ulGy';

async function main() {
  try {
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });
    console.log('STATUS', res.status, res.statusText);
    const text = await res.text();
    console.log(text.slice(0, 2000));
  } catch (err) {
    console.error('FETCH_ERROR', err);
    process.exit(1);
  }
}

main();
