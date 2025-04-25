// Import the comparison function from game.js (you'll need to make it exportable in game.js)
import { comparar } from './game.js';

// Add these elements and variables
const pokemonInput = document.getElementById('pokemon-input');
const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
const guessesDiv = document.getElementById('guesses');
const gameOverScreen = document.getElementById('gameOverScreen');
const gameOverMessage = document.getElementById('gameOverMessage');
const playAgainBtn = document.getElementById('playAgainBtn');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');
let currentPokemonData = null;
let guessCount = 0;
const MAX_GUESSES = 10;

// Add this function to handle the Pokemon input and autocomplete
function setupPokemonInput() {
  if (!pokemonInput) return;

  // Fetch all Pokemon names for autocomplete
  fetch('https://pokeapi.co/api/v2/pokemon?limit=1025')
    .then(response => response.json())
    .then(data => {
      const pokemonList = data.results.map(pokemon => ({
        name: pokemon.name,
        url: pokemon.url
      }));
      
      // Setup autocomplete
      pokemonInput.addEventListener('input', function() {
        const inputValue = this.value.toLowerCase().trim();
        autocompleteDropdown.innerHTML = '';
        
        if (inputValue.length < 2) {
          autocompleteDropdown.style.display = 'none';
          return;
        }
        
        const matches = pokemonList.filter(pokemon => 
          pokemon.name.includes(inputValue)
        ).slice(0, 5);
        
        if (matches.length > 0) {
          autocompleteDropdown.style.display = 'block';
          matches.forEach(pokemon => {
            const option = document.createElement('div');
            option.className = 'autocomplete-option';
            option.textContent = pokemon.name;
            option.addEventListener('click', function() {
              pokemonInput.value = pokemon.name;
              autocompleteDropdown.style.display = 'none';
              submitGuess();
            });
            autocompleteDropdown.appendChild(option);
          });
        } else {
          autocompleteDropdown.style.display = 'none';
        }
      });
      
      // Close autocomplete when clicking outside
      document.addEventListener('click', function(e) {
        if (e.target !== pokemonInput) {
          autocompleteDropdown.style.display = 'none';
        }
      });
      
      // Submit on Enter key
      pokemonInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitGuess();
        }
      });
    })
    .catch(error => console.error('Error fetching Pokemon list:', error));
}

// Function to submit a guess
function submitGuess() {
  if (!pokemonInput || !currentRoomId) return;
  
  const pokemonName = pokemonInput.value.trim().toLowerCase();
  if (!pokemonName) return;
  
  // Clear input
  pokemonInput.value = '';
  autocompleteDropdown.style.display = 'none';
  
  // Send guess to server
  socket.emit('player_guess', { roomId: currentRoomId, guess: pokemonName });
  
  // Add guess to UI (will be updated with colors when response comes back)
  addGuessToUI(pokemonName);
}

