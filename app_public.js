// ハンギョドン育成ゲーム
// GitHub Pages + Supabase 向けの静的構成

const SUPABASE_URL = 'https://otyfyfucfqbdboltelsw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jmt7PPVYn_L7MNDBJ69otg_s6u_ulGy';
const PUSH_VAPID_PUBLIC_KEY = 'BOs7vrRNkcraSCGjHZTVe_ywnnRfb2Ko6x0r0y2K2gJxQcMt_DtfvhUn8S-oOYFjXUHxwQYxMVZXi9ueKdwkJM8';
const PUSH_STORAGE_KEY = 'hangyodonPushEnabled';

// defer 属性により、Supabase CDN の読み込み完了後に app.js が実行される
// window.supabase は defer でスクリプトの読み込み順序が保証されるため、存在することが確定
const supabaseClient = (window.supabase && SUPABASE_PUBLISHABLE_KEY && SUPABASE_PUBLISHABLE_KEY !== 'SUPABASE_PUBLISHABLE_KEY_HERE')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const hangyoImg = document.getElementById('hangyo');
const feedBtn = document.getElementById('feed-btn');
const hungerBar = document.getElementById('hunger-bar');
const statusMessage = document.getElementById('status-message');

let hangyodon = null;
let jobGameData = {
  isActive: false,
  earnedMoney: 0,
  timeLeft: 10,
  timerInterval: null,
  lastJobTime: 0
};

const shopItems = {
  onigiri: { price: 100, hunger: 10, label: 'おにぎり' },
  pan: { price: 100, hunger: 10, label: 'パン' }
};

// レベルアップに必要なEXPを計算する関数
// 各レベルに必要な総EXPを返す（ベース: レベルごとに 100 + (レベル-1)*50）
function requiredExp(level) {
  if (level < 1) return 0;
  // レベル1: 100, レベル2: 250, レベル3: 400 ...
  return 100 + (level - 1) * 150;
}

function toLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getRandomHour(start, end) {
  return Math.floor(Math.random() * (end - start + 1)) + start;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeInventory(value) {
  if (!value) return {};

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      console.error('Inventory parse error:', error, value);
      return {};
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([key, qty]) => key && Number(qty) > 0)
      .map(([key, qty]) => [key, Number(qty)])
  );
}

function getDefaultHangyodonState() {
  return {
    hunger: 0,
    mood: 0,
    level: 1,
    exp: 0,
    money: 1000,
    inventory: {},
    sleeping: false,
    sleep_start_at: null,
    sleep_end_at: null,
    sleep_schedule_date: null,
    game_over: false,
    sleepStartHour: getRandomHour(22, 23),
    wakeUpHour: getRandomHour(6, 8),
    meetingDate: new Date().toISOString(),
    started_at: new Date().toISOString(),
    lastBathDate: null,
    lastHungerNotificationDate: null,
    lastJobTime: 0
  };
}

function progressStateToRuntime(state) {
  const defaults = getDefaultHangyodonState();
  return {
    ...defaults,
    ...state,
    inventory: normalizeInventory(state?.inventory || {}),
    sleeping: Boolean(state?.sleeping),
    hunger: clamp(Number(state?.hunger ?? defaults.hunger), 0, 100),
    mood: clamp(Number(state?.mood ?? defaults.mood), -100, 100),
    level: Math.max(1, Number(state?.level ?? defaults.level)),
    exp: Math.max(0, Number(state?.exp ?? defaults.exp)),
    money: Math.max(0, Number(state?.money ?? defaults.money)),
    meetingDate: state?.started_at || state?.meetingDate || defaults.meetingDate,
    started_at: state?.started_at || state?.meetingDate || defaults.meetingDate,
    sleep_start_at: state?.sleep_start_at || null,
    sleep_end_at: state?.sleep_end_at || null,
    sleep_schedule_date: state?.sleep_schedule_date || null,
    game_over: Boolean(state?.game_over),
    sleepStartHour: safeNumber(state?.sleepStartHour, defaults.sleepStartHour),
    wakeUpHour: safeNumber(state?.wakeUpHour, defaults.wakeUpHour),
    lastBathDate: state?.lastBathDate || null,
    lastHungerNotificationDate: state?.lastHungerNotificationDate || null,
    lastJobTime: safeNumber(state?.lastJobTime, 0)
  };
}

