import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzyg-fVXE2rM6e8QZrNJ88CxQIlUGNXF4",
  authDomain: "webemu.firebaseapp.com",
  projectId: "webemu",
  storageBucket: "webemu.firebasestorage.app",
  messagingSenderId: "360587947742",
  appId: "1:360587947742:web:a23644967b83b15596dc4f"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const SYSTEM_LABELS = {
  nes: 'NES / Famicom', snes: 'Super NES', gameboy: 'Game Boy / GBC / GBA',
  gamewatch: 'Game & Watch', genesis: 'Genesis', gamegear: 'Game Gear',
  playstation: 'PlayStation', psp: 'PSP', n64: 'Nintendo 64', nds: 'Nintendo DS',
};

const SYSTEM_PAGES = {
  nes: 'nes.html', snes: 'snes.html', gameboy: 'gameboy.html',
  gamewatch: 'gamewatch.html', genesis: 'genesis.html', gamegear: 'gamegear.html',
  playstation: 'playstation.html', psp: 'psp.html', n64: 'n64.html', nds: 'nds.html',
};

const COVER_REPOS = {
  nes: 'Nintendo_-_Nintendo_Entertainment_System',
  snes: 'Nintendo_-_Super_Nintendo_Entertainment_System',
  gameboy: 'Nintendo_-_Game_Boy',
  gamewatch: 'Nintendo_-_Game_and_Watch',
  genesis: 'Sega_-_Mega_Drive_-_Genesis',
  gamegear: 'Sega_-_Game_Gear',
  playstation: 'Sony_-_PlayStation',
  psp: 'Sony_-_PlayStation_Portable',
  n64: 'Nintendo_-_Nintendo_64',
  nds: 'Nintendo_-_Nintendo_DS',
};

const EXT_TO_SYSTEM = {
  nes: 'nes', fds: 'nes', sfc: 'snes', smc: 'snes',
  gb: 'gameboy', gbc: 'gameboy', gba: 'gameboy', mgw: 'gamewatch',
  md: 'genesis', gen: 'genesis', smd: 'genesis',
  gg: 'gamegear', sms: 'gamegear',
  cue: 'playstation', cso: 'psp',
  n64: 'n64', z64: 'n64', v64: 'n64',
  nds: 'nds', srl: 'nds',
  bin: null, iso: null, img: null, pbp: null, rom: null,
};

const ROM_EXTENSIONS = new Set(Object.keys(EXT_TO_SYSTEM));

function detectSystem(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return EXT_TO_SYSTEM[ext] ?? null;
}

function isRomFile(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return ROM_EXTENSIONS.has(ext);
}

const IDB_NAME = 'webemu-roms', IDB_VERSION = 1, IDB_STORE = 'roms';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

const idb = await openIDB();

async function saveRom(id, file) {
  const tx = idb.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).put(file, id);
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
}

async function getRom(id) {
  const tx  = idb.transaction(IDB_STORE, 'readonly');
  const req = tx.objectStore(IDB_STORE).get(id);
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result || null); req.onerror = rej; });
}

async function deleteRom(id) {
  const tx = idb.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).delete(id);
}

function getDeviceId() {
  let id = localStorage.getItem('webemu-device-id');
  if (!id) { id = 'device-' + Math.random().toString(36).slice(2); localStorage.setItem('webemu-device-id', id); }
  return id;
}

function buildCoverUrl(repo, name) {
  return `https://cdn.jsdelivr.net/gh/libretro-thumbnails/${repo}@master/Named_Boxarts/${encodeURIComponent(name)}.png`;
}

async function fetchCover(name, system) {
  const repo = COVER_REPOS[system];
  if (!repo) return null;
  for (const n of [name, name.replace(/\s*\(.*?\)/g, '').trim()]) {
    const url = buildCoverUrl(repo, n);
    try { const res = await fetch(url, { method: 'HEAD' }); if (res.ok) return url; } catch (_) {}
  }
  return null;
}

