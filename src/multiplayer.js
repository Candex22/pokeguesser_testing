import { fetchPokemonData } from './api.js';
import { getGenerationNumber, getTextColorClass } from './utils.js';

// Variables globales
let socket; // Referencia al socket
let allPokemon = []; // Lista de todos los Pokémon para el autocompletado
let currentRoomId = null; // ID de la sala actual
let gameActive = false; // Estado del juego

// Inicializar el juego multijugador
export function initMultiplayerGame(socketInstance, roomId) {
  // Guardar referencia al socket y al ID de sala
  socket = socketInstance;
  currentRoomId = roomId;
  gameActive = true;
  
  console.log('Iniciando juego multijugador en sala:', roomId);

  // Elementos DOM
  const pokemonInput = document.getElementById('pokemon-input');
  const pokemonList = document.getElementById('pokemon-list');
  const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
  const errorMessage = document.getElementById('error-message');
  const correctPokemonDiv = document.getElementById('correct-pokemon');
  const gameRoomIdSpan = document.getElementById('gameRoomId');
  
  // Actualizar el ID de sala en la interfaz
  if (gameRoomIdSpan) {
    gameRoomIdSpan.textContent = roomId;
  }
  
  // Ocultar pantalla de carga si está visible
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
  
  // Limpiar elementos anteriores
  if (pokemonList) pokemonList.innerHTML = '';
  if (errorMessage) errorMessage.textContent = '';
  if (correctPokemonDiv) correctPokemonDiv.classList.add('hidden');
  
  // Configurar autocompletado
  setupAutocomplete(pokemonInput, autocompleteDropdown);
  
  // Configurar el manejador del input para el envío de adivinanzas
  pokemonInput.addEventListener('keypress', async (event) => {
    if (event.key === 'Enter' && gameActive) {
      const pokemonName = pokemonInput.value.trim().toLowerCase();
      
      if (!pokemonName) return;
      
      try {
        // Mostrar indicador de carga
        const loadingIndicator = document.getElementById('loading');
        if (loadingIndicator) {
          loadingIndicator.textContent = 'Enviando adivinanza...';
          loadingIndicator.style.display = 'block';
        }
        
        // Limpiar errores anteriores
        if (errorMessage) {
          errorMessage.textContent = '';
        }
        
        console.log(`Enviando adivinanza: ${pokemonName} en sala: ${currentRoomId}`);
        
        // Limpiar el input y dropdown
        pokemonInput.value = '';
        autocompleteDropdown.style.display = 'none';
        
        // Añadir listener temporal para capturar errores
        const errorHandler = (data) => {
          console.error("Error del servidor:", data);
          if (errorMessage) {
            errorMessage.textContent = data.message || "Error al procesar tu adivinanza";
          }
          // Remover el listener después de recibir un error
          socket.off('error', errorHandler);
        };
        
        socket.on('error', errorHandler);
        
        // Enviar la adivinanza al servidor
        socket.emit('guess_pokemon', { 
          roomId: currentRoomId, 
          pokemonName 
        });
        
        // Si no hay respuesta en 5 segundos, mostrar mensaje
        const timeoutId = setTimeout(() => {
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }
          if (errorMessage) {
            errorMessage.textContent = "No se recibió respuesta del servidor. Intenta nuevamente.";
          }
          socket.off('error', errorHandler);
        }, 5000);
        
        // Si recibimos una respuesta, cancelar el timeout
        socket.once('guess_result', () => {
          clearTimeout(timeoutId);
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }
          socket.off('error', errorHandler);
        });
        
      } catch (error) {
        console.error("Error local al enviar adivinanza:", error);
        if (errorMessage) {
          errorMessage.textContent = "Error al enviar tu adivinanza. Verifica tu conexión.";
        }
        const loadingIndicator = document.getElementById('loading');
        if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
        }
      }
    }
  });
  
  // Configurar botón para volver al lobby
  const backToLobbyBtn = document.getElementById('backToLobbyBtn');
  if (backToLobbyBtn) {
    backToLobbyBtn.addEventListener('click', () => {
      const gameScreen = document.getElementById('gameScreen');
      const lobbyScreen = document.getElementById('lobbyScreen');
      
      if (gameScreen && lobbyScreen) {
        gameScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
      }
      
      // Salir de la sala actual
      if (currentRoomId) {
        socket.emit('leave_room', { roomId: currentRoomId });
        currentRoomId = null;
        gameActive = false;
      }
    });
  }
  
  // Configurar listeners para eventos del socket relacionados con el juego
  setupGameSocketListeners();
  
  // Cargar lista de Pokémon para autocompletado
  loadPokemonList();
}

// Cargar lista de Pokémon para autocompletado
async function loadPokemonList() {
  try {
    const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025');
    const data = await response.json();
    
    allPokemon = data.results.map(pokemon => ({
      name: pokemon.name,
      url: pokemon.url
    }));
    
    console.log(`Cargados ${allPokemon.length} Pokémon para autocompletado`);
  } catch (error) {
    console.error('Error cargando lista de Pokémon:', error);
  }
}

