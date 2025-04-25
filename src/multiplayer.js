import { fetchPokemonData } from './api.js';
import { getGenerationNumber } from './utils.js';

// Estado del juego compartido para todos los jugadores en una sala
let gameState = {
  isGameActive: false,
  winner: null,
  guessCount: 0,
  maxGuesses: 10,
  playerGuesses: {}
};

// Inicializar el juego multiplayer
export function initMultiplayerGame(socket, roomId) {
  const pokemonInput = document.getElementById('pokemon-input');
  const pokemonList = document.getElementById('pokemon-list');
  const errorMessage = document.getElementById('error-message');
  
  // Ocultar pantalla de carga cuando estemos listos
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
  
  // Escuchar eventos del socket relacionados con el juego
  setupSocketListeners(socket, roomId);
  
  // Configurar el manejador del input para el envío de adivinanzas
  pokemonInput.addEventListener('keypress', async (event) => {
    if (event.key === 'Enter') {
      const pokemonName = pokemonInput.value.trim().toLowerCase();
      
      if (!pokemonName) return;
      
      try {
        // Limpiar el input
        pokemonInput.value = '';
        
        // Enviar la adivinanza al servidor
        socket.emit('guess_pokemon', { 
          roomId, 
          pokemonName 
        });
        
      } catch (error) {
        errorMessage.textContent = "Error al procesar tu adivinanza";
        console.error("Error:", error);
      }
    }
  });
}

