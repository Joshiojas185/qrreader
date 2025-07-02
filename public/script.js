// Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const messageOverlay = document.getElementById('messageOverlay');
const messageIcon = document.getElementById('messageIcon');
const messageTitle = document.getElementById('messageTitle');
const messageText = document.getElementById('messageText');
const upload = document.getElementById('upload');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const successAnimation = document.getElementById('successAnimation');
const totalScannedEl = document.getElementById('totalScanned');
const confettiCanvas = document.getElementById('confetti');

// State variables
let stream = null;
let scanning = false;
let facingMode = 'environment'; // 'user' for front camera, 'environment' for back camera
let messageTimeout = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  await loadParticipantsData();
  await startCamera();
  updateStats();
  setInterval(syncPendingData, 30000); // Sync every 30 seconds
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
    updateStatus('Initializing camera...', 'loading');
    
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
    updateStatus('Scanning...', 'ready');
    
  } catch (err) {
    console.error('Camera error:', err);
    updateStatus('Camera unavailable', 'error');
    showOverlayMessage('Camera Error', 'Camera access denied or unavailable. Please allow camera access and refresh the page.', 'error');
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
  
  // Parse QR data - expected format: "id : 1, status : approved"
  const idMatch = qrData.match(/id\s*:\s*(\d+)/);
  const statusMatch = qrData.match(/status\s*:\s*([A-Za-z0-9_-]+)/);
  
  if (!idMatch) {
    showOverlayMessage('Invalid QR Code', 'QR code does not contain valid participant ID', 'error');
    autoRestartScanning();
    return;
  }

  const participantId = parseInt(idMatch[1]);
  const qrStatus = statusMatch ? statusMatch[1] : null;
  
  // Find participant
  const participants = getParticipants();
  const participant = participants.find(p => p.id === participantId);
  
  if (!participant) {
    showOverlayMessage('Participant Not Found', `No participant found with ID: ${participantId}`, 'error');
    autoRestartScanning();
    return;
  }

  // Check if already scanned
  const scannedIds = getScannedIds();
  if (scannedIds.includes(participantId)) {
    showOverlayMessage('Already Scanned', `${participant.name}, this QR code has already been scanned!`, 'warning');
    autoRestartScanning();
    return;
  }

  // Check participant status
  if (participant.status !== 'approved' && qrStatus !== 'approved') {
    showOverlayMessage('Not Approved', `${participant.name}, you are not approved for this event`, 'error');
    autoRestartScanning();
    return;
  }

  // Success! Mark as attended
  processSuccessfulScan(participant);
}

function processSuccessfulScan(participant) {
  // Stop scanning
  stopCamera();
  
  // Show success animation
  showSuccessAnimation();
  
  // Update participant status
  updateParticipant(participant.id, { status: 'attended' });
  
  // Add to scanned list
  addScannedId(participant.id);
  
  // Add to pending sync
  addToPendingSync(participant.id);
  
  // Try to sync immediately
  syncParticipant(participant.id);
  
  // Show welcome message
  showOverlayMessage(
    `Welcome ${participant.name}! 🎉`,
    `Hi ${participant.name}, get your bands on, welcome to the event!`,
    'success'
  );
  
  // Show confetti
  showConfetti();
  
  // Update stats
  updateStats();
  
  updateStatus('Success!', 'success');
  
  // Auto restart after 4 seconds
  autoRestartScanning();
}

function showOverlayMessage(title, text, type) {
  // Clear any existing timeout
  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }

  messageTitle.textContent = title;
  messageText.textContent = text;
  
  // Reset icon classes
  messageIcon.className = 'message-icon';
  messageIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
  
  // Add type class and update icon
  if (type === 'success') {
    messageIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
  } else if (type === 'error') {
    messageIcon.classList.add('error');
    messageIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
  } else if (type === 'warning') {
    messageIcon.classList.add('warning');
    messageIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
  }
  
  // Show overlay
  messageOverlay.classList.add('show');
}

function hideOverlayMessage() {
  messageOverlay.classList.remove('show');
}

function showSuccessAnimation() {
  successAnimation.classList.add('show');
  setTimeout(() => {
    successAnimation.classList.remove('show');
  }, 1200);
}

// Auto restart scanning after 4 seconds
function autoRestartScanning() {
  messageTimeout = setTimeout(() => {
    hideOverlayMessage();
    startCamera();
  }, 4000);
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
    // Keep in pending sync for retry
  }
}

async function syncPendingData() {
  const pending = getPendingSync();
  if (pending.length === 0) return;
  
  console.log(`Syncing ${pending.length} pending participants...`);
  
  for (const id of pending) {
    await syncParticipant(id);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Stats management
function updateStats() {
  const scannedIds = getScannedIds();
  totalScannedEl.textContent = scannedIds.length;
}

// Event listeners
upload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(imageData.data, imageData.width, imageData.height);
    
    if (code) {
      handleQRCode(code.data);
    } else {
      showOverlayMessage('No QR Code Found', 'No QR code found in this image. Please try another image.', 'error');
      autoRestartScanning();
    }
  };
  
  img.src = URL.createObjectURL(file);
  e.target.value = ''; // Reset file input
});

// Camera controls
document.getElementById('switchCamera').addEventListener('click', () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera();
});

document.getElementById('flashlight').addEventListener('click', () => {
  // Note: Flashlight control is limited in web browsers
  // This is a placeholder for future implementation
  showOverlayMessage('Flash Control', 'Flash control is not available in web browsers', 'error');
  autoRestartScanning();
});

// Enhanced Confetti animation
function showConfetti() {
  const canvas = confettiCanvas;
  const ctx = canvas.getContext('2d');
  
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const particles = [];
  const colors = ['#f94eb2', '#ff6b9d', '#c084fc', '#4ade80', '#60a5fa', '#fbbf24'];
  
  // Create more particles for better effect
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * 5 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 15 + 8,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 20,
      shape: Math.random() > 0.5 ? 'circle' : 'square'
    });
  }
  
  function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      
      // Update position
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // gravity
      p.rotation += p.rotationSpeed;
      
      // Draw particle
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
      
      // Remove if off screen
      if (p.y > canvas.height + 30) {
        particles.splice(i, 1);
      }
    }
    
    if (particles.length > 0) {
      requestAnimationFrame(animateConfetti);
    }
  }
  
  animateConfetti();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopCamera();
});


const  clearLocalStorage = document.getElementById('localStorageBtn');
clearLocalStorage.addEventListener("click", () => {
  localStorage.clear();
  alert('Localstorage cleared successfully');
})