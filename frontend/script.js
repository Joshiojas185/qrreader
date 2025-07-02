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
const confettiCanvas = document.getElementById('confetti');

// State variables
let stream = null;
let scanning = false;
let facingMode = 'environment';
let messageTimeout = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  await loadParticipantsData();
  await startCamera();
  updateStats();
  setInterval(syncPendingData, 30000);
}

// Participant data management
const defaultParticipants = [
  {
    "id": 136,
    "name": "John",
    "email": "john@gmail.com",
    "mobile": "9876543210",
    "role": "Attendee",
    "status": "approved"
  },
  {
    "id": 135,
    "name": "Jake",
    "email": "jake@gmail.com",
    "mobile": "99887765556",
    "role": "Volunteer",
    "status": "approved"
  },
  {
    "id": 93,
    "name": "KRITIKA KUMARI",
    "email": "22egjcs123@gitjaipur.com",
    "mobile": "9835757339",
    "role": "Attendee",
    "status": "approved"
  },
  {
    "id": 40,
    "name": "Priyanka Jangid",
    "email": "priyankajangid0602@gmail.com",
    "mobile": "9352634485",
    "role": "Attendee",
    "status": "approved"
  },
  {
    "id": 12,
    "name": "Ojas Joshi",
    "email": "joshiojas185@gmail.com",
    "mobile": "8824427953",
    "role": "Volunteer",
    "status": "approved"
  },
  {
    "id": 8,
    "name": "Kiran Choudhary",
    "email": "kiranchoudhary9180@gmail.com",
    "mobile": null,
    "role": "Volunteer",
    "status": "approved"
  },
  {
    "id": 1,
    "name": "Shubham Gupta",
    "email": "shubham.codeup@gmail.com",
    "mobile": null,
    "role": "Organizer",
    "status": "approved"
  }
];

async function loadParticipantsData() {
  let participants = localStorage.getItem('participants');
  if (!participants) {
    localStorage.setItem('participants', JSON.stringify(defaultParticipants));
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
    updateStatus('Ready to Scan', 'ready');
    
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
  
  updateParticipant(participant.id, { status: 'attended' });
  addScannedId(participant.id);
  addToPendingSync(participant.id);
  
  syncParticipant(participant.id);
  
  showMessage(
    `Welcome ${participant.name}! 🎉`,
    `Successfully checked in. Enjoy the event!`,
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
  try {
    const response = await fetch(`http://localhost:3000/dev/participants/attended/${participantId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: participantId, timestamp: new Date().toISOString() })
    });
    
    if (response.ok) {
      removeFromPendingSync(participantId);
      updateStats();
      console.log(`Synced participant ${participantId}`);
    } else {
      console.error(`Failed to sync participant ${participantId}:`, response.statusText);
    }
  } catch (error) {
    console.error(`Network error syncing participant ${participantId}:`, error);
  }
}

async function syncPendingData() {
  const pending = getPendingSync();
  if (pending.length === 0) return;
  
  console.log(`Syncing ${pending.length} pending participants...`);
  
  for (const id of pending) {
    await syncParticipant(id);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

function updateStats() {
  const scannedIds = getScannedIds();
  totalScannedEl.textContent = scannedIds.length;
}

// Event listeners
document.getElementById('switchCamera').addEventListener('click', () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera();
});

document.getElementById('flashlight').addEventListener('click', () => {
  showMessage('Flash Not Available', 'Flash control is not supported in web browsers', 'error');
  autoRestartScanning();
});

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

// Clear localStorage functionality
const clearLocalStorage = document.getElementById('localStorageBtn');
clearLocalStorage.addEventListener("click", () => {
  localStorage.clear();
  alert('LocalStorage cleared successfully');
  window.location.reload();
});

// Cleanup
window.addEventListener('beforeunload', () => {
  stopCamera();
});