async function scanCoverCandidates(name, system) {
  const repo = COVER_REPOS[system];
  if (!repo) return [];
  const candidates = [
    { label: name, query: name },
    { label: name.replace(/\s*\(.*?\)/g, '').trim(), query: name.replace(/\s*\(.*?\)/g, '').trim() },
    { label: name + ' (USA)', query: name + ' (USA)' },
    { label: name + ' (Europe)', query: name + ' (Europe)' },
    { label: name + ' (Japan)', query: name + ' (Japan)' },
    { label: name + ' (World)', query: name + ' (World)' },
  ].filter((c, i, arr) => c.query && arr.findIndex(x => x.query === c.query) === i);

  const results = [];
  for (const c of candidates) {
    const url = buildCoverUrl(repo, c.query);
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) results.push({ url, label: c.label });
    } catch (_) {}
  }
  return results;
}

function compressImage(file, maxSize = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else        { w = Math.round(w * maxSize / h); h = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressAvatar(file) { return compressImage(file, 200); }

const signinScreen      = document.getElementById('signinScreen');
const collectionScreen  = document.getElementById('collectionScreen');
const signInBtn         = document.getElementById('signInBtn');
const signOutBtn        = document.getElementById('signOutBtn');
const userAvatar        = document.getElementById('userAvatar');
const avatarUploadInput = document.getElementById('avatarUploadInput');
const userName          = document.getElementById('userName');
const collectionTitle   = document.getElementById('collectionTitle');
const collectionContent = document.getElementById('collectionContent');
const deviceBanner      = document.getElementById('deviceBanner');
const addGameBtn        = document.getElementById('addGameBtn');
const modalOverlay      = document.getElementById('modalOverlay');
const modalClose        = document.getElementById('modalClose');
const modalCancelBtn    = document.getElementById('modalCancelBtn');
const modalSaveBtn      = document.getElementById('modalSaveBtn');
const modalGameName     = document.getElementById('modalGameName');
const modalSystem       = document.getElementById('modalSystem');
const modalRomFile      = document.getElementById('modalRomFile');
const modalFileName     = document.getElementById('modalFileName');
const modalFileDrop     = document.getElementById('modalFileDrop');
const modalStatus       = document.getElementById('modalStatus');
const emailInput        = document.getElementById('emailInput');
const passwordInput     = document.getElementById('passwordInput');
const emailAuthBtn      = document.getElementById('emailAuthBtn');
const signinToggle      = document.getElementById('signinToggle');
const signinError       = document.getElementById('signinError');
const signinHeading     = document.getElementById('signinHeading');
const searchInput       = document.getElementById('searchInput');
const folderInput       = document.getElementById('folderInput');
const importProgress    = document.getElementById('importProgress');
const folderModalOverlay = document.getElementById('folderModalOverlay');
const folderModalBody    = document.getElementById('folderModalBody');
const folderModalCount   = document.getElementById('folderModalCount');
const folderModalClose   = document.getElementById('folderModalClose');
const folderModalCancel  = document.getElementById('folderModalCancel');
const folderModalImport  = document.getElementById('folderModalImport');

const coverModalOverlay  = document.getElementById('coverModalOverlay');
const coverModalTitle    = document.getElementById('coverModalTitle');
const coverModalClose    = document.getElementById('coverModalClose');
const coverModalCancel   = document.getElementById('coverModalCancel');
const coverModalSave     = document.getElementById('coverModalSave');
const coverSearchInput   = document.getElementById('coverSearchInput');
const coverRescanBtn     = document.getElementById('coverRescanBtn');
const coverUploadInput   = document.getElementById('coverUploadInput');
const coverResultsWrap   = document.getElementById('coverResultsWrap');
const coverResultsGrid   = document.getElementById('coverResultsGrid');
const coverResultsLabel  = document.getElementById('coverResultsLabel');
const coverStatus        = document.getElementById('coverStatus');

let currentUser    = null;
let isRegistering  = false;
let allGames       = [];
let folderFiles    = [];

let coverEditGame      = null;
let coverSelectedUrl   = null;
let coverUploadedBase64 = null;

signinToggle.addEventListener('click', () => {
  isRegistering = !isRegistering;
  signinHeading.textContent  = isRegistering ? 'Create account' : 'Sign in';
  emailAuthBtn.textContent   = isRegistering ? 'Register' : 'Sign in';
  signinToggle.textContent   = isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register";
  signinError.textContent    = '';
});

emailAuthBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim(), password = passwordInput.value;
  signinError.textContent = '';
  if (!email || !password) { signinError.textContent = 'Enter your email and password.'; return; }
  emailAuthBtn.disabled = true; emailAuthBtn.textContent = 'Please wait...';
  try {
    if (isRegistering) await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    const m = { 'auth/invalid-email': 'Invalid email address.', 'auth/user-not-found': 'No account found with this email.', 'auth/wrong-password': 'Incorrect password.', 'auth/email-already-in-use': 'An account with this email already exists.', 'auth/weak-password': 'Password must be at least 6 characters.', 'auth/too-many-requests': 'Too many attempts. Try again later.' };
    signinError.textContent = m[e.code] || 'Something went wrong. Try again.';
  } finally {
    emailAuthBtn.disabled = false;
    emailAuthBtn.textContent = isRegistering ? 'Register' : 'Sign in';
  }
});

