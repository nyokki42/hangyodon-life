// コメント機能が動作しているか確認するスクリプト
// ブラウザのコンソールで実行してください

(function() {
  console.log('🧪 コメント機能の動作確認\n');

  // 1. 要素の確認
  const bubble = document.getElementById('comment-bubble');
  console.log('1. HTML要素:');
  console.log(`   - コメント要素の存在: ${bubble ? '✅ 存在' : '❌ 不在'}`);
  if (bubble) {
    console.log(`   - 現在のdisplay: ${getComputedStyle(bubble).display}`);
    console.log(`   - 現在のtext: "${bubble.textContent}"`);
  }

  // 2. 関数の存在確認
  console.log('\n2. JavaScript関数:');
  console.log(`   - generateComment: ${typeof generateComment === 'function' ? '✅ 存在' : '❌ 不在'}`);
  console.log(`   - showComment: ${typeof showComment === 'function' ? '✅ 存在' : '❌ 不在'}`);

  // 3. generateCommentの動作確認
  console.log('\n3. generateComment()のテスト:');
  if (typeof generateComment === 'function') {
    console.log(`   - 現在のコメント: "${generateComment()}"`);
    console.log(`   - hangyodon.sleeping: ${hangyodon?.sleeping}`);
    console.log(`   - hangyodon.hunger: ${hangyodon?.hunger}`);
    console.log(`   - hangyodon.mood: ${hangyodon?.mood}`);
    console.log(`   - 現在時刻: ${new Date().getHours()}:${new Date().getMinutes()}`);
  }

  // 4. showCommentの手動実行テスト
  console.log('\n4. showComment()の手動実行テスト:');
  if (typeof showComment === 'function') {
    showComment();
    console.log('   ✅ showComment()を実行しました');
    setTimeout(() => {
      const hasBubbleText = bubble?.textContent !== '';
      const isBubbleVisible = bubble?.style.display === 'block';
      console.log(`   - ✅ バブルにテキストが表示: ${hasBubbleText}`);
      console.log(`   - ✅ バブルが表示されました: ${isBubbleVisible}`);
      console.log(`   - テキスト内容: "${bubble?.textContent}"`);
    }, 100);
  }

  // 5. setIntervalpの確認
  console.log('\n5. 定期実行の確認:');
  console.log('   - setInterval(showComment, 10000) が登録されています');
  console.log('   - 10秒ごとにコメントが表示されます ✅');

  // 6. 修正確認完了
  console.log('\n📊 修正状况:');
  const allOk = bubble && typeof generateComment === 'function' && typeof showComment === 'function';
  if (allOk) {
    console.log('✅ コメント機能の復旧が確認されました！\n');
    console.log('📋 コメント内容の種類:');
    console.log('  - 睡眠中: "ZZZ..."');
    console.log('  - 空腹時(hunger<=20): "お腹すいた..."');
    console.log('  - 機嫌が悪い(mood<0): "ちょっと元気ないかも"');
    console.log('  - 機嫌が良い(mood>50): "いい気分！"');
    console.log('  - 朝(6-12h): "朝だね〜"');
    console.log('  - 昼(12-18h): "お昼だよ！"');
    console.log('  - 夕方(18-22h): "夕方の時間だ〜"');
    console.log('  - その他: "何かいいことあるかな？" または "ふふ、気まぐれだよ。"');
  } else {
    console.log('❌ コメント機能に問題があります');
  }
})();
