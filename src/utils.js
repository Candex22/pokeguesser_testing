// Colores que necesitan texto blanco
const darkColors = ['blue', 'black', 'brown', 'purple']

// Obtiene el numero de generacion a partir del nombre de la generacion
function getGenerationNumber(generationName) {
    const romanNumerals = {
        'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 
        'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9
    }
    
    const genParts = generationName.split('-')
    if (genParts.length > 1) {
        const roman = genParts[1].toLowerCase()
        return romanNumerals[roman] || '?'
    }
    return '?'
}

// Determinamos si el texto tiene que ser blanco o negro basado en el fondo
function getTextColorClass(backgroundColor) {
    return darkColors.includes(backgroundColor) ? 'text-white' : 'text-black'
}

export { darkColors, getGenerationNumber, getTextColorClass }
