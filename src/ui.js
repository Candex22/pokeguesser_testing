import { getTextColorClass } from './utils.js'

// Crea y agrega la tarjeta del pokemon a la lista con animacion
function createPokemonCard(pokemon, pokemonListContainer) {
    const card = document.createElement('div')
    card.className = 'pokemon-card'
    
    // Mayus la primera letra del nombre
    const capitalizedName = pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)
    const type1 = pokemon.types[0] || 'none'
    const type2 = pokemon.types[1] || 'none'
    const textColorClass = getTextColorClass(pokemon.color)
    
    // Crea la intro (imagen + nombre)
    const intro = document.createElement('div')
    intro.className = 'pokemon-intro ' + pokemon.color
    intro.innerHTML = `
        <div class="intro-container">
            <div class="intro-image">
                <img src="${pokemon.sprite}" alt="${capitalizedName}">
            </div>
            <div class="intro-name ${textColorClass}">${capitalizedName}</div>
        </div>
    `
    
    // Crea la info
    const data = document.createElement('div')
    data.className = 'pokemon-data'
    
    // Crea el contenedor de la imagen
    const imageContainer = document.createElement('div')
    imageContainer.className = 'pokemon-image'
    imageContainer.innerHTML = `<img src="${pokemon.sprite}" alt="${capitalizedName}">`
    
    // Crea el contenedor de la info
    const infoContainer = document.createElement('div')
    infoContainer.className = 'pokemon-info'
    
    // Define todas las celdas
    const cells = [
        { class: `type-cell ${type1}`,id: 'type1', text: type1.charAt(0).toUpperCase() + type1.slice(1) },
        { class: `type-cell ${type2}`,id: 'type2', text: type2 !== 'none' ? type2.charAt(0).toUpperCase() + type2.slice(1) : 'None' },
        { class: pokemon.habitat, id: 'habitat', text: pokemon.habitat.charAt(0).toUpperCase() + pokemon.habitat.slice(1) },
        { class: pokemon.color, id: 'color', text: pokemon.color.charAt(0).toUpperCase() + pokemon.color.slice(1) },
        { class: 'evolution-stage', id: 'evolutionStage', text: `Stage ${pokemon.evolutionStage}` },
        { class: 'height', id: 'height', text: `${pokemon.height}m` },
        { class: 'weight', id: 'weight', text: `${pokemon.weight}kg` },
        { class: 'generation', id: 'generation', text: `Gen ${pokemon.generation}` },
    ]
    
    // Agrega todas las celdas al contenedor de la info
    cells.forEach(cell => {
        const div = document.createElement('div')
        div.className = `info-cell`
        if (cell.id) {
            div.id = cell.id
        }
        div.textContent = cell.text
        infoContainer.appendChild(div)
    })
    
    // Agrega el contenedor de la imagen y la info al contenedor de la data
    data.appendChild(imageContainer)
    data.appendChild(infoContainer)
    
    // Agrega ambos contenedores a la tarjeta
    card.appendChild(intro)
    card.appendChild(data)
    
    // Agrega la tarjeta al inicio de la lista
    pokemonListContainer.insertBefore(card, pokemonListContainer.firstChild)
    
    // Retorna los elementos para las animaciones
    return { card, intro, imageContainer, infoContainer }
}

export { createPokemonCard }
