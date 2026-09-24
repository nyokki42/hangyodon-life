// ハンギョドン育成ゲーム
// GitHub Pages + Supabase 向けの静的構成

const SUPABASE_URL = 'https://otyfyfucfqbdboltelsw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jmt7PPVYn_L7MNDBJ69otg_s6u_ulGy';
const PUSH_VAPID_PUBLIC_KEY = 'BOs7vrRNkcraSCGjHZTVe_ywnnRfb2Ko6x0r0y2K2gJxQcMt_DtfvhUn8S-oOYFjXUHxwQYxMVZXi9ueKdwkJM8';
const PUSH_STORAGE_KEY = 'hangyodonPushEnabled';
const ADMIN_PASSWORD = '1234';

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
    sleepModeEnabled: true,
    sleep_start_at: null,
    sleep_end_at: null,
    sleep_schedule_date: null,
    game_over: false,
    sleepStartHour: getRandomHour(22, 23),
    wakeUpHour: getRandomHour(6, 8),
    meetingDate: new Date().toISOString(),
    lastBathDate: null,
    lastHungerNotificationDate: null,
    lastJobTime: 0
  };
}

function progressStateToRuntime(state) {
  const defaults = getDefaultHangyodonState();
  const derivedSleepModeEnabled = state?.sleepModeEnabled !== undefined
    ? Boolean(state.sleepModeEnabled)
    : state?.sleep_schedule_date !== 'OFF';
  const next = {
    ...defaults,
    ...state,
    sleepModeEnabled: derivedSleepModeEnabled,
    inventory: normalizeInventory(state?.inventory || {}),
    sleeping: Boolean(state?.sleeping),
    hunger: clamp(Number(state?.hunger ?? defaults.hunger), 0, 100),
    mood: clamp(Number(state?.mood ?? defaults.mood), -100, 100),
    level: Math.max(1, Number(state?.level ?? defaults.level)),
    exp: Math.max(0, Number(state?.exp ?? defaults.exp)),
    money: Math.max(0, Number(state?.money ?? defaults.money)),
    meetingDate: state?.meetingDate || defaults.meetingDate,
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

  if (next.sleep_schedule_date === 'OFF') {
    next.sleepModeEnabled = false;
    next.sleeping = false;
  }

  return next;
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
  const next = applySleepModeState({ ...state });
  if (!next.sleepModeEnabled) {
    return next;
  }

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

  next.sleeping = isSleepingAtInstant(next, Date.now());
  return next;
}

function isSleepingAtInstant(state, instant = Date.now()) {
  if (!state || !isSleepModeEnabled(state)) return false;
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

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
  const next = ensureSleepSchedule({ ...state }, new Date());
  if (elapsedMinutes <= 0) return next;

  const startedAt = Date.now() - (elapsedMinutes * 60 * 1000);
  let awakeMinutes = 0;

  for (let minute = 0; minute < elapsedMinutes; minute += 1) {
    const target = startedAt + (minute * 60 * 1000);
    if (!isSleepingAtInstant(next, target)) {
      awakeMinutes += 1;
      next.mood = Math.max(-100, next.mood - 1);
    }
  }

  const hungerLoss = Math.floor(awakeMinutes / 5);
  if (hungerLoss > 0) {
    next.hunger = Math.max(0, next.hunger - hungerLoss);
  }

  if (next.hunger <= 0) {
    next.mood = Math.min(next.mood, 0);
  }

  next.sleeping = isSleepingAtInstant(next, Date.now());
  return next;
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
    const remoteInventory = normalizeInventory(data.inventory || cached.inventory || {});
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
      meetingDate: cached.meetingDate || new Date().toISOString(),
      lastBathDate: cached.lastBathDate || null,
      lastHungerNotificationDate: cached.lastHungerNotificationDate || null,
      lastJobTime: cached.lastJobTime || 0
    };

    const bootState = ensureSleepSchedule(progressStateToRuntime(baseState), new Date());
    const lastUpdatedMs = data.last_updated ? new Date(data.last_updated).getTime() : Date.now();
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - lastUpdatedMs) / 60000));
    const merged = applyElapsedMinutesToState(bootState, elapsedMinutes);

    hangyodon = progressStateToRuntime({
      ...merged,
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
    return;
  }

  try {
    const payload = {
      id: 1,
      hunger: clamp(Number(hangyodon.hunger) || 0, 0, 100),
      mood: clamp(Number(hangyodon.mood) || 0, -100, 100),
      level: Math.max(1, Number(hangyodon.level) || 1),
      exp: Math.max(0, Number(hangyodon.exp) || 0),
      money: Math.max(0, Number(hangyodon.money) || 0),
      inventory: normalizeInventory(hangyodon.inventory),
      sleep_start_at: hangyodon.sleep_start_at || null,
      sleep_end_at: hangyodon.sleep_end_at || null,
      sleep_schedule_date: hangyodon.sleep_schedule_date || null,
      game_over: Boolean(hangyodon.game_over),
      last_updated: new Date().toISOString()
    };

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

function saveGame() {
  hangyodon = ensureSleepSchedule(progressStateToRuntime(hangyodon), new Date());
  saveLocalGameCache();
  syncToSupabase();
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
    syncFromSupabase();
  } else {
    updateUI();
  }
}

function isHangyodonSleepingNow() {
  if (!hangyodon) return false;
  return isSleepingAtInstant(hangyodon, Date.now());
}

function canOperate() {
  if (!hangyodon || hangyodon.game_over) {
    setStatusMessage('ゲームオーバー中は操作できません。スタートから新しく始めてください。', 'error');
    return false;
  }

  if (isHangyodonSleepingNow()) {
    setStatusMessage('ハンギョドンは寝ています。起きてからお世話してください。', 'info');
    return false;
  }

  return true;
}

function addExperience(amount) {
  hangyodon.exp = Math.max(0, hangyodon.exp + amount);

  while (hangyodon.exp >= requiredExp(hangyodon.level)) {
    hangyodon.exp -= requiredExp(hangyodon.level);
    hangyodon.level += 1;
    setStatusMessage(`レベル ${hangyodon.level} になりました！`, 'success');
  }
}

function finishAction(message, type = 'success') {
  saveGame();
  updateUI();
  setStatusMessage(message, type);
}

function showFeedMenu() {
  if (!canOperate()) return;

  const menu = document.getElementById('feed-menu');
  const options = document.getElementById('feed-options');
  if (!menu || !options) return;

  options.innerHTML = '';
  for (const [item, qty] of Object.entries(hangyodon.inventory)) {
    const info = shopItems[item];
    if (!info || qty <= 0) continue;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.item = item;
    button.textContent = `${info.label} x${qty}`;
    button.addEventListener('click', () => feedHangyodon(item));
    options.appendChild(button);
  }

  if (!options.children.length) {
    setStatusMessage('食べ物を持っていません。ショップで購入してください。', 'info');
    return;
  }

  menu.style.display = 'block';
}

function hideFeedMenu() {
  const menu = document.getElementById('feed-menu');
  if (menu) menu.style.display = 'none';
}

function feedHangyodon(item) {
  if (!canOperate()) return;

  const info = shopItems[item];
  if (!info || !hangyodon.inventory[item]) {
    setStatusMessage('その食べ物は持っていません。', 'error');
    return;
  }

  hangyodon.inventory[item] -= 1;
  if (hangyodon.inventory[item] <= 0) delete hangyodon.inventory[item];
  hangyodon.hunger = clamp(hangyodon.hunger + info.hunger, 0, 100);
  hangyodon.mood = clamp(hangyodon.mood + 5, -100, 100);
  hideFeedMenu();
  finishAction(`${info.label}をあげました！`);
}

function showWalkPopup(message) {
  const popup = document.getElementById('walk-popup');
  const messageEl = document.getElementById('walk-popup-message');
  if (messageEl) messageEl.textContent = message;
  if (popup) popup.style.display = 'flex';
}

function closeWalkPopup() {
  const popup = document.getElementById('walk-popup');
  if (popup) popup.style.display = 'none';
}

function walkHangyodon() {
  if (!canOperate()) return;
  if (hangyodon.hunger <= 0) {
    setStatusMessage('お腹が空きすぎています。先にご飯をあげてください。', 'error');
    return;
  }

  hangyodon.hunger = Math.max(0, hangyodon.hunger - 10);
  if (Math.random() < 0.7) {
    const money = 50;
    addExperience(20);
    hangyodon.mood = clamp(hangyodon.mood + 10, -100, 100);
    hangyodon.money += money;
    if (Math.random() < 0.35) {
      hangyodon.inventory.onigiri = (hangyodon.inventory.onigiri || 0) + 1;
      showWalkPopup(`散歩は大成功！ ${money}円とおにぎりを見つけた！`);
    } else {
      showWalkPopup(`楽しく散歩しました！ ${money}円を見つけた！`);
    }
    finishAction('散歩から帰ってきました！');
  } else {
    hangyodon.money = Math.max(0, hangyodon.money - 30);
    hangyodon.mood = clamp(hangyodon.mood - 10, -100, 100);
    addExperience(-10);
    showWalkPopup('散歩中に転んでしまいました…。');
    finishAction('散歩から帰ってきました。', 'info');
  }
}

function showBathPopup(message) {
  const popup = document.getElementById('bath-popup');
  const messageEl = document.getElementById('bath-popup-message');
  if (messageEl) messageEl.textContent = message;
  if (popup) popup.style.display = 'flex';
}

function closeBathPopup() {
  const popup = document.getElementById('bath-popup');
  if (popup) popup.style.display = 'none';
}

function batheHangyodon() {
  if (!canOperate()) return;

  const today = new Date().toDateString();
  const lastBath = hangyodon.lastBathDate ? new Date(hangyodon.lastBathDate).toDateString() : null;
  if (lastBath === today) {
    setStatusMessage('お風呂は1日1回までです。', 'info');
    return;
  }

  hangyodon.lastBathDate = new Date().toISOString();
  hangyodon.mood = clamp(hangyodon.mood + 20, -100, 100);
  showBathPopup('お風呂に入ってさっぱりした！');
  finishAction('お風呂に入りました！');
}

function buyShopItem(item) {
  if (!canOperate()) return;

  const info = shopItems[item];
  if (!info) return;
  if (hangyodon.money < info.price) {
    setStatusMessage('お金が足りません。', 'error');
    return;
  }

  hangyodon.money -= info.price;
  hangyodon.inventory[item] = (hangyodon.inventory[item] || 0) + 1;
  finishAction(`${info.label}を購入しました！`);
}

function updateJobDisplay() {
  const timer = document.getElementById('job-timer');
  const money = document.getElementById('job-money');
  if (timer) timer.textContent = String(jobGameData.timeLeft);
  if (money) money.textContent = String(jobGameData.earnedMoney);
}

function startJob() {
  if (!canOperate() || jobGameData.isActive) return;

  jobGameData.isActive = true;
  jobGameData.earnedMoney = 0;
  jobGameData.timeLeft = 10;
  const game = document.getElementById('job-minigame');
  const finishButton = document.getElementById('job-finish-btn');
  if (game) game.style.display = 'flex';
  if (finishButton) finishButton.style.display = 'block';
  updateJobDisplay();
  updateUI();

  jobGameData.timerInterval = setInterval(() => {
    jobGameData.timeLeft -= 1;
    updateJobDisplay();
    if (jobGameData.timeLeft <= 0) finishJob();
  }, 1000);
}

function workAtJob() {
  if (!jobGameData.isActive || !canOperate()) return;
  const earned = Math.floor(Math.random() * 16) + 5;
  jobGameData.earnedMoney += earned;
  updateJobDisplay();
}

function finishJob() {
  if (!jobGameData.isActive) return;

  if (jobGameData.timerInterval) clearInterval(jobGameData.timerInterval);
  jobGameData.timerInterval = null;
  jobGameData.isActive = false;
  jobGameData.lastJobTime = Date.now();

  const game = document.getElementById('job-minigame');
  const finishButton = document.getElementById('job-finish-btn');
  if (game) game.style.display = 'none';
  if (finishButton) finishButton.style.display = 'none';

  hangyodon.money += jobGameData.earnedMoney;
  addExperience(Math.max(5, Math.floor(jobGameData.earnedMoney / 10)));
  finishAction(`${jobGameData.earnedMoney}円を稼ぎました！`);
}

function isSleepModeEnabled(state = hangyodon) {
  if (!state) return true;
  if (state.sleepModeEnabled === false || state.sleep_schedule_date === 'OFF') return false;
  return true;
}

function applySleepModeState(nextState) {
  const next = { ...nextState };
  next.sleepModeEnabled = isSleepModeEnabled(next);
  if (!next.sleepModeEnabled) {
    next.sleeping = false;
    next.sleep_schedule_date = 'OFF';
  }
  return next;
}

function setSleepModeEnabled(enabled) {
  if (!hangyodon) return;

  hangyodon.sleepModeEnabled = Boolean(enabled);

  if (enabled) {
    hangyodon.sleep_schedule_date = hangyodon.sleep_schedule_date === 'OFF' ? toLocalDateKey(new Date()) : hangyodon.sleep_schedule_date;
    if (!hangyodon.sleep_start_at || !hangyodon.sleep_end_at) {
      const generated = createSleepScheduleForDate(new Date());
      hangyodon.sleep_start_at = generated.sleep_start_at;
      hangyodon.sleep_end_at = generated.sleep_end_at;
      hangyodon.sleep_schedule_date = generated.sleep_schedule_date;
    }
    hangyodon.sleeping = isSleepingAtInstant(hangyodon, Date.now());
    setStatusMessage('睡眠モードを ON にしました。', 'success');
  } else {
    hangyodon.sleeping = false;
    hangyodon.sleep_schedule_date = 'OFF';
    setStatusMessage('睡眠モードを OFF にしました。通常時の時間経過に戻ります。', 'info');
  }

  saveGame();
  updateUI();
}

function openAdminPasswordModal() {
  const modal = document.getElementById('admin-password-modal');
  const input = document.getElementById('admin-password-input');
  if (modal) modal.style.display = 'flex';
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
}

function closeAdminPasswordModal() {
  const modal = document.getElementById('admin-password-modal');
  if (modal) modal.style.display = 'none';
  const input = document.getElementById('admin-password-input');
  if (input) input.value = '';
}

function openAdminMenu() {
  const modal = document.getElementById('admin-password-modal');
  const menu = document.getElementById('admin-menu');
  if (modal) modal.style.display = 'none';
  if (menu) menu.style.display = 'flex';
  const toggleBtn = document.getElementById('admin-sleep-toggle-btn');
  if (toggleBtn) {
    toggleBtn.textContent = isSleepModeEnabled(hangyodon) ? '睡眠モード：ON' : '睡眠モード：OFF';
  }
}

function closeAdminMenu() {
  const menu = document.getElementById('admin-menu');
  if (menu) menu.style.display = 'none';
  closeAdminPasswordModal();
}

function handleAdminLogin() {
  const input = document.getElementById('admin-password-input');
  if (!input) return;

  if (input.value === ADMIN_PASSWORD) {
    openAdminMenu();
    return;
  }

  setStatusMessage('パスワードが違います。', 'error');
  input.value = '';
}

function sendAdminTestNotification() {
  const title = 'ハンギョドン∞ライフ';
  const body = 'ハンギョドンからのお知らせです！';

  async function doLocalSend() {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, {
            body,
            icon: 'hangyo_open.png',
            badge: 'hangyo_open.png',
            tag: 'hangyodon-admin-test'
          });
          setStatusMessage('テスト通知を送信しました。', 'success');
          return;
        }
      }
    } catch (error) {
      console.error('Admin notification via service worker failed:', error);
    }

    if ('Notification' in window) {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setStatusMessage('通知の許可が必要です。', 'error');
          return;
        }
      }
      new Notification(title, {
        body,
        icon: 'hangyo_open.png',
        tag: 'hangyodon-admin-test'
      });
      setStatusMessage('テスト通知を送信しました。', 'success');
      return;
    }

    setStatusMessage('この端末では通知を送れません。', 'error');
  }

  async function doPushSend() {
    try {
      if (!supabaseClient) {
        await doLocalSend();
        return;
      }

      if (!isPushSupported()) {
        await doLocalSend();
        return;
      }

      if (!('Notification' in window)) {
        await doLocalSend();
        return;
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setStatusMessage('通知の許可が必要です。', 'error');
          return;
        }
      }

      if (Notification.permission !== 'granted') {
        setStatusMessage('通知が拒否されています。設定からONにしてください。', 'error');
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
      if (!saved) {
        await doLocalSend();
        return;
      }

      const { data, error } = await supabaseClient.functions.invoke('send-hangyodon-push', {
        body: {
          pet_id: 1,
          type: 'admin_test',
          title,
          body,
          icon: 'hangyo_open.png',
          tag: 'hangyodon-admin-test'
        }
      });

      if (error) {
        console.error('Admin push invoke failed:', error);
        setStatusMessage('通知送信に失敗しました。', 'error');
        return;
      }

      if (data && data.ok === false) {
        setStatusMessage('通知送信に失敗しました。', 'error');
        return;
      }

      setStatusMessage('テスト通知を送信しました。', 'success');
    } catch (error) {
      console.error('Admin test notification failed:', error);
      await doLocalSend();
    }
  }

  doPushSend();
}