function createSleepScheduleForDate(date = new Date()) {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);

  const startMinutes = (22 * 60) + Math.floor(Math.random() * (2 * 60 + 1));
  const endMinutes = (6 * 60) + Math.floor(Math.random() * (2 * 60 + 1));

  const startAt = new Date(base.getTime() + startMinutes * 60000);
  const endAt = new Date(base.getTime() + 24 * 60 * 60 * 1000 + endMinutes * 60000);

  return {
    sleep_start_at: startAt.toISOString(),
    sleep_end_at: endAt.toISOString(),
    sleep_schedule_date: toLocalDateKey(base)
  };
}

function ensureSleepSchedule(state, now = new Date()) {
  const next = { ...state };
  const currentStart = next.sleep_start_at ? new Date(next.sleep_start_at) : null;
  const currentEnd = next.sleep_end_at ? new Date(next.sleep_end_at) : null;
  const dateKey = toLocalDateKey(now);

  const shouldCreate = !currentStart || !currentEnd || !next.sleep_schedule_date || next.sleep_schedule_date !== dateKey || now.getTime() >= currentEnd.getTime();
  if (shouldCreate) {
    const generated = createSleepScheduleForDate(now);
    next.sleep_start_at = generated.sleep_start_at;
    next.sleep_end_at = generated.sleep_end_at;
    next.sleep_schedule_date = generated.sleep_schedule_date;
  }

  return next;
}

function isSleepingAtInstant(state, instant = Date.now()) {
  if (!state?.sleep_start_at || !state?.sleep_end_at) return false;
  const startMs = new Date(state.sleep_start_at).getTime();
  const endMs = new Date(state.sleep_end_at).getTime();
  return instant >= startMs && instant < endMs;
}

function setStatusMessage(message, type = 'info') {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function saveLocalGameCache() {
  localStorage.setItem('hangyodonSave', JSON.stringify(hangyodon));
  localStorage.setItem('jobLastTime', String(jobGameData.lastJobTime || 0));
}

function readLocalGameCache() {
  const data = localStorage.getItem('hangyodonSave');
  if (!data) return null;

  try {
    const parsed = JSON.parse(data);
    return progressStateToRuntime({
      ...getDefaultHangyodonState(),
      ...parsed,
      inventory: normalizeInventory(parsed.inventory || {})
    });
  } catch (error) {
    console.error('Local save parse error:', error);
    return null;
  }
}

function getSleepingStateForHour(hour, sleepStartHour, wakeUpHour) {
  const start = sleepStartHour >= 24 ? sleepStartHour - 24 : sleepStartHour;
  const wake = wakeUpHour >= 24 ? wakeUpHour - 24 : wakeUpHour;

  if (start === wake) return false;
  if (start < wake) {
    return hour >= start && hour < wake;
  }
  return !(hour >= wake && hour < start);
}

function applyElapsedMinutesToState(state, elapsedMinutes) {
  // Client-side time decay is disabled.
  // Hunger/mood decay is handled only by Supabase Cron.
  return ensureSleepSchedule({ ...state }, new Date());
}

async function ensureSupabaseRow() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient.from('hangyodon').select('*').eq('id', 1).maybeSingle();
  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    const defaultRow = {
      id: 1,
      hunger: 100,
      mood: 100,
      level: 1,
      exp: 0,
      money: 100,
      inventory: {},
      sleep_start_at: null,
      sleep_end_at: null,
      sleep_schedule_date: null,
      game_over: false,
      last_updated: new Date().toISOString()
    };

    const { error: insertError } = await supabaseClient.from('hangyodon').insert([defaultRow]);
    if (insertError) throw insertError;
  }
}

async function updateSharedStateOnly(patch = {}) {
  if (!supabaseClient) return true;

  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );

  if (!Object.keys(cleanPatch).length) return true;

  const { error } = await supabaseClient
    .from('hangyodon')
    .update(cleanPatch)
    .eq('id', 1);

  if (error) throw error;
  return true;
}

