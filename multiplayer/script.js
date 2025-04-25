// Importar el módulo para el juego multijugador
import { initMultiplayerGame } from '../src/multiplayer.js';

// Elementos DOM
const clientIdSpan = document.getElementById('clientId');
const lobbyScreen = document.getElementById('lobbyScreen');
const roomScreen = document.getElementById('roomScreen');
const gameScreen = document.getElementById('gameScreen');
const roomIdSpan = document.getElementById('roomId');
const roomMembersP = document.getElementById('roomMembers');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomInput = document.getElementById('joinRoomInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const readyBtn = document.getElementById('readyBtn');
const sayHelloBtn = document.getElementById('sayHelloBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const messagesDiv = document.getElementById('messages');
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.getElementById('loading-progress');

// Estado
let currentRoomId = null;
let isReady = false;

// Conectar al servidor mediante Socket.IO
const socket = io();

// Cuando se establece la conexión con el servidor
socket.on('connected', (data) => {
  clientIdSpan.textContent = data.id;
  console.log('Conectado al servidor con ID:', data.id);
  
  // Ocultar pantalla de carga
  loadingScreen.style.display = 'none';
});

// Evento para crear sala
createRoomBtn.addEventListener('click', () => {
  socket.emit('create_room');
});

// Evento para unirse a sala
joinRoomBtn.addEventListener('click', () => {
  const roomId = joinRoomInput.value.trim().toUpperCase();
  if (roomId) {
    socket.emit('join_room', { roomId });
  }
});

// Evento para marcar como listo
readyBtn.addEventListener('click', () => {
  isReady = !isReady;
  readyBtn.textContent = isReady ? 'No Listo' : 'Listo';
  readyBtn.classList.toggle('secondary', !isReady);
  socket.emit('player_ready', { roomId: currentRoomId, isReady });
});

// Evento para saludar
sayHelloBtn.addEventListener('click', () => {
  socket.emit('say_hello', { roomId: currentRoomId });
});

// Evento para salir de sala
leaveRoomBtn.addEventListener('click', () => {
  socket.emit('leave_room', { roomId: currentRoomId });
});

// Eventos del servidor
socket.on('room_created', (data) => {
  currentRoomId = data.roomId;
  roomIdSpan.textContent = currentRoomId;
  updateMembersList(data.members);
  
  // Cambiar a pantalla de sala
  lobbyScreen.classList.add('hidden');
  roomScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  
  addMessage(`Has creado la sala: ${currentRoomId}`, true);
});

socket.on('joined_room', (data) => {
  console.log(`Joined room: ${data.roomId} with ${data.members.length} members`);
  currentRoomId = data.roomId;
  roomIdSpan.textContent = currentRoomId;
  updateMembersList(data.members);
  
  // Cambiar a pantalla de sala o juego según corresponda
  lobbyScreen.classList.add('hidden');
  
  if (data.gameStarted) {
    roomScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initMultiplayerGame(socket, currentRoomId);
    addMessage(`Te has unido a una partida en progreso en la sala: ${currentRoomId}`, true);
  } else {
    roomScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    addMessage(`Te has unido a la sala: ${currentRoomId}`, true);
  }
});

socket.on('member_joined', (data) => {
  if (currentRoomId === data.roomId) {
    updateMembersList(data.members);
    addMessage(`Jugador ${data.newMember.substring(0, 4)} se ha unido a la sala`, true);
  }
});

socket.on('member_left', (data) => {
  if (currentRoomId === data.roomId) {
    updateMembersList(data.members);
    addMessage(`Jugador ${data.leftMember.substring(0, 4)} ha abandonado la sala`, true);
  }
});

socket.on('left_room', (data) => {
  // Restablecer estado
  currentRoomId = null;
  isReady = false;
  readyBtn.textContent = 'Listo';
  readyBtn.classList.remove('secondary');
  
  // Cambiar a pantalla de lobby
  lobbyScreen.classList.remove('hidden');
  roomScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  
  // Limpiar mensajes
  messagesDiv.innerHTML = '';
});

socket.on('member_greeting', (data) => {
  if (currentRoomId === data.roomId) {
    addMessage(data.message);
  }
});

socket.on('player_ready_update', (data) => {
  if (currentRoomId === data.roomId) {
    updateMembersList(data.members);
    
    // Si todos están listos y el juego ha comenzado
    if (data.allReady && data.gameStarted) {
      addMessage('¡Todos los jugadores están listos! Preparando el juego...', true);
    }
  }
});

socket.on('pokemon_to_guess', (data) => {
  if (currentRoomId === data.roomId) {
    console.log('Game started with Pokemon ID:', data.pokemonId);
    
    // Cambiar a la pantalla de juego
    lobbyScreen.classList.add('hidden');
    roomScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // Inicializar el juego multijugador
    initMultiplayerGame(socket, currentRoomId);
  }
});

socket.on('error', (data) => {
  alert(`Error: ${data.message}`);
});

// Funciones auxiliares
function updateMembersList(members) {
  const membersList = members.map(m => {
    const isCurrentUser = m.id === socket.id;
    const readyStatus = m.isReady ? 'Listo ✓' : 'No Listo ✗';
    const readyClass = m.isReady ? 'player-ready' : 'player-not-ready';
    return `<span class="${readyClass}">${isCurrentUser ? 'Tú' : m.id.substring(0, 4)}: ${readyStatus}</span>`;
  }).join(', ');
  
  roomMembersP.innerHTML = `Miembros: ${membersList}`;
}

function addMessage(text, isSystem = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isSystem ? 'system-message' : ''}`;
  messageDiv.textContent = text;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Inicialización adicional cuando la ventana carga
window.addEventListener('load', () => {
  // Mostrar pantalla de carga mientras nos conectamos
  loadingScreen.style.display = 'flex';
  loadingProgress.textContent = 'Conectando al servidor...';
});