// Configurar listeners para eventos del socket
function setupSocketListeners(socket, roomId) {
  // El servidor envía el Pokémon a adivinar
  socket.on('pokemon_to_guess', (data) => {
    console.log('Pokemon para adivinar recibido:', data.pokemonId);
    // No mostramos ningún dato sobre el Pokémon al jugador
    gameState.isGameActive = true;
    
    // Limpiar la lista de adivinanzas anteriores
    const pokemonList = document.getElementById('pokemon-list');
    pokemonList.innerHTML = '';
    
    // Mostrar mensaje de inicio de juego
    addSystemMessage('¡El juego ha comenzado! Adivina el Pokémon.');
  });
  
  // Respuesta a una adivinanza
  socket.on('guess_result', async (data) => {
    try {
      // Obtener los datos del Pokémon adivinado para poder compararlo
      const guessedPokemon = await fetchPokemonData(data.pokemonName);
      
      // Crear y mostrar la tarjeta del Pokémon adivinado con los resultados
      createPokemonGuessCard(guessedPokemon, data.comparison, data.userId);
      
      // Si la adivinanza es correcta y fuimos nosotros, mostrar mensaje de victoria
      if (data.isCorrect && data.userId === socket.id) {
        addSystemMessage('¡Has adivinado el Pokémon correctamente! ¡Ganaste!');
      } 
      // Si otro jugador ganó
      else if (data.isCorrect) {
        addSystemMessage(`¡El jugador ${data.userId} ha adivinado el Pokémon! El juego ha terminado.`);
      }
      
      // Si el juego ha terminado, mostrar el Pokémon correcto
      if (data.gameOver) {
        gameState.isGameActive = false;
        
        if (data.correctPokemon) {
          setTimeout(() => {
            showCorrectPokemon(data.correctPokemon);
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Error al procesar resultado de adivinanza:", error);
    }
  });
  
  // Cuando un jugador se une a la partida ya iniciada
  socket.on('game_status', (data) => {
    if (data.isActive) {
      gameState.isGameActive = true;
      
      // Reconstruir el historial de adivinanzas
      if (data.guessHistory && data.guessHistory.length > 0) {
        const pokemonList = document.getElementById('pokemon-list');
        pokemonList.innerHTML = ''; // Limpiar primero
        
        // Recrear las tarjetas de adivinanzas anteriores
        data.guessHistory.forEach(guess => {
          createPokemonGuessCard(guess.pokemon, guess.comparison, guess.userId);
        });
        
        addSystemMessage('Te has unido a una partida en progreso. Revisa las adivinanzas anteriores.');
      }
    }
  });
  
  // Cuando el juego termina (todos los jugadores se fueron, o se acabaron los intentos)
  socket.on('game_over', (data) => {
    gameState.isGameActive = false;
    
    if (data.winner) {
      addSystemMessage(`El juego ha terminado. Ganador: ${data.winner}`);
    } else {
      addSystemMessage('El juego ha terminado. Nadie ha adivinado el Pokémon.');
    }
    
    if (data.correctPokemon) {
      showCorrectPokemon(data.correctPokemon);
    }
  });
}

// Crear una tarjeta de adivinanza con información de comparación
function createPokemonGuessCard(pokemon, comparison, userId) {
  const pokemonList = document.getElementById('pokemon-list');
  
  // Crear la tarjeta del Pokémon
  const card = document.createElement('div');
  card.className = 'pokemon-card';
  
  // Mostrar tarjeta de introducción
  const introSection = document.createElement('div');
  introSection.className = 'pokemon-intro fade-in';
  
  // Identificar si es nuestra adivinanza o de otro jugador
  const isCurrentUser = userId === socket.id;
  const userLabel = isCurrentUser ? 'Tú' : `Jugador ${userId.substring(0, 4)}`;
  
  // Contenido de la introducción
  introSection.innerHTML = `
    <div class="intro-container">
      <div class="intro-image">
        <img src="${pokemon.sprite}" alt="${pokemon.name}">
      </div>
      <div class="intro-info">
        <span class="intro-name">${pokemon.name}</span>
        <p>${userLabel} ha adivinado este Pokémon</p>
      </div>
    </div>
  `;
  
  // Sección de datos del Pokémon con comparación
  const dataSection = document.createElement('div');
  dataSection.className = 'pokemon-data';
  
  // Imagen
  const imageDiv = document.createElement('div');
  imageDiv.className = 'pokemon-image';
  imageDiv.innerHTML = `<img src="${pokemon.sprite}" alt="${pokemon.name}">`;
  
  // Información con colores según la comparación
  const infoDiv = document.createElement('div');
  infoDiv.className = 'pokemon-info';
  
  // Añadir celdas de información con clases de color según comparación
  const infoCells = [
    { id: 'type1', value: pokemon.types[0], match: comparison.type1 },
    { id: 'type2', value: pokemon.types[1] || 'Ninguno', match: comparison.type2 },
    { id: 'color', value: pokemon.color, match: comparison.color },
    { id: 'generation', value: `Gen ${pokemon.generation}`, match: comparison.generation },
    { id: 'height', value: `${pokemon.height} m`, match: comparison.height },
    { id: 'weight', value: `${pokemon.weight} kg`, match: comparison.weight },
    { id: 'habitat', value: pokemon.habitat, match: comparison.habitat },
    { id: 'evolutionStage', value: `Ev. ${pokemon.evolutionStage}`, match: comparison.evolutionStage }
  ];
  
  infoCells.forEach(cell => {
    const cellDiv = document.createElement('div');
    cellDiv.id = cell.id;
    cellDiv.className = `info-cell ${cell.match ? 'green' : 'red'}`;
    cellDiv.textContent = cell.value;
    infoDiv.appendChild(cellDiv);
  });
  
  // Añadir las secciones a la tarjeta
  dataSection.appendChild(imageDiv);
  dataSection.appendChild(infoDiv);
  card.appendChild(introSection);
  card.appendChild(dataSection);
  
  // Añadir la tarjeta al principio de la lista
  pokemonList.insertBefore(card, pokemonList.firstChild);
  
  // Animación de la tarjeta
  setTimeout(() => {
    introSection.classList.remove('fade-in');
    introSection.classList.add('fade-out');
    
    setTimeout(() => {
      const cells = card.querySelectorAll('.pokemon-image, .info-cell');
      cells.forEach((cell, index) => {
        setTimeout(() => {
          cell.classList.add('animated');
        }, index * 100);
      });
    }, 600);
  }, 1500);
}

// Mostrar mensaje del sistema
function addSystemMessage(text) {
  const messagesDiv = document.getElementById('messages');
  if (messagesDiv) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

// Mostrar el Pokémon correcto cuando termina el juego
function showCorrectPokemon(pokemon) {
  const gameScreen = document.getElementById('gameScreen');
  const pokemonInfo = document.getElementById('pokemon-info');
  const pokemonImage = document.getElementById('pokemon-imagen');
  
  if (gameScreen && pokemonInfo && pokemonImage) {
    gameScreen.classList.remove('hidden');
    
    // Mostrar imagen del Pokémon
    pokemonImage.src = pokemon.sprite;
    
    // Mostrar información completa
    pokemonInfo.innerHTML = `
      <h2>${pokemon.name}</h2>
      <p>Tipo 1: ${pokemon.types[0]}</p>
      <p>Tipo 2: ${pokemon.types[1] || 'Ninguno'}</p>
      <p>Color: ${pokemon.color}</p>
      <p>Generación: ${pokemon.generation}</p>
      <p>Habitat: ${pokemon.habitat}</p>
      <p>Altura: ${pokemon.height} m</p>
      <p>Peso: ${pokemon.weight} kg</p>
      <p>Etapa de evolución: ${pokemon.evolutionStage}</p>
    `;
  }
}

