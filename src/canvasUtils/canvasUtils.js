/**
 * Очищает canvas от содержимого (подсветки и др.)
 * @param {HTMLCanvasElement | null | undefined} canvas - Элемент canvas для очистки
 */
 function clearOverlayCanvas(canvas) {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
}