// Function to add a guess to the UI
async function addGuessToUI(pokemonName) {
  try {
    // Fetch Pokemon data for the guess
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
    if (!response.ok) throw new Error('Pokemon not found');
    
    const pokemonData = await response.json();
    
    // Fetch species data
    const speciesResponse = await fetch(pokemonData.species.url);
    const speciesData = await speciesResponse.json();
    
    // Fetch evolution chain
    const evolutionResponse = await fetch(speciesData.evolution_chain.url);
    const evolutionChain = await evolutionResponse.json();
    
    // Calculate evolution stage
    let evolutionStage = 1;
    let chain = evolutionChain.chain;
    
    if (chain.species.name === pokemonName) {
      evolutionStage = 1;
    } else {
      let foundInChain = false;
      
      for (const firstEvo of chain.evolves_to) {
        if (firstEvo.species.name === pokemonName) {
          evolutionStage = 2;
          foundInChain = true;
          break;
        }
        
        for (const secondEvo of firstEvo.evolves_to) {
          if (secondEvo.species.name === pokemonName) {
            evolutionStage = 3;
            foundInChain = true;
            break;
          }
        }
        
        if (foundInChain) break;
      }
    }
    
    // Create the guess element
    const guessDiv = document.createElement('div');
    guessDiv.className = 'pokemon-guess';
    guessDiv.id = `guess-${guessCount++}`;
    
    // Add Pokemon data to the guess element
    guessDiv.innerHTML = `
      <div class="guess-header">
        <img src="${pokemonData.sprites.front_default}" alt="${pokemonName}" class="guess-sprite">
        <h3>${pokemonName}</h3>
      </div>
      <div class="guess-details">
        <div id="type1" class="guess-attribute">Type 1: ${pokemonData.types[0].type.name}</div>
        <div id="type2" class="guess-attribute">Type 2: ${pokemonData.types[1]?.type.name || 'None'}</div>
        <div id="color" class="guess-attribute">Color: ${speciesData.color.name}</div>
        <div id="evolutionStage" class="guess-attribute">Evolution: ${evolutionStage}</div>
        <div id="weight" class="guess-attribute">Weight: ${pokemonData.weight/10} kg</div>
        <div id="height" class="guess-attribute">Height: ${pokemonData.height/10} m</div>
        <div id="habitat" class="guess-attribute">Habitat: ${speciesData.habitat?.name || 'Unknown'}</div>
        <div id="generation" class="guess-attribute">Gen: ${speciesData.generation.name.replace('generation-', '')}</div>
      </div>
    `;
    
    // Add to the guesses container
    if (guessesDiv) {
      guessesDiv.insertBefore(guessDiv, guessesDiv.firstChild);
    }
    
    // If we have the target Pokemon data, compare with it
    if (currentPokemonData) {
      comparePokemon(currentPokemonData, {
        name: pokemonName,
        types: pokemonData.types.map(t => t.type.name),
        color: speciesData.color.name,
        habitat: speciesData.habitat?.name || 'unknown',
        height: pokemonData.height/10,
        weight: pokemonData.weight/10,
        evolutionStage: evolutionStage,
        generation: parseInt(speciesData.generation.name.replace('generation-', ''))
      }, guessDiv.id);
    }
    
    // Check if we've reached the guess limit (for singleplayer mode)
    if (guessCount >= MAX_GUESSES) {
      // Handle max guesses reached
      gameOverMessage.textContent = `Game over! You've used all ${MAX_GUESSES} guesses.`;
      gameOverScreen.classList.remove('hidden');
    }
    
  } catch (error) {
    console.error('Error processing guess:', error);
    addMessage(`Error: ${pokemonName} not found!`, true);
  }
}

// Function to compare the guessed Pokemon with the target Pokemon
function comparePokemon(targetPokemon, guessedPokemon, guessElementId) {
  const guessDiv = document.getElementById(guessElementId);
  if (!guessDiv) return;
  
  const attributes = guessDiv.querySelectorAll('.guess-attribute');
  
  // Compare name (win condition)
  if (targetPokemon.name === guessedPokemon.name) {
    // You win!
    gameOverMessage.textContent = `You won! You guessed ${targetPokemon.name} correctly!`;
    gameOverScreen.classList.remove('hidden');
    return true;
  }
  
  // Compare types
  attributes.forEach(attr => {
    const attrId = attr.id;
    
    if (attrId === 'type1' && targetPokemon.types[0] === guessedPokemon.types[0]) {
      attr.style.backgroundColor = '#22df19';
    }
    
    if (attrId === 'type2') {
      const targetType2 = targetPokemon.types[1] || 'None';
      const guessedType2 = guessedPokemon.types[1] || 'None';
      
      if (targetType2 === guessedType2) {
        attr.style.backgroundColor = '#22df19';
      }
    }
    
    if (attrId === 'color' && targetPokemon.color === guessedPokemon.color) {
      attr.style.backgroundColor = '#22df19';
    }
    
    if (attrId === 'evolutionStage' && targetPokemon.evolutionStage === guessedPokemon.evolutionStage) {
      attr.style.backgroundColor = '#22df19';
    }
    
    if (attrId === 'weight' && targetPokemon.weight === guessedPokemon.weight) {
      attr.style.backgroundColor = '#22df19';
    }
    
    if (attrId === 'height' && targetPokemon.height === guessedPokemon.height) {
      attr.style.backgroundColor = '#22df19';
    }
    
    if (attrId === 'habitat' && targetPokemon.habitat === guessedPokemon.habitat) {
      attr.style.backgroundColor = '#22df19';
    }
    
    if (attrId === 'generation' && targetPokemon.generation === guessedPokemon.generation) {
      attr.style.backgroundColor = '#22df19';
    }
  });
  
  return false;
}

