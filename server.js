const fetch = require('node-fetch')
const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const app = express()
const server = http.createServer(app)
const io = socketIo(server)

// Track rooms and their members
const rooms = {}

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)))

// Route for the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

// Route for game room
app.get('/room/:roomId', (req, res) => {
  const roomId = req.params.roomId
  if (rooms[roomId]) {
    res.sendFile(path.join(__dirname, 'index.html'))
  } else {
    res.redirect('/')
  }
})

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`)
  
  // Create a new room
  socket.on('create_room', () => {
    const roomId = uuidv4().substring(0, 6) // Generate shorter room ID for convenience
    
    // Join the socket to this room
    socket.join(roomId)
    
    // Add room to our tracking object
    rooms[roomId] = {
      members: [{
        id: socket.id,
        isReady: false
      }],
      gameStarted: false
    }
    
    console.log(`Room created: ${roomId} by ${socket.id}`)
    
    // Send room ID back to the client
    socket.emit('room_created', {
      roomId: roomId,
      members: rooms[roomId].members
    })
  })
  
  // Join an existing room
  socket.on('join_room', (data) => {
    const roomId = data.roomId
    
    // Check if room exists
    if (!rooms[roomId]) {
      socket.emit('error', { message: 'Room does not exist' })
      return
    }
    
    // Check if user is already in room
    const existingMember = rooms[roomId].members.find(m => m.id === socket.id)
    if (existingMember) {
      return // Already in room, do nothing
    }
    
    // Join the socket to this room
    socket.join(roomId)
    
    // Add member to room
    rooms[roomId].members.push({
      id: socket.id,
      isReady: false
    })
    
    console.log(`User ${socket.id} joined room: ${roomId}`)
    
    // Notify everyone in the room that a new user joined
    io.to(roomId).emit('user_joined', {
      userId: socket.id,
      roomId: roomId
    })
    
    // Confirm to the user they've joined
    socket.emit('joined_room', {
      roomId: roomId,
      members: rooms[roomId].members
    })
  })
  
  // Handle player ready status
  socket.on('player_ready', (data) => {
    const roomId = data.roomId
    const isReady = data.isReady
    
    if (!roomId || !rooms[roomId]) {
      socket.emit('error', { message: 'Invalid room' })
      return
    }
    
    // Update player ready status
    const member = rooms[roomId].members.find(m => m.id === socket.id)
    if (member) {
      member.isReady = isReady
    }
    
    // Check if all players are ready
    const allReady = rooms[roomId].members.every(m => m.isReady)
    
    // If all players are ready and game hasn't started, generate Pokemon ID
    if (allReady && !rooms[roomId].gameStarted) {
      rooms[roomId].pokemonId = Math.floor(Math.random() * 1025) + 1
      rooms[roomId].gameStarted = true
      console.log(`Generated Pokemon ID ${rooms[roomId].pokemonId} for room ${roomId}`)
    }
    
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`)
  
  // Create a new room
  socket.on('create_room', () => {
    // Your existing code
  })
  
  // Join an existing room
  socket.on('join_room', (data) => {
    // Your existing code
  })
  
  // Handle player ready status
  socket.on('player_ready', (data) => {
    // Your existing code
  })
  
  // Other existing handlers...

  // ADD THESE HANDLERS INSIDE THE CONNECTION CALLBACK:
  
  // Handle player guess
  socket.on('player_guess', async (data) => {
    const roomId = data.roomId;
    const guess = data.guess.toLowerCase();
    
    if (!roomId || !rooms[roomId] || !rooms[roomId].gameStarted) {
      socket.emit('error', { message: 'Invalid room or game not started' });
      return;
    }
    
    try {
      // Fetch the current Pokemon's data if we don't have it
      if (!rooms[roomId].pokemonName) {
        const pokemonId = rooms[roomId].pokemonId;
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        const pokemon = await response.json();
        rooms[roomId].pokemonName = pokemon.name;
      }
      
      // Check if the guess is correct
      if (guess === rooms[roomId].pokemonName) {
        console.log(`Player ${socket.id} guessed correctly: ${guess}`);
        
        // Notify all players about the winner
        io.to(roomId).emit('game_ended', {
          roomId: roomId,
          winnerId: socket.id,
          pokemonName: rooms[roomId].pokemonName,
          pokemonId: rooms[roomId].pokemonId
        });
        
        // Reset the game but keep players in the room
        rooms[roomId].gameStarted = false;
        rooms[roomId].members.forEach(member => {
          member.isReady = false;
        });
      } else {
        // Notify all players about the wrong guess
        io.to(roomId).emit('guess_result', {
          roomId: roomId,
          userId: socket.id,
          guess: guess,
          correct: false
        });
      }
    } catch (error) {
      console.error('Error handling guess:', error);
      socket.emit('error', { message: 'Error processing your guess' });
    }
  });

  // Handle play again request
  socket.on('play_again', (data) => {
    const roomId = data.roomId;
    
    if (!roomId || !rooms[roomId]) {
      socket.emit('error', { message: 'Invalid room' });
      return;
    }
    
    // Set this player as ready
    const member = rooms[roomId].members.find(m => m.id === socket.id);
    if (member) {
      member.isReady = true;
    }
    
    // Check if everyone is ready to play again
    const allReady = rooms[roomId].members.every(m => m.isReady);
    
    // Update all clients with ready status
    io.to(roomId).emit('player_ready_update', {
      roomId: roomId,
      members: rooms[roomId].members,
      allReady: allReady,
      gameStarted: false
    });
    
    // If everyone is ready, start a new game
    if (allReady) {
      rooms[roomId].pokemonId = Math.floor(Math.random() * 1025) + 1;
      rooms[roomId].gameStarted = true;
      
      // Fetch the Pokémon name so we can check guesses
      fetch(`https://pokeapi.co/api/v2/pokemon/${rooms[roomId].pokemonId}`)
        .then(response => response.json())
        .then(data => {
          rooms[roomId].pokemonName = data.name;
          console.log(`Generated Pokemon ${rooms[roomId].pokemonName} (ID: ${rooms[roomId].pokemonId}) for room ${roomId}`);
          
          // Notify all clients that the game has started
          io.to(roomId).emit('game_started', {
            roomId: roomId,
            pokemonId: rooms[roomId].pokemonId
          });
        })
        .catch(error => {
          console.error('Error fetching Pokemon data:', error);
        });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // Your existing disconnect handler
  });
});
// Handle player guess
socket.on('player_guess', async (data) => {
  const roomId = data.roomId;
  const guess = data.guess.toLowerCase();
  
  if (!roomId || !rooms[roomId] || !rooms[roomId].gameStarted) {
    socket.emit('error', { message: 'Invalid room or game not started' });
    return;
  }
  
  try {
    // Fetch the current Pokemon's data if we don't have it
    if (!rooms[roomId].pokemonName) {
      const pokemonId = rooms[roomId].pokemonId;
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
      const pokemon = await response.json();
      rooms[roomId].pokemonName = pokemon.name;
    }
    
    // Check if the guess is correct
    if (guess === rooms[roomId].pokemonName) {
      console.log(`Player ${socket.id} guessed correctly: ${guess}`);
      
      // Notify all players about the winner
      io.to(roomId).emit('game_ended', {
        roomId: roomId,
        winnerId: socket.id,
        pokemonName: rooms[roomId].pokemonName,
        pokemonId: rooms[roomId].pokemonId
      });
      
      // Reset the game but keep players in the room
      rooms[roomId].gameStarted = false;
      rooms[roomId].members.forEach(member => {
        member.isReady = false;
      });
      
    } else {
      // Notify all players about the wrong guess
      io.to(roomId).emit('guess_result', {
        roomId: roomId,
        userId: socket.id,
        guess: guess,
        correct: false
      });
    }
  } catch (error) {
    console.error('Error handling guess:', error);
    socket.emit('error', { message: 'Error processing your guess' });
  }
});

