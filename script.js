const canvas = document.getElementById('puzzleCanvas');
const ctx = canvas.getContext('2d');

let imageObj = null;
let rows, cols;
let pieceWidth, pieceHeight;
let pieces = [];
let draggingPiece = null;
let offsetX, offsetY;
let timer = 0, timerInterval;
const timerDisplay = document.getElementById('timer');
const message = document.getElementById('message');

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;

// Load image
document.getElementById('imageInput').addEventListener('change', function(e){
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = function(evt){
        imageObj = new Image();
        imageObj.onload = () => {
            let scale = Math.min(MAX_WIDTH / imageObj.width, MAX_HEIGHT / imageObj.height, 1);
            canvas.width = imageObj.width * scale;
            canvas.height = imageObj.height * scale;
            drawPieces();
        }
        imageObj.src = evt.target.result;
    }
    reader.readAsDataURL(file);
});

// Wire up difficulty buttons (no longer relies on inline onclick / global scope)
document.querySelectorAll('.buttons button').forEach(btn => {
    btn.addEventListener('click', () => startPuzzle(Number(btn.dataset.size)));
});

// Start puzzle
function startPuzzle(size){
    if(!imageObj) return alert("Please upload an image first!");

    rows = cols = size;
    pieceWidth = canvas.width / cols;
    pieceHeight = canvas.height / rows;

    // Generate non-overlapping random positions
    let positions = [];
    const padding = 10;
    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            positions.push({
                x: Math.random() * (canvas.width - pieceWidth - padding),
                y: Math.random() * (canvas.height - pieceHeight - padding)
            });
        }
    }
    positions.sort(() => Math.random() - 0.5);

    pieces = [];
    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            const pos = positions.pop();
            pieces.push({
                sx: c * (imageObj.width / cols),
                sy: r * (imageObj.height / rows),
                x: pos.x,
                y: pos.y,
                correctX: c * pieceWidth,
                correctY: r * pieceHeight
            });
        }
    }

    clearInterval(timerInterval);
    timer = 0;
    timerDisplay.innerText = `⏱️ Time: 0s`;
    timerInterval = setInterval(()=>{
        timer++;
        timerDisplay.innerText = `⏱️ Time: ${timer}s`;
    }, 1000);

    drawPieces();
}

// Draw grid background
function drawGrid(){
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            ctx.strokeRect(c*pieceWidth, r*pieceHeight, pieceWidth, pieceHeight);
        }
    }
}

// Draw all pieces
function drawPieces(){
    ctx.clearRect(0,0,canvas.width, canvas.height);
    drawGrid();
    for(let p of pieces){
        ctx.drawImage(
            imageObj,
            p.sx, p.sy, imageObj.width/cols, imageObj.height/rows,
            p.x, p.y, pieceWidth, pieceHeight
        );
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, pieceWidth, pieceHeight);

        // 3D shadow when dragging
        if(draggingPiece === p){
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
        } else {
            ctx.shadowBlur = 0;
        }
    }
}

// --- Drag & Drop Desktop ---
canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', drag);
canvas.addEventListener('mouseup', stopDrag);

// --- Touch support Mobile ---
canvas.addEventListener('touchstart', startDrag, {passive:false});
canvas.addEventListener('touchmove', drag, {passive:false});
canvas.addEventListener('touchend', stopDrag, {passive:false});

// Unified drag functions
function getXY(e){
    const rect = canvas.getBoundingClientRect();
    // Canvas may be displayed smaller than its internal resolution on mobile
    // (CSS max-width:100%), so map client coords into canvas drawing-buffer space.
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if(e.changedTouches && e.changedTouches.length){
        // touchend: the lifted finger is only in changedTouches, not touches
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else if(e.touches && e.touches.length){
        // touchstart / touchmove
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        // mouse events
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const mx = (clientX - rect.left) * scaleX;
    const my = (clientY - rect.top) * scaleY;
    return {mx,my};
}

function startDrag(e){
    e.preventDefault();
    const {mx,my} = getXY(e);

    for(let i=pieces.length-1; i>=0; i--){
        let p = pieces[i];
        if(mx > p.x && mx < p.x+pieceWidth && my > p.y && my < p.y+pieceHeight){
            draggingPiece = p;
            offsetX = mx - p.x;
            offsetY = my - p.y;
            pieces.push(pieces.splice(i,1)[0]); // bring to front
            break;
        }
    }
}

function drag(e){
    e.preventDefault();
    if(!draggingPiece) return;
    const {mx,my} = getXY(e);

    let newX = mx - offsetX;
    let newY = my - offsetY;

    // Keep inside canvas
    newX = Math.max(0, Math.min(newX, canvas.width - pieceWidth));
    newY = Math.max(0, Math.min(newY, canvas.height - pieceHeight));

    draggingPiece.x = newX;
    draggingPiece.y = newY;
    drawPieces();
}

function stopDrag(e){
    e.preventDefault();
    if(draggingPiece){
        const snapThresholdX = pieceWidth / 2;
        const snapThresholdY = pieceHeight / 2;

        if(Math.abs(draggingPiece.x - draggingPiece.correctX) < snapThresholdX)
            draggingPiece.x = draggingPiece.correctX;
        if(Math.abs(draggingPiece.y - draggingPiece.correctY) < snapThresholdY)
            draggingPiece.y = draggingPiece.correctY;

        draggingPiece = null;
        drawPieces();
        checkCompletion();
    }
}

// Check completion
function checkCompletion(){
    if(pieces.every(p => p.x === p.correctX && p.y === p.correctY)){
        clearInterval(timerInterval);
        message.innerHTML = `🎉 Congratulations! You solved it in <b>${timer}s</b>.<br>💫 From <b>Selvam</b> — Thanks for using Selvam’s Jigsaw Puzzle!`;
    }
}
