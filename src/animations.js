// Aplica animaciones a la tarjeta de Pokemon
function animatePokemonCard(cardElements) {
    const { intro, imageContainer, infoContainer } = cardElements
    
    // Muestra la intro con animacion
    setTimeout(() => {
        intro.classList.add('fade-in')
    }, 100)
    
    // Transiciona a la vista de datos
    setTimeout(() => {
        intro.classList.add('fade-out')
        
        // Despues de que la intro desaparece, anima cada celda secuencialmente
        setTimeout(() => {
            // Primero anima la imagen
            imageContainer.classList.add('animated')
            
            // Anima cada celda de la info con un retraso
            const infoCells = infoContainer.querySelectorAll('.info-cell')
            infoCells.forEach((cell, index) => {
                setTimeout(() => {
                    cell.classList.add('animated')
                }, 100 + (index * 100)) // 100ms de delay entre cada celda
            })
        }, 400)
    }, 1000)
}

export { animatePokemonCard }
