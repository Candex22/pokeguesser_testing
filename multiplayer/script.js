// Al principio del archivo, después de las importaciones existentes
import { initMultiplayerGame } from './multiplayer.js';

// Modificar el evento 'game_started' en el script.js existente para integrarlo
socket.on('game_started', (data) => {
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

// Añadir este evento para cuando el juego ya está en progreso y un jugador se une
socket.on('joined_room', (data) => {
  console.log(`Joined room: ${data.roomId} with ${data.members.length} members`);
  currentRoomId = data.roomId;
  roomIdSpan.textContent = currentRoomId;
  updateMembersList(data.members);
  
  // Switch to room screen
  lobbyScreen.classList.add('hidden');
  roomScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  
  addMessage(`You joined room: ${currentRoomId}`, true);
  
  // Si el juego ya ha comenzado, inicializar el juego multijugador
  if (data.gameStarted) {
    gameScreen.classList.remove('hidden');
    roomScreen.classList.add('hidden');
    initMultiplayerGame(socket, currentRoomId);
  }
});