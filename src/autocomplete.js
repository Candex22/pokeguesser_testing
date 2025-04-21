// Maneja la navegacion por teclado en el dropdown
function updateSelection(items, selectedIndex) {
    Array.from(items).forEach((item, index) => {
        if (index === selectedIndex) {
            item.style.backgroundColor = '#f0f0f0'
        } else {
            item.style.backgroundColor = ''
        }
    })
}

// Inicializa el autocompletado
function initializeAutocomplete(input, dropdown, pokemonList) {
    let selectedIndex = -1

    // Maneja los cambios de entrada para el autocompletado
    input.addEventListener('input', async () => {
        const query = input.value.toLowerCase().trim()
        if (query.length === 0) {
            dropdown.style.display = 'none'
            return
        }

        // Filtra y ordena los nombres de los pokemons
        const matches = pokemonList
            .filter(pokemon => pokemon.name.toLowerCase().startsWith(query))
            .sort((a, b) => a.id - b.id)

        if (matches.length > 0) {
            dropdown.innerHTML = ''
            selectedIndex = -1

            for (const pokemon of matches) {
                try {
                    const item = document.createElement('div')
                    item.className = 'autocomplete-item'
                    item.innerHTML = `
                        <img src="${pokemon.sprite}" alt="${pokemon.name}">
                        <span>${pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}</span>
                    `

                    item.addEventListener('click', () => {
                        input.value = pokemon.name
                        dropdown.style.display = 'none'
                        // Trigger de busqueda del pokemon
                        const event = new KeyboardEvent('keypress', { key: 'Enter' })
                        input.dispatchEvent(event)
                    })

                    dropdown.appendChild(item)
                } catch (error) {
                    console.error(`Error fetching Pokemon ${pokemon.name}:`, error)
                }
            }

            dropdown.style.display = 'block'
        } else {
            dropdown.style.display = 'none'
        }
    })

    // Maneja la navegacion por teclado
    input.addEventListener('keydown', (e) => {
        const items = dropdown.getElementsByClassName('autocomplete-item')
        
        if (e.key === 'Enter') {
            e.preventDefault()
            
            // Si hay un elemento seleccionado en el dropdown, usa ese valor
            if (items.length > 0 && selectedIndex >= 0) {
                const selectedItem = items[selectedIndex].querySelector('span')
                input.value = selectedItem.textContent.toLowerCase()
            }
            
            // Oculta el dropdown y dispara el evento de búsqueda
            dropdown.style.display = 'none'
            
            // Trigger de busqueda del pokemon
            const event = new KeyboardEvent('keypress', { key: 'Enter' })
            input.dispatchEvent(event)
            
            // Limpia el input después de la búsqueda
            setTimeout(() => {
                input.value = ''
            }, 100)
            
            return
        }
        
        if (items.length === 0) return
        
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            selectedIndex = (selectedIndex + 1) % items.length
            updateSelection(items, selectedIndex)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1
            updateSelection(items, selectedIndex)
        }
    })

    // Cierra el dropdown cuando se hace clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            dropdown.style.display = 'none'
        }
    })
}

export { initializeAutocomplete, updateSelection }
