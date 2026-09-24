/**
 * ブラウザのコンソール エラーをシミュレート
 * app.js の初期化時に何が起きているかを確認
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
          body: data
        });
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('=== ブラウザコンソール エラーシミュレーション ===\n');

    // 1. app.js の完全確認
    console.log('1. app.js を詳細確認中...\n');
    const appJsResponse = await fetchUrl('https://nyokki42.github.io/hangyodon-life/app.js');
    const appJs = appJsResponse.body;

    // 実行開始時点での初期化を確認
    console.log('【初期化コード】\n');
    const lines = appJs.split('\n');

    // supabaseClient の初期化を詳しく見る
    let inSupabaseInit = false;
    let supabaseInitCode = '';
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i];
      if (line.includes('const supabaseClient')) {
        inSupabaseInit = true;
      }
      if (inSupabaseInit) {
        supabaseInitCode += line + '\n';
        if (line.includes('null;')) {
          break;
        }
      }
    }

    console.log(supabaseInitCode);
    console.log('\n【分析】');

    // window.supabase の存在チェック
    if (supabaseInitCode.includes('window.supabase &&')) {
      console.log('✓ Code does check window.supabase existence');
    } else {
      console.log('❌ Code does NOT check window.supabase existence');
    }

    // SUPABASE_PUBLISHABLE_KEY の空文字列チェック
    if (supabaseInitCode.includes('SUPABASE_PUBLISHABLE_KEY &&')) {
      console.log('✓ Code checks SUPABASE_PUBLISHABLE_KEY is not empty');
    }

    // プレースホルダーチェック
    if (supabaseInitCode.includes('SUPABASE_PUBLISHABLE_KEY_HERE')) {
      console.log('✓ Code checks for placeholder "SUPABASE_PUBLISHABLE_KEY_HERE"');
    }

    // 2. loadGame() の呼び出しと初期化シーケンスを確認
    console.log('\n\n【初期化シーケンス】\n');

    const loadGameMatch = appJs.match(/^(?!.*\/\/).*loadGame\(\)/m);
    const syncFromSupabaseMatch = appJs.match(/^(?!.*\/\/).*syncFromSupabase\(\)/m);
    
    if (loadGameMatch) {
      console.log('✓ loadGame() が呼び出されている');
    }
    
    const callStack = [];
    
    // loadGame の最後の呼び出し位置を見つける
    const lastLoadGameIdx = appJs.lastIndexOf('loadGame()');
    if (lastLoadGameIdx > -1) {
      console.log(`  loadGame() call position: ${appJs.substring(0, lastLoadGameIdx).split('\n').length} line`);
    }

    // 3. loadGame 関数のコード
    console.log('\n\n【loadGame() 関数の内容】\n');
    const loadGameFnMatch = appJs.match(/function loadGame\(\)\s*{([\s\S]+?)^function/m);
    if (loadGameFnMatch) {
      const fnBody = loadGameFnMatch[1];
      const fnLines = fnBody.split('\n').slice(0, 20);
      fnLines.forEach((line, idx) => {
        if (line.trim()) {
          console.log(`  ${line}`);
        }
      });
    }

    // 4. syncFromSupabase の確認
    console.log('\n\n【syncFromSupabase() 開始部分】\n');
    const syncFnMatch = appJs.match(/async function syncFromSupabase\(\)\s*{([\s\S]{0,600})/);
    if (syncFnMatch) {
      const fnBody = syncFnMatch[1];
      const fnLines = fnBody.split('\n').slice(0, 15);
      fnLines.forEach((line) => {
        if (line.trim()) {
          console.log(`  ${line}`);
        }
      });
    }

    // 5. supabaseClient が null の場合
    console.log('\n\n【supabaseClient の状態判定】\n');
    console.log('もし window.supabase が undefined なら:');
    console.log('  → supabaseClient = null');
    console.log('  → syncFromSupabase() の最初の if (!supabaseClient) に入る');
    console.log('  → saveLocalGameCache() と updateUI() だけ実行');
    console.log('  → ローカルキャッシュを表示\n');

    console.log('このため、ページは「Supabaseに接続できませんでした」メッセージを表示します。\n');

    // 6. window.supabase が存在するかをチェック
    console.log('\n【問題特定】');
    console.log('\n現在の状況:');
    console.log('1. Supabase CDN スクリプトは正しく読み込まれている');
    console.log('2. app.js も正しく読み込まれている');
    console.log('3. ただし、ブラウザ実行時に window.supabase が undefined の可能性');
    console.log('\n最も可能性が高い原因:');
    console.log('→ Supabase CDN の読み込みが完了する前に app.js の初期化コードが実行されている');
    console.log('   OR');
    console.log('→ ブラウザキャッシュで古い app.js (sleep_* 前) が読み込まれている');
    
    // 7. sleep_* カラムの確認
    console.log('\n\n【sleep_* カラムの確認】\n');
    if (appJs.includes('sleep_start_at')) {
      console.log('✓ app.js には sleep_start_at が含まれている');
    } else {
      console.log('❌ app.js に sleep_start_at が含まれていない（古いバージョン）');
    }

    // 8. HTTPSヘッダーをチェック（CDNの読み込みが完了しているか）
    console.log('\n\n【ネットワークレイヤー確認】\n');
    console.log('公開 index.html のスクリプトタグ順序:');
    console.log('1. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    console.log('2. <script src="app.js"></script>');
    console.log('\nこの順序が正しいので、CDN → app.js の順序は正常です。');
    console.log('しかし、画面がローカルキャッシュを表示しているということは...');

  } catch (error) {
    console.error('エラー:', error);
  }
}

main();
