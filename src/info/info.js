
function questionActiveFile() {
    const file = getActiveFile();
    if (!file) {console.log("!file => return"); return;}
    console.log(activeFileId);
    console.log(file);
}


function questionProject() {

    const overlayCanvas = document.getElementById('overlayCanvas');
    overlayCanvas.style.imageRendering= 'pixelated';
    if (!overlayCanvas) return;
    const canvasHost = document.getElementById('canvasHost');
    if (canvasHost) {
        overlayCanvas.width = canvasHost.offsetWidth;
        overlayCanvas.height = canvasHost.offsetHeight;
    }
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);


    ctx.beginPath();

    const result = collectionSelection.pixels;
    for (const ring of result) {
        if (!ring.length) {continue;}
        ctx.fillStyle = 'red'; 
        ctx.fillRect(ring[0]* zoom,ring[1]* zoom, 1* zoom, 1* zoom);
        ctx.closePath();
    }

}