signInBtn.addEventListener('click', async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { console.error(e); }
});

signOutBtn.addEventListener('click', () => signOut(auth));

userAvatar.addEventListener('click', () => avatarUploadInput.click());
avatarUploadInput.addEventListener('change', async () => {
  const f = avatarUploadInput.files[0];
  if (!f || !currentUser) return;
  try {
    const base64 = await compressAvatar(f);
    userAvatar.src = base64;
    await setDoc(doc(db, 'users', currentUser.uid), { photoBase64: base64 }, { merge: true });
  } catch (e) { console.error('[avatar]', e); }
  avatarUploadInput.value = '';
});

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    signinScreen.style.display = 'none';
    collectionScreen.classList.add('active');
    const displayName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'User';
    userName.textContent = displayName;
    collectionTitle.textContent = displayName + "'s Collection";
    const snap = await getDoc(doc(db, 'users', user.uid));
    userAvatar.src = (snap.exists() && snap.data().photoBase64) ? snap.data().photoBase64 : (user.photoURL || '');
    await checkDevice(user.uid);
    await loadCollection(user.uid);
  } else {
    currentUser = null;
    signinScreen.style.display = '';
    collectionScreen.classList.remove('active');
  }
});

async function checkDevice(uid) {
  const deviceId = getDeviceId();
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().lastDevice && snap.data().lastDevice !== deviceId) deviceBanner.classList.add('visible');
  await setDoc(ref, { lastDevice: deviceId, lastSeen: serverTimestamp() }, { merge: true });
}

async function loadCollection(uid) {
  collectionContent.innerHTML = '<div class="loading-state">Loading your collection...</div>';
  const snap = await getDocs(collection(db, 'users', uid, 'collection'));
  allGames = [];
  snap.forEach(d => allGames.push({ id: d.id, ...d.data() }));
  renderCollection(allGames, searchInput.value.trim().toLowerCase());
}

function renderCollection(games, query = '') {
  const filtered = query ? games.filter(g => g.name.toLowerCase().includes(query) || (SYSTEM_LABELS[g.system] || '').toLowerCase().includes(query)) : games;
  collectionContent.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = query
      ? `<div class="empty-title">No results for "${query}"</div><p class="empty-desc">Try a different search term.</p>`
      : `<div class="empty-title">No games yet</div><p class="empty-desc">Click "Add Game" or "Import Folder" to get started.</p>`;
    collectionContent.appendChild(empty);
    return;
  }

  const grouped = {};
  filtered.forEach(g => { if (!grouped[g.system]) grouped[g.system] = []; grouped[g.system].push(g); });

  for (const system of Object.keys(grouped)) {
    const section = document.createElement('div');
    section.className = 'section-wrap';
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `<span class="section-title">${SYSTEM_LABELS[system] || system}</span><div class="section-line"></div>`;
    const grid = document.createElement('div');
    grid.className = 'game-grid';
    for (const game of grouped[system]) buildCard(game, currentUser.uid).then(card => grid.appendChild(card));
    section.appendChild(header);
    section.appendChild(grid);
    collectionContent.appendChild(section);
  }
}

searchInput.addEventListener('input', () => renderCollection(allGames, searchInput.value.trim().toLowerCase()));

async function buildCard(game, uid) {
  const card    = document.createElement('div');
  card.className = 'game-card';
  const romFile = await getRom(game.id);
  const hasRom  = !!romFile;

  const coverHtml = game.coverUrl
    ? `<div class="game-cover-wrap"><img class="game-cover" src="${game.coverUrl}" alt="${game.name}" loading="lazy" /><button class="game-cover-edit" data-id="${game.id}"><span class="game-cover-edit-label">Edit Cover</span></button></div>`
    : `<div class="game-cover-wrap"><div class="game-cover-placeholder">NO ART</div><button class="game-cover-edit" data-id="${game.id}"><span class="game-cover-edit-label">Add Cover</span></button></div>`;

  card.innerHTML = `
    ${coverHtml}
    <div class="game-info">
      <div class="game-name">${game.name}</div>
      <div class="game-system-badge">${SYSTEM_LABELS[game.system] || game.system}</div>
      <div class="game-actions">
        <button class="game-play-btn" ${!hasRom ? 'disabled' : ''}>${hasRom ? 'Play' : 'No ROM'}</button>
        <button class="game-remove-btn" title="Remove">✕</button>
      </div>
      ${!hasRom ? `<div class="game-rom-btn">Add ROM file<input type="file" /></div>` : ''}
    </div>
  `;

  const playBtn     = card.querySelector('.game-play-btn');
  const removeBtn   = card.querySelector('.game-remove-btn');
  const attachInput = card.querySelector('.game-rom-btn input');
  const editCoverBtn = card.querySelector('.game-cover-edit');

  if (playBtn && hasRom) {
    playBtn.addEventListener('click', () => {
      const page = SYSTEM_PAGES[game.system];
      if (!page) return;
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(romFile, 'pending-launch');
      tx.oncomplete = () => { sessionStorage.setItem('webemu-launch-name', game.name); window.location.href = page; };
    });
  }

  removeBtn.addEventListener('click', async () => {
    if (!confirm(`Remove "${game.name}" from your collection?`)) return;
    await deleteDoc(doc(db, 'users', uid, 'collection', game.id));
    await deleteRom(game.id);
    await loadCollection(uid);
  });

  if (attachInput) {
    attachInput.addEventListener('change', async () => {
      const f = attachInput.files[0];
      if (!f) return;
      await saveRom(game.id, f);
      await loadCollection(uid);
    });
  }

  if (editCoverBtn) {
    editCoverBtn.addEventListener('click', () => openCoverModal(game));
  }

  return card;
}

function openCoverModal(game) {
  coverEditGame       = game;
  coverSelectedUrl    = null;
  coverUploadedBase64 = null;
  coverModalTitle.textContent = `Cover Art — ${game.name}`;
  coverSearchInput.value = game.name;
  coverResultsWrap.style.display = 'none';
  coverResultsGrid.innerHTML = '';
  coverStatus.textContent = '';
  coverModalOverlay.classList.add('active');
}

coverModalClose.addEventListener('click',  () => coverModalOverlay.classList.remove('active'));
coverModalCancel.addEventListener('click', () => coverModalOverlay.classList.remove('active'));
coverModalOverlay.addEventListener('click', e => { if (e.target === coverModalOverlay) coverModalOverlay.classList.remove('active'); });

