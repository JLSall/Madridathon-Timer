const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = 3000;

// Serve static files (your HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Start HTTP server
const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

// Setup WebSocket server
const wss = new WebSocket.Server({ server });

// Timer state (in seconds)
let duration = 24 * 3600; // 24 hours default
let timerInterval = null;

// Broadcast to all connected clients
function broadcast(data) {
  console.log('Broadcasting to all clients:', data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Broadcast to specific client type (timer displays only)
function broadcastToTimers(data) {
  console.log('Broadcasting to timer displays:', data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.isTimer) {
      client.send(JSON.stringify(data));
    }
  });
}

// Update timer every second if running
function startTimer() {
  if (!timerInterval) {
    timerInterval = setInterval(() => {
      if (duration > 0) {
        duration--;
        broadcast({ type: 'update', duration });
      } else {
        clearInterval(timerInterval);
        timerInterval = null;
        broadcast({ type: 'stopped' });
      }
    }, 1000);
  }
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    broadcast({ type: 'paused' });
  }
}

// Handle WebSocket connections
wss.on('connection', ws => {
  console.log('Client connected');

  // Send current timer state to new client
  ws.send(JSON.stringify({type: 'update', duration}));

  ws.on('message', message => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);

      switch (data.type) {
        case 'start':
          startTimer();
          break;
        case 'pause':
          pauseTimer();
          break;
        case 'add':
          console.log(`Adding ${data.amount} seconds to timer`);
          duration += data.amount;
          broadcast({type: 'update', duration});
          break;
        case 'subtract':
          duration = Math.max(0, duration - data.amount);
          broadcast({type: 'update', duration});
          break;
        case 'set':
          duration = Math.max(0, data.amount);
          broadcast({type: 'update', duration});
          break;
        case 'spinWheel':
          console.log('Forwarding wheel spin to timers:', data);
          // Forward wheel spin command to timer displays only
          broadcastToTimers({
            type: 'spinWheel', 
            seconds: data.seconds,
            wheelType: data.wheelType,
            doublerFlag: data.doublerFlag
          });
          break;
        case 'registerTimer':
          // Mark this connection as a timer display
          ws.isTimer = true;
          console.log('Timer display registered');
          break;
      }
    } catch (err) {
      console.error('Invalid message', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});