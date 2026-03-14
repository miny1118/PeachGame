const ROWS = 12;
const COLS = 12;
const BOARD_SIZE = ROWS * COLS;
const TARGET_SUM = 10;
const GAME_SECONDS = 90;
const BEST_KEY = "peach-ten-pop-best";

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const timeLeftEl = document.getElementById("timeLeft");
const sumValueEl = document.getElementById("sumValue");
const statusBadgeEl = document.getElementById("statusBadge");
const particleLayer = document.getElementById("particleLayer");
const newGameBtn = document.getElementById("newGameBtn");
const clearBtn = document.getElementById("clearBtn");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameOverRain = document.getElementById("gameOverRain");
const finalScoreText = document.getElementById("finalScoreText");
const playAgainBtn = document.getElementById("playAgainBtn");

let tiles = [];
let selectedIds = [];
let score = 0;
let secondsLeft = GAME_SECONDS;
let timerId = null;
let isDragging = false;
let gameOver = false;
let dragStartId = null;

bestEl.textContent = localStorage.getItem(BEST_KEY) || "0";

function randomValue() {
  return Math.floor(Math.random() * 9) + 1;
}

function createTiles() {
  const nextTiles = Array.from({ length: BOARD_SIZE }, (_, index) => ({
    id: index,
    value: randomValue(),
    empty: false
  }));

  // Seed a few guaranteed adjacent pairs that sum to 10 so the board can always start.
  const seededPairs = [
    [0, 1, 4, 6],
    [COLS + 2, COLS + 3, 7, 3],
    [COLS * 2 + 5, COLS * 3 + 5, 8, 2],
    [COLS * 5 + 7, COLS * 5 + 8, 1, 9]
  ];

  seededPairs.forEach(([firstId, secondId, firstValue, secondValue]) => {
    if (nextTiles[firstId] && nextTiles[secondId]) {
      nextTiles[firstId].value = firstValue;
      nextTiles[secondId].value = secondValue;
    }
  });

  return nextTiles;
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getTileById(id) {
  return tiles.find((tile) => tile.id === id);
}

function getSelectedSum() {
  return selectedIds.reduce((sum, id) => {
    const tile = getTileById(id);
    return sum + (tile && !tile.empty ? tile.value : 0);
  }, 0);
}

function updateHud() {
  scoreEl.textContent = String(score);
  sumValueEl.textContent = String(getSelectedSum());
  timeLeftEl.textContent = formatTime(secondsLeft);
}

function setMessage(text, badge = "Ready") {
  statusBadgeEl.textContent = badge;
  statusBadgeEl.setAttribute("aria-label", text);
}

function hideGameOverOverlay() {
  gameOverOverlay.hidden = true;
  gameOverRain.innerHTML = "";
}

function showGameOverOverlay() {
  finalScoreText.textContent = `Final score ${score}`;
  gameOverOverlay.hidden = false;
  gameOverRain.innerHTML = "";

  for (let index = 0; index < 40; index += 1) {
    const peach = document.createElement("span");
    peach.className = "rain-peach";
    peach.style.left = `${Math.random() * 100}%`;
    peach.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    peach.style.animationDelay = `${Math.random() * 0.8}s`;
    gameOverRain.appendChild(peach);
  }
}

function getRectangleSelection(startId, endId) {
  const startRow = Math.floor(startId / COLS);
  const startCol = startId % COLS;
  const endRow = Math.floor(endId / COLS);
  const endCol = endId % COLS;
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const ids = [];

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const id = row * COLS + col;
      const tile = getTileById(id);
      if (tile && !tile.empty) {
        ids.push(id);
      }
    }
  }

  return ids;
}

function renderBoard() {
  boardEl.innerHTML = "";

  tiles.forEach((tile) => {
    const button = document.createElement("button");
    button.className = "tile";
    button.type = "button";
    button.dataset.id = String(tile.id);

    if (tile.empty) {
      button.classList.add("empty");
    } else {
      button.innerHTML = `
        <span class="leaf" aria-hidden="true"></span>
        <span class="tile-face">
          <span class="tile-number">${tile.value}</span>
        </span>
      `;
    }

    if (selectedIds.includes(tile.id)) {
      button.classList.add("selected");
    }

    boardEl.appendChild(button);
  });
}

function createParticles(element, count = 8) {
  const rect = element.getBoundingClientRect();
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.style.left = `${rect.left + rect.width / 2 + (Math.random() * 34 - 17)}px`;
    particle.style.top = `${rect.top + rect.height / 2 + (Math.random() * 34 - 17)}px`;
    particle.style.background = index % 2 === 0 ? "rgba(255,255,255,0.96)" : "rgba(255,223,142,0.96)";
    particleLayer.appendChild(particle);
    window.setTimeout(() => particle.remove(), 700);
  }
}

function clearSelection() {
  selectedIds = [];
  dragStartId = null;
  renderBoard();
  updateHud();
}

function flashInvalidSelection() {
  selectedIds.forEach((id) => {
    const element = boardEl.querySelector(`[data-id="${id}"]`);
    if (!element) return;
    element.classList.add("invalid");
    window.setTimeout(() => element.classList.remove("invalid"), 320);
  });
}