coverRescanBtn.addEventListener('click', async () => {
  const searchName = coverSearchInput.value.trim();
  if (!searchName || !coverEditGame) return;

  coverRescanBtn.disabled = true;
  coverRescanBtn.textContent = 'Scanning...';
  coverStatus.textContent = '';
  coverResultsWrap.style.display = 'none';
  coverResultsGrid.innerHTML = '';
  coverSelectedUrl = null;
  coverUploadedBase64 = null;

  const results = await scanCoverCandidates(searchName, coverEditGame.system);

  coverRescanBtn.disabled = false;
  coverRescanBtn.textContent = 'Scan';

  if (results.length === 0) {
    coverStatus.textContent = 'No cover art found. Try a different name or upload your own.';
    return;
  }

  coverResultsLabel.textContent = `${results.length} result${results.length > 1 ? 's' : ''} found — click one to select it`;
  coverResultsWrap.style.display = 'block';

  results.forEach(r => {
    const item = document.createElement('div');
    item.className = 'cover-result-item';

    const img = document.createElement('img');
    img.className = 'cover-result-img';
    img.src = r.url;
    img.alt = r.label;
    img.loading = 'lazy';

    const label = document.createElement('div');
    label.className = 'cover-result-label';
    label.textContent = r.label;

    item.appendChild(img);
    item.appendChild(label);

    item.addEventListener('click', () => {
      coverResultsGrid.querySelectorAll('.cover-result-img').forEach(i => i.classList.remove('selected'));
      img.classList.add('selected');
      coverSelectedUrl    = r.url;
      coverUploadedBase64 = null;
    });

    coverResultsGrid.appendChild(item);
  });

  const firstImg = coverResultsGrid.querySelector('.cover-result-img');
  if (firstImg) { firstImg.classList.add('selected'); coverSelectedUrl = results[0].url; }
});

coverUploadInput.addEventListener('change', async () => {
  const f = coverUploadInput.files[0];
  if (!f) return;
  try {
    coverStatus.textContent = 'Processing image...';
    const base64 = await compressImage(f, 400);
    coverUploadedBase64 = base64;
    coverSelectedUrl    = null;
    coverResultsGrid.querySelectorAll('.cover-result-img').forEach(i => i.classList.remove('selected'));
    coverStatus.textContent = 'Custom image ready. Click Save Cover to apply.';
  } catch (e) {
    coverStatus.textContent = 'Could not process image. Try a different file.';
    console.error(e);
  }
  coverUploadInput.value = '';
});

coverModalSave.addEventListener('click', async () => {
  if (!coverEditGame || !currentUser) return;
  if (!coverSelectedUrl && !coverUploadedBase64) {
    coverStatus.textContent = 'Select a cover art result or upload your own image first.';
    return;
  }

  coverModalSave.disabled = true;
  coverModalSave.textContent = 'Saving...';

  try {
    const newCoverUrl = coverUploadedBase64 || coverSelectedUrl;
    await setDoc(doc(db, 'users', currentUser.uid, 'collection', coverEditGame.id), { coverUrl: newCoverUrl }, { merge: true });
    coverModalOverlay.classList.remove('active');
    await loadCollection(currentUser.uid);
  } catch (e) {
    coverStatus.textContent = 'Failed to save. Try again.';
    console.error(e);
  } finally {
    coverModalSave.disabled = false;
    coverModalSave.textContent = 'Save Cover';
  }
});

addGameBtn.addEventListener('click', () => {
  modalGameName.value = ''; modalSystem.value = ''; modalRomFile.value = '';
  modalFileName.textContent = ''; modalStatus.textContent = '';
  modalFileDrop.classList.remove('has-file');
  modalOverlay.classList.add('active');
});

modalClose.addEventListener('click',     () => modalOverlay.classList.remove('active'));
modalCancelBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) modalOverlay.classList.remove('active'); });

modalRomFile.addEventListener('change', () => {
  const f = modalRomFile.files[0];
  if (!f) return;
  modalFileName.textContent = f.name;
  modalFileDrop.classList.add('has-file');
  if (!modalGameName.value) modalGameName.value = f.name.replace(/\.\w+$/, '');
  const detected = detectSystem(f.name);
  if (detected && !modalSystem.value) modalSystem.value = detected;
});

modalSaveBtn.addEventListener('click', async () => {
  const name = modalGameName.value.trim(), system = modalSystem.value, file = modalRomFile.files[0];
  if (!name)   { modalStatus.textContent = 'Enter a game name.'; return; }
  if (!system) { modalStatus.textContent = 'Select a system.'; return; }
  if (!file)   { modalStatus.textContent = 'Add a ROM file.'; return; }

  modalSaveBtn.disabled = true; modalSaveBtn.textContent = 'Saving...'; modalStatus.textContent = '';
  try {
    const coverUrl = await fetchCover(name, system);
    const gameId   = Date.now().toString(36) + Math.random().toString(36).slice(2);
    await setDoc(doc(db, 'users', currentUser.uid, 'collection', gameId), { name, system, coverUrl: coverUrl || null, addedAt: serverTimestamp() });
    await saveRom(gameId, file);
    modalOverlay.classList.remove('active');
    await loadCollection(currentUser.uid);
  } catch (e) {
    modalStatus.textContent = 'Failed to save. Try again.';
    console.error(e);
  } finally {
    modalSaveBtn.disabled = false; modalSaveBtn.textContent = 'Save to Collection';
  }
});

