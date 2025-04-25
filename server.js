// Importar las dependencias necesarias 
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fetch = require('node-fetch'); // Necesitarás instalar: npm install node-fetch

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos desde la carpeta raíz y la carpeta src
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'src')));

// Ruta para la página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para la página multijugador
app.get('/multiplayer', (req, res) => {
  res.sendFile(path.join(__dirname, 'multiplayer/index.html'));
});

// Almacenar información de las salas
const rooms = {};

// Manejar conexiones de Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Enviar ID del cliente
  socket.emit('connected', { id: socket.id });
  
  // Crear sala
  socket.on('create_room', () => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      members: [{ id: socket.id, isReady: false }],
      gameStarted: false,
      pokemonId: null,
      pokemonData: null,
      guessHistory: [],
      winner: null
    };
    
    socket.join(roomId);
    socket.emit('room_created', { roomId, members: rooms[roomId].members });
    console.log(`Room created: ${roomId} by client: ${socket.id}`);
  });
  
  // Unirse a sala
  socket.on('join_room', (data) => {
    const roomId = data.roomId;
    
    if (!roomId || !rooms[roomId]) {
      socket.emit('error', { message: 'Invalid room ID' });
      return;
    }
    
    // Unirse a la sala
    socket.join(roomId);
    rooms[roomId].members.push({ id: socket.id, isReady: false });
    
    // Notificar a todos los miembros
    io.to(roomId).emit('member_joined', { 
      roomId, 
      newMember: socket.id, 
      members: rooms[roomId].members,
      gameStarted: rooms[roomId].gameStarted 
    });
    
    // Notificar al cliente que se unió
    socket.emit('joined_room', { 
      roomId, 
      members: rooms[roomId].members,
      gameStarted: rooms[roomId].gameStarted
    });
    
    console.log(`Client ${socket.id} joined room: ${roomId}`);
  });
  
  // Salir de sala
  socket.on('leave_room', (data) => {
    const roomId = data.roomId;
    
    if (roomId && rooms[roomId]) {
      // Eliminar el cliente de la lista de miembros
      rooms[roomId].members = rooms[roomId].members.filter(m => m.id !== socket.id);
      
      // Salir de la sala
      socket.leave(roomId);
      
      // Si la sala está vacía, eliminarla
      if (rooms[roomId].members.length === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} deleted`);
      } else {
        // Notificar a los demás miembros
        io.to(roomId).emit('member_left', { 
          roomId, 
          leftMember: socket.id, 
          members: rooms[roomId].members 
        });
      }
      
      socket.emit('left_room', { roomId });
      console.log(`Client ${socket.id} left room: ${roomId}`);
    }
  });
  
  // Enviar mensaje
  socket.on('say_hello', (data) => {
    const roomId = data.roomId;
    
    if (roomId && rooms[roomId]) {
      io.to(roomId).emit('member_greeting', { 
        roomId, 
        memberId: socket.id, 
        message: `¡Hola a todos! Soy ${socket.id.substring(0, 4)}...` 
      });
    }
  });
  
  // Manejar adivinanzas de Pokémon
  socket.on('guess_pokemon', async (data) => {
    const roomId = data.roomId;
    const pokemonName = data.pokemonName.toLowerCase();
    
    if (!roomId || !rooms[roomId] || !rooms[roomId].gameStarted || !rooms[roomId].pokemonId) {
      socket.emit('error', { message: 'No hay juego activo en esta sala' });
      return;
    }
    
    try {
      // Obtener datos del Pokémon adivinado
      const guessResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
      if (!guessResponse.ok) {
        socket.emit('error', { message: 'Pokémon no encontrado' });
        return;
      }
      const guessedPokemon = await guessResponse.json();
      
      // Obtener datos de especie
      const speciesResponse = await fetch(guessedPokemon.species.url);
      const speciesData = await speciesResponse.json();
      
      // Comparar con el Pokémon objetivo
      let isCorrect = false;
      
      // Si es la primera adivinanza, cargar los datos del Pokémon objetivo
      if (!rooms[roomId].pokemonData) {
        await loadTargetPokemonData(roomId);
      }
      
      const targetPokemon = rooms[roomId].pokemonData;
      
      // Verificar si la adivinanza es correcta
      isCorrect = guessedPokemon.name === targetPokemon.name;
      
      // Crear objeto de comparación
      const comparison = {
        type1: guessedPokemon.types[0]?.type.name === targetPokemon.types[0]?.type.name,
        type2: (guessedPokemon.types[1]?.type.name || 'none') === (targetPokemon.types[1]?.type.name || 'none'),
        color: speciesData.color.name === targetPokemon.species.color.name,
        generation: getGenerationNumber(speciesData.generation.name) === getGenerationNumber(targetPokemon.species.generation.name),
        height: guessedPokemon.height === targetPokemon.height,
        weight: guessedPokemon.weight === targetPokemon.weight,
        habitat: (speciesData.habitat?.name || 'unknown') === (targetPokemon.species.habitat?.name || 'unknown'),
        evolutionStage: await compareEvolutionStage(speciesData, targetPokemon.evolutionStage)
      };
      
      // Crear objeto de Pokémon para enviar
      const pokemonToSend = {
        name: guessedPokemon.name,
        sprite: guessedPokemon.sprites.front_default,
        types: guessedPokemon.types.map(t => t.type.name),
        color: speciesData.color.name,
        generation: getGenerationNumber(speciesData.generation.name),
        height: guessedPokemon.height / 10,
        weight: guessedPokemon.weight / 10, 
        habitat: speciesData.habitat?.name || 'unknown',
        evolutionStage: await determineEvolutionStage(speciesData)
      };
      
      // Guardar la adivinanza en el historial
      rooms[roomId].guessHistory.push({
        userId: socket.id,
        pokemon: pokemonToSend,
        comparison: comparison,
        isCorrect: isCorrect
      });
      
      // Si es correcto, establecer ganador
      if (isCorrect) {
        rooms[roomId].winner = socket.id;
      }
      
      // Enviar resultado a todos los jugadores
      io.to(roomId).emit('guess_result', {
        userId: socket.id,
        pokemonName: guessedPokemon.name,
        comparison: comparison,
        isCorrect: isCorrect,
        gameOver: isCorrect,
        correctPokemon: isCorrect ? targetPokemon : null
      });
      
      // Si la adivinanza es correcta, terminar el juego
      if (isCorrect) {
        io.to(roomId).emit('game_over', {
          winner: socket.id,
          correctPokemon: targetPokemon
        });
        
        // Reiniciar juego
        rooms[roomId].gameStarted = false;
        rooms[roomId].pokemonId = null;
        rooms[roomId].pokemonData = null;
        rooms[roomId].guessHistory = [];
        rooms[roomId].winner = null;
      }
      
    } catch (error) {
      console.error('Error processing guess:', error);
      socket.emit('error', { message: 'Error al procesar tu adivinanza' });
    }
  });
  
  // Manejar estado "listo" del jugador
  socket.on('player_ready', async (data) => {
    const roomId = data.roomId;
    const isReady = data.isReady;
    
    if (!roomId || !rooms[roomId]) {
      socket.emit('error', { message: 'Invalid room' });
      return;
    }
    
    // Update player ready status
    const member = rooms[roomId].members.find(m => m.id === socket.id);
    if (member) {
      member.isReady = isReady;
    }
    
    // Check if all players are ready
    const allReady = rooms[roomId].members.every(m => m.isReady);
    
    // If all players are ready and game hasn't started, generate Pokemon ID
    if (allReady && !rooms[roomId].gameStarted) {
      rooms[roomId].pokemonId = Math.floor(Math.random() * 1025) + 1;
      rooms[roomId].gameStarted = true;
      console.log(`Generated Pokemon ID ${rooms[roomId].pokemonId} for room ${roomId}`);
      
      // Inicializar otros datos del juego
      rooms[roomId].guessHistory = [];
      rooms[roomId].winner = null;
      
      // Cargar los datos del Pokémon objetivo (lazy loading)
      try {
        await loadTargetPokemonData(roomId);
      } catch (error) {
        console.error(`Error loading target Pokemon data for room ${roomId}:`, error);
      }
    }
    
    // Notify all players in the room about the ready status update
    io.to(roomId).emit('player_ready_update', {
      roomId: roomId,
      members: rooms[roomId].members,
      allReady: allReady,
      gameStarted: rooms[roomId].gameStarted
    });
  
    // Si el juego ha comenzado, enviar el ID del Pokémon a todos los jugadores
    if (rooms[roomId].gameStarted) {
      io.to(roomId).emit('pokemon_to_guess', {
        roomId: roomId,
        pokemonId: rooms[roomId].pokemonId
      });
    }
  });
  
  // Manejar desconexión del cliente
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Buscar y eliminar al cliente de todas las salas
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const memberIndex = room.members.findIndex(m => m.id === socket.id);
      
      if (memberIndex !== -1) {
        // Eliminar al miembro
        room.members.splice(memberIndex, 1);
        
        // Si la sala está vacía, eliminarla
        if (room.members.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted after disconnect`);
        } else {
          // Notificar a los demás miembros
          io.to(roomId).emit('member_left', { 
            roomId, 
            leftMember: socket.id, 
            members: room.members 
          });
        }
      }
    }
  });
});