function commitSelection() {
  if (gameOver || selectedIds.length === 0) return;

  const sum = getSelectedSum();
  if (sum === TARGET_SUM) {
    const cleared = [...selectedIds];
    score += 10;
    setMessage("Perfect 10. Pop!", "Sweet");

    cleared.forEach((id) => {
      const element = boardEl.querySelector(`[data-id="${id}"]`);
      if (!element) return;
      createParticles(element, 10);
    });

    cleared.forEach((id) => {
      const tile = getTileById(id);
      if (tile) tile.empty = true;
    });

    selectedIds = [];
    storeBest();
    renderBoard();
    updateHud();
    window.setTimeout(() => {
      checkBoardState();
    }, 0);
    return;
  }

  if (sum > TARGET_SUM) {
    flashInvalidSelection();
    setMessage("That path went over 10.", "Too High");
  } else {
    setMessage("Not enough yet. Keep dragging.", "Keep Going");
  }

  window.setTimeout(() => {
    clearSelection();
  }, 180);
}

function updateDragSelection(id) {
  if (!isDragging || gameOver) return;

  const tile = getTileById(id);
  if (!tile || tile.empty) return;
  if (dragStartId === null) return;

  selectedIds = getRectangleSelection(dragStartId, id);
  const sum = getSelectedSum();
  renderBoard();
  updateHud();

  if (sum === TARGET_SUM) {
    commitSelection();
    isDragging = false;
  } else if (sum > TARGET_SUM) {
    commitSelection();
    isDragging = false;
  } else {
    setMessage(`Need ${TARGET_SUM - sum} more.`, "Dragging");
  }
}

function handlePointerDown(event) {
  const tileEl = event.target.closest(".tile");
  if (!tileEl || gameOver) return;

  const id = Number(tileEl.dataset.id);
  const tile = getTileById(id);
  if (!tile || tile.empty) return;

  isDragging = true;
  dragStartId = id;
  selectedIds = [id];
  renderBoard();
  updateHud();
  setMessage(`Need ${TARGET_SUM - getSelectedSum()} more.`, "Dragging");
}

function handlePointerMove(event) {
  if (!isDragging || gameOver) return;

  const target = document.elementFromPoint(event.clientX, event.clientY);
  const tileEl = target ? target.closest(".tile") : null;
  if (!tileEl) return;

  updateDragSelection(Number(tileEl.dataset.id));
}

function handlePointerUp() {
  if (!isDragging) return;
  isDragging = false;
  commitSelection();
}

function storeBest() {
  const best = Number(localStorage.getItem(BEST_KEY) || 0);
  if (score > best) {
    localStorage.setItem(BEST_KEY, String(score));
    bestEl.textContent = String(score);
  }
}

function checkBoardState() {
  const remainingTiles = tiles.filter((tile) => !tile.empty);
  if (remainingTiles.length === 0) {
    endGame("Board clear. Amazing run!");
    return true;
  }

  let hasMove = false;

  for (let startId = 0; startId < BOARD_SIZE; startId += 1) {
    const startTile = getTileById(startId);
    if (!startTile || startTile.empty) continue;

    for (let endId = startId; endId < BOARD_SIZE; endId += 1) {
      const endTile = getTileById(endId);
      if (!endTile || endTile.empty) continue;

      const rectIds = getRectangleSelection(startId, endId);
      const rectSum = rectIds.reduce((sum, id) => sum + getTileById(id).value, 0);
      if (rectSum === TARGET_SUM) {
        hasMove = true;
        break;
      }
    }

    if (hasMove) {
      break;
    }
  }

  if (!hasMove) {
    endGame("No more connected tens on the board.");
  }

  return hasMove;
}

function tick() {
  if (gameOver) return;
  secondsLeft -= 1;
  updateHud();

  if (secondsLeft <= 0) {
    endGame("Time up!");
  }
}

function endGame(message) {
  gameOver = true;
  isDragging = false;
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
  storeBest();
  clearSelection();
  setMessage(`${message} Final score ${score}.`, "Finished");
  showGameOverOverlay();
}

function startNewGame() {
  hideGameOverOverlay();
  tiles = createTiles();
  selectedIds = [];
  score = 0;
  secondsLeft = GAME_SECONDS;
  gameOver = false;
  isDragging = false;

  if (timerId) {
    window.clearInterval(timerId);
  }

  renderBoard();
  updateHud();
  setMessage("Hold and drag across touching peaches. Make exactly 10.", "Ready");
  timerId = window.setInterval(tick, 1000);
}

function checkBoardHasMove(candidateTiles) {
  const activeTiles = candidateTiles.filter((tile) => !tile.empty);

  for (const startTile of activeTiles) {
    for (const endTile of activeTiles) {
      const startRow = Math.floor(startTile.id / COLS);
      const startCol = startTile.id % COLS;
      const endRow = Math.floor(endTile.id / COLS);
      const endCol = endTile.id % COLS;
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      let sum = 0;

      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          const tile = candidateTiles[row * COLS + col];
          if (tile && !tile.empty) {
            sum += tile.value;
          }
        }
      }

      if (sum === TARGET_SUM) {
        return true;
      }
    }
  }

  return false;
}

boardEl.addEventListener("pointerdown", handlePointerDown);
window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);
window.addEventListener("pointercancel", handlePointerUp);

newGameBtn.addEventListener("click", startNewGame);
playAgainBtn.addEventListener("click", startNewGame);
clearBtn.addEventListener("click", () => {
  clearSelection();
  setMessage("Drag path cleared.", "Ready");
});

startNewGame();
