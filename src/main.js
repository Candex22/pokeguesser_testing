// Punto de entrada principal para importar e inicializar los modulos
import { fetchAllPokemon, fetchPokemonData } from './api.js'
import { initializeAutocomplete } from './autocomplete.js'
import { createPokemonCard } from './ui.js'
import { animatePokemonCard } from './animations.js'

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('pokemon-input')
    const pokemonListContainer = document.getElementById('pokemon-list')
    const errorMessage = document.getElementById('error-message')
    const loadingIndicator = document.getElementById('loading')
    const loadingScreen = document.getElementById('loading-screen')
    const loadingProgress = document.getElementById('loading-progress')
    const dropdown = document.getElementById('autocomplete-dropdown')

    let pokemonList = []

    // Inicializa la aplicacion
    async function initializeApp() {
        // Carga todos los Pokemon
        pokemonList = await fetchAllPokemon(loadingProgress)
        
        // Ocultar la pantalla de carga
        loadingScreen.style.display = 'none'
        
        // Inicializa el autocompletado
        initializeAutocomplete(input, dropdown, pokemonList)
        
        // Configura el evento para buscar Pokemon
        setupPokemonSearch()
    }

    // Configura el evento para buscar Pokemon
    function setupPokemonSearch() {
        // Maneja el envio del formulario
        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault()
                const pokemonName = input.value.trim().toLowerCase()
                
                if (!pokemonName) {
                    errorMessage.textContent = 'Please enter a Pokemon name'
                    return
                }
                
                errorMessage.textContent = ''
                loadingIndicator.textContent = 'Loading...'
                
                try {
                    const pokemonData = await fetchPokemonData(pokemonName)
                    const cardElements = createPokemonCard(pokemonData, pokemonListContainer)
                    animatePokemonCard(cardElements)
                    input.value = ''
                } catch (error) {
                    errorMessage.textContent = `Error: ${error.message}`
                } finally {
                    loadingIndicator.textContent = ''
                }
            }
        })
    }

    // Inicia la aplicacion
    initializeApp()
})
