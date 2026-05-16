const TIME_CONFIG = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_LABELS = {
  pomodoro: '准备开始',
  shortBreak: '休息一下',
  longBreak: '好好休息',
};

const CIRCUMFERENCE = 2 * Math.PI * 88;

let currentMode = 'pomodoro';
let timeLeft = TIME_CONFIG.pomodoro;
let timerId = null;
let autoSwitchId = null;
let isRunning = false;

let todayCount = parseInt(localStorage.getItem('pomodoro_today') || '0');
let todayMinutes = parseInt(localStorage.getItem('pomodoro_minutes') || '0');
let totalCount = parseInt(localStorage.getItem('pomodoro_total') || '0');
let todayDate = localStorage.getItem('pomodoro_date') || '';

const now = new Date();
const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
if (todayDate !== dateStr) {
  todayCount = 0;
  todayMinutes = 0;
  todayDate = dateStr;
  saveStats();
}

const timeDisplay = document.getElementById('timeDisplay');
const statusLabel = document.getElementById('statusLabel');
const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');
const taskInput = document.getElementById('taskName');
const ringProgress = document.querySelector('.ring-progress');
const todayCountEl = document.getElementById('todayCount');
const todayMinutesEl = document.getElementById('todayMinutes');
const totalCountEl = document.getElementById('totalCount');
const modeButtons = document.querySelectorAll('.mode-btn');
const appEl = document.querySelector('.app');

function saveStats() {
  localStorage.setItem('pomodoro_today', todayCount);
  localStorage.setItem('pomodoro_minutes', todayMinutes);
  localStorage.setItem('pomodoro_total', totalCount);
  localStorage.setItem('pomodoro_date', todayDate);
}

function updateStats() {
  todayCountEl.textContent = todayCount;
  todayMinutesEl.textContent = todayMinutes;
  totalCountEl.textContent = totalCount;
}

function updateTimeDisplay() {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const total = TIME_CONFIG[currentMode];
  timeDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (timeLeft / total);
}

function updateStartButton() {
  if (isRunning) {
    btnStart.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" rx="1"/>
        <rect x="14" y="4" width="4" height="16" rx="1"/>
      </svg>
      <span>暂停</span>`;
  } else {
    const isFresh = timeLeft === TIME_CONFIG[currentMode];
    btnStart.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="6,3 20,12 6,21"/>
      </svg>
      <span>${isFresh ? '开始' : '继续'}</span>`;
  }
}

function switchMode(mode) {
  if (currentMode === mode) return;
  clearTimeout(autoSwitchId);
  autoSwitchId = null;
  if (isRunning) pause();

  currentMode = mode;
  timeLeft = TIME_CONFIG[mode];

  appEl.classList.remove('mode-shortBreak', 'mode-longBreak');
  if (mode === 'shortBreak') appEl.classList.add('mode-shortBreak');
  if (mode === 'longBreak') appEl.classList.add('mode-longBreak');

  modeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  statusLabel.textContent = MODE_LABELS[mode];
  updateTimeDisplay();
  updateStartButton();
}

function pause() {
  clearInterval(timerId);
  timerId = null;
  isRunning = false;
  updateStartButton();
  statusLabel.textContent = '已暂停';
}

let audioCtx = null;

function playNotification() {
  try {
    if (audioCtx) audioCtx.close();
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99];
    const endTime = audioCtx.currentTime + notes.length * 0.15 + 0.4;
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.15);
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.4);
    });
    setTimeout(() => {
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close();
        audioCtx = null;
      }
    }, (endTime - audioCtx.currentTime) * 1000 + 100);
  } catch (e) {
    // Ignore audio errors
  }
}

function finishSession() {
  pause();
  playNotification();

  if (currentMode === 'pomodoro') {
    todayCount++;
    todayMinutes += TIME_CONFIG.pomodoro / 60;
    totalCount++;
    saveStats();
    updateStats();

    statusLabel.textContent = '完成！休息一下吧 ☕';
    if (window.electronAPI) {
      window.electronAPI.sendNotification('番茄钟', '一个番茄完成了！休息一下吧。');
    }

    if (totalCount % 4 === 0) {
      autoSwitchId = setTimeout(() => switchMode('longBreak'), 2000);
    } else {
      autoSwitchId = setTimeout(() => switchMode('shortBreak'), 2000);
    }
  } else {
    statusLabel.textContent = '休息结束，继续加油！';
    autoSwitchId = setTimeout(() => switchMode('pomodoro'), 2000);
  }
}

function tick() {
  if (timeLeft <= 0) {
    finishSession();
    return;
  }
  timeLeft--;
  updateTimeDisplay();
}

function start() {
  clearTimeout(autoSwitchId);
  autoSwitchId = null;
  if (isRunning) {
    pause();
    return;
  }
  isRunning = true;
  statusLabel.textContent =
    currentMode === 'pomodoro' ? '专注中...' : '休息中...';
  updateStartButton();
  timerId = setInterval(tick, 1000);
}

function reset() {
  pause();
  timeLeft = TIME_CONFIG[currentMode];
  statusLabel.textContent = MODE_LABELS[currentMode];
  updateTimeDisplay();
  updateStartButton();
}

// Event Listeners
btnStart.addEventListener('click', start);
btnReset.addEventListener('click', reset);

modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    taskInput.blur();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      start();
      break;
    case 'KeyR':
      reset();
      break;
    case 'Digit1':
      switchMode('pomodoro');
      break;
    case 'Digit2':
      switchMode('shortBreak');
      break;
    case 'Digit3':
      switchMode('longBreak');
      break;
  }
});

// Init
ringProgress.style.strokeDasharray = CIRCUMFERENCE;
ringProgress.style.strokeDashoffset = 0;
updateTimeDisplay();
updateStats();
updateStartButton();