async function syncFromSupabase() {
  if (!supabaseClient) {
    saveLocalGameCache();
    updateUI();
    return;
  }

  try {
    await ensureSupabaseRow();
    const { data, error } = await supabaseClient.from('hangyodon').select('*').eq('id', 1).single();
    if (error) throw error;

    const cached = readLocalGameCache() || getDefaultHangyodonState();
    const remoteInventory = normalizeInventory(data.inventory ?? {});

    const baseState = {
      ...cached,
      hunger: safeNumber(data.hunger, cached.hunger),
      mood: safeNumber(data.mood, cached.mood),
      level: safeNumber(data.level, cached.level),
      exp: safeNumber(data.exp, cached.exp),
      money: safeNumber(data.money, cached.money),
      inventory: remoteInventory,
      sleep_start_at: data.sleep_start_at || cached.sleep_start_at || null,
      sleep_end_at: data.sleep_end_at || cached.sleep_end_at || null,
      sleep_schedule_date: data.sleep_schedule_date || cached.sleep_schedule_date || null,
      game_over: Boolean(data.game_over),
      started_at: data.started_at || cached.started_at || new Date().toISOString(),
      lastJobTime: cached.lastJobTime || 0
    };

    const bootState = ensureSleepSchedule(progressStateToRuntime(baseState), new Date());

    hangyodon = progressStateToRuntime({
      ...bootState,
      inventory: remoteInventory,
      game_over: Boolean(data.game_over)
    });

    if (hangyodon.mood <= -100 || hangyodon.game_over) {
      triggerGameOver(false);
      return;
    }

    saveLocalGameCache();
    updateUI();
    setStatusMessage('共有データと同期しました。', 'success');
  } catch (error) {
    console.error('Supabase sync error:', error);
    if (error?.message && error.message.includes('inventory')) {
      setStatusMessage('Supabase に inventory 列がありません。SQL で inventory を追加してください。', 'error');
    } else {
      setStatusMessage('Supabaseに接続できませんでした。ローカル保存を表示します。', 'error');
    }

    const cached = readLocalGameCache();
    if (cached) {
      hangyodon = cached;
      updateUI();
    }
  }
}

async function syncToSupabase() {
  if (!supabaseClient) {
    saveLocalGameCache();
    return true;
  }

  try {
    const { data: current } = await supabaseClient
      .from('hangyodon')
      .select('started_at, inventory')
      .eq('id', 1)
      .maybeSingle();

    const inventoryForWrite = normalizeInventory(hangyodon.inventory ?? current?.inventory ?? {});
    const payload = {
      id: 1,
      hunger: clamp(Number(hangyodon.hunger) || 0, 0, 100),
      mood: clamp(Number(hangyodon.mood) || 0, -100, 100),
      level: Math.max(1, Number(hangyodon.level) || 1),
      exp: Math.max(0, Number(hangyodon.exp) || 0),
      money: Math.max(0, Number(hangyodon.money) || 0),
      inventory: inventoryForWrite,
      sleep_start_at: hangyodon.sleep_start_at || null,
      sleep_end_at: hangyodon.sleep_end_at || null,
      sleep_schedule_date: hangyodon.sleep_schedule_date || null,
      game_over: Boolean(hangyodon.game_over),
      last_updated: new Date().toISOString()
    };

    if (!current?.started_at) {
      payload.started_at = hangyodon.started_at || new Date().toISOString();
    }

    const { error } = await supabaseClient.from('hangyodon').upsert(payload, { onConflict: 'id' });
    if (error) throw error;

    saveLocalGameCache();
    return true;
  } catch (error) {
    console.error('Supabase save error:', error);
    saveLocalGameCache();
    if (error?.message && error.message.includes('inventory')) {
      setStatusMessage('Supabase の inventory 列がありません。SQL で inventory を追加してください。', 'error');
    } else {
      setStatusMessage('共有データの保存に失敗しました。ローカルに一時保存されています。', 'error');
    }
    return false;
  }
}

async function saveGame() {
  hangyodon = ensureSleepSchedule(progressStateToRuntime(hangyodon), new Date());
  const ok = await syncToSupabase();
  if (ok) {
    saveLocalGameCache();
  }
  return ok;
}

function resetGame() {
  hangyodon = getDefaultHangyodonState();
  jobGameData.lastJobTime = 0;
  localStorage.setItem('jobLastTime', '0');
  saveGame();
  updateUI();
}

function triggerGameOver(showMessage = true) {
  const defaultState = getDefaultHangyodonState();
  hangyodon = {
    ...defaultState,
    game_over: true,
    sleeping: false,
    sleep_start_at: null,
    sleep_end_at: null,
    sleep_schedule_date: null
  };

  if (showMessage) {
    setStatusMessage('前のハンギョドンはいなくなってしまいました……', 'error');
  }

  saveLocalGameCache();
  syncToSupabase();
  updateUI();
}

