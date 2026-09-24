/**
 * GitHub Pages 公開版の最新状況を確認するスクリプト
 * 修正後の index.html と app.js が defer 属性を持つか確認
 * その後、Supabase 接続状況をシミュレート
 */

const https = require('https');

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data
        });
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('=== GitHub Pages 公開版 最終検証 ===\n');

    // 1. index.html を取得
    console.log('1. 公開版 index.html を取得中...');
    const htmlResponse = await fetchUrl('https://nyokki42.github.io/hangyodon-life/');
    console.log(`   Status: ${htmlResponse.status}\n`);

    if (htmlResponse.status !== 200) {
      console.error('❌ index.html 取得失敗');
      return;
    }

    // 2. defer 属性の確認
    console.log('2. Supabase スクリプトタグの defer 属性を確認...\n');
    
    const supabaseScriptMatch = htmlResponse.body.match(/<script\s+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2["'][^>]*>/);
    const appJsScriptMatch = htmlResponse.body.match(/<script\s+src=["']app\.js["'][^>]*>/);

    console.log('【Supabase CDN スクリプトタグ】');
    if (supabaseScriptMatch) {
      const tag = supabaseScriptMatch[0];
      console.log(`  ${tag}`);
      if (tag.includes('defer')) {
        console.log('  ✓ defer 属性あり\n');
      } else {
        console.log('  ❌ defer 属性なし（修正未反映）\n');
      }
    } else {
      console.log('  ❌ Supabase スクリプトタグが見つかりません\n');
    }

    console.log('【app.js スクリプトタグ】');
    if (appJsScriptMatch) {
      const tag = appJsScriptMatch[0];
      console.log(`  ${tag}`);
      if (tag.includes('defer')) {
        console.log('  ✓ defer 属性あり\n');
      } else {
        console.log('  ❌ defer 属性なし（修正未反映）\n');
      }
    } else {
      console.log('  ❌ app.js スクリプトタグが見つかりません\n');
    }

    // 3. app.js を取得して defer 対応を確認
    console.log('3. 公開版 app.js を取得中...');
    const appJsResponse = await fetchUrl('https://nyokki42.github.io/hangyodon-life/app.js');
    console.log(`   Status: ${appJsResponse.status}\n`);

    if (appJsResponse.status === 200) {
      const appJs = appJsResponse.body;

      // defer 対応のコメント確認
      console.log('【app.js の Supabase 初期化部分】\n');
      
      if (appJs.includes('defer 属性により')) {
        console.log('✓ defer 対応のコメントが含まれている\n');
        
        // 実際のコメント部分を抽出
        const commentMatch = appJs.match(/\/\/ defer 属性により[^\n]*\n[^\n]*\n[^\n]*\nconst supabaseClient/);
        if (commentMatch) {
          console.log('【実際のコード】');
          console.log(commentMatch[0].substring(0, 200) + '...\n');
        }
      } else {
        console.log('❌ defer 対応のコメントが見つかりません（修正未反映）\n');
      }

      // Supabase URL と Key の確認
      const urlMatch = appJs.match(/const SUPABASE_URL = '([^']+)'/);
      const keyMatch = appJs.match(/const SUPABASE_PUBLISHABLE_KEY = '([^']+)'/);

      if (urlMatch) {
        console.log(`✓ SUPABASE_URL: ${urlMatch[1]}`);
      }
      if (keyMatch) {
        console.log(`✓ SUPABASE_PUBLISHABLE_KEY: ${keyMatch[1].substring(0, 20)}...\n`);
      }
    }

    // 4. デプロイ状況の推測
    console.log('\n=== 修正ステータス ===\n');

    const hasDeferSupabase = supabaseScriptMatch && supabaseScriptMatch[0].includes('defer');
    const hasDeferAppJs = appJsScriptMatch && appJsScriptMatch[0].includes('defer');
    const hasComment = appJsResponse.status === 200 && appJsResponse.body.includes('defer 属性により');

    if (hasDeferSupabase && hasDeferAppJs && hasComment) {
      console.log('✅ 修正がすべてデプロイされています\n');
      console.log('【次のステップ】');
      console.log('1. ブラウザのキャッシュをクリア (Ctrl+Shift+Del)');
      console.log('2. https://nyokki42.github.io/hangyodon-life/ をリロード');
      console.log('3. 画面に「共有データと同期しました。」メッセージが表示されるか確認');
      console.log('4. DevTools Console を開いて以下を実行: console.log(typeof window.supabase)');
      console.log('   → "object" と表示されるはず\n');
    } else {
      console.log('❌ 修正がまだ反映されていません\n');
      console.log('【確認事項】');
      
      if (!hasDeferSupabase) {
        console.log('・ index.html の Supabase CDN スクリプトに defer がない');
      }
      if (!hasDeferAppJs) {
        console.log('・ index.html の app.js スクリプトに defer がない');
      }
      if (!hasComment) {
        console.log('・ app.js のコメントが更新されていない');
      }
      
      console.log('\n【修正手順】');
      console.log('1. ローカルファイルが修正されていることを確認');
      console.log('2. GitHub Desktop または git CLI で commit / push');
      console.log('3. GitHub Pages のデプロイが完了するのを待つ（通常 1-2 分）');
      console.log('4. ブラウザキャッシュをクリア');
      console.log('5. 公開 URL をリロード\n');
    }

    // 5. Supabase REST API アクセステスト
    console.log('\n【Supabase REST API テスト】\n');
    console.log('公開版で Supabase に接続できるか テスト中...');

    const apiResponse = await fetchUrl('https://otyfyfucfqbdboltelsw.supabase.co/rest/v1/hangyodon?id=eq.1');
    
    if (apiResponse.status === 200) {
      console.log('✓ Supabase REST API: 200 OK');
      try {
        const data = JSON.parse(apiResponse.body);
        console.log(`✓ DB からデータ取得成功: ${data.length} 行`);
        if (data[0]) {
          console.log(`  - hunger: ${data[0].hunger}`);
          console.log(`  - mood: ${data[0].mood}`);
          console.log(`  - game_over: ${data[0].game_over}`);
          console.log(`  - sleep_start_at: ${data[0].sleep_start_at ? '設定済み' : 'null'}`);
        }
      } catch (e) {
        console.log('⚠ JSON パースエラー');
      }
    } else {
      console.log(`❌ Supabase REST API: ${apiResponse.status}`);
    }

  } catch (error) {
    console.error('\n❌ エラー:', error.message);
  }
}

main();
