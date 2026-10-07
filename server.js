const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const MAX_STROKES = 12000;
let strokes = [];

app.use(express.static(path.join(__dirname, 'public')));

function userCount() { io.emit('users', io.of('/').sockets.size); }

io.on('connection', (socket) => {
  socket.emit('canvas-state', strokes);
  userCount();

  socket.on('stroke', (segment) => {
    if (!segment || ![segment.x0,segment.y0,segment.x1,segment.y1,segment.width].every(Number.isFinite)) return;
    const clean = {
      x0: Math.max(0, Math.min(1, segment.x0)), y0: Math.max(0, Math.min(1, segment.y0)),
      x1: Math.max(0, Math.min(1, segment.x1)), y1: Math.max(0, Math.min(1, segment.y1)),
      color: /^#[0-9a-fA-F]{6}$/.test(segment.color) ? segment.color : '#111827',
      width: Math.max(1, Math.min(30, segment.width))
    };
    strokes.push(clean);
    if (strokes.length > MAX_STROKES) strokes = strokes.slice(-MAX_STROKES);
    socket.broadcast.emit('stroke', clean);
  });

  socket.on('clear-canvas', () => {
    strokes = [];
    io.emit('clear-canvas');
  });

  socket.on('disconnect', userCount);
});

server.listen(PORT, () => console.log(`Air Paint: http://localhost:${PORT}`));