// Configurar autocompletado
function setupAutocomplete(inputElement, dropdownElement) {
  if (!inputElement || !dropdownElement) return;
  
  // Cuando el usuario escribe en el input
  inputElement.addEventListener('input', () => {
    const value = inputElement.value.toLowerCase().trim();
    
    // Si no hay valor, ocultar el dropdown
    if (!value) {
      dropdownElement.style.display = 'none';
      return;
    }
    
    // Filtrar pokémon que coinciden con el input
    const matches = allPokemon.filter(pokemon => 
      pokemon.name.toLowerCase().includes(value)
    ).slice(0, 5); // Limitar a 5 resultados
    
    // Si hay coincidencias, mostrar el dropdown
    if (matches.length > 0) {
      dropdownElement.innerHTML = '';
      matches.forEach(pokemon => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        
        // Intentar obtener el ID del Pokémon de la URL para mostrar la imagen
        const pokemonId = pokemon.url.split('/').filter(Boolean).pop();
        
        item.innerHTML = `
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png" 
               alt="${pokemon.name}" 
               onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'">
          <span>${pokemon.name}</span>
        `;
        
        // Al hacer clic en un ítem, seleccionarlo
        item.addEventListener('click', () => {
          inputElement.value = pokemon.name;
          dropdownElement.style.display = 'none';
        });
        
        dropdownElement.appendChild(item);
      });
      
      dropdownElement.style.display = 'block';
    } else {
      dropdownElement.style.display = 'none';
    }
  });
  
  // Ocultar dropdown cuando se pierde el foco
  document.addEventListener('click', (event) => {
    if (!inputElement.contains(event.target) && !dropdownElement.contains(event.target)) {
      dropdownElement.style.display = 'none';
    }
  });
}

// Configurar listeners para eventos del socket relacionados con el juego
function setupGameSocketListeners() {
  // Limpiar listeners anteriores para evitar duplicados
  socket.off('pokemon_to_guess');
  socket.off('guess_result');
  socket.off('game_over');
  socket.off('error');
  
  // El servidor envía el Pokémon a adivinar
  socket.on('pokemon_to_guess', (data) => {
    console.log('Pokemon para adivinar recibido:', data.pokemonId);
    addSystemMessage('¡El juego ha comenzado! Adivina el Pokémon.');
    gameActive = true;
    
    // Limpiar lista de adivinanzas anteriores
    const pokemonList = document.getElementById('pokemon-list');
    if (pokemonList) {
      pokemonList.innerHTML = '';
    }
    
    // Ocultar Pokémon correcto de juegos anteriores
    const correctPokemonDiv = document.getElementById('correct-pokemon');
    if (correctPokemonDiv) {
      correctPokemonDiv.classList.add('hidden');
    }
  });
  
  // Respuesta a una adivinanza
  socket.on('guess_result', (data) => {
    console.log('Resultado de adivinanza recibido:', data);
    
    try {
      // Ocultar indicador de carga
      const loadingIndicator = document.getElementById('loading');
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
      
      // Crear y mostrar la tarjeta del Pokémon adivinado con los resultados
      createPokemonGuessCard(data);
      
      // Si la adivinanza es correcta y fuimos nosotros, mostrar mensaje de victoria
      if (data.isCorrect && data.userId === socket.id) {
        addSystemMessage('¡Has adivinado el Pokémon correctamente! ¡Ganaste!');
      } 
      // Si otro jugador ganó
      else if (data.isCorrect) {
        addSystemMessage(`¡El jugador ${data.userId.substring(0, 4)} ha adivinado el Pokémon! El juego ha terminado.`);
      }
      
      // Si el juego ha terminado, mostrar el Pokémon correcto
      if (data.gameOver && data.correctPokemon) {
        gameActive = false;
        
        setTimeout(() => {
          showCorrectPokemon(data.correctPokemon);
        }, 2000);
      }
    } catch (error) {
      console.error("Error al procesar resultado de adivinanza:", error);
      addSystemMessage("Error al mostrar el resultado de la adivinanza.");
    }
  });
  
  // Cuando el juego termina
  socket.on('game_over', (data) => {
    console.log('Juego terminado:', data);
    gameActive = false;
    
    // Ocultar indicador de carga si estaba visible
    const loadingIndicator = document.getElementById('loading');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    
    if (data.winner) {
      const isCurrentUser = data.winner === socket.id;
      addSystemMessage(`El juego ha terminado. ${isCurrentUser ? '¡Has ganado!' : `Ganador: ${data.winner.substring(0, 4)}`}`);
    } else {
      addSystemMessage('El juego ha terminado. Nadie ha adivinado el Pokémon.');
    }
    
    if (data.correctPokemon) {
      showCorrectPokemon(data.correctPokemon);
    }
  });
  
  // Mensajes de error
  socket.on('error', (data) => {
    console.error('Error del servidor:', data);
    
    // Ocultar indicador de carga
    const loadingIndicator = document.getElementById('loading');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    
    // Mostrar mensaje de error
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
      errorMessage.textContent = data.message || 'Error desconocido';
    }
    
    addSystemMessage(`Error: ${data.message || 'Ha ocurrido un error'}`);
  });
  
  // Cuando el juego termina
  socket.on('game_over', (data) => {
    console.log('Juego terminado:', data);
    gameActive = false;
    
    if (data.winner) {
      addSystemMessage(`El juego ha terminado. Ganador: ${data.winner.substring(0, 4)}`);
    } else {
      addSystemMessage('El juego ha terminado. Nadie ha adivinado el Pokémon.');
    }
    
    if (data.correctPokemon) {
      showCorrectPokemon(data.correctPokemon);
    }
  });
}

