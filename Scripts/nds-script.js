const launchBtn    = document.getElementById('launchBtn');
const closeBtn     = document.getElementById('closeBtn');
const romFileInput = document.getElementById('romFile');
const romUrlInput  = document.getElementById('romUrl');
const dropZone     = document.getElementById('dropZone');
const fileNameEl   = document.getElementById('fileName');
const statusEl     = document.getElementById('status-msg');
const progressBar  = document.getElementById('progressBar');
const gameTitleEl  = document.getElementById('gameTitle');
const gameTopbar   = document.getElementById('game-topbar');
const gameScreen   = document.getElementById('game-screen');
const launcherWrap = document.getElementById('launcherWrap');
const mainNav      = document.getElementById('mainNav');
const coverWrap    = document.getElementById('coverWrap');
const coverImg     = document.getElementById('coverImg');
const coverTitle   = document.getElementById('coverTitle');
const kbdGrid      = document.getElementById('kbdGrid');
const launchName = sessionStorage.getItem('webemu-launch-name');

let ejsLoaded = false;

const COVER_REPO = 'Nintendo_-_Nintendo_DS';

function coverUrl(gameName) {
  return `https://cdn.jsdelivr.net/gh/libretro-thumbnails/${COVER_REPO}@master/Named_Boxarts/${encodeURIComponent(gameName)}.png`;
}

if (launchName) {
  sessionStorage.removeItem('webemu-launch-name');

  const openLaunchIDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open('webemu-roms', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('roms');
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });

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

async function fetchCoverArt(rawName) {
  const candidates = [
    rawName,
    rawName.replace(/\s*\(.*?\)/g, '').trim(),
  ];
  for (const name of candidates) {
    try {
      const res = await fetch(coverUrl(name), { method: 'HEAD' });
      if (res.ok) return { url: coverUrl(name), name };
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
  const rawName = filename.replace(/\.\w+$/, '');
  const result  = await fetchCoverArt(rawName);
  if (result) showCover(result.url, result.name);
  else hideCover();
}

romFileInput.addEventListener('change', () => {
  const f = romFileInput.files[0];
  fileNameEl.textContent = f ? f.name : '';
  statusEl.textContent = '';
  if (f) tryLoadCover(f.name);
  else hideCover();
});

romUrlInput.addEventListener('change', () => {
  const url = romUrlInput.value.trim();
  if (url) tryLoadCover(url.split('/').pop());
  else hideCover();
});

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) {
    const dt = new DataTransfer();
    dt.items.add(f);
    romFileInput.files = dt.files;
    fileNameEl.textContent = f.name;
    statusEl.textContent = '';
    tryLoadCover(f.name);
  }
});

function setLoading(on) {
  launchBtn.disabled = on;
  progressBar.classList.toggle('visible', on);
  launchBtn.textContent = on ? 'Loading…' : 'Launch';
}

function launchROM(romUrl, name) {
  setLoading(true);
  statusEl.textContent = '';

  window.EJS_player        = '#game';
  window.EJS_core          = 'nds';
  window.EJS_gameUrl       = romUrl;
  window.EJS_pathtodata    = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_startOnLoaded = true;

  launcherWrap.style.display = 'none';
  mainNav.classList.add('hidden');
  gameScreen.classList.add('active');
  gameTitleEl.textContent = name || 'Nintendo DS';
  gameTopbar.classList.add('active');

  const script   = document.createElement('script');
  script.src     = 'https://cdn.emulatorjs.org/stable/data/loader.js';
  script.onerror = () => {
    statusEl.textContent = 'Failed to load EmulatorJS.';
    closeGame();
  };
  document.body.appendChild(script);
  ejsLoaded = true;
}

launchBtn.addEventListener('click', () => {
  const file = romFileInput.files[0];
  const url  = romUrlInput.value.trim();

  if (file) {
    const blobUrl = URL.createObjectURL(file);
    launchROM(blobUrl, file.name.replace(/\.\w+$/, ''));
  } else if (url) {
    launchROM(url, url.split('/').pop().replace(/\.\w+$/, '') || 'Game');
  } else {
    statusEl.textContent = 'Select a ROM file or enter a URL.';
  }
});

function closeGame() {
  window.location.reload();
}

closeBtn.addEventListener('click', closeGame);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ejsLoaded) closeGame();
});