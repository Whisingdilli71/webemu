const launchBtn       = document.getElementById('launchBtn');
const closeBtn        = document.getElementById('closeBtn');
const romFileInput    = document.getElementById('romFile');
const romUrlInput     = document.getElementById('romUrl');
const dropZone        = document.getElementById('dropZone');
const fileNameEl      = document.getElementById('fileName');
const statusEl        = document.getElementById('status-msg');
const progressBar     = document.getElementById('progressBar');
const gameTitleEl     = document.getElementById('gameTitle');
const gameTopbar      = document.getElementById('game-topbar');
const controlsOverlay = document.getElementById('controls-overlay');
const darkToggle      = document.getElementById('darkToggle');
const volSlider       = document.getElementById('volSlider');
const volLabel        = document.getElementById('volLabel');
const saveStateBtn    = document.getElementById('saveStateBtn');
const loadStateBtn    = document.getElementById('loadStateBtn');
const stateFileInput  = document.getElementById('stateFileInput');
const coverWrap       = document.getElementById('coverWrap');
const coverImg        = document.getElementById('coverImg');
const coverTitle      = document.getElementById('coverTitle');
const kbdGrid         = document.getElementById('kbdGrid');
const launchName = sessionStorage.getItem('webemu-launch-name');

let instance  = null;
let idleTimer = null;

const mainNav = document.querySelector('nav');
const fsBtn   = document.getElementById('fsBtn');

if (launchName) {
  sessionStorage.removeItem('webemu-launch-name');

  const openLaunchIDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open('webemu-roms', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('roms');
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });

const COVER_REPOS = {
  sfc: 'Nintendo_-_Super_Nintendo_Entertainment_System',
  smc: 'Nintendo_-_Super_Nintendo_Entertainment_System',
  snes: 'Nintendo_-_Super_Nintendo_Entertainment_System',
};

  (async () => {
    const idb   = await openLaunchIDB();
    const tx    = idb.transaction('roms', 'readwrite');
    const store = tx.objectStore('roms');
    const req   = store.get('pending-launch');
    req.onsuccess = () => {
      const file = req.result;
      store.delete('pending-launch');
      if (file) {
        const url = URL.createObjectURL(file);
        launchROM(url, launchName);
      }
    };
  })();
}

function extOf(name) {
  const m = name.match(/\.(\w+)$/);
  return m ? m[1].toLowerCase() : 'nes';
}

function coverUrl(repo, gameName) {
  const encoded = encodeURIComponent(gameName);
  return `https://cdn.jsdelivr.net/gh/libretro-thumbnails/${repo}@master/Named_Boxarts/${encoded}.png`;
}

async function fetchCoverArt(rawName, ext) {
  const repo = COVER_REPOS[ext] || COVER_REPOS.nes;
  const candidates = [
    rawName,
    rawName.replace(/\s*\(.*?\)/g, '').trim(),
  ];

  for (const name of candidates) {
    const url = coverUrl(repo, name);
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return { url, name };
    } catch (_) {}
  }
  return null;
}

function showCover(url, name) {
  coverImg.src = url;
  coverTitle.textContent = name;
  coverWrap.classList.add('visible');
  kbdGrid.style.display = 'none';
}

function hideCover() {
  coverWrap.classList.remove('visible');
  coverImg.src = '';
  kbdGrid.style.display = '';
}

async function tryLoadCover(filename) {
  const ext     = extOf(filename);
  const rawName = filename.replace(/\.\w+$/, '');
  const result  = await fetchCoverArt(rawName, ext);
  if (result) {
    showCover(result.url, result.name);
  } else {
    hideCover();
  }
}


function setStatus(msg) { statusEl.textContent = msg; }
function setLoading(on) {
  launchBtn.disabled = on;
  progressBar.classList.toggle('visible', on);
  launchBtn.textContent = on ? 'Loading…' : 'Launch';
}

volSlider.addEventListener('input', () => {
  const v = volSlider.value;
  volLabel.textContent = v + '%';
  if (window._masterGain) window._masterGain.gain.value = v / 100;
});
function applyVolume() {
  if (window._masterGain) window._masterGain.gain.value = volSlider.value / 100;
}

romFileInput.addEventListener('change', () => {
  const f = romFileInput.files[0];
  fileNameEl.textContent = f ? f.name : '';
  setStatus('');
  if (f) tryLoadCover(f.name);
  else hideCover();
});

romUrlInput.addEventListener('change', () => {
  const url = romUrlInput.value.trim();
  if (url) {
    const filename = url.split('/').pop();
    tryLoadCover(filename);
  } else {
    hideCover();
  }
});

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) {
    const dt = new DataTransfer(); dt.items.add(f);
    romFileInput.files = dt.files;
    fileNameEl.textContent = f.name;
    setStatus('');
    tryLoadCover(f.name);
  }
});

const TRIGGER_ZONE = 120;
document.addEventListener('mousemove', e => {
  if (!instance) return;
  const fromBottom = window.innerHeight - e.clientY;
  if (fromBottom <= TRIGGER_ZONE) {
    controlsOverlay.classList.remove('hidden');
  } else {
    controlsOverlay.classList.add('hidden');
  }
});
controlsOverlay.addEventListener('mouseenter', () => controlsOverlay.classList.remove('hidden'));

fsBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'F11' && instance) {
    e.preventDefault();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }
});

saveStateBtn.addEventListener('click', async () => {
  if (!instance) return;
  try {
    const { state } = await instance.saveState();
    const url = URL.createObjectURL(state);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = (gameTitleEl.textContent || 'game') + '.state';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('[saveState]', e);
  }
});

stateFileInput.addEventListener('change', async () => {
  const f = stateFileInput.files[0];
  if (!f || !instance) return;
  try {
    await instance.loadState(f);
  } catch (e) {
    console.error('[loadState]', e);
  }
  stateFileInput.value = '';
});

async function closeGame() {
  if (instance) {
    try { await instance.exit(); } catch(e) {}
    instance = null;
  }
  gameTopbar.classList.remove('active');
  controlsOverlay.classList.remove('active');
  controlsOverlay.classList.remove('hidden');
  mainNav.classList.remove('hidden');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  setLoading(false);
  setStatus('');
}
closeBtn.addEventListener('click', closeGame);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && instance) closeGame();
});

async function launchROM(rom, name) {
  setLoading(true);
  setStatus('');
  try {
    instance = await Nostalgist.launch({
      core: 'snes9x',
      rom,
      retroarchConfig: {
        rewind_enable:           true,
        rewind_granularity:      2,
        input_hold_fast_forward: 'space',
        input_rewind:            'r',
      },
    });
    applyVolume();
    setLoading(false);
    gameTitleEl.textContent = name || 'fceumm';
    mainNav.classList.add('hidden');
    gameTopbar.classList.add('active');
    controlsOverlay.classList.add('active');
    controlsOverlay.classList.add('hidden');
  } catch (err) {
    console.error('[fceumm]', err);
    setStatus('Launch failed: ' + (err?.message || String(err)));
    setLoading(false);
  }
}

launchBtn.addEventListener('click', async () => {
  const file = romFileInput.files[0];
  const url  = romUrlInput.value.trim();
  if (file) {
    await launchROM(file, file.name.replace(/\.\w+$/, ''));
  } else if (url) {
    await launchROM(url, url.split('/').pop().replace(/\.\w+$/, '') || 'Game');
  } else {
    setStatus('Select a ROM file or enter a URL.');
  }
});

romUrlInput.value = 'https://raw.githubusercontent.com/retrobrews/snes-games/master/furryrpg.sfc';
tryLoadCover('furryrpg.sfc')