// Crear una tarjeta de adivinanza con información de comparación
function createPokemonGuessCard(data) {
  const pokemonList = document.getElementById('pokemon-list');
  if (!pokemonList) return;
  
  // Crear la tarjeta del Pokémon
  const card = document.createElement('div');
  card.className = 'pokemon-card-guess';
  
  // Sección de datos del Pokémon con comparación
  const dataSection = document.createElement('div');
  dataSection.className = 'pokemon-data';
  
  // Imagen
  const imageDiv = document.createElement('div');
  imageDiv.className = 'pokemon-image-guess';
  
  // Obtener imagen del Pokémon adivinado
  const pokemonImage = document.createElement('img');
  
  // Usar la API de PokeAPI para obtener la imagen por nombre
  fetch(`https://pokeapi.co/api/v2/pokemon/${data.pokemonName}`)
    .then(response => response.json())
    .then(pokemon => {
      pokemonImage.src = pokemon.sprites.front_default || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
    })
    .catch(error => {
      console.error("Error obteniendo imagen del Pokémon:", error);
      pokemonImage.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
    });
  
  pokemonImage.alt = data.pokemonName;
  imageDiv.appendChild(pokemonImage);
  
  // Información con colores según la comparación
  const infoDiv = document.createElement('div');
  infoDiv.className = 'pokemon-info-guess';
  
  // Identificar si es nuestra adivinanza o de otro jugador
  const isCurrentUser = data.userId === socket.id;
  const userLabel = document.createElement('div');
  userLabel.className = 'info-cell';
  userLabel.textContent = isCurrentUser ? 'Tú' : `J-${data.userId.substring(0, 4)}`;
  infoDiv.appendChild(userLabel);
  
  // Nombre del Pokémon
  const nameCell = document.createElement('div');
  nameCell.className = 'info-cell';
  nameCell.textContent = data.pokemonName;
  infoDiv.appendChild(nameCell);
  
  // Añadir celdas de información con clases de color según comparación
  const compareProps = Object.keys(data.comparison);
  compareProps.forEach(prop => {
    const cell = document.createElement('div');
    cell.className = `info-cell ${data.comparison[prop] ? 'correct' : ''}`;
    
    switch(prop) {
      case 'type1':
        cell.textContent = 'Tipo 1';
        break;
      case 'type2':
        cell.textContent = 'Tipo 2';
        break;
      case 'color':
        cell.textContent = 'Color';
        break;
      case 'generation':
        cell.textContent = 'Gen.';
        break;
      case 'height':
        cell.textContent = 'Altura';
        break;
      case 'weight':
        cell.textContent = 'Peso';
        break;
      case 'habitat':
        cell.textContent = 'Hábitat';
        break;
      case 'evolutionStage':
        cell.textContent = 'Evolución';
        break;
      default:
        cell.textContent = prop;
    }
    
    infoDiv.appendChild(cell);
  });
  
  // Añadir las secciones a la tarjeta
  dataSection.appendChild(imageDiv);
  dataSection.appendChild(infoDiv);
  card.appendChild(dataSection);
  
  // Añadir la tarjeta al principio de la lista para que las más recientes aparezcan arriba
  pokemonList.insertBefore(card, pokemonList.firstChild);
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
  const correctPokemonDiv = document.getElementById('correct-pokemon');
  const pokemonInfo = document.getElementById('pokemon-info');
  const pokemonImage = document.getElementById('pokemon-imagen');
  
  if (correctPokemonDiv && pokemonInfo && pokemonImage) {
    correctPokemonDiv.classList.remove('hidden');
    
    // Mostrar imagen del Pokémon
    pokemonImage.src = pokemon.sprite;
    
    // Mostrar información completa
    pokemonInfo.innerHTML = `
      <h2>${pokemon.name}</h2>
      <p><strong>Tipo 1:</strong> ${pokemon.types[0].type.name}</p>
      <p><strong>Tipo 2:</strong> ${pokemon.types[1] ? pokemon.types[1].type.name : 'Ninguno'}</p>
      <p><strong>Color:</strong> ${pokemon.species.color.name}</p>
      <p><strong>Generación:</strong> ${getGenerationNumber(pokemon.species.generation.name)}</p>
      <p><strong>Hábitat:</strong> ${pokemon.species.habitat ? pokemon.species.habitat.name : 'Desconocido'}</p>
      <p><strong>Altura:</strong> ${pokemon.height / 10} m</p>
      <p><strong>Peso:</strong> ${pokemon.weight / 10} kg</p>
      <p><strong>Etapa de evolución:</strong> ${pokemon.evolutionStage}</p>
    `;
  }
}