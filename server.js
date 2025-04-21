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
    
    // Notify all players in the room about the ready status update
    io.to(roomId).emit('player_ready_update', {
      roomId: roomId,
      members: rooms[roomId].members,
      allReady: allReady,
      gameStarted: rooms[roomId].gameStarted
    })

    // If game has started, send Pokemon ID separately
    if (rooms[roomId].gameStarted) {
      io.to(roomId).emit('game_started', {
        roomId: roomId,
        pokemonId: rooms[roomId].pokemonId
      })
    }
  })
  
  // Send message within a room
  socket.on('say_hello', (data) => {
    const roomId = data.roomId
    
    if (!roomId || !rooms[roomId]) {
      socket.emit('error', { message: 'Invalid room' })
      return
    }
    
    console.log(`Server received: Hello from ${socket.id} in room ${roomId}`)
    
    // Broadcast the message to everyone in the room
    io.to(roomId).emit('hello_received', {
      userId: socket.id,
      roomId: roomId
    })
  })

  // Get room information
  socket.on('get_room_info', (data) => {
    const roomId = data.roomId
    if (rooms[roomId]) {
      socket.emit('room_info', {
        roomId: roomId,
        members: rooms[roomId].members
      })
    }
  })

  // Handle get Pokemon ID for room
  socket.on('get_pokemon_id', (data) => {
    const roomId = data.roomId
    console.log('Received get_pokemon_id request for room:', roomId)
    if (rooms[roomId]) {
      console.log('Found room, sending Pokemon ID:', rooms[roomId].pokemonId)
      // Send to all sockets in the room
      io.to(roomId).emit('pokemon_id', {
        roomId: roomId,
        pokemonId: rooms[roomId].pokemonId
      })
    } else {
      console.log('Room not found:', roomId)
    }
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    
    // Remove user from all rooms they were in
    for (const roomId in rooms) {
      const room = rooms[roomId]
      
      // If user was in this room
      const index = room.members.findIndex(m => m.id === socket.id)
      if (index !== -1) {
        // Remove from members array
        room.members.splice(index, 1)
        
        // Notify others in the room
        io.to(roomId).emit('user_left', {
          userId: socket.id,
          roomId: roomId
        })
        
        console.log(`User ${socket.id} left room: ${roomId}`)
        
        // If room is empty, delete it
        if (room.members.length === 0) {
          delete rooms[roomId]
          console.log(`Room deleted: ${roomId}`)
        }
      }
    }
  })
})

// Handle player guess
socket.on('player_guess', (data) => {
  const roomId = data.roomId;
  const guess = data.guess.toLowerCase();
  
  if (!roomId || !rooms[roomId] || !rooms[roomId].gameStarted) {
    socket.emit('error', { message: 'Invalid room or game not started' });
    return;
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
    // Notify the player their guess was wrong
    socket.emit('guess_result', {
      roomId: roomId,
      guess: guess,
      correct: false
    });
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