// Funciones auxiliares
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Determinar el número de generación
function getGenerationNumber(generationName) {
  if (!generationName) return 1;
  
  const match = generationName.match(/generation-([ivx]+)/i);
  if (!match) return 1;
  
  const romanNumeral = match[1].toUpperCase();
  const romanToNumber = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9
  };
  
  return romanToNumber[romanNumeral] || 1;
}

// Cargar datos del Pokémon objetivo
async function loadTargetPokemonData(roomId) {
  if (!rooms[roomId] || !rooms[roomId].pokemonId) return null;
  
  try {
    const pokemonId = rooms[roomId].pokemonId;
    
    // Obtener datos del Pokémon
    const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
    const pokemonData = await pokemonResponse.json();
    
    // Obtener datos de la especie
    const speciesResponse = await fetch(pokemonData.species.url);
    const speciesData = await speciesResponse.json();
    
    // Determinar etapa de evolución
    const evolutionStage = await determineEvolutionStage(speciesData);
    
    // Guardar datos completos
    rooms[roomId].pokemonData = {
      name: pokemonData.name,
      sprite: pokemonData.sprites.front_default,
      types: pokemonData.types,
      height: pokemonData.height,
      weight: pokemonData.weight,
      species: speciesData,
      evolutionStage: evolutionStage
    };
    
    return rooms[roomId].pokemonData;
  } catch (error) {
    console.error(`Error loading Pokemon data for room ${roomId}:`, error);
    return null;
  }
}

