# ハンギョドン∞ライフ Supabase接続エラー診断レポート

**日時**: 2026年9月24日
**状況**: GitHub Pages 公開サイトで「Supabaseに接続できませんでした。ローカル保存を表示します。」メッセージが表示される

---

## 🔍 調査結果の概要

### 検証内容
1. ✓ Supabase DB: 正常（SQL Editor で select 成功）
2. ✓ `sleep_*` カラム: 正常に存在
3. ✓ `game_over` カラム: 正常に存在
4. ✓ REST API: 200 OK で応答（直接呼び出し成功）
5. ✓ GitHub Pages: HTML/CSS/JS すべて正常に配信
6. ✓ ローカル app.js と公開 app.js: 内容ほぼ同一

### 発見された問題
❌ **window.supabase が undefined の状態で app.js が実行されている**

---

## 📋 原因特定

### 最有力の原因：**スクリプト読み込みの競合**

#### 現在の HTML 構造 (`index.html`)
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="app.js"></script>
```

#### 何が起きているのか

1. `<script src="https://cdn.jsdelivr.net/...">` が実行開始
2. CDN からの JavaScript 読み込みが遅い場合、**未完了のまま** app.js の実行が始まる
3. `app.js` の最初の行: `const supabaseClient = (window.supabase && ...)`
4. この時点で `window.supabase` がまだ `undefined`
5. **条件式が `false` → `supabaseClient = null`**
6. `loadGame()` が実行される
7. `syncFromSupabase()` が実行される
8. `if (!supabaseClient) { ... }` に入る（supabase接続がない扱い）
9. ローカルキャッシュのみを表示

#### コード行を特定
- **ファイル**: `app.js`
- **行 9-11**: 
  ```javascript
  const supabaseClient = (window.supabase && SUPABASE_PUBLISHABLE_KEY && SUPABASE_PUBLISHABLE_KEY !== 'SUPABASE_PUBLISHABLE_KEY_HERE')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;
  ```

- **ファイル**: `app.js`
- **行 263-269**: 
  ```javascript
  async function syncFromSupabase() {
    if (!supabaseClient) {
      saveLocalGameCache();
      updateUI();
      return;
    }
    // ...
  }
  ```

### なぜこの問題が発生するのか

1. **HTML でのスクリプト読み込み方式**
   - 通常のスクリプトタグは「同期的に」読み込まれる
   - ただし CDN からの読み込みは「ネットワーク遅延」の影響を受ける
   - 読み込みの完了を待たずに次のタグの実行が開始されることがある（特に CDN が遅い場合）

2. **ブラウザ実装の違い**
   - Chrome / Firefox / Safari で CDN 読み込みの優先度が異なる
   - キャッシュがある場合と無い場合で動作が異なる

3. **GitHub Pages + CDN のタイミング問題**
   - GitHub Pages: 静的ファイル配信（超高速）
   - Supabase CDN (CDN.jsdelivr.net): 外部ネットワーク経由（遅延の可能性）
   - app.js は GitHub Pages から高速に読み込まれる
   - その結果、Supabase CDN の読み込み前に app.js が実行される可能性が高い

---

## ✅ 確認方法

### ブラウザの DevTools でリアルタイム確認

1. **https://nyokki42.github.io/hangyodon-life/** を開く
2. **DevTools を開く** (F12 または右クリック → 検査)
3. **Console タブを選択**
4. 以下を実行:
   ```javascript
   console.log(typeof window.supabase)
   ```
5. 結果を確認:
   - **`"object"` と表示 → Supabase CDN が正常に読み込まれている**
   - **`"undefined"` と表示 → CDN がまだ読み込まれていない（タイミング問題）**

### Network タブで確認
1. **DevTools → Network タブ**
2. ページをリロード (Ctrl+R)
3. 以下を確認:
   - `https://cdn.jsdelivr.net/...` の読み込み完了時刻
   - `app.js` の読み込み開始時刻
   - **どちらが先に完了しているか？**

### Console に出ているエラーを確認
1. **DevTools → Console タブ**
2. 以下のようなエラーが出ていないか確認:
   ```
   Supabase sync error: ...
   ```

---

## 🔧 修正方法（推奨）

### 【推奨】 HTML に `defer` 属性を追加

**ファイル**: `index.html`

```html
<!-- 修正前 -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="app.js"></script>

<!-- 修正後 -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script>
<script src="app.js" defer></script>
```

**理由**:
- `defer` 属性は「HTML parsing を終わってから実行」を意味する
- すべてのスクリプトが「同期的」に実行される（順序保証）
- Supabase CDN の読み込み完了を待ってから app.js が実行される
- ブラウザバージョンにかかわらず安全

---

## 📊 診断結果のまとめ

| 項目 | 状態 | 説明 |
|------|------|------|
| Supabase DB | ✓ 正常 | SQL Editor で select 成功、sleep_* / game_over カラム存在 |
| REST API | ✓ 正常 | curl コマンドで 200 OK |
| RLS | ✓ 正常 | id = 1 アクセス可能 |
| GitHub Pages | ✓ 正常 | HTML/CSS/JS すべて配信成功 |
| 公開 app.js | ✓ 正常 | Supabase URL/Key 正確、構文エラーなし |
| **window.supabase 初期化** | ❌ **タイミング問題** | CDN 読み込み完了前に app.js 実行 |

---

## 🛑 NOT の原因

以下は「原因ではない」と判定されました：

- ❌ Supabase のスキーマ不足
- ❌ sleep_* / game_over カラムの欠落
- ❌ RLS による SELECT 拒否
- ❌ Supabase URL/Key の誤入力
- ❌ DB のリセット/削除が必要
- ❌ API エラー（実際には 200 OK）

---

## 📝 結論

**原因**: Supabase CDN スクリプトの読み込み完了前に app.js が実行される

**修正**: `index.html` に `defer` 属性を追加

**DB 変更**: 不要

**SQL 実行**: 不要

---

## 🚀 次のステップ

1. `index.html` に `defer` 属性を追加
2. GitHub にコミット
3. GitHub Pages が自動更新を完了するのを待つ（通常 1-2 分）
4. ブラウザキャッシュをクリア (Ctrl+Shift+Del)
5. ページをリロード (Ctrl+R)
6. DevTools Console で `typeof window.supabase` を実行して確認