// Handle play again request
socket.on('play_again', (data) => {
  const roomId = data.roomId;
  
  if (!roomId || !rooms[roomId]) {
    socket.emit('error', { message: 'Invalid room' });
    return;
  }
  
  // Set this player as ready
  const member = rooms[roomId].members.find(m => m.id === socket.id);
  if (member) {
    member.isReady = true;
  }
  
  // Check if everyone is ready to play again
  const allReady = rooms[roomId].members.every(m => m.isReady);
  
  // Update all clients with ready status
  io.to(roomId).emit('player_ready_update', {
    roomId: roomId,
    members: rooms[roomId].members,
    allReady: allReady,
    gameStarted: false
  });
  
  // If everyone is ready, start a new game
  if (allReady) {
    rooms[roomId].pokemonId = Math.floor(Math.random() * 1025) + 1;
    rooms[roomId].gameStarted = true;
    
    // Fetch the Pokémon name so we can check guesses
    fetch(`https://pokeapi.co/api/v2/pokemon/${rooms[roomId].pokemonId}`)
      .then(response => response.json())
      .then(data => {
        rooms[roomId].pokemonName = data.name;
        console.log(`Generated Pokemon ${rooms[roomId].pokemonName} (ID: ${rooms[roomId].pokemonId}) for room ${roomId}`);
        
        // Notify all clients that the game has started
        io.to(roomId).emit('game_started', {
          roomId: roomId,
          pokemonId: rooms[roomId].pokemonId
        });
      })
      .catch(error => {
        console.error('Error fetching Pokemon data:', error);
      });
  }
});



// Start the server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})