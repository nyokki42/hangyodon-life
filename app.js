// ハンギョドン育成ゲーム
// GitHub Pages + Supabase 向けの静的構成

const SUPABASE_URL = 'https://otyfyfucfqbdboltelsw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jmt7PPVYn_L7MNDBJ69otg_s6u_ulGy';

const supabaseClient = (window.supabase && SUPABASE_PUBLISHABLE_KEY && SUPABASE_PUBLISHABLE_KEY !== 'SUPABASE_PUBLISHABLE_KEY_HERE')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const hangyoImg = document.getElementById('hangyo');
const feedBtn = document.getElementById('feed-btn');
const hungerBar = document.getElementById('hunger-bar');
const statusMessage = document.getElementById('status-message');

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
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value)
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
    sleepStartHour: getRandomHour(22, 26),
    wakeUpHour: getRandomHour(6, 10),
    meetingDate: new Date().toISOString(),
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
    meetingDate: state?.meetingDate || defaults.meetingDate,
    sleepStartHour: safeNumber(state?.sleepStartHour, defaults.sleepStartHour),
    wakeUpHour: safeNumber(state?.wakeUpHour, defaults.wakeUpHour),
    lastBathDate: state?.lastBathDate || null,
    lastHungerNotificationDate: state?.lastHungerNotificationDate || null,
    lastJobTime: safeNumber(state?.lastJobTime, 0)
  };
}

let hangyodon = getDefaultHangyodonState();

const shopItems = {
  onigiri: { price: 100, hunger: 10, label: 'おにぎり' },
  pan: { price: 100, hunger: 10, label: 'パン' }
};

const positiveRewards = [
  () => {
    const inc = Math.floor(Math.random() * 11) + 5;
    hangyodon.mood = Math.min(100, hangyodon.mood + inc);
    return `気分が${inc}上がった！`;
  },
  () => {
    const found = (Math.floor(Math.random() * 5) + 1) * 50;
    hangyodon.money += found;
    return `${found}円拾った！`;
  },
  () => {
    const items = Object.keys(shopItems);
    const item = items[Math.floor(Math.random() * items.length)];
    hangyodon.inventory[item] = (hangyodon.inventory[item] || 0) + 1;
    return `${shopItems[item].label}を見つけた！`;
  },
  () => {
    const baseExp = 10;
    const exp = hangyodon.level * baseExp;
    gainExp(exp);
    return `${exp}の経験を得た！`;
  }
];

const negativeRewards = [
  () => {
    const dec = Math.floor(Math.random() * 11) + 5;
    hangyodon.mood = Math.max(-100, hangyodon.mood - dec);
    return `気分が${dec}下がった…`;
  },
  () => {
    const lost = Math.min(hangyodon.money, (Math.floor(Math.random() * 5) + 1) * 50);
    hangyodon.money -= lost;
    return `${lost}円落とした…`;
  },
  () => {
    const items = Object.keys(hangyodon.inventory).filter(i => hangyodon.inventory[i] > 0);
    if (items.length === 0) return '何も落とさなかった…';
    const item = items[Math.floor(Math.random() * items.length)];
    hangyodon.inventory[item]--;
    return `${shopItems[item].label}を落とした…`;
  }
];

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
  const next = { ...state };
  if (elapsedMinutes <= 0) return next;

  const now = Date.now();
  for (let minute = 0; minute < elapsedMinutes; minute += 1) {
    const minuteDate = new Date(now - ((elapsedMinutes - minute) * 60 * 1000));
    const hour = minuteDate.getHours();
    const sleeping = getSleepingStateForHour(hour, next.sleepStartHour, next.wakeUpHour);
    if (!sleeping) {
      next.hunger = Math.max(0, next.hunger - 1);
      next.mood = Math.max(-100, next.mood - 1);
    }
  }

  if (next.hunger <= 0) {
    next.mood = Math.min(next.mood, 0);
  }

  return next;
}

