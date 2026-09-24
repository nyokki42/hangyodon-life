/**
 * GitHub Pages 公開サイトの診断スクリプト
 * 以下を確認します：
 * 1. index.html の取得
 * 2. app.js の URL と内容確認
 * 3. Supabase スクリプトの読み込み順序
 * 4. app.js の初期化処理
 */

const https = require('https');

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('=== GitHub Pages 公開サイト診断 ===\n');

    // 1. index.html を取得
    console.log('1. index.html を取得中...');
    const htmlResponse = await fetchUrl('https://nyokki42.github.io/hangyodon-life/');
    console.log(`   Status: ${htmlResponse.status}`);

    if (htmlResponse.status !== 200) {
      console.error('   ❌ index.html 取得失敗');
      return;
    }
    console.log('   ✓ index.html 取得成功\n');

    // 2. app.js の URL と Supabase スクリプト の読み込み順序を確認
    console.log('2. index.html 内のスクリプト読み込み順序を確認...');
    const scriptMatches = htmlResponse.body.match(/<script[^>]*src=['"](\.\/[^'"]+|https?:\/\/[^'"]+)['"][^>]*><\/script>/gi);
    if (scriptMatches) {
      console.log('   発見されたスクリプト:');
      scriptMatches.forEach((match, idx) => {
        console.log(`   ${idx + 1}. ${match}`);
      });
    } else {
      console.log('   スクリプトタグなし');
    }

    // Supabase スクリプトの順序を確認
    const inlineScriptMatches = htmlResponse.body.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    const supabaseScriptIndex = inlineScriptMatches ? inlineScriptMatches.findIndex(m => m.includes('supabase')) : -1;
    const appScriptIndex = inlineScriptMatches ? inlineScriptMatches.findIndex(m => m.includes('app.js')) : -1;

    console.log(`\n   Supabase スクリプト読み込みインデックス: ${supabaseScriptIndex}`);
    console.log(`   app.js 読み込みインデックス: ${appScriptIndex}`);

    if (supabaseScriptIndex > -1 && appScriptIndex > -1 && supabaseScriptIndex > appScriptIndex) {
      console.log('   ❌ WARNING: app.js が Supabase スクリプトより先に読み込まれている可能性あり\n');
    } else {
      console.log('   ✓ スクリプト読み込み順序は正常そう\n');
    }

    // 3. app.js を取得
    console.log('3. app.js を取得中...');
    const appJsResponse = await fetchUrl('https://nyokki42.github.io/hangyodon-life/app.js');
    console.log(`   Status: ${appJsResponse.status}`);

    if (appJsResponse.status !== 200) {
      console.error('   ❌ app.js 取得失敗');
      return;
    }
    console.log('   ✓ app.js 取得成功\n');

    // 4. app.js の Supabase 初期化を確認
    console.log('4. app.js の Supabase 関連コードを分析...');
    
    const supabaseUrlMatch = appJsResponse.body.match(/const SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
    const supabaseKeyMatch = appJsResponse.body.match(/const SUPABASE_PUBLISHABLE_KEY\s*=\s*['"]([^'"]+)['"]/);
    const createClientMatch = appJsResponse.body.match(/window\.supabase\.createClient\s*\(\s*SUPABASE_URL,\s*SUPABASE_PUBLISHABLE_KEY\s*\)/);
    const windowSupabaseCheck = appJsResponse.body.match(/window\.supabase/g);

    if (supabaseUrlMatch) {
      console.log(`   ✓ SUPABASE_URL: ${supabaseUrlMatch[1].substring(0, 50)}...`);
    } else {
      console.log('   ❌ SUPABASE_URL が見つかりません');
    }

    if (supabaseKeyMatch) {
      const keyPreview = supabaseKeyMatch[1].substring(0, 20) + '...';
      console.log(`   ✓ SUPABASE_PUBLISHABLE_KEY: ${keyPreview}`);
    } else {
      console.log('   ❌ SUPABASE_PUBLISHABLE_KEY が見つかりません');
    }

    if (createClientMatch) {
      console.log('   ✓ window.supabase.createClient() の呼び出しが見つかります');
    } else {
      console.log('   ❌ window.supabase.createClient() が見つかりません');
    }

    console.log(`   window.supabase の参照数: ${windowSupabaseCheck ? windowSupabaseCheck.length : 0}`);

    // 5. Supabase CDN が読み込まれているか確認
    console.log('\n5. Supabase CDN の読み込みを確認...');
    const supabaseCdnMatch = htmlResponse.body.match(/<script[^>]*src=['"](https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^'"]+)['"]/);
    
    if (supabaseCdnMatch) {
      console.log(`   ✓ Supabase CDN: ${supabaseCdnMatch[1]}`);
    } else {
      console.log('   ❌ Supabase CDN が見つかりません');
    }

    // 6. window.supabase チェック用の初期化コード
    console.log('\n6. app.js の初期化順序を確認...');
    
    // スクリプトの最初の100行をサンプル
    const firstLines = appJsResponse.body.split('\n').slice(0, 20);
    console.log('   app.js の先頭20行:');
    firstLines.forEach((line, idx) => {
      if (line.trim()) {
        console.log(`   ${idx + 1}: ${line.substring(0, 80)}`);
      }
    });

    // 7. syncFromSupabase 関数を確認
    console.log('\n7. syncFromSupabase 関数の確認...');
    const syncFromSupabaseMatch = appJsResponse.body.match(/async\s+function\s+syncFromSupabase\s*\(\s*\)\s*{([\s\S]{0,500})/);
    
    if (syncFromSupabaseMatch) {
      console.log('   ✓ syncFromSupabase 関数が見つかります');
      const fnBody = syncFromSupabaseMatch[1];
      
      if (fnBody.includes('if (!supabaseClient)')) {
        console.log('   ✓ supabaseClient チェックあり');
      }
      
      if (fnBody.includes('ensureSupabaseRow')) {
        console.log('   ✓ ensureSupabaseRow() を呼び出し');
      }
      
      if (fnBody.includes('select(')) {
        console.log('   ✓ select() クエリあり');
      }
    }

    // 8. ローカルの app.js と比較
    console.log('\n8. ローカル版 app.js との比較...');
    const fs = require('fs');
    const localAppJs = fs.readFileSync('c:\\Users\\hyokk\\OneDrive\\ドキュメント\\hangyodon-life\\app.js', 'utf8');
    
    const publicFirstLines = appJsResponse.body.split('\n').slice(0, 30).join('\n');
    const localFirstLines = localAppJs.split('\n').slice(0, 30).join('\n');
    
    if (publicFirstLines === localFirstLines) {
      console.log('   ✓ 先頭30行が一致');
    } else {
      console.log('   ❌ 先頭30行が異なる可能性あり');
      console.log('\n   公開版 SUPABASE_URL:');
      const pubUrlMatch = appJsResponse.body.match(/const SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
      if (pubUrlMatch) console.log(`   ${pubUrlMatch[1]}`);
      
      console.log('\n   ローカル版 SUPABASE_URL:');
      const localUrlMatch = localAppJs.match(/const SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
      if (localUrlMatch) console.log(`   ${localUrlMatch[1]}`);
    }

    // サイズ比較
    console.log(`\n   ファイルサイズ:`);
    console.log(`   公開版: ${appJsResponse.body.length} bytes`);
    console.log(`   ローカル版: ${localAppJs.length} bytes`);
    
    if (Math.abs(appJsResponse.body.length - localAppJs.length) > 100) {
      console.log('   ❌ ファイルサイズが大きく異なる');
    } else {
      console.log('   ✓ ファイルサイズが近い');
    }

    console.log('\n=== 診断完了 ===');

  } catch (error) {
    console.error('エラー:', error);
  }
}

main();