// Determinar etapa de evolución
async function determineEvolutionStage(speciesData) {
  try {
    const evolutionResponse = await fetch(speciesData.evolution_chain.url);
    const evolutionData = await evolutionResponse.json();
    
    let stage = 1;
    let chain = evolutionData.chain;
    let currentPokemonName = speciesData.name;
    
    // Verificar si es la forma base
    if (chain.species.name === currentPokemonName) {
      return stage;
    }
    
    // Verificar si es la primera evolución
    if (chain.evolves_to && chain.evolves_to.length > 0) {
      stage = 2;
      for (const evolution of chain.evolves_to) {
        if (evolution.species.name === currentPokemonName) {
          return stage;
        }
        
        // Verificar si es la segunda evolución
        if (evolution.evolves_to && evolution.evolves_to.length > 0) {
          stage = 3;
          for (const finalEvolution of evolution.evolves_to) {
            if (finalEvolution.species.name === currentPokemonName) {
              return stage;
            }
          }
        }
      }
    }
    
    return stage; // Default a 1 si no podemos determinar
  } catch (error) {
    console.error("Error determining evolution stage:", error);
    return 1; // Default a 1 si hay un error
  }
}

// Comparar etapa de evolución
async function compareEvolutionStage(speciesData, targetStage) {
  const stage = await determineEvolutionStage(speciesData);
  return stage === targetStage;
}

// Start the server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
});