// Initialize when the game screen becomes visible
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
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (gameStatus) gameStatus.textContent = '';
    if (guessesDiv) guessesDiv.innerHTML = '';
    guessCount = 0;
    
    // Setup Pokemon input
    setupPokemonInput();
    
    // Fetch Pokemon data
    ;(async () => {
      try {
        console.log('Fetching Pokemon with ID:', data.pokemonId);
        
        // Fetch Pokemon data from API
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
        
        // Store Pokemon data for later comparison
        currentPokemonData = {
          name: pokemon.name,
          types: pokemon.types.map(t => t.type.name),
          color: species.color.name,
          habitat: species.habitat ? species.habitat.name : 'unknown',
          height: pokemon.height/10,
          weight: pokemon.weight/10,
          evolutionStage: evolutionStage,
          generation: parseInt(species.generation.name.replace('generation-', ''))
        };
        
        // Update UI - show the sihouette but don't reveal the name
        const pokemonImage = document.getElementById('pokemon-imagen');
        if (pokemonImage) {
          pokemonImage.src = pokemon.sprites.front_default;
          pokemonImage.style.filter = 'brightness(0)'; // Silhouette effect
        }
        
        // Update pokemon info display
        const pokemonInfo = document.getElementById('pokemon-info');
        if (pokemonInfo) {
          pokemonInfo.innerHTML = `
            <div class="pokemon-attribute">Type 1: ${pokemon.types[0].type.name}</div>
            <div class="pokemon-attribute">Type 2: ${pokemon.types[1] ? pokemon.types[1].type.name : 'None'}</div>
            <div class="pokemon-attribute">Color: ${species.color.name}</div>
            <div class="pokemon-attribute">Evolution Stage: ${evolutionStage}</div>
            <div class="pokemon-attribute">Weight: ${pokemon.weight/10} kg</div>
            <div class="pokemon-attribute">Height: ${pokemon.height/10} m</div>
            <div class="pokemon-attribute">Habitat: ${species.habitat ? species.habitat.name : 'Unknown'}</div>
            <div class="pokemon-attribute">Generation: ${species.generation.name.replace('generation-', '')}</div>
          `;
        }
      } catch (error) {
        console.error('Error fetching Pokemon:', error);
      }
    })();
  }
});

// Handle game ending (someone won)
socket.on('game_ended', (data) => {
  if (currentRoomId === data.roomId) {
    const isWinner = data.winnerId === clientId;
    
    // Reveal the Pokemon
    const pokemonImage = document.getElementById('pokemon-imagen');
    if (pokemonImage) {
      pokemonImage.style.filter = 'none'; // Remove silhouette effect
    }
    
    // Show game over message
    const winnerText = isWinner ? 
      `You won! You correctly guessed ${data.pokemonName}!` : 
      `Player ${data.winnerId} won by correctly guessing ${data.pokemonName}!`;
    
    if (gameOverMessage) {
      gameOverMessage.textContent = winnerText;
      gameOverScreen.classList.remove('hidden');
    }
    
    // Add message to chat
    addMessage(winnerText, true);
    
    // Reset ready status
    isReady = false;
    if (readyBtn) {
      readyBtn.textContent = 'Ready';
      readyBtn.classList.remove('secondary');
    }
  }
});

// Handle wrong guess
socket.on('guess_result', (data) => {
  if (currentRoomId === data.roomId && !data.correct) {
    if (gameStatus) {
      gameStatus.textContent = `"${data.guess}" is not correct. Try again!`;
      setTimeout(() => {
        gameStatus.textContent = '';
      }, 3000);
    }
  }
});

// Play again button
if (playAgainBtn) {
  playAgainBtn.addEventListener('click', () => {
    if (currentRoomId) {
      socket.emit('play_again', { roomId: currentRoomId });
      gameOverScreen.classList.add('hidden');
      readyBtn.textContent = 'Not Ready';
      readyBtn.classList.add('secondary');
      isReady = true;
    }
  });
}

// Back to lobby button
if (backToLobbyBtn) {
  backToLobbyBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    roomScreen.classList.remove('hidden');
  });
}