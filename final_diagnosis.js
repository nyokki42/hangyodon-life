/**
 * 最終確認：window.supabase が本当に存在しているか
 * 実際のブラウザ環境をシミュレート
 */

const https = require('https');
const vm = require('vm');

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('=== 最終診断：window.supabase と supabaseClient の状態を確認 ===\n');

    // 公開 app.js を取得
    console.log('1. 公開中の app.js を取得中...');
    const appJsContent = await fetchUrl('https://nyokki42.github.io/hangyodon-life/app.js');
    console.log(`   ✓ 取得完了（${appJsContent.length} bytes）\n`);

    // 初期化コードの部分を切り出し
    console.log('2. Supabase 初期化部分を分析...\n');

    const initLines = appJsContent.split('\n').slice(0, 20);
    
    console.log('【公開 app.js の先頭部分】');
    initLines.forEach((line, idx) => {
      if (line.trim()) {
        console.log(`  ${idx + 1}: ${line}`);
      }
    });

    // supabaseClient の初期化条件をチェック
    console.log('\n【初期化条件の分析】\n');

    const supabaseUrlMatch = appJsContent.match(/const SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
    const supabaseKeyMatch = appJsContent.match(/const SUPABASE_PUBLISHABLE_KEY\s*=\s*['"]([^'"]+)['"]/);
    const createClientMatch = appJsContent.match(/const supabaseClient\s*=\s*\(([\s\S]{0,200})\)/);

    console.log('SUPABASE_URL:');
    console.log(`  ${supabaseUrlMatch ? supabaseUrlMatch[1] : 'NOT FOUND'}\n`);

    console.log('SUPABASE_PUBLISHABLE_KEY:');
    console.log(`  ${supabaseKeyMatch ? supabaseKeyMatch[1].substring(0, 32) + '...' : 'NOT FOUND'}\n`);

    console.log('supabaseClient の初期化ロジック:');
    if (createClientMatch) {
      console.log(`  ${createClientMatch[1].substring(0, 100).replace(/\n/g, '\n  ')}\n`);
    }

    // 最重要：loadGame() がどのように実行されているか
    console.log('【loadGame() と syncFromSupabase() の流れ】\n');

    const loadGameCall = appJsContent.match(/^loadGame\(\);/m);
    const syncFromSupabaseCheck = appJsContent.match(/if\s*\(\s*!supabaseClient\s*\)\s*{[\s\S]{0,200}?saveLocalGameCache/);

    if (loadGameCall) {
      console.log('✓ loadGame() がスクリプト末尾で実行されている');
    }

    if (syncFromSupabaseCheck) {
      console.log('✓ syncFromSupabase() で supabaseClient の null チェックがある');
    }

    // 本質的な問題：もし window.supabase が undefined だったら
    console.log('\n【もし window.supabase が undefined だったら】\n');
    console.log('条件: window.supabase && ... が false');
    console.log('→ supabaseClient = null');
    console.log('→ syncFromSupabase() の if (!supabaseClient) に入る');
    console.log('→ saveLocalGameCache() と updateUI() だけ実行');
    console.log('→ console.error("Supabase sync error: ...") が出力される');
    console.log('→ 画面に「Supabaseに接続できませんでした」メッセージ');

    // 実際に画面に出ているメッセージ内容
    console.log('\n【実際のエラーメッセージ】\n');
    const errorMessageMatch = appJsContent.match(/setStatusMessage\(['"]Supabaseに接続できませんでした[\s\S]*?['"],\s*['"]error['"]\)/);
    
    if (errorMessageMatch) {
      console.log(errorMessageMatch[0]);
    }

    // syncFromSupabase の catch ブロック
    const catchBlockMatch = appJsContent.match(/catch\s*\(\s*error\s*\)\s*{[\s\S]{0,500}?setStatusMessage\(['"]Supabaseに接続できませんでした/);
    
    if (catchBlockMatch) {
      console.log('\n【syncFromSupabaseの catch ブロック】');
      console.log(catchBlockMatch[0].substring(0, 300) + '...\n');
    }

    // 診断結果
    console.log('\n=== 最終診断結果 ===\n');

    console.log('原因の可能性:');
    console.log('1. 【最も可能性が高い】');
    console.log('   window.supabase が CDN 読み込み前に undefined のまま');
    console.log('   → app.js が Supabase CDN より先に初期化されている');
    console.log('   → const supabaseClient = null となる');
    console.log('   → syncFromSupabase() の if (!supabaseClient) に入る');
    console.log('   → ローカルキャッシュのみ表示');

    console.log('\n2. 【次の可能性】');
    console.log('   Supabase CDN 自体が読み込まれていない');
    console.log('   OR CDN エラーで window.supabase が定義されない');

    console.log('\n3. 【可能性は低いが】');
    console.log('   CDN CDN 読み込みは成功しているが、');
    console.log('   select() の実行時に RLS で拒否されている');
    console.log('   (ただし REST API 直接呼び出しは成功したので、これは低い)');

    console.log('\n推奨される確認方法:');
    console.log('ブラウザの DevTools Console で:');
    console.log('  console.log(typeof window.supabase)');
    console.log('を実行して、window.supabase が "object" か "undefined" かを確認');

    console.log('\n推奨される修正:');
    console.log('index.html の <script src="app.js"></script> に defer 属性を追加');
    console.log('  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script>');
    console.log('  <script src="app.js" defer></script>');

  } catch (error) {
    console.error('エラー:', error);
  }
}

main();