function resetAll() {
  const confirmed = window.confirm('本当に全リセットしますか？');
  if (!confirmed) {
    setStatusMessage('全リセットはキャンセルされました。', 'info');
    return;
  }

  resetGame();
  closeAdminMenu();
  setStatusMessage('ゲームを全リセットしました。', 'success');
}

function registerGameActionHandlers() {
  if (feedBtn) feedBtn.addEventListener('click', showFeedMenu);

  const walkBtn = document.getElementById('walk-btn');
  const bathBtn = document.getElementById('bath-btn');
  const jobBtn = document.getElementById('job-btn');
  const adminBtn = document.getElementById('admin-btn');
  const feedCancel = document.getElementById('feed-cancel');
  const walkPopupOk = document.getElementById('walk-popup-ok');
  const bathPopupOk = document.getElementById('bath-popup-ok');
  const jobWorkBtn = document.getElementById('job-work-btn');
  const jobFinishBtn = document.getElementById('job-finish-btn');
  const adminLoginBtn = document.getElementById('admin-login-btn');
  const adminCancelBtn = document.getElementById('admin-password-cancel-btn');
  const adminSleepToggleBtn = document.getElementById('admin-sleep-toggle-btn');
  const adminSendPushBtn = document.getElementById('admin-send-push-btn');
  const adminResetMenuBtn = document.getElementById('admin-reset-btn');
  const adminCloseMenuBtn = document.getElementById('admin-close-btn');

  const adminPasswordInput = document.getElementById('admin-password-input');
  if (adminPasswordInput) {
    adminPasswordInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        handleAdminLogin();
      }
    });
  }

  if (walkBtn) walkBtn.addEventListener('click', walkHangyodon);
  if (bathBtn) bathBtn.addEventListener('click', batheHangyodon);
  if (jobBtn) jobBtn.addEventListener('click', startJob);
  if (adminBtn) adminBtn.addEventListener('click', openAdminPasswordModal);
  if (feedCancel) feedCancel.addEventListener('click', hideFeedMenu);
  if (walkPopupOk) walkPopupOk.addEventListener('click', closeWalkPopup);
  if (bathPopupOk) bathPopupOk.addEventListener('click', closeBathPopup);
  if (jobWorkBtn) jobWorkBtn.addEventListener('click', workAtJob);
  if (jobFinishBtn) jobFinishBtn.addEventListener('click', finishJob);
  if (adminLoginBtn) adminLoginBtn.addEventListener('click', handleAdminLogin);
  if (adminCancelBtn) adminCancelBtn.addEventListener('click', closeAdminPasswordModal);
  if (adminSleepToggleBtn) {
    adminSleepToggleBtn.addEventListener('click', () => {
      setSleepModeEnabled(!isSleepModeEnabled(hangyodon));
      const label = document.getElementById('admin-sleep-toggle-btn');
      if (label) label.textContent = isSleepModeEnabled(hangyodon) ? '睡眠モード：ON' : '睡眠モード：OFF';
    });
  }
  if (adminSendPushBtn) adminSendPushBtn.addEventListener('click', sendAdminTestNotification);
  if (adminResetMenuBtn) adminResetMenuBtn.addEventListener('click', resetAll);
  if (adminCloseMenuBtn) adminCloseMenuBtn.addEventListener('click', closeAdminMenu);

  document.querySelectorAll('#shop button').forEach(button => {
    button.addEventListener('click', () => buyShopItem(button.dataset.item));
  });
}

