# 🔍 Supabase接続状況の確認方法

ブラウザで `https://nyokki42.github.io/hangyodon-life/` を開いた後、以下を実施してください。

---

## 📱 ステップ 1: ページをリロード

1. **Ctrl + Shift + Delete** を押してブラウザキャッシュをクリア
2. **Ctrl + R** を押してページをリロード
3. ページが読み込まれるのを待つ（5秒程度）

---

## 🛠️ ステップ 2: DevTools Console を開く

- **Windows/Linux**: F12 キー
- **Mac**: Cmd + Option + I キー
- または右クリック→「検査」→「Console」タブ

---

## ✅ ステップ 3: 以下を一つずつ実行して確認

### 確認 1: window.supabase の存在確認

Console に貼り付けて実行:
```javascript
console.log('window.supabase の型:', typeof window.supabase);
console.log('window.supabase:', window.supabase);
```

**期待される結果:**
```
window.supabase の型: object
window.supabase: {createClient: ƒ, ...}
```

❌ `undefined` と表示されたら → Supabase CDN が読み込まれていない（再度リロード）

---

### 確認 2: supabaseClient の初期化確認

Console に貼り付けて実行:
```javascript
// これは app.js で定義されたもの
console.log('supabaseClient が null か確認:', typeof supabaseClient);
```

**期待される結果:**
```
supabaseClient が null か確認: object
```

❌ `undefined` と表示されたら → app.js が読み込まれていない

---

### 確認 3: ページ上のメッセージを確認

ページをよく見て、以下のいずれが表示されているか確認:

**✅ 成功パターン:**
- 「共有データと同期しました。」（緑色メッセージ）
- ハンギョドンの画像が表示されている
- ゲーム画面のすべてのボタン・UI が表示されている

**❌ 失敗パターン:**
- 「Supabaseに接続できませんでした。ローカル保存を表示します。」（赤色メッセージ）

---

### 確認 4: Console のエラー確認

Console タブを見て、赤い エラーメッセージ が出ていないか確認:

**正常：** Console にエラーが出ていない
**異常：** 以下のようなエラーが出ている可能性
- `Supabase sync error: ...`
- `TypeError: Cannot read property ...`
- CORS エラー

---

## 🐛 もし失敗した場合

Console に以下を貼り付けて実行し、その出力結果をコピー:

```javascript
console.log('=== Supabase接続状況 ===');
console.log('window.supabase:', typeof window.supabase);
console.log('supabaseClient:', typeof supabaseClient);
console.log('navigator.onLine:', navigator.onLine);
console.log('Page URL:', window.location.href);
```

その出力結果をユーザーに報告してください。

---

## 📊 期待される画面の状態

### ✅ 成功時

```
【ゲーム画面が表示される】
- ハンギョドン のキャラクター画像
- 「レベル: 1」など ステータス表示
- 「ご飯をあげる」「散歩する」などの ボタン
- 「共有データと同期しました。」のメッセージ（緑）
- 通知 ON/OFF ボタン
```

### ❌ 失敗時

```
【ゲーム画面が表示されるが、エラーメッセージ】
- 「Supabaseに接続できませんでした。ローカル保存を表示します。」（赤）
- localStorage から読み込んだ（可能性がある）古い/デフォルトのデータを表示
```

---

## 🔧 if troubleshooting needed

1. **F12 → Network タブ:**
   - `https://cdn.jsdelivr.net/...supabase-js@2` のリクエストが成功（200 OK）しているか確認
   - `app.js` のリクエストが成功しているか確認

2. **F12 → Console:**
   - `console.error()` で出力されたエラーの詳細内容を確認

3. **ブラウザの再起動:**
   - キャッシュが残っている可能性があるため、ブラウザを完全に終了してから再度開く

4. **ネットワーク確認:**
   - インターネット接続が正常か確認
   - VPN / プロキシを使用していないか確認

---

## 📝 次のアクション

### ✅ 成功時（「共有データと同期しました。」が表示）

修正が成功しています！

- ゲーム機能を試す（ご飯をあげる、散歩など）
- 通知設定を試す
- 複数タブで同じ URL を開いて、データが同期されるか確認

### ❌ 失敗時

Console に出ているエラー内容を確認して、以下のいずれかの対応を実施:

1. **ページをハードリロード:** Ctrl+Shift+R
2. **ブラウザキャッシュをクリア:** Ctrl+Shift+Delete
3. **別ブラウザで試す:** Chrome / Firefox / Safari
4. **イシューを報告:** Console のエラー内容とブラウザ情報をユーザーに報告

---

完了後、結果をお知らせください。
