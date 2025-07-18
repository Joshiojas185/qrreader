// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const messageOverlay = document.getElementById('messageOverlay');
const messageIcon = document.getElementById('messageIcon');
const messageTitle = document.getElementById('messageTitle');
const messageText = document.getElementById('messageText');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const successAnimation = document.getElementById('successAnimation');
const totalScannedEl = document.getElementById('totalScanned');
const pendingSyncEl = document.getElementById('pendingSync');
const confettiCanvas = document.getElementById('confetti');
const refreshDataBtn = document.getElementById('refreshData');

// State variables
let stream = null;
let scanning = false;
let facingMode = 'environment';
let messageTimeout = null;
let isOnline = navigator.onLine;

// API Configuration
const API_BASE_URL = 'https://codeup.in/dev';
const ENDPOINTS = {
  APPROVED_PARTICIPANTS: `${API_BASE_URL}/admin/participants`,
  MARK_ATTENDED: `${API_BASE_URL}/admin/participant/mark-attended`
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
});

// Online/Offline status monitoring
window.addEventListener('online', () => {
  isOnline = true;
  updateStatus('Online - Ready to Scan', 'ready');
  syncPendingData();
});

window.addEventListener('offline', () => {
  isOnline = false;
  updateStatus('Offline - Saving locally', 'warning');
});

async function initializeApp() {
  updateStatus('Loading participants...', 'loading');
  await loadParticipantsData();
  await startCamera();
  updateStats();
  
  // Sync pending data every 30 seconds
  setInterval(syncPendingData, 30000);
}

// Participant data management
async function loadParticipantsData() {
  try {
    updateStatus('Fetching participants...', 'loading');
    const response = await fetch(ENDPOINTS.APPROVED_PARTICIPANTS);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const participants = await response.json();
    
    if (Array.isArray(participants) && participants.length > 0) {
      localStorage.setItem('participants', JSON.stringify(participants));
      console.log(`Loaded ${participants.length} participants from API`);
      updateStatus('Participants loaded', 'success');
    } else {
      throw new Error('No participants found');
    }
  } catch (error) {
    console.error('Failed to load participants from API:', error);
    
    // Try to load from localStorage as fallback
    const savedParticipants = localStorage.getItem('participants');
    if (savedParticipants) {
      console.log('Using cached participants');
      updateStatus('Using cached data', 'warning');
    } else {
      console.log('No cached data available');
      updateStatus('No participant data', 'error');
      showMessage('Data Loading Failed', 'Unable to load participant data. Please refresh.', 'error');
    }
  }
}

function getParticipants() {
  return JSON.parse(localStorage.getItem('participants') || '[]');
}

function updateParticipant(id, updates) {
  const participants = getParticipants();
  const index = participants.findIndex(p => p.id === parseInt(id));
  if (index !== -1) {
    participants[index] = { ...participants[index], ...updates };
    localStorage.setItem('participants', JSON.stringify(participants));
    return participants[index];
  }
  return null;
}

function getScannedIds() {
  return JSON.parse(localStorage.getItem('scannedIds') || '[]');
}

function addScannedId(id) {
  const scannedIds = getScannedIds();
  if (!scannedIds.includes(parseInt(id))) {
    scannedIds.push(parseInt(id));
    localStorage.setItem('scannedIds', JSON.stringify(scannedIds));
  }
}

function getPendingSync() {
  return JSON.parse(localStorage.getItem('pendingSync') || '[]');
}

function addToPendingSync(id) {
  const pending = getPendingSync();
  if (!pending.includes(parseInt(id))) {
    pending.push(parseInt(id));
    localStorage.setItem('pendingSync', JSON.stringify(pending));
  }
}

function removeFromPendingSync(id) {
  const pending = getPendingSync();
  const filtered = pending.filter(pid => pid !== parseInt(id));
  localStorage.setItem('pendingSync', JSON.stringify(filtered));
}

