// Connect to Socket.io server
const socket = io()
let clientId = ''
let currentRoomId = null
let isReady = false

// DOM elements
const lobbyScreen = document.getElementById('lobbyScreen')
const roomScreen = document.getElementById('roomScreen')
const gameScreen = document.getElementById('gameScreen')
const createRoomBtn = document.getElementById('createRoomBtn')
const joinRoomBtn = document.getElementById('joinRoomBtn')
const joinRoomInput = document.getElementById('joinRoomInput')
const roomIdSpan = document.getElementById('roomId')
const roomMembersP = document.getElementById('roomMembers')
const sayHelloBtn = document.getElementById('sayHelloBtn')
const leaveRoomBtn = document.getElementById('leaveRoomBtn')
const readyBtn = document.getElementById('readyBtn')
const messagesDiv = document.getElementById('messages')
const clientIdSpan = document.getElementById('clientId')

// When connection is established
socket.on('connect', () => {
  clientId = socket.id
  clientIdSpan.textContent = clientId
  console.log(`Connected to server with ID: ${clientId}`)
  
  // If we're in a game room, rejoin it and request Pokemon
  if (window.location.pathname.startsWith('/room/')) {
    const roomId = window.location.pathname.split('/').pop()
    socket.emit('join_room', { roomId })
  }
})

// Create Room button handler
createRoomBtn.addEventListener('click', () => {
  socket.emit('create_room')
  console.log('Requesting to create a room...')
})

// Join Room button handler
joinRoomBtn.addEventListener('click', () => {
  const roomId = joinRoomInput.value.trim()
  if (roomId) {
    socket.emit('join_room', { roomId })
    console.log(`Requesting to join room: ${roomId}`)
  } else {
    addMessage('Please enter a room ID', true)
  }
})

// Say Hello button handler
sayHelloBtn.addEventListener('click', () => {
  if (currentRoomId) {
    socket.emit('say_hello', { roomId: currentRoomId })
    console.log(`Hello from ${clientId} in room ${currentRoomId}`)
    addMessage(`You said: Hello!`)
  }
})

// Ready button handler
readyBtn.addEventListener('click', () => {
  if (currentRoomId) {
    isReady = !isReady
    socket.emit('player_ready', { roomId: currentRoomId, isReady })
    readyBtn.textContent = isReady ? 'Not Ready' : 'Ready'
    readyBtn.classList.toggle('secondary', isReady)
  }
})

// Leave Room button handler
leaveRoomBtn.addEventListener('click', () => {
  if (currentRoomId) {
    socket.emit('leave_room', { roomId: currentRoomId })
    leaveRoom()
  }
})

// Socket event handlers
socket.on('room_created', (data) => {
  console.log(`Room created with ID: ${data.roomId}`)
  currentRoomId = data.roomId
  roomIdSpan.textContent = currentRoomId
  roomMembersP.textContent = `Members: You (${clientId})`
  
  // Switch to room screen
  lobbyScreen.classList.add('hidden')
  roomScreen.classList.remove('hidden')
  gameScreen.classList.add('hidden')
  
  addMessage(`You created room: ${currentRoomId}`, true)
})

socket.on('joined_room', (data) => {
  console.log(`Joined room: ${data.roomId} with ${data.members.length} members`)
  currentRoomId = data.roomId
  roomIdSpan.textContent = currentRoomId
  updateMembersList(data.members)
  
  // Switch to room screen
  lobbyScreen.classList.add('hidden')
  roomScreen.classList.remove('hidden')
  gameScreen.classList.add('hidden')
  
  addMessage(`You joined room: ${currentRoomId}`, true)
})

socket.on('user_joined', (data) => {
  console.log(`User ${data.userId} joined room ${data.roomId}`)
  addMessage(`User ${data.userId} joined the room`, true)
  
  // Update members list if we're in this room
  if (currentRoomId === data.roomId) {
    socket.emit('get_room_info', { roomId: currentRoomId })
  }
})

socket.on('user_left', (data) => {
  console.log(`User ${data.userId} left room ${data.roomId}`)
  addMessage(`User ${data.userId} left the room`, true)
  
  // Update members list if we're in this room
  if (currentRoomId === data.roomId) {
    socket.emit('get_room_info', { roomId: currentRoomId })
  }
})

socket.on('hello_received', (data) => {
  console.log(`Hello from ${data.userId} in room ${data.roomId}`)
  addMessage(`${data.userId} says: Hello!`)
})

socket.on('room_info', (data) => {
  if (currentRoomId === data.roomId) {
    updateMembersList(data.members)
  }
})

socket.on('player_ready_update', (data) => {
  if (currentRoomId === data.roomId) {
    updateMembersList(data.members)
    if (data.allReady && data.gameStarted) {
      // Switch to game screen
      lobbyScreen.classList.add('hidden')
      roomScreen.classList.add('hidden')
      gameScreen.classList.remove('hidden')
      
      // Set room ID in game screen
      document.getElementById('gameRoomId').textContent = currentRoomId
    }
  }
})

socket.on('game_started', (data) => {
  if (currentRoomId === data.roomId) {
    console.log('Game started with Pokemon ID:', data.pokemonId);
    
    // Switch to game screen
    lobbyScreen.classList.add('hidden');
    roomScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // Set room ID in game screen
    document.getElementById('gameRoomId').textContent = currentRoomId;
    
    // Reset game elements
    gameResults.classList.add('hidden');
    gameStatus.textContent = '';
    
    // Fetch Pokemon data
    ;(async () => {
      try {
        console.log('Fetching Pokemon with ID:', data.pokemonId);
        
        // Fetch Pokemon data from browser
        const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${data.pokemonId}`);
        const pokemon = await pokemonResponse.json();
        
        // Fetch species data
        const speciesResponse = await fetch(pokemon.species.url);
        const species = await speciesResponse.json();
        
        // Fetch evolution chain
        const evolutionResponse = await fetch(species.evolution_chain.url);
        const evolutionChain = await evolutionResponse.json();
        
        // Calculate evolution stage
        let evolutionStage = 1;
        const chain = evolutionChain.chain;
        if (chain.evolves_to.length > 0) {
          if (chain.species.name === pokemon.name) {
            evolutionStage = 1;
          } else if (chain.evolves_to.some(evo => evo.species.name === pokemon.name)) {
            evolutionStage = 2;
          } else if (chain.evolves_to.some(evo => 
            evo.evolves_to.some(finalEvo => finalEvo.species.name === pokemon.name))) {
            evolutionStage = 3;
          }
        }
        
        // Update UI - but don't show the name!
        const pokemonInfo = document.getElementById('pokemon-info');
        
        if (pokemonInfo) {
          pokemonInfo.innerHTML = `
            <p>Type 1: ${pokemon.types[0].type.name}</p>
            <p>Type 2: ${pokemon.types[1] ? pokemon.types[1].type.name : 'None'}</p>
            <p>Color: ${species.color.name}</p>
            <p>Evolution Stage: ${evolutionStage}</p>
            <p>Weight: ${pokemon.weight/10} kg</p>
            <p>Height: ${pokemon.height/10} m</p>
            <p>Habitat: ${species.habitat ? species.habitat.name : 'Unknown'}</p>
            <p>Generation: ${species.generation.name.replace('generation-', '')}</p>
          `;
        }
      } catch (error) {
        console.error('Error fetching Pokemon:', error);
      }
    })();
  }
});


// Helper functions
function updateMembersList(members) {
  const membersList = members.map(member => {
    const readyStatus = member.isReady ? 
      '<span class="player-ready">✓ Ready</span>' : 
      '<span class="player-not-ready">✗ Not Ready</span>'
    return `${member.id} ${readyStatus}`
  }).join('<br>')
  roomMembersP.innerHTML = `Members:<br>${membersList}`
}

function leaveRoom() {
  currentRoomId = null
  isReady = false
  
  // Switch back to lobby screen
  roomScreen.classList.add('hidden')
  lobbyScreen.classList.remove('hidden')
  
  addMessage('You left the room', true)
}

function addMessage(text, isSystem = false) {
  const messageDiv = document.createElement('div')
  messageDiv.className = `message${isSystem ? ' system-message' : ''}`
  messageDiv.textContent = text
  messagesDiv.appendChild(messageDiv)
  messagesDiv.scrollTop = messagesDiv.scrollHeight
}

// Handle game room initialization
if (window.location.pathname.startsWith('/room/')) {
  const roomId = window.location.pathname.split('/')[2]
  currentRoomId = roomId
  
  // Join the room
  socket.emit('join_room', { roomId })
}

// Game elements
const guessInput = document.getElementById('guess-input');
const guessBtn = document.getElementById('guess-btn');
const gameStatus = document.getElementById('game-status');
const gameResults = document.getElementById('game-results');
const winnerInfo = document.getElementById('winner-info');
const playAgainBtn = document.getElementById('play-again-btn');

// Guess button handler
guessBtn?.addEventListener('click', () => {
  submitGuess();
});

// Also handle Enter key press for guessing
guessInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitGuess();
  }
});

// Play again button handler
playAgainBtn?.addEventListener('click', () => {
  if (currentRoomId) {
    socket.emit('play_again', { roomId: currentRoomId });
    gameResults.classList.add('hidden');
    readyBtn.textContent = 'Not Ready';
    readyBtn.classList.add('secondary');
    isReady = true;
  }
});

function submitGuess() {
  if (currentRoomId && guessInput.value.trim()) {
    const guess = guessInput.value.trim();
    socket.emit('player_guess', { roomId: currentRoomId, guess: guess });
    guessInput.value = '';
    addMessage(`You guessed: ${guess}`);
  }
}

// Socket event for game ended (someone won)
socket.on('game_ended', (data) => {
  if (currentRoomId === data.roomId) {
    const isWinner = data.winnerId === clientId;
    const winnerText = isWinner ? 
      'You won! You guessed the Pokémon correctly!' : 
      `Player ${data.winnerId} won by correctly guessing ${data.pokemonName}!`;
    
    winnerInfo.textContent = winnerText;
    gameResults.classList.remove('hidden');
    
    // Add message to chat
    addMessage(winnerText, true);
    
    // Reset ready status
    isReady = false;
    readyBtn.textContent = 'Ready';
    readyBtn.classList.remove('secondary');
  }
});

// Socket event for wrong guess
socket.on('guess_result', (data) => {
  if (currentRoomId === data.roomId && !data.correct) {
    gameStatus.textContent = `"${data.guess}" is not correct. Try again!`;
    setTimeout(() => {
      gameStatus.textContent = '';
    }, 3000);
  }
});socket.on('game_started', (data) => {
  if (currentRoomId === data.roomId) {
    console.log('Game started with Pokemon ID:', data.pokemonId);
    
    // Switch to game screen
    lobbyScreen.classList.add('hidden');
    roomScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // Set room ID in game screen
    document.getElementById('gameRoomId').textContent = currentRoomId;
    
    // Reset game elements
    gameResults.classList.add('hidden');
    gameStatus.textContent = '';
    
    // Fetch Pokemon data
    ;(async () => {
      try {
        console.log('Fetching Pokemon with ID:', data.pokemonId);
        
        // Fetch Pokemon data from browser
        const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${data.pokemonId}`);
        const pokemon = await pokemonResponse.json();
        
        // Fetch species data
        const speciesResponse = await fetch(pokemon.species.url);
        const species = await speciesResponse.json();
        
        // Fetch evolution chain
        const evolutionResponse = await fetch(species.evolution_chain.url);
        const evolutionChain = await evolutionResponse.json();
        
        // Calculate evolution stage
        let evolutionStage = 1;
        const chain = evolutionChain.chain;
        if (chain.evolves_to.length > 0) {
          if (chain.species.name === pokemon.name) {
            evolutionStage = 1;
          } else if (chain.evolves_to.some(evo => evo.species.name === pokemon.name)) {
            evolutionStage = 2;
          } else if (chain.evolves_to.some(evo => 
            evo.evolves_to.some(finalEvo => finalEvo.species.name === pokemon.name))) {
            evolutionStage = 3;
          }
        }
        
        // Update UI - but don't show the name!
        const pokemonInfo = document.getElementById('pokemon-info');
        
        if (pokemonInfo) {
          pokemonInfo.innerHTML = `
            <p>Type 1: ${pokemon.types[0].type.name}</p>
            <p>Type 2: ${pokemon.types[1] ? pokemon.types[1].type.name : 'None'}</p>
            <p>Color: ${species.color.name}</p>
            <p>Evolution Stage: ${evolutionStage}</p>
            <p>Weight: ${pokemon.weight/10} kg</p>
            <p>Height: ${pokemon.height/10} m</p>
            <p>Habitat: ${species.habitat ? species.habitat.name : 'Unknown'}</p>
            <p>Generation: ${species.generation.name.replace('generation-', '')}</p>
          `;
        }
      } catch (error) {
        console.error('Error fetching Pokemon:', error);
      }
    })();
  }
});