let blinkLoopActive = false;
let blinkTimeoutId = null;
let blinkSwitchTimeoutId = null;

function updateHangyoImage() {
  if (!hangyoImg || !hangyodon) return;

  if (hangyodon.game_over) {
    hangyoImg.src = 'hangyo_open.png';
    return;
  }

  if (isHangyodonSleepingNow()) {
    hangyoImg.src = 'hangyo_sleep.png';
    return;
  }

  if (hangyoImg.src.endsWith('/hangyo_sleep.png')) {
    hangyoImg.src = 'hangyo_open.png';
  }
}

function stopBlinkLoop() {
  blinkLoopActive = false;
  if (blinkTimeoutId) {
    clearTimeout(blinkTimeoutId);
    blinkTimeoutId = null;
  }
  if (blinkSwitchTimeoutId) {
    clearTimeout(blinkSwitchTimeoutId);
    blinkSwitchTimeoutId = null;
  }
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

  updateHangyoImage();

  const hungerBarVisible = hungerBar;
  if (hungerBarVisible) {
    hungerBarVisible.style.width = `${hangyodon.hunger}%`;
  }

  const meetEl = document.getElementById('meeting-date');
  if (meetEl) {
    const d = new Date(hangyodon.meetingDate);
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
      jobBtn.disabled = hangyodon.game_over || sleepNow || jobGameData.isActive;
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
  if (!hangyoImg || !hangyodon || hangyodon.game_over || isHangyodonSleepingNow()) {
    return;
  }

  blinkLoopActive = true;
  const randomTime = Math.random() * 4000 + 2000;
  blinkTimeoutId = setTimeout(() => {
    if (!hangyoImg || !hangyodon || hangyodon.game_over || isHangyodonSleepingNow()) {
      return;
    }

    hangyoImg.src = 'hangyo_close.png';
    blinkSwitchTimeoutId = setTimeout(() => {
      if (!hangyoImg || !hangyodon || hangyodon.game_over || isHangyodonSleepingNow()) {
        return;
      }

      hangyoImg.src = 'hangyo_open.png';
      blinkTimeoutId = null;
      blinkSwitchTimeoutId = null;
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

registerGameActionHandlers();

hangyodon = getDefaultHangyodonState();
loadGame();
randomBlink();

const startGameBtn = document.getElementById('start-game-btn');
if (startGameBtn) {
  startGameBtn.addEventListener('click', startNewGame);
}

updateUI();
registerPushNotificationHandlers();
if (isPushSupported()) {
  registerServiceWorker();
}

const adminBtn = document.getElementById('admin-btn');
if (adminBtn) {
  adminBtn.disabled = false;
  adminBtn.textContent = '管理者';
}

const adminSleepToggleBtn = document.getElementById('admin-sleep-toggle-btn');
if (adminSleepToggleBtn) {
  adminSleepToggleBtn.textContent = isSleepModeEnabled(hangyodon) ? '睡眠モード：ON' : '睡眠モード：OFF';
}

setInterval(showComment, 10000);