folderInput.addEventListener('change', () => {
  const files = Array.from(folderInput.files).filter(f => isRomFile(f.name));
  folderInput.value = '';
  if (files.length === 0) { alert('No recognised ROM files found in this folder.'); return; }
  folderFiles = files.map(f => ({ file: f, name: f.name.replace(/\.\w+$/, ''), system: detectSystem(f.name), skipped: false }));
  buildFolderModal();
  folderModalOverlay.classList.add('active');
});

function buildFolderModal() {
  folderModalBody.innerHTML = '';
  folderFiles.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'folder-file-row';
    row.dataset.index = i;

    const nameEl = document.createElement('div');
    nameEl.className = 'folder-file-name';
    nameEl.textContent = entry.name;
    nameEl.title = entry.file.name;

    const select = document.createElement('select');
    select.className = 'folder-file-select';
    select.innerHTML = `<option value="">Unknown</option><option value="nes">NES</option><option value="snes">SNES</option><option value="gameboy">Game Boy</option><option value="gamewatch">Game &amp; Watch</option><option value="genesis">Genesis</option><option value="gamegear">Game Gear</option><option value="playstation">PlayStation</option><option value="psp">PSP</option><option value="n64">N64</option><option value="nds">Nintendo DS</option>`;
    select.value = entry.system || '';
    select.addEventListener('change', () => { folderFiles[i].system = select.value || null; updateFolderCount(); });

    const skipBtn = document.createElement('button');
    skipBtn.className = 'folder-file-skip';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', () => {
      folderFiles[i].skipped = !folderFiles[i].skipped;
      row.classList.toggle('skipped', folderFiles[i].skipped);
      skipBtn.textContent = folderFiles[i].skipped ? 'Undo' : 'Skip';
      updateFolderCount();
    });

    row.appendChild(nameEl); row.appendChild(select); row.appendChild(skipBtn);
    folderModalBody.appendChild(row);
  });
  updateFolderCount();
}

function updateFolderCount() {
  const valid = folderFiles.filter(e => !e.skipped && e.system).length;
  folderModalCount.textContent = `${valid} of ${folderFiles.length} games ready to import`;
}

folderModalClose.addEventListener('click',  () => folderModalOverlay.classList.remove('active'));
folderModalCancel.addEventListener('click', () => folderModalOverlay.classList.remove('active'));

folderModalImport.addEventListener('click', async () => {
  const toImport = folderFiles.filter(e => !e.skipped && e.system);
  if (toImport.length === 0) { alert('No games ready to import. Assign a system to at least one game.'); return; }

  folderModalImport.disabled = true; folderModalImport.textContent = 'Importing...';
  const uid = currentUser.uid;
  let done = 0;

  folderModalOverlay.classList.remove('active');
  importProgress.classList.add('visible');

  for (const entry of toImport) {
    importProgress.textContent = `Importing ${done + 1} of ${toImport.length}: ${entry.name}`;
    try {
      const coverUrl = await fetchCover(entry.name, entry.system);
      const gameId   = Date.now().toString(36) + Math.random().toString(36).slice(2);
      await setDoc(doc(db, 'users', uid, 'collection', gameId), { name: entry.name, system: entry.system, coverUrl: coverUrl || null, addedAt: serverTimestamp() });
      await saveRom(gameId, entry.file);
      done++;
    } catch (e) { console.error('[folder import]', entry.name, e); }
  }

  importProgress.textContent = `Imported ${done} games.`;
  setTimeout(() => importProgress.classList.remove('visible'), 3000);
  folderModalImport.disabled = false; folderModalImport.textContent = 'Import All';
  await loadCollection(uid);
});