function startNewGame() {
  hangyodon = getDefaultHangyodonState();
  hangyodon.game_over = false;
  hangyodon.sleep_start_at = null;
  hangyodon.sleep_end_at = null;
  hangyodon.sleep_schedule_date = null;
  hangyodon.sleeping = false;
  jobGameData.lastJobTime = 0;
  localStorage.setItem('jobLastTime', '0');
  saveGame();
  updateUI();
  setStatusMessage('新しいハンギョドンが生まれたよ！', 'success');
}

function loadGame() {
  const cached = readLocalGameCache();
  if (cached) {
    hangyodon = cached;
  }

  if (!hangyodon) {
    hangyodon = getDefaultHangyodonState();
  }

  hangyodon = ensureSleepSchedule(progressStateToRuntime(hangyodon), new Date());

  if (!hangyodon.money && hangyodon.money !== 0) hangyodon.money = 1000;
  if (!hangyodon.inventory) hangyodon.inventory = {};
  if (!hangyodon.meetingDate) {
    hangyodon.meetingDate = new Date().toISOString();
  }

  const savedJobTime = localStorage.getItem('jobLastTime');
  if (savedJobTime) {
    jobGameData.lastJobTime = parseInt(savedJobTime, 10) || 0;
  }

  if (supabaseClient) {
    subscribeHangyodonRealtime();
    syncFromSupabase();
  } else {
    updateUI();
  }
}

function isHangyodonSleepingNow() {
  if (!hangyodon) return false;
  return isSleepingAtInstant(hangyodon, Date.now());
}

function updateUI() {
  const gameContainer = document.querySelector('.game');
  const startScreen = document.getElementById('start-screen');

  if (hangyodon && hangyodon.game_over) {
    if (gameContainer) gameContainer.style.display = 'none';
    if (startScreen) startScreen.classList.remove('hidden');
  } else {
    if (gameContainer) gameContainer.style.display = 'flex';
    if (startScreen) startScreen.classList.add('hidden');
  }

  const sleepNow = isHangyodonSleepingNow();
  hangyodon.sleeping = sleepNow;

  if (hangyoImg) {
    if (hangyodon.game_over) {
      hangyoImg.src = 'hangyo_open.png';
    } else if (sleepNow) {
      hangyoImg.src = 'hangyo_sleep.png';
    } else {
      hangyoImg.src = 'hangyo_open.png';
    }
  }

  const hungerBarVisible = hungerBar;
  if (hungerBarVisible) {
    hungerBarVisible.style.width = `${hangyodon.hunger}%`;
  }

  const meetEl = document.getElementById('meeting-date');
  if (meetEl) {
    // started_at は Supabase から取得された唯一の正解
    const d = new Date(hangyodon.started_at);
    meetEl.textContent = d.toLocaleString();
  }

  const hasFood = Object.values(hangyodon.inventory).some(q => q > 0);
  if (feedBtn) feedBtn.disabled = hangyodon.hunger >= 100 || !hasFood || hangyodon.game_over || sleepNow;

  const walkBtn = document.getElementById('walk-btn');
  if (walkBtn) walkBtn.disabled = hangyodon.hunger <= 0 || hangyodon.game_over || sleepNow;

  const bathBtn = document.getElementById('bath-btn');
  if (bathBtn) {
    const today = new Date().toDateString();
    const lastBath = hangyodon.lastBathDate ? new Date(hangyodon.lastBathDate).toDateString() : null;
    bathBtn.disabled = lastBath === today || hangyodon.game_over || sleepNow;
  }

  const jobBtn = document.getElementById('job-btn');
  if (jobBtn) {
    const now = Date.now();
    const cooldownMs = 10 * 60 * 1000;
    if (jobGameData.lastJobTime && (now - jobGameData.lastJobTime) < cooldownMs) {
      jobBtn.disabled = true;
    } else {
      jobBtn.disabled = hangyodon.game_over || sleepNow;
    }
  }

  const moodEl = document.getElementById('mood-value');
  if (moodEl) moodEl.textContent = hangyodon.mood;

  const levelEl = document.getElementById('level-value');
  const expEl = document.getElementById('exp-value');
  if (levelEl) levelEl.textContent = hangyodon.level;
  if (expEl) {
    const req = requiredExp(hangyodon.level);
    expEl.textContent = `${hangyodon.exp}/${req}`;
  }

  const moneyEl = document.getElementById('money-value');
  if (moneyEl) moneyEl.textContent = hangyodon.money;

  const shopButtons = document.querySelectorAll('#shop button');
  shopButtons.forEach(btn => {
    const it = btn.dataset.item;
    btn.disabled = hangyodon.money < (shopItems[it]?.price || Infinity) || hangyodon.game_over || sleepNow;
  });

  const invList = document.getElementById('inventory-list');
  if (invList) {
    invList.innerHTML = '';
    for (const [item, qty] of Object.entries(hangyodon.inventory)) {
      if (qty <= 0) continue;
      const info = shopItems[item] || {};
      const label = info.label || item;
      const li = document.createElement('li');
      li.textContent = `${label} x${qty}`;
      invList.appendChild(li);
    }
  }
}