async function ensureSupabaseRow() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient.from('hangyodon').select('*').eq('id', 1).maybeSingle();
  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    const row = {
      id: 1,
      hunger: 100,
      mood: 100,
      level: 1,
      exp: 0,
      money: 100,
      last_updated: new Date().toISOString()
    };

    const { error: insertError } = await supabaseClient.from('hangyodon').insert([row]);
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
    const baseState = {
      ...cached,
      hunger: safeNumber(data.hunger, cached.hunger),
      mood: safeNumber(data.mood, cached.mood),
      level: safeNumber(data.level, cached.level),
      exp: safeNumber(data.exp, cached.exp),
      money: safeNumber(data.money, cached.money),
      meetingDate: cached.meetingDate || new Date().toISOString(),
      lastBathDate: cached.lastBathDate || null,
      lastHungerNotificationDate: cached.lastHungerNotificationDate || null,
      lastJobTime: cached.lastJobTime || 0
    };

    const lastUpdatedMs = data.last_updated ? new Date(data.last_updated).getTime() : Date.now();
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - lastUpdatedMs) / 60000));
    const merged = applyElapsedMinutesToState(progressStateToRuntime(baseState), elapsedMinutes);

    hangyodon = progressStateToRuntime({
      ...merged,
      inventory: normalizeInventory(cached.inventory || {})
    });

    if (hangyodon.mood <= -100) {
      resetGame();
      return;
    }

    saveLocalGameCache();
    updateUI();
    setStatusMessage('共有データと同期しました。', 'success');
  } catch (error) {
    console.error('Supabase sync error:', error);
    setStatusMessage('Supabaseに接続できませんでした。ローカル保存を表示します。', 'error');

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
      last_updated: new Date().toISOString()
    };

    const { error } = await supabaseClient.from('hangyodon').upsert(payload, { onConflict: 'id' });
    if (error) throw error;

    saveLocalGameCache();
    return true;
  } catch (error) {
    console.error('Supabase save error:', error);
    saveLocalGameCache();
    setStatusMessage('共有データの保存に失敗しました。ローカルに一時保存されています。', 'error');
    return false;
  }
}

