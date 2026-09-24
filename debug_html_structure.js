/**
 * GitHub Pages 公開サイトの HTML 構造を詳細確認
 * app.js の loadGame() が実行されるタイミングを分析
 */

const https = require('https');

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
    console.log('=== GitHub Pages 公開サイト HTML 構造確認 ===\n');

    // index.html を取得
    const htmlContent = await fetchUrl('https://nyokki42.github.io/hangyodon-life/');

    // スクリプトタグを全て抽出
    console.log('【HTML内の全スクリプトタグ】\n');
    const scriptRegex = /<script[^>]*(?:src=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let scriptIndex = 0;
    const scripts = [];

    while ((match = scriptRegex.exec(htmlContent)) !== null) {
      scriptIndex++;
      const src = match[1] || '(inline)';
      const content = match[2] ? match[2].substring(0, 100) : '';
      
      scripts.push({
        index: scriptIndex,
        src,
        content,
        isExternal: !!match[1],
        isInline: !match[1]
      });

      console.log(`${scriptIndex}. src: ${src}`);
      if (content) {
        console.log(`   content preview: ${content.substring(0, 100).split('\n')[0]}`);
      }
    }

    // スクリプト実行順序を確認
    console.log('\n\n【スクリプト実行順序】\n');
    
    const supabaseScriptIdx = scripts.findIndex(s => s.src.includes('supabase'));
    const appJsScriptIdx = scripts.findIndex(s => s.src === 'app.js');

    console.log(`Supabase CDN スクリプト: ${supabaseScriptIdx + 1}番目`);
    console.log(`app.js スクリプト: ${appJsScriptIdx + 1}番目`);

    if (supabaseScriptIdx < appJsScriptIdx) {
      console.log('\n✓ 実行順序は正しい（Supabase → app.js）\n');
    } else {
      console.log('\n❌ 実行順序が逆（app.js が Supabase より先に実行される可能性）\n');
    }

    // loadGame() の呼び出しタイミングの詳細確認
    console.log('\n【app.js の末尾（初期化コード）】\n');

    const appJsContent = await fetchUrl('https://nyokki42.github.io/hangyodon-life/app.js');
    const appJsLines = appJsContent.split('\n');

    // 最後の20行を表示（初期化処理が書かれている部分）
    console.log('末尾20行:');
    for (let i = Math.max(0, appJsLines.length - 20); i < appJsLines.length; i++) {
      if (appJsLines[i].trim()) {
        console.log(`${i + 1}: ${appJsLines[i].substring(0, 80)}`);
      }
    }

    // loadGame の呼び出しを検索
    console.log('\n\n【loadGame() の呼び出し】\n');
    const loadGameLines = appJsLines
      .map((line, idx) => ({ line, idx: idx + 1 }))
      .filter(({ line }) => line.includes('loadGame()') && !line.trim().startsWith('//'));

    if (loadGameLines.length > 0) {
      loadGameLines.forEach(({ line, idx }) => {
        console.log(`行 ${idx}: ${line}`);
      });
    }

    // 初期化処理の最終確認
    console.log('\n\n【初期化処理のフロー】\n');
    console.log('公開サイト実行時:');
    console.log('1. index.html 読み込み');
    console.log('2. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    console.log('   → window.supabase が定義される（CDNから読み込まれる）');
    console.log('3. <script src="app.js"></script>');
    console.log('   → イEUR app.js 実行開始');
    console.log('   → const supabaseClient = (window.supabase && ...) の時点で window.supabase は存在');
    console.log('4. loadGame() が呼び出される');
    console.log('   → syncFromSupabase() が非同期実行');

    // window.supabase の初期化タイミングの詳細
    console.log('\n\n【window.supabase 初期化の詳細】\n');

    console.log('理論上はこうなるはず:');
    console.log('  1. CDN スクリプト実行 → window.supabase が定義');
    console.log('  2. app.js 実行 → supabaseClient が作成される');
    console.log('  3. loadGame() → syncFromSupabase() が実行');
    console.log('\nしかし実際には:');
    console.log('  ? window.supabase が undefined');
    console.log('  → supabaseClient = null');
    console.log('  → それが原因で「Supabaseに接続できませんでした」メッセージが出ている');

    // CDNの読み込み時間を確認する方法を提示
    console.log('\n\n【検証方法】\n');
    console.log('実際の原因を特定するには、ブラウザの DevTools Console で:');
    console.log('1. Network タブで各スクリプトの読み込み時間を確認');
    console.log('2. Console タブで window.supabase の値を確認');
    console.log('3. debugger; を入れて実行順序を確認');

    // 可能な修正方法を提示
    console.log('\n\n【考えられる修正方法】\n');
    console.log('A) app.js の初期化を遅延させる');
    console.log('   → DOMContentLoaded または load イベント待機');
    console.log('B) window.supabase の初期化を待つ');
    console.log('   → setInterval で window.supabase を監視');
    console.log('C) app.js を defer フラグ付きで読み込む');
    console.log('   → <script src="app.js" defer></script>');
    console.log('D) Supabase CDN の読み込みを待つ');
    console.log('   → async/await で CDN の読み込み完了を待機');

  } catch (error) {
    console.error('エラー:', error);
  }
}

main();