function randomBlink() {
  const randomTime = Math.random() * 4000 + 2000;
  setTimeout(() => {
    if (hangyoImg) hangyoImg.src = 'hangyo_close.png';
    setTimeout(() => {
      if (hangyoImg) hangyoImg.src = 'hangyo_open.png';
      randomBlink();
    }, 200);
  }, randomTime);
}

function generateComment() {
  if (hangyodon.sleeping) {
    return 'ZZZ...';
  }

  const now = new Date();
  const h = now.getHours();
  const comments = [];

  if (hangyodon.hunger <= 20) comments.push('お腹すいた...');
  if (hangyodon.mood < 0) comments.push('ちょっと元気ないかも');
  if (hangyodon.mood > 50) comments.push('いい気分！');
  if (h >= 6 && h < 12) comments.push('朝だね〜');
  if (h >= 12 && h < 18) comments.push('お昼だよ！');
  if (h >= 18 && h < 22) comments.push('夕方の時間だ〜');

  comments.push('何かいいことあるかな？');
  comments.push('ふふ、気まぐれだよ。');

  return comments[Math.floor(Math.random() * comments.length)];
}

function showComment() {
  const bubble = document.getElementById('comment-bubble');
  if (!bubble) return;
  bubble.textContent = generateComment();
  bubble.style.display = 'block';
  setTimeout(() => {
    bubble.style.display = 'none';
  }, 9000);
}

function isPushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64String) {
  if (!base64String || base64String.includes('PASTE_') || base64String.includes('YOUR_')) {
    return new Uint8Array();
  }

  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    output[i] = binary.charCodeAt(i);
  }

  return output;
}

function updatePushButtons(isEnabled) {
  const enableBtn = document.getElementById('enable-push-btn');
  const disableBtn = document.getElementById('disable-push-btn');
  const helpText = document.getElementById('push-help-text');

  if (enableBtn) enableBtn.style.display = isEnabled ? 'none' : 'block';
  if (disableBtn) disableBtn.style.display = isEnabled ? 'block' : 'none';
  if (helpText) {
    helpText.textContent = isEnabled ? 'この端末では通知を受け取る設定です。' : 'スマートフォンに空腹時の通知を受け取れます。';
  }

  localStorage.setItem(PUSH_STORAGE_KEY, isEnabled ? '1' : '0');
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    return !!registration;
  } catch (error) {
    console.error('Service Worker registration error:', error);
    return false;
  }
}