// Camera control
async function startCamera() {
  try {
    updateStatus('Starting camera...', 'loading');
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    
    video.srcObject = stream;
    await video.play();
    
    scanning = true;
    requestAnimationFrame(scanFrame);
    
    if (isOnline) {
      updateStatus('Ready to Scan', 'ready');
    } else {
      updateStatus('Offline - Saving locally', 'warning');
    }
    
  } catch (err) {
    console.error('Camera error:', err);
    updateStatus('Camera Error', 'error');
    showMessage('Camera Access Required', 'Please allow camera access to scan QR codes', 'error');
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  scanning = false;
}

function updateStatus(text, type) {
  statusText.textContent = text;
  statusDot.className = `status-dot ${type}`;
}

// Scanning loop
function scanFrame() {
  if (!scanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
    if (scanning) requestAnimationFrame(scanFrame);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = window.jsQR(imageData.data, imageData.width, imageData.height);

  if (code) {
    handleQRCode(code.data);
  } else {
    requestAnimationFrame(scanFrame);
  }
}

// // QR Code handling
// function handleQRCode(qrData) {
//   console.log('QR Data:', qrData);
  
//   const idMatch = qrData.match(/id\s*:\s*(\d+)/);
//   const statusMatch = qrData.match(/status\s*:\s*([A-Za-z0-9_-]+)/);
  
//   if (!idMatch) {
//     showMessage('Invalid QR Code', 'This QR code is not valid for this event', 'error');
//     autoRestartScanning();
//     return;
//   }

//   const participantId = parseInt(idMatch[1]);
//   const qrStatus = statusMatch ? statusMatch[1] : null;
  
//   const participants = getParticipants();
//   const participant = participants.find(p => p.id === participantId);
  
//   if (!participant) {
//     showMessage('Participant Not Found', `No participant found with ID: ${participantId}`, 'error');
//     autoRestartScanning();
//     return;
//   }

//   const scannedIds = getScannedIds();
//   if (scannedIds.includes(participantId)) {
//     showMessage('Already Checked In', `${participant.name} has already been checked in!`, 'warning');
//     autoRestartScanning();
//     return;
//   }

//   if (participant.status !== 'approved' && qrStatus !== 'approved') {
//     showMessage('Access Denied', `${participant.name} is not approved for this event`, 'error');
//     autoRestartScanning();
//     return;
//   }

//   processSuccessfulScan(participant);
// }


// QR Code handling
function handleQRCode(qrData) {
  console.log('QR Data:', qrData);
  
  const idMatch = qrData.match(/id\s*:\s*(\d+)/);
  const statusMatch = qrData.match(/status\s*:\s*([A-Za-z0-9_-]+)/);
  
  if (!idMatch) {
    showMessage('Invalid QR Code', 'This QR code is not valid for this event', 'error');
    autoRestartScanning();
    return;
  }

  const participantId = parseInt(idMatch[1]);
  const qrStatus = statusMatch ? statusMatch[1] : null;
  
  const participants = getParticipants();
  const participant = participants.find(p => p.id === participantId);
  
  if (!participant) {
    showMessage('Participant Not Found', `No participant found with ID: ${participantId}`, 'error');
    autoRestartScanning();
    return;
  }

  const scannedIds = getScannedIds();
  if (scannedIds.includes(participantId)) {
    showMessage('Already Checked In', `${participant.name} has already been checked in!`, 'warning');
    autoRestartScanning();
    return;
  }

  // Check if participant status is already attended
  if (participant.status === 'attended') {
    showMessage('Ticket Already Scanned', `${participant.name}'s ticket has already been scanned!`, 'warning');
    autoRestartScanning();
    return;
  }

  if (participant.status !== 'approved' && qrStatus !== 'approved') {
    showMessage('Access Denied', `${participant.name} is not approved for this event`, 'error');
    autoRestartScanning();
    return;
  }

  processSuccessfulScan(participant);
}

function processSuccessfulScan(participant) {
  stopCamera();
  
  showSuccessAnimation();
  
  // Update local data
  updateParticipant(participant.id, { status: 'attended' });
  addScannedId(participant.id);
  addToPendingSync(participant.id);
  
  // Try to sync immediately
  syncParticipant(participant.id);
  
  showMessage(
    `Welcome ${participant.name}! 🎉`,
    `Successfully checked in. ${isOnline ? 'Data synced!' : 'Will sync when online.'}`,
    'success'
  );
  
  showConfetti();
  updateStats();
  updateStatus('Check-in Successful', 'success');
  
  autoRestartScanning();
}

function showMessage(title, text, type) {
  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }

  messageTitle.textContent = title;
  messageText.textContent = text;
  
  messageIcon.className = 'message-icon';
  
  if (type === 'success') {
    messageIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
  } else if (type === 'error') {
    messageIcon.classList.add('error');
    messageIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
  } else if (type === 'warning') {
    messageIcon.classList.add('warning');
    messageIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
  }
  
  messageOverlay.classList.add('show');
}

function hideMessage() {
  messageOverlay.classList.remove('show');
}

function showSuccessAnimation() {
  successAnimation.classList.add('show');
  setTimeout(() => {
    successAnimation.classList.remove('show');
  }, 1000);
}

function autoRestartScanning() {
  messageTimeout = setTimeout(() => {
    hideMessage();
    startCamera();
  }, 3000);
}

// API Integration
async function syncParticipant(participantId) {
  if (!isOnline) {
    console.log(`Offline: Participant ${participantId} will be synced later`);
    return;
  }

  try {
    const response = await fetch(`${ENDPOINTS.MARK_ATTENDED}/${participantId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      }
      // ,
      // body: JSON.stringify({ 
      //   id: participantId, 
      //   timestamp: new Date().toISOString(),
      //   status: 'attended'
      // })
    });
    
    if (response.ok) {
      removeFromPendingSync(participantId);
      updateStats();
      console.log(`Successfully synced participant ${participantId}`);
    } else {
      console.error(`Failed to sync participant ${participantId}:`, response.status, response.statusText);
    }
  } catch (error) {
    console.error(`Network error syncing participant ${participantId}:`, error);
  }
}

async function syncPendingData() {
  if (!isOnline) {
    console.log('Offline: Skipping sync');
    return;
  }

  const pending = getPendingSync();
  if (pending.length === 0) return;
  
  console.log(`Syncing ${pending.length} pending participants...`);
  
  for (const id of pending) {
    await syncParticipant(id);
    // Small delay to prevent overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Update stats after sync
  updateStats();
}

function updateStats() {
  const scannedIds = getScannedIds();
  const pendingSync = getPendingSync();
  
         pendingSyncEl.textContent = scannedIds.length;
  pendingSyncEl.textContent = pendingSync.length;
}

// Event listeners
function setupEventListeners() {
  document.getElementById('switchCamera').addEventListener('click', () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
  });

  document.getElementById('flashlight').addEventListener('click', () => {
    showMessage('Flash Not Available', 'Flash control is not supported in web browsers', 'error');
    autoRestartScanning();
  });

  refreshDataBtn.addEventListener('click', async () => {
    refreshDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Refreshing</span>';
    await loadParticipantsData();
    await syncPendingData();
    refreshDataBtn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Refresh</span>';
  });

  // Clear localStorage functionality
  document.getElementById('localStorageBtn').addEventListener('click', () => {
    localStorage.clear();
    alert('LocalStorage cleared successfully');
    window.location.reload();
  });
}

// Confetti animation
function showConfetti() {
  const canvas = confettiCanvas;
  const ctx = canvas.getContext('2d');
  
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const particles = [];
  const colors = ['#f94eb2', '#ff6b9d', '#22c55e', '#60a5fa', '#fbbf24'];
  
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 4 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 12 + 6,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 15,
      shape: Math.random() > 0.5 ? 'circle' : 'square'
    });
  }
  
  function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.rotation += p.rotationSpeed;
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size/2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      }
      
      ctx.restore();
      
      if (p.y > canvas.height + 20) {
        particles.splice(i, 1);
      }
    }
    
    if (particles.length > 0) {
      requestAnimationFrame(animateConfetti);
    }
  }
  
  animateConfetti();
}

// Cleanup
window.addEventListener('beforeunload', () => {
  stopCamera();
});












// // DOM Elements
// const video = document.getElementById('video');
// const canvas = document.getElementById('canvas');
// const ctx = canvas.getContext('2d');
// const messageOverlay = document.getElementById('messageOverlay');
// const messageIcon = document.getElementById('messageIcon');
// const messageTitle = document.getElementById('messageTitle');
// const messageText = document.getElementById('messageText');
// const statusDot = document.getElementById('statusDot');
// const statusText = document.getElementById('statusText');
// const successAnimation = document.getElementById('successAnimation');
// const totalScannedEl = document.getElementById('totalScanned');
// const pendingSyncEl = document.getElementById('pendingSync');
// const confettiCanvas = document.getElementById('confetti');
// const refreshDataBtn = document.getElementById('refreshData');

// // State variables
// let stream = null;
// let scanning = false;
// let facingMode = 'environment';
// let messageTimeout = null;
// let isOnline = navigator.onLine;

// // API Configuration
// const API_BASE_URL = 'http://localhost:5000';
// const ENDPOINTS = {
//   APPROVED_PARTICIPANTS: `${API_BASE_URL}/approvedparticipants`,
//   MARK_ATTENDED: `${API_BASE_URL}/mark-attended`
// };

// // Initialize app
// document.addEventListener('DOMContentLoaded', () => {
//   initializeApp();
//   setupEventListeners();
// });

// // Online/Offline status monitoring
// window.addEventListener('online', () => {
//   isOnline = true;
//   updateStatus('Online - Ready to Scan', 'ready');
//   syncPendingData();
// });

// window.addEventListener('offline', () => {
//   isOnline = false;
//   updateStatus('Offline - Saving locally', 'warning');
// });

// async function initializeApp() {
//   updateStatus('Loading participants...', 'loading');
//   await loadParticipantsData();
//   await startCamera();
//   updateStats();
  
//   // Sync pending data every 30 seconds
//   setInterval(syncPendingData, 30000);
// }

// // Participant data management
// async function loadParticipantsData() {
//   try {
//     updateStatus('Fetching participants...', 'loading');
//     const response = await fetch(ENDPOINTS.APPROVED_PARTICIPANTS);
    
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
    
//     const participants = await response.json();
    
//     if (Array.isArray(participants) && participants.length > 0) {
//       localStorage.setItem('participants', JSON.stringify(participants));
//       console.log(`Loaded ${participants.length} participants from API`);
//       updateStatus('Participants loaded', 'success');
//     } else {
//       throw new Error('No participants found');
//     }
//   } catch (error) {
//     console.error('Failed to load participants from API:', error);
    
//     // Try to load from localStorage as fallback
//     const savedParticipants = localStorage.getItem('participants');
//     if (savedParticipants) {
//       console.log('Using cached participants');
//       updateStatus('Using cached data', 'warning');
//     } else {
//       console.log('No cached data available');
//       updateStatus('No participant data', 'error');
//       showMessage('Data Loading Failed', 'Unable to load participant data. Please refresh.', 'error');
//     }
//   }
// }

// function getParticipants() {
//   return JSON.parse(localStorage.getItem('participants') || '[]');
// }

// function updateParticipant(id, updates) {
//   const participants = getParticipants();
//   const index = participants.findIndex(p => p.id === parseInt(id));
//   if (index !== -1) {
//     participants[index] = { ...participants[index], ...updates };
//     localStorage.setItem('participants', JSON.stringify(participants));
//     return participants[index];
//   }
//   return null;
// }

// function getScannedIds() {
//   return JSON.parse(localStorage.getItem('scannedIds') || '[]');
// }

// function addScannedId(id) {
//   const scannedIds = getScannedIds();
//   if (!scannedIds.includes(parseInt(id))) {
//     scannedIds.push(parseInt(id));
//     localStorage.setItem('scannedIds', JSON.stringify(scannedIds));
//   }
// }

// function getPendingSync() {
//   return JSON.parse(localStorage.getItem('pendingSync') || '[]');
// }

// function addToPendingSync(id) {
//   const pending = getPendingSync();
//   if (!pending.includes(parseInt(id))) {
//     pending.push(parseInt(id));
//     localStorage.setItem('pendingSync', JSON.stringify(pending));
//   }
// }

// function removeFromPendingSync(id) {
//   const pending = getPendingSync();
//   const filtered = pending.filter(pid => pid !== parseInt(id));
//   localStorage.setItem('pendingSync', JSON.stringify(filtered));
// }

// // Camera control
// async function startCamera() {
//   try {
//     updateStatus('Starting camera...', 'loading');
    
//     if (stream) {
//       stream.getTracks().forEach(track => track.stop());
//     }

//     stream = await navigator.mediaDevices.getUserMedia({
//       video: { 
//         facingMode: facingMode,
//         width: { ideal: 1280 },
//         height: { ideal: 720 }
//       }
//     });
    
//     video.srcObject = stream;
//     await video.play();
    
//     scanning = true;
//     requestAnimationFrame(scanFrame);
    
//     if (isOnline) {
//       updateStatus('Ready to Scan', 'ready');
//     } else {
//       updateStatus('Offline - Saving locally', 'warning');
//     }
    
//   } catch (err) {
//     console.error('Camera error:', err);
//     updateStatus('Camera Error', 'error');
//     showMessage('Camera Access Required', 'Please allow camera access to scan QR codes', 'error');
//   }
// }

// function stopCamera() {
//   if (stream) {
//     stream.getTracks().forEach(track => track.stop());
//     stream = null;
//   }
//   scanning = false;
// }

// function updateStatus(text, type) {
//   statusText.textContent = text;
//   statusDot.className = `status-dot ${type}`;
// }

// // Scanning loop
// function scanFrame() {
//   if (!scanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
//     if (scanning) requestAnimationFrame(scanFrame);
//     return;
//   }

//   canvas.width = video.videoWidth;
//   canvas.height = video.videoHeight;
//   ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//   const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//   const code = window.jsQR(imageData.data, imageData.width, imageData.height);

//   if (code) {
//     handleQRCode(code.data);
//   } else {
//     requestAnimationFrame(scanFrame);
//   }
// }

// // QR Code handling
// function handleQRCode(qrData) {
//   console.log('QR Data:', qrData);
  
//   const idMatch = qrData.match(/id\s*:\s*(\d+)/);
//   const statusMatch = qrData.match(/status\s*:\s*([A-Za-z0-9_-]+)/);
  
//   if (!idMatch) {
//     showMessage('Invalid QR Code', 'This QR code is not valid for this event', 'error');
//     autoRestartScanning();
//     return;
//   }

//   const participantId = parseInt(idMatch[1]);
//   const qrStatus = statusMatch ? statusMatch[1] : null;
  
//   const participants = getParticipants();
//   const participant = participants.find(p => p.id === participantId);
  
//   if (!participant) {
//     showMessage('Participant Not Found', `No participant found with ID: ${participantId}`, 'error');
//     autoRestartScanning();
//     return;
//   }

//   const scannedIds = getScannedIds();
//   if (scannedIds.includes(participantId)) {
//     showMessage('Already Checked In', `${participant.name} has already been checked in!`, 'warning');
//     autoRestartScanning();
//     return;
//   }

//   // Check if participant status is already attended
//   if (participant.status === 'attended') {
//     showMessage('Ticket Already Scanned', `${participant.name}'s ticket has already been scanned!`, 'warning');
//     autoRestartScanning();
//     return;
//   }

//   if (participant.status !== 'approved' && qrStatus !== 'approved') {
//     showMessage('Access Denied', `${participant.name} is not approved for this event`, 'error');
//     autoRestartScanning();
//     return;
//   }

//   processSuccessfulScan(participant);
// }

// function processSuccessfulScan(participant) {
//   stopCamera();
  
//   showSuccessAnimation();
  
//   // Update local data
//   updateParticipant(participant.id, { status: 'attended' });
//   addScannedId(participant.id);
//   addToPendingSync(participant.id);
  
//   // Try to sync immediately
//   syncParticipant(participant.id);
  
//   showMessage(
//     `Welcome ${participant.name}! 🎉`,
//     `Successfully checked in. ${isOnline ? 'Data synced!' : 'Will sync when online.'}`,
//     'success'
//   );
  
//   showConfetti();
//   updateStats();
//   updateStatus('Check-in Successful', 'success');
  
//   autoRestartScanning();
// }

// function showMessage(title, text, type) {
//   if (messageTimeout) {
//     clearTimeout(messageTimeout);
//   }

//   messageTitle.textContent = title;
//   messageText.textContent = text;
  
//   messageIcon.className = 'message-icon';
  
//   if (type === 'success') {
//     messageIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
//   } else if (type === 'error') {
//     messageIcon.classList.add('error');
//     messageIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
//   } else if (type === 'warning') {
//     messageIcon.classList.add('warning');
//     messageIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
//   }
  
//   messageOverlay.classList.add('show');
// }

// function hideMessage() {
//   messageOverlay.classList.remove('show');
// }

// function showSuccessAnimation() {
//   successAnimation.classList.add('show');
//   setTimeout(() => {
//     successAnimation.classList.remove('show');
//   }, 1000);
// }

// function autoRestartScanning() {
//   messageTimeout = setTimeout(() => {
//     hideMessage();
//     startCamera();
//   }, 3000);
// }

// // API Integration
// async function syncParticipant(participantId) {
//   if (!isOnline) {
//     console.log(`Offline: Participant ${participantId} will be synced later`);
//     return;
//   }

//   try {
//     const response = await fetch(`${ENDPOINTS.MARK_ATTENDED}/${participantId}`, {
//       method: 'PUT',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ 
//         id: participantId, 
//         timestamp: new Date().toISOString(),
//         status: 'attended'
//       })
//     });
    
//     if (response.ok) {
//       removeFromPendingSync(participantId);
//       updateStats();
//       console.log(`Successfully synced participant ${participantId}`);
//     } else {
//       console.error(`Failed to sync participant ${participantId}:`, response.status, response.statusText);
//     }
//   } catch (error) {
//     console.error(`Network error syncing participant ${participantId}:`, error);
//   }
// }

// async function syncPendingData() {
//   if (!isOnline) {
//     console.log('Offline: Skipping sync');
//     return;
//   }

//   const pending = getPendingSync();
//   if (pending.length === 0) return;
  
//   console.log(`Syncing ${pending.length} pending participants...`);
  
//   for (const id of pending) {
//     await syncParticipant(id);
//     // Small delay to prevent overwhelming the server
//     await new Promise(resolve => setTimeout(resolve, 100));
//   }
  
//   // Update stats after sync
//   updateStats();
// }

// function updateStats() {
//   const scannedIds = getScannedIds();
//   const pendingSync = getPendingSync();
  
//   totalScannedEl.textContent = scannedIds.length;
//   pendingSyncEl.textContent = pendingSync.length;
// }

// // Event listeners
// function setupEventListeners() {
//   document.getElementById('switchCamera').addEventListener('click', () => {
//     facingMode = facingMode === 'environment' ? 'user' : 'environment';
//     startCamera();
//   });

//   document.getElementById('flashlight').addEventListener('click', () => {
//     showMessage('Flash Not Available', 'Flash control is not supported in web browsers', 'error');
//     autoRestartScanning();
//   });

//   refreshDataBtn.addEventListener('click', async () => {
//     refreshDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Refreshing</span>';
//     await loadParticipantsData();
//     await syncPendingData();
//     refreshDataBtn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Refresh</span>';
//   });

//   // Clear localStorage functionality
//   document.getElementById('localStorageBtn').addEventListener('click', () => {
//     localStorage.clear();
//     alert('LocalStorage cleared successfully');
//     window.location.reload();
//   });
// }

// // Confetti animation
// function showConfetti() {
//   const canvas = confettiCanvas;
//   const ctx = canvas.getContext('2d');
  
//   canvas.width = window.innerWidth;
//   canvas.height = window.innerHeight;
  
//   const particles = [];
//   const colors = ['#f94eb2', '#ff6b9d', '#22c55e', '#60a5fa', '#fbbf24'];
  
//   for (let i = 0; i < 80; i++) {
//     particles.push({
//       x: Math.random() * canvas.width,
//       y: -10,
//       vx: (Math.random() - 0.5) * 6,
//       vy: Math.random() * 4 + 3,
//       color: colors[Math.floor(Math.random() * colors.length)],
//       size: Math.random() * 12 + 6,
//       rotation: Math.random() * 360,
//       rotationSpeed: (Math.random() - 0.5) * 15,
//       shape: Math.random() > 0.5 ? 'circle' : 'square'
//     });
//   }
  
//   function animateConfetti() {
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
    
//     for (let i = particles.length - 1; i >= 0; i--) {
//       const p = particles[i];
      
//       p.x += p.vx;
//       p.y += p.vy;
//       p.vy += 0.15;
//       p.rotation += p.rotationSpeed;
      
//       ctx.save();
//       ctx.translate(p.x, p.y);
//       ctx.rotate(p.rotation * Math.PI / 180);
//       ctx.fillStyle = p.color;
      
//       if (p.shape === 'circle') {
//         ctx.beginPath();
//         ctx.arc(0, 0, p.size/2, 0, Math.PI * 2);
//         ctx.fill();
//       } else {
//         ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
//       }
      
//       ctx.restore();
      
//       if (p.y > canvas.height + 20) {
//         particles.splice(i, 1);
//       }
//     }
    
//     if (particles.length > 0) {
//       requestAnimationFrame(animateConfetti);
//     }
//   }
  
//   animateConfetti();
// }

// // Cleanup
// window.addEventListener('beforeunload', () => {
//   stopCamera();
// });