import { getGenerationNumber } from './utils.js'

// Fetch de todos los pokemons y pre-cargar las imagenes
async function fetchAllPokemon(loadingProgress) {
    try {
        // Primero fetch de todos los pokemons
        const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025')
        const data = await response.json()
        const total = data.results.length
        let loaded = 0

        // Fetch de datos para cada pokemon y pre-cargar sus sprites
        const pokemonList = await Promise.all(
            data.results.map(async (pokemon, index) => {
                try {
                    const detailResponse = await fetch(pokemon.url)
                    const pokemonData = await detailResponse.json()
                    
                    // Pre-cargar la imagen
                    if (pokemonData.sprites.front_default) {
                        await new Promise((resolve, reject) => {
                            const img = new Image()
                            img.onload = resolve
                            img.onerror = reject
                            img.src = pokemonData.sprites.front_default
                        })
                    }

                    loaded++
                    const progress = Math.floor((loaded / total) * 100)
                    loadingProgress.textContent = `Loading Pokemon data... ${progress}%`

                    return {
                        name: pokemon.name,
                        id: pokemonData.id,
                        url: pokemon.url,
                        sprite: pokemonData.sprites.front_default
                    }
                } catch (error) {
                    console.error(`Error loading Pokemon ${pokemon.name}:`, error)
                    loaded++
                    return null
                }
            })
        )

        // Eliminar entradas nulas (cargas fallidas) y ordenar por ID
        return pokemonList.filter(p => p !== null).sort((a, b) => a.id - b.id)
    } catch (error) {
        console.error('Error fetching Pokemon list:', error)
        loadingProgress.textContent = 'Error loading Pokemon data. Please refresh the page.'
        return []
    }
}

// Fetch de datos del pokemon de la API
async function fetchPokemonData(pokemonName) {
    try {
        // Fetch de datos basicos del pokemon
        const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`)
        if (!pokemonResponse.ok) {
            throw new Error('Pokemon not found')
        }
        const pokemonData = await pokemonResponse.json()
        
        // Fetch de datos de la especie para habitat, color, y cadena de evolucion
        const speciesResponse = await fetch(pokemonData.species.url)
        const speciesData = await speciesResponse.json()
        
        return {
            id: pokemonData.id,
            name: pokemonData.name,
            sprite: pokemonData.sprites.front_default, 
            types: pokemonData.types.map(t => t.type.name),
            height: pokemonData.height / 10, // Convert to meters
            weight: pokemonData.weight / 10, // Convert to kg
            habitat: speciesData.habitat ? speciesData.habitat.name : 'unknown',
            color: speciesData.color ? speciesData.color.name : 'unknown',
            evolutionStage: await determineEvolutionStage(speciesData),
            generation: getGenerationNumber(speciesData.generation.name)
        }
    } catch (error) {
         throw error
    }
}

// Determina la etapa de evolucion
async function determineEvolutionStage(speciesData) {
    try {
        const evolutionResponse = await fetch(speciesData.evolution_chain.url)
        const evolutionData = await evolutionResponse.json()
        
        let stage = 1
        let chain = evolutionData.chain
        let currentPokemonName = speciesData.name
        
        // Verifica si es la forma base
        if (chain.species.name === currentPokemonName) {
            return stage
        }
        
        // Verifica si es la primera evolucion
        if (chain.evolves_to && chain.evolves_to.length > 0) {
            stage = 2
            for (const evolution of chain.evolves_to) {
                if (evolution.species.name === currentPokemonName) {
                    return stage
                }
                
                // Verifica si es la segunda evolucion
                if (evolution.evolves_to && evolution.evolves_to.length > 0) {
                    stage = 3
                    for (const finalEvolution of evolution.evolves_to) {
                        if (finalEvolution.species.name === currentPokemonName) {
                            return stage
                        }
                    }
                }
            }
        }
        
        return stage // Default a 1 si no podemos determinar
    } catch (error) {
        console.error("Error determining evolution stage:", error)
        return 1 // Default a 1 si hay un error
    }
}

export { fetchAllPokemon, fetchPokemonData, determineEvolutionStage }