function saveGame() {
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

function loadGame() {
  const cached = readLocalGameCache();
  if (cached) {
    hangyodon = cached;
  }

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

function updateUI() {
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
  if (feedBtn) feedBtn.disabled = hangyodon.hunger >= 100 || !hasFood;

  const walkBtn = document.getElementById('walk-btn');
  if (walkBtn) walkBtn.disabled = hangyodon.hunger <= 0;

  const bathBtn = document.getElementById('bath-btn');
  if (bathBtn) {
    const today = new Date().toDateString();
    const lastBath = hangyodon.lastBathDate ? new Date(hangyodon.lastBathDate).toDateString() : null;
    bathBtn.disabled = lastBath === today;
  }

  const jobBtn = document.getElementById('job-btn');
  if (jobBtn) {
    const now = Date.now();
    const cooldownMs = 10 * 60 * 1000;
    if (jobGameData.lastJobTime && (now - jobGameData.lastJobTime) < cooldownMs) {
      jobBtn.disabled = true;
    } else {
      jobBtn.disabled = false;
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
    btn.disabled = hangyodon.money < (shopItems[it]?.price || Infinity);
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

function walk() {
  if (hangyodon.hunger <= 0) return;
  hangyodon.hunger = Math.max(0, hangyodon.hunger - 10);

  let rewardFunc;
  if (Math.random() < 0.1) {
    const availableNegative = [negativeRewards[0], negativeRewards[2]];
    if (hangyodon.money > 0) {
      availableNegative.push(negativeRewards[1]);
    }
    rewardFunc = availableNegative[Math.floor(Math.random() * availableNegative.length)];
  } else {
    rewardFunc = positiveRewards[Math.floor(Math.random() * positiveRewards.length)];
  }

  const message = rewardFunc();
  showWalkPopup(message);
  saveGame();
  updateUI();
}

function showWalkPopup(message) {
  const popup = document.getElementById('walk-popup');
  const messageEl = document.getElementById('walk-popup-message');
  const okBtn = document.getElementById('walk-popup-ok');

  if (!popup || !messageEl) return;

  messageEl.textContent = message;
  popup.style.display = 'flex';

  okBtn.onclick = () => {
    popup.style.display = 'none';
  };
}

function goBath() {
  const today = new Date().toDateString();
  const lastBath = hangyodon.lastBathDate ? new Date(hangyodon.lastBathDate).toDateString() : null;
  if (lastBath === today) {
    showBathPopup('今日はもうお風呂に入った!');
    return;
  }

  hangyodon.mood = Math.min(100, hangyodon.mood + 30);
  hangyodon.lastBathDate = new Date().toISOString();
  showBathPopup('気分が30上がった!うれしい!');
  saveGame();
  updateUI();
}

function showBathPopup(message) {
  const popup = document.getElementById('bath-popup');
  const messageEl = document.getElementById('bath-popup-message');
  const okBtn = document.getElementById('bath-popup-ok');

  if (!popup || !messageEl) return;

  messageEl.textContent = message;
  popup.style.display = 'flex';

  okBtn.onclick = () => {
    popup.style.display = 'none';
  };
}

let jobGameData = {
  isActive: false,
  earnedMoney: 0,
  timeLeft: 10,
  timerInterval: null,
  lastJobTime: 0
};

function startPartTimeJob() {
  if (jobGameData.isActive) return;

  const modal = document.getElementById('job-minigame');
  if (modal) modal.style.display = 'flex';

  const finishBtn = document.getElementById('job-finish-btn');
  if (finishBtn) finishBtn.style.display = 'none';

  jobGameData.isActive = true;
  jobGameData.earnedMoney = 0;
  jobGameData.timeLeft = 10;
  jobGameData.lastJobTime = Date.now();

  const statusEl = document.getElementById('job-status');
  if (statusEl) statusEl.textContent = '仕事中！ボタンを連打してお金を稼ぐ！';

  const moneyEl = document.getElementById('job-money');
  if (moneyEl) moneyEl.textContent = '0';

  const timerEl = document.getElementById('job-timer');
  if (timerEl) timerEl.textContent = '10';

  const workBtn = document.getElementById('job-work-btn');
  if (workBtn) {
    workBtn.disabled = false;
    workBtn.onclick = () => {
      if (jobGameData.isActive) {
        jobGameData.earnedMoney += 1;
        hangyodon.money += 1;
        const moneyEl2 = document.getElementById('job-money');
        if (moneyEl2) moneyEl2.textContent = jobGameData.earnedMoney;
      }
    };
  }

  jobGameData.timerInterval = setInterval(() => {
    jobGameData.timeLeft -= 1;
    const timerEl2 = document.getElementById('job-timer');
    if (timerEl2) timerEl2.textContent = jobGameData.timeLeft;
    if (jobGameData.timeLeft <= 0) {
      endPartTimeJob();
    }
  }, 1000);
}

function endPartTimeJob() {
  if (!jobGameData.isActive) return;
  jobGameData.isActive = false;
  clearInterval(jobGameData.timerInterval);

  const earnedAmount = jobGameData.earnedMoney;
  const statusEl = document.getElementById('job-status');
  if (statusEl) statusEl.textContent = `バイト終了！右上の「バイト終了」ボタンを押して戻ってね（${earnedAmount}円）`;

  const workBtn = document.getElementById('job-work-btn');
  if (workBtn) workBtn.disabled = true;

  const finishBtn = document.getElementById('job-finish-btn');
  if (finishBtn) {
    finishBtn.style.display = 'block';
  } else {
    showTemporaryComment(`${earnedAmount}円稽ぎました！`);
  }

  saveGame();
  updateUI();
}

function closePartTimeJob() {
  const finishBtn = document.getElementById('job-finish-btn');
  if (finishBtn) finishBtn.style.display = 'none';
  const jobModal = document.getElementById('job-minigame');
  if (jobModal) jobModal.style.display = 'none';

  showTemporaryComment(`${jobGameData.earnedMoney}円稽ぎました！`);
  jobGameData.earnedMoney = 0;
  jobGameData.timeLeft = 10;
  localStorage.setItem('jobLastTime', String(jobGameData.lastJobTime));
  saveGame();
  updateUI();
}

function showTemporaryComment(text) {
  const bubble = document.getElementById('comment-bubble');
  if (!bubble) return;
  bubble.textContent = text;
  bubble.style.display = 'block';
  setTimeout(() => {
    bubble.style.display = 'none';
  }, 5000);
}

function giveFood(itemName) {
  if (hangyodon.hunger >= 100) return;
  if (!hangyodon.inventory[itemName] || hangyodon.inventory[itemName] <= 0) return;

  hangyodon.inventory[itemName]--;
  hangyodon.hunger += shopItems[itemName].hunger;
  if (hangyodon.hunger > 100) hangyodon.hunger = 100;
  hangyodon.mood += 10;
  if (hangyodon.mood > 100) hangyodon.mood = 100;
  gainExp(10);

  saveGame();
  updateUI();
}

function showFeedMenu() {
  const optionsDiv = document.getElementById('feed-options');
  if (!optionsDiv) return;

  optionsDiv.innerHTML = '';
  for (const [item, qty] of Object.entries(hangyodon.inventory)) {
    if (qty > 0) {
      const btn = document.createElement('button');
      const label = shopItems[item]?.label || item;
      btn.textContent = `${label} x${qty}`;
      btn.addEventListener('click', () => {
        giveFood(item);
        hideFeedMenu();
      });
      optionsDiv.appendChild(btn);
    }
  }

  if (optionsDiv.children.length === 0) {
    optionsDiv.textContent = '食べ物がない…';
  }

  const feedMenu = document.getElementById('feed-menu');
  if (feedMenu) feedMenu.style.display = 'block';
}

function hideFeedMenu() {
  const feedMenu = document.getElementById('feed-menu');
  if (feedMenu) feedMenu.style.display = 'none';
}

function purchaseItem(item) {
  const info = shopItems[item];
  if (!info) return;
  if (hangyodon.money >= info.price) {
    hangyodon.money -= info.price;
    hangyodon.inventory[item] = (hangyodon.inventory[item] || 0) + 1;
    saveGame();
    updateUI();
  } else {
    alert('お金が足りない！');
  }
}

feedBtn.addEventListener('click', showFeedMenu);

const feedCancel = document.getElementById('feed-cancel');
if (feedCancel) {
  feedCancel.addEventListener('click', hideFeedMenu);
}

const walkBtn = document.getElementById('walk-btn');
if (walkBtn) {
  walkBtn.addEventListener('click', walk);
}

const bathBtn = document.getElementById('bath-btn');
if (bathBtn) {
  bathBtn.addEventListener('click', goBath);
}

const jobBtn = document.getElementById('job-btn');
if (jobBtn) {
  jobBtn.addEventListener('click', startPartTimeJob);
}

const jobFinishBtn = document.getElementById('job-finish-btn');
if (jobFinishBtn) {
  jobFinishBtn.addEventListener('click', () => {
    closePartTimeJob();
    jobFinishBtn.style.display = 'none';
  });
}

const shopButtons = document.querySelectorAll('#shop button');
shopButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.dataset.item;
    purchaseItem(item);
  });
});

const resetAllBtn = document.getElementById('reset-all-btn');
if (resetAllBtn) {
  resetAllBtn.addEventListener('click', () => {
    resetGame();
  });
}

setInterval(() => {
  const now = new Date();
  const hour = now.getHours();

  if (!hangyodon.sleeping && hour >= hangyodon.sleepStartHour) {
    hangyodon.sleeping = true;
    if (hangyoImg) hangyoImg.src = 'hangyo_sleep.png';
  }
  if (hangyodon.sleeping && hour >= hangyodon.wakeUpHour) {
    hangyodon.sleeping = false;
    if (hangyoImg) hangyoImg.src = 'hangyo_open.png';
    hangyodon.sleepStartHour = getRandomHour(22, 26);
    hangyodon.wakeUpHour = getRandomHour(6, 10);
  }

  if (!hangyodon.sleeping) {
    hangyodon.hunger = Math.max(0, hangyodon.hunger - 1);
    hangyodon.mood = Math.max(-100, hangyodon.mood - 1);

    if (hangyodon.hunger <= 20) {
      const today = new Date().toDateString();
      const lastNotified = hangyodon.lastHungerNotificationDate ? new Date(hangyodon.lastHungerNotificationDate).toDateString() : null;
      if (lastNotified !== today) {
        hangyodon.lastHungerNotificationDate = new Date().toISOString();
      }
    }
  }

  if (hangyodon.mood <= -100) {
    resetGame();
    return;
  }

  saveGame();
  updateUI();
}, 60000);

function requiredExp(level) {
  return level * level * 10;
}

function gainExp(amount) {
  hangyodon.exp += amount;
  while (hangyodon.exp >= requiredExp(hangyodon.level)) {
    hangyodon.exp -= requiredExp(hangyodon.level);
    hangyodon.level += 1;
    hangyodon.money += 100;
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

setInterval(showComment, 10000);

if (supabaseClient) {
  setStatusMessage('Supabase接続を準備しています…', 'info');
} else {
  setStatusMessage('SupabaseのPublishable keyを設定してください。', 'error');
}

loadGame();
updateUI();
randomBlink();

if (supabaseClient) {
  supabaseClient.channel('hangyodon_shared').on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'hangyodon',
    filter: 'id=eq.1'
  }, payload => {
    const row = payload.new || payload.old;
    if (!row) return;

    const localCache = readLocalGameCache() || getDefaultHangyodonState();
    const nextState = progressStateToRuntime({
      ...localCache,
      hunger: safeNumber(row.hunger, localCache.hunger),
      mood: safeNumber(row.mood, localCache.mood),
      level: safeNumber(row.level, localCache.level),
      exp: safeNumber(row.exp, localCache.exp),
      money: safeNumber(row.money, localCache.money)
    });

    hangyodon = nextState;
    saveLocalGameCache();
    updateUI();
    setStatusMessage('他の端末の更新を反映しました。', 'success');
  }).subscribe();
}





