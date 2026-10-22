import { io } from 'socket.io-client';

// Нэг л socket холболт: нэвтэрсний дараа нээж, гарахад хаана.
// Монолит тул хаяггүй io() нь ижил домэйн рүү холбогдож, session cookie автоматаар явна.
let socket = null;

export function connectSocket() {
  if (!socket) socket = io({ autoConnect: true });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