async function savePushSubscriptionToSupabase(subscription) {
  if (!supabaseClient) {
    setStatusMessage('Supabaseの接続が無いため、通知購読を保存できません。', 'error');
    return false;
  }

  if (!subscription || !subscription.endpoint) return false;

  const keyP256dh = subscription.getKey ? subscription.getKey('p256dh') : null;
  const keyAuth = subscription.getKey ? subscription.getKey('auth') : null;

  const payload = {
    pet_id: 1,
    endpoint: subscription.endpoint,
    p256dh: keyP256dh ? arrayBufferToBase64(keyP256dh) : null,
    auth: keyAuth ? arrayBufferToBase64(keyAuth) : null,
    is_active: true,
    platform: /Android/i.test(navigator.userAgent) ? 'android' : /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'browser',
    device_label: navigator.userAgent,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient.from('push_subscriptions').upsert(payload, { onConflict: 'endpoint' });
  if (error) {
    console.error('Push subscription save error:', error);
    setStatusMessage('通知購読の保存に失敗しました。', 'error');
    return false;
  }

  return true;
}

async function removePushSubscriptionFromSupabase(endpoint) {
  if (!supabaseClient || !endpoint) return;

  await supabaseClient.from('push_subscriptions').update({ is_active: false, updated_at: new Date().toISOString() }).eq('endpoint', endpoint);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function enablePushNotifications() {
  if (!isPushSupported()) {
    setStatusMessage('この端末ではWeb Pushが使えません。iPhoneではホーム画面に追加してから試してください。', 'error');
    return;
  }

  if (!('Notification' in window)) {
    setStatusMessage('ブラウザが通知APIをサポートしていません。', 'error');
    return;
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatusMessage('通知の許可が必要です。設定から通知をオンにしてください。', 'error');
      return;
    }
  }

  if (Notification.permission !== 'granted') {
    setStatusMessage('通知が拒否されています。設定からONにしてください。', 'error');
    return;
  }

  if (!PUSH_VAPID_PUBLIC_KEY || PUSH_VAPID_PUBLIC_KEY.includes('PASTE_') || PUSH_VAPID_PUBLIC_KEY.includes('YOUR_')) {
    setStatusMessage('VAPID公開鍵が未設定です。Supabase Secret と app.js の公開鍵を設定してください。', 'error');
    return;
  }

  await registerServiceWorker();

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUSH_VAPID_PUBLIC_KEY)
    });
  }

  const saved = await savePushSubscriptionToSupabase(subscription);
  if (saved) {
    updatePushButtons(true);
    setStatusMessage('この端末で通知をONにしました。', 'success');
  }
}

async function disablePushNotifications() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await removePushSubscriptionFromSupabase(subscription.endpoint);
    }

    updatePushButtons(false);
    setStatusMessage('通知をOFFにしました。', 'info');
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    setStatusMessage('通知の停止に失敗しました。', 'error');
  }
}

function registerPushNotificationHandlers() {
  const enableBtn = document.getElementById('enable-push-btn');
  const disableBtn = document.getElementById('disable-push-btn');

  if (enableBtn) {
    enableBtn.addEventListener('click', enablePushNotifications);
  }

  if (disableBtn) {
    disableBtn.addEventListener('click', disablePushNotifications);
  }

  const isEnabled = ('Notification' in window && Notification.permission === 'granted') || localStorage.getItem(PUSH_STORAGE_KEY) === '1';
  updatePushButtons(isEnabled);
}

function maybeShowLocalHungerNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (hangyodon.hunger > 20) return;
  if (isHangyodonSleepingNow()) return;

  const today = new Date().toDateString();
  const lastNotified = hangyodon.lastHungerNotificationDate ? new Date(hangyodon.lastHungerNotificationDate).toDateString() : null;

  if (lastNotified === today) return;

  hangyodon.lastHungerNotificationDate = new Date().toISOString();
  new Notification('🍙 ハンギョドンがお腹すいてるよ！', {
    body: 'ご飯をあげてね。',
    icon: 'hangyo_open.png',
    tag: 'hangyodon-hunger-low'
  });
}

// Periodic sync: avoid local-only per-minute decay. Use Supabase as single source of truth.
setInterval(() => {
  if (supabaseClient) {
    syncFromSupabase();
    return;
  }

  // When offline/no supabase, update UI and ensure sleep schedule only.
  if (!hangyodon) return;
  const now = new Date();
  hangyodon = ensureSleepSchedule(progressStateToRuntime(hangyodon), now);
  updateUI();
}, 60000);

setInterval(showComment, 10000);

if (supabaseClient) {
  setStatusMessage('Supabase接続を準備しています…', 'info');
} else {
  setStatusMessage('SupabaseのPublishable keyを設定してください。', 'error');
}

hangyodon = getDefaultHangyodonState();
loadGame();
randomBlink();
registerPushNotificationHandlers();
if (isPushSupported()) {
  registerServiceWorker();
}

if (supabaseClient) {
  supabaseClient.channel('hangyodon_shared').on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'hangyodon',
    filter: 'id=eq.1'
  }, payload => {
    // Supabase の変更を受けたらサーバーを信頼して再同期する
    // これにより古い端末側の状態で上書きされることを防ぎます
    try {
      syncFromSupabase();
    } catch (e) {
      console.error('Realtime sync error:', e);
    }
  }).subscribe();
}

const startGameBtn = document.getElementById('start-game-btn');
if (startGameBtn) {
  startGameBtn.addEventListener('click', startNewGame);
}

updateUI();





