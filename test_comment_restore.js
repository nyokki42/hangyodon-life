#!/usr/bin/env node
// コメント機能の復旧確認スクリプト

const fs = require('fs');
const path = require('path');

console.log('📋 ハンギョドンコメント機能の復旧確認\n');

// 1. HTML要素の確認
console.log('✓ HTML確認:');
const htmlPath = path.join(__dirname, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const hasCommentBubble = htmlContent.includes('id="comment-bubble"');
const hasCommentClass = htmlContent.includes('class="comment-bubble"');
console.log(`  - コメント要素 (#comment-bubble): ${hasCommentBubble ? '✅ 存在' : '❌ 不在'}`);
console.log(`  - コメントCSS (.comment-bubble): ${hasCommentClass ? '✅ 存在' : '❌ 不在'}`);

// 2. CSS確認
console.log('\n✓ CSS確認:');
const cssPath = path.join(__dirname, 'style.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const hasCommentCSS = cssContent.includes('.comment-bubble');
const hasCommentDisplay = cssContent.includes('display: none') && cssContent.includes('.comment-bubble');
console.log(`  - .comment-bubble CSS: ${hasCommentCSS ? '✅ 存在' : '❌ 不在'}`);
console.log(`  - display制御: ${hasCommentDisplay ? '✅ 存在（デフォルト非表示）' : '⚠️ 宣言なし'}`);

// 3. JavaScript関数の確認
console.log('\n✓ JavaScript関数確認:');
const jsPath = path.join(__dirname, 'app.js');
const jsContent = fs.readFileSync(jsPath, 'utf8');

const hasGenerateComment = /function\s+generateComment\s*\(\s*\)/.test(jsContent);
const hasShowComment = /function\s+showComment\s*\(\s*\)/.test(jsContent);
const hasSetInterval = /setInterval\s*\(\s*showComment\s*,\s*10000\s*\)/.test(jsContent);

console.log(`  - generateComment(): ${hasGenerateComment ? '✅ 実装済み' : '❌ 未実装'}`);
console.log(`  - showComment(): ${hasShowComment ? '✅ 実装済み' : '❌ 未実装'}`);
console.log(`  - setInterval(showComment, 10000): ${hasSetInterval ? '✅ 登録済み' : '❌ 未登録'}`);

// 4. 最終判定
console.log('\n📊 復旧状態:');
const isRestored = hasCommentBubble && hasCommentCSS && hasGenerateComment && hasShowComment && hasSetInterval;
if (isRestored) {
  console.log('✅ コメント機能の復旧が完了しました！\n');
  console.log('📱 ブラウザで確認可能なコメント:');
  console.log('  1. 睡眠中 → "ZZZ..." コメント');
  console.log('  2. お腹が減った（<20） → "お腹すいた..."');
  console.log('  3. 機嫌が悪い（<0） → "ちょっと元気ないかも"');
  console.log('  4. 機嫌が良い（>50） → "いい気分！"');
  console.log('  5. 朝（6-12時）→ "朝だね〜"');
  console.log('  6. 昼（12-18時）→ "お昼だよ！"');
  console.log('  7. 夕方（18-22時）→ "夕方の時間だ〜"');
  console.log('  8. その他 → "何かいいことあるかな？" または "ふふ、気まぐれだよ。"\n');
  process.exit(0);
} else {
  console.log('❌ コメント機能がまだ完全には復旧していません\n');
  console.log('不足している要素:');
  if (!hasCommentBubble) console.log('  - HTML: コメント要素がない');
  if (!hasCommentCSS) console.log('  - CSS: コメント用スタイルがない');
  if (!hasGenerateComment) console.log('  - JS: generateComment() が実装されていない');
  if (!hasShowComment) console.log('  - JS: showComment() が実装されていない');
  if (!hasSetInterval) console.log('  - JS: setInterval(showComment, 10000) が登録されていない');
  process.exit(1);
}
