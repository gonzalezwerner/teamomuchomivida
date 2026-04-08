const GRID_SIZE = 14;

const WORD_BANK = [
  { text: "TEAMO", label: "TE AMO" },
  { text: "CORAZON", label: "CORAZON" },
  { text: "BESO", label: "BESO" },
  { text: "ABRAZO", label: "ABRAZO" },
  { text: "ETERNOS", label: "ETERNOS" },
  { text: "DESTINO", label: "DESTINO" },
  { text: "LATIDO", label: "LATIDO" },
  { text: "MAGIA", label: "MAGIA" },
  { text: "MIRADA", label: "MIRADA" },
  { text: "POEMA", label: "POEMA" },
  { text: "CARINO", label: "CARINO" },
  { text: "LUNA", label: "LUNA" },
];

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const CELEBRATION_MESSAGES = [
  "Cada palabra lleva tu nombre.",
  "El cielo ya esta encendido para ustedes.",
  "Todo este brillo existe para decir te amo.",
  "El corazon de la escena late por ustedes.",
];

const rootStyle = document.documentElement.style;
const experienceElement = document.querySelector(".experience");
const boardElement = document.querySelector("#board");
const wordListElement = document.querySelector("#wordList");
const progressTextElement = document.querySelector("#progressText");
const scorePercentElement = document.querySelector("#scorePercent");
const statusMessageElement = document.querySelector("#statusMessage");
const selectionHintElement = document.querySelector("#selectionHint");
const replayButton = document.querySelector("#replayButton");
const completionOverlay = document.querySelector("#completionOverlay");
const playAgainButton = document.querySelector("#playAgainButton");
const closeOverlayButton = document.querySelector("#closeOverlayButton");
const celebrationCanvas = document.querySelector("#celebrationCanvas");
const celebrationScene = document.querySelector(".celebration-scene");

const state = {
  grid: [],
  placements: [],
  foundWords: new Set(),
  foundCells: new Set(),
  cellMap: new Map(),
  dragging: false,
  startCell: null,
  previewCells: [],
  completed: false,
};

const celebration = {
  running: false,
  rafId: 0,
  ctx: celebrationCanvas.getContext("2d"),
  stars: [],
  sparks: [],
  petals: [],
  heartPoints: [],
  ribbons: [],
  startTime: 0,
  width: 0,
  height: 0,
  centerX: 0,
  centerY: 0,
  focalLength: 620,
  quality: 1,
  isMobile: false,
};

let overlayTimeoutId = 0;

function shuffle(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
}

function createEmptyGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(""));
}

function pickFillLetter() {
  const letters = "AMORLUNEESTICBDPQS";
  return letters[Math.floor(Math.random() * letters.length)];
}

function canPlaceWord(grid, word, row, col, dx, dy) {
  for (let index = 0; index < word.length; index += 1) {
    const nextRow = row + dy * index;
    const nextCol = col + dx * index;

    if (
      nextRow < 0 ||
      nextRow >= GRID_SIZE ||
      nextCol < 0 ||
      nextCol >= GRID_SIZE
    ) {
      return false;
    }

    const current = grid[nextRow][nextCol];
    if (current && current !== word[index]) {
      return false;
    }
  }

  return true;
}

function placeWord(grid, entry, row, col, dx, dy) {
  const cells = [];

  for (let index = 0; index < entry.text.length; index += 1) {
    const nextRow = row + dy * index;
    const nextCol = col + dx * index;
    grid[nextRow][nextCol] = entry.text[index];
    cells.push({ row: nextRow, col: nextCol });
  }

  return {
    ...entry,
    row,
    col,
    dx,
    dy,
    cells,
    key: entry.text,
  };
}

function generatePuzzle() {
  const words = [...WORD_BANK].sort((a, b) => b.text.length - a.text.length);

  for (let attempt = 0; attempt < 180; attempt += 1) {
    const grid = createEmptyGrid(GRID_SIZE);
    const placements = [];
    let success = true;

    for (const entry of words) {
      let placed = false;
      const directions = shuffle([...DIRECTIONS]);

      for (let tries = 0; tries < 240 && !placed; tries += 1) {
        const [dx, dy] = directions[tries % directions.length];
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);

        if (!canPlaceWord(grid, entry.text, row, col, dx, dy)) {
          continue;
        }

        placements.push(placeWord(grid, entry, row, col, dx, dy));
        placed = true;
      }

      if (!placed) {
        success = false;
        break;
      }
    }

    if (!success) {
      continue;
    }

    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        if (!grid[row][col]) {
          grid[row][col] = pickFillLetter();
        }
      }
    }

    return { grid, placements };
  }

  throw new Error("No se pudo generar la sopa de letras.");
}

function coordsToKey(row, col) {
  return `${row}:${col}`;
}

function buildWordList() {
  wordListElement.innerHTML = "";

  state.placements.forEach((placement, index) => {
    const item = document.createElement("li");
    item.className = "word-item";
    item.dataset.word = placement.key;
    item.style.setProperty("--item-delay", `${index * 70}ms`);
    item.innerHTML = `<strong>${placement.label}</strong><span>Pendiente</span>`;
    wordListElement.appendChild(item);
  });
}

function buildBoard() {
  boardElement.innerHTML = "";
  boardElement.style.setProperty("--board-size", GRID_SIZE);
  state.cellMap.clear();

  state.grid.forEach((row, rowIndex) => {
    row.forEach((letter, colIndex) => {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.type = "button";
      cell.dataset.row = String(rowIndex);
      cell.dataset.col = String(colIndex);
      cell.textContent = letter;
      cell.style.setProperty(
        "--enter-delay",
        `${rowIndex * 28 + colIndex * 16}ms`
      );
      cell.setAttribute(
        "aria-label",
        `Fila ${rowIndex + 1}, columna ${colIndex + 1}, letra ${letter}`
      );

      state.cellMap.set(coordsToKey(rowIndex, colIndex), cell);
      boardElement.appendChild(cell);
    });
  });
}

function clearPreview() {
  state.previewCells.forEach(({ row, col }) => {
    const cell = state.cellMap.get(coordsToKey(row, col));
    if (cell && !state.foundCells.has(coordsToKey(row, col))) {
      cell.classList.remove("is-preview");
    }
  });

  state.previewCells = [];
}

function setPreview(cells) {
  clearPreview();
  state.previewCells = cells;

  cells.forEach(({ row, col }) => {
    const cell = state.cellMap.get(coordsToKey(row, col));
    if (cell && !state.foundCells.has(coordsToKey(row, col))) {
      cell.classList.add("is-preview");
    }
  });
}

function getLineCells(start, end) {
  const dx = Math.sign(end.col - start.col);
  const dy = Math.sign(end.row - start.row);
  const deltaCol = Math.abs(end.col - start.col);
  const deltaRow = Math.abs(end.row - start.row);
  const isStraight =
    deltaCol === 0 || deltaRow === 0 || deltaCol === deltaRow;

  if (!isStraight) {
    return [];
  }

  const length = Math.max(deltaCol, deltaRow) + 1;
  const cells = [];

  for (let index = 0; index < length; index += 1) {
    cells.push({
      row: start.row + dy * index,
      col: start.col + dx * index,
    });
  }

  return cells;
}

function eventToCell(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element || !element.classList.contains("cell")) {
    return null;
  }

  return {
    row: Number(element.dataset.row),
    col: Number(element.dataset.col),
  };
}

function updateProgress() {
  const foundCount = state.foundWords.size;
  const total = state.placements.length;
  const percent = Math.round((foundCount / total) * 100);
  const messages = [
    "La historia apenas comienza.",
    "El tablero ya esta encendiendo el ambiente.",
    "Cada palabra suma mas brillo al momento.",
    "Ya casi aparece la sorpresa final.",
    "Todo esta listo para el gran final romantico.",
  ];

  progressTextElement.textContent = `${foundCount} / ${total} encontradas`;
  scorePercentElement.textContent = `${percent}%`;
  document.documentElement.style.setProperty("--progress-angle", `${(percent / 100) * 360}deg`);
  statusMessageElement.textContent =
    messages[Math.min(messages.length - 1, Math.floor((percent / 100) * messages.length))];

  selectionHintElement.textContent =
    foundCount === total
      ? "La escena final ya esta lista para brillar."
      : CELEBRATION_MESSAGES[foundCount % CELEBRATION_MESSAGES.length];
}

function markWordFound(placement) {
  state.foundWords.add(placement.key);
  placement.cells.forEach(({ row, col }) => {
    const key = coordsToKey(row, col);
    state.foundCells.add(key);
    const cell = state.cellMap.get(key);
    if (cell) {
      cell.classList.add("is-found");
      cell.classList.remove("is-preview");
    }
  });

  const item = wordListElement.querySelector(`[data-word="${placement.key}"]`);
  if (item) {
    item.classList.add("is-found");
    const badge = item.querySelector("span");
    if (badge) {
      badge.textContent = "Encontrada";
    }
  }

  updateProgress();

  if (state.foundWords.size === state.placements.length) {
    completePuzzle();
  }
}

function flashInvalidSelection(cells) {
  cells.forEach(({ row, col }) => {
    const cell = state.cellMap.get(coordsToKey(row, col));
    if (cell) {
      cell.classList.add("is-invalid");
      window.setTimeout(() => cell.classList.remove("is-invalid"), 280);
    }
  });
}

function finalizeSelection() {
  if (!state.previewCells.length) {
    clearPreview();
    return;
  }

  const matched = state.placements.find((placement) => {
    if (state.foundWords.has(placement.key)) {
      return false;
    }

    const direct = placement.cells.every((cell, index) => {
      const current = state.previewCells[index];
      return current && current.row === cell.row && current.col === cell.col;
    });

    const reversed = placement.cells.every((cell, index) => {
      const current = state.previewCells[state.previewCells.length - 1 - index];
      return current && current.row === cell.row && current.col === cell.col;
    });

    return (
      placement.cells.length === state.previewCells.length &&
      (direct || reversed)
    );
  });

  if (matched) {
    markWordFound(matched);
  } else {
    flashInvalidSelection(state.previewCells);
  }

  clearPreview();
}

function handlePointerDown(event) {
  const target = event.target;
  if (!target.classList.contains("cell")) {
    return;
  }

  state.dragging = true;
  state.startCell = {
    row: Number(target.dataset.row),
    col: Number(target.dataset.col),
  };

  setPreview([state.startCell]);
  target.setPointerCapture?.(event.pointerId);
}

function handlePointerMove(event) {
  if (!state.dragging || !state.startCell) {
    return;
  }

  const currentCell = eventToCell(event);
  if (!currentCell) {
    return;
  }

  const cells = getLineCells(state.startCell, currentCell);
  if (cells.length) {
    setPreview(cells);
  }
}

function stopDragging() {
  if (!state.dragging) {
    return;
  }

  state.dragging = false;
  state.startCell = null;
  finalizeSelection();
}

function updateGlobalParallax(clientX, clientY) {
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  if (window.innerWidth < 900 || coarsePointer || !experienceElement) {
    resetGlobalParallax();
    return;
  }

  const horizontal = (clientX / window.innerWidth - 0.5) * 2;
  const vertical = (clientY / window.innerHeight - 0.5) * 2;
  rootStyle.setProperty("--parallax-x", `${horizontal * 16}px`);
  rootStyle.setProperty("--parallax-y", `${vertical * 14}px`);
}

function resetGlobalParallax() {
  rootStyle.setProperty("--parallax-x", "0px");
  rootStyle.setProperty("--parallax-y", "0px");
}

function resetGameState() {
  window.clearTimeout(overlayTimeoutId);
  state.foundWords.clear();
  state.foundCells.clear();
  state.dragging = false;
  state.startCell = null;
  state.previewCells = [];
  state.completed = false;
  replayButton.disabled = true;
  completionOverlay.classList.remove("is-active");
  completionOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  celebrationScene.style.setProperty("--scene-tilt-x", "0deg");
  celebrationScene.style.setProperty("--scene-tilt-y", "0deg");
  resetGlobalParallax();
  stopCelebration();
}

function setupGame() {
  resetGameState();
  const puzzle = generatePuzzle();
  state.grid = puzzle.grid;
  state.placements = puzzle.placements;
  buildBoard();
  buildWordList();
  updateProgress();
}

function resizeCelebrationCanvas() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const compactMobile = viewportWidth < 520;
  celebration.isMobile =
    coarsePointer || viewportWidth < 760 || viewportHeight > viewportWidth * 1.15;
  celebration.quality = compactMobile ? 0.5 : celebration.isMobile ? 0.64 : 1;
  celebration.centerX = viewportWidth / 2;
  celebration.centerY =
    viewportHeight * (compactMobile ? 0.31 : celebration.isMobile ? 0.34 : 0.42);
  celebration.focalLength =
    Math.min(viewportWidth, viewportHeight) *
    (compactMobile ? 1.68 : celebration.isMobile ? 1.55 : 1.28);

  const ratio = Math.min(
    window.devicePixelRatio || 1,
    compactMobile ? 1.25 : celebration.isMobile ? 1.5 : 2
  );
  celebration.width = viewportWidth;
  celebration.height = viewportHeight;
  celebrationCanvas.width = Math.floor(celebration.width * ratio);
  celebrationCanvas.height = Math.floor(celebration.height * ratio);
  celebrationCanvas.style.width = `${celebration.width}px`;
  celebrationCanvas.style.height = `${celebration.height}px`;
  celebration.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  completionOverlay.classList.toggle("is-mobile", celebration.isMobile);
}

function buildHeartPoints() {
  const points = [];
  const layerReach = celebration.isMobile ? 6 : 8;
  const angleStep = celebration.isMobile ? 0.125 : 0.09;

  for (let layer = -layerReach; layer <= layerReach; layer += 1) {
    const depth = layer * 0.38;
    const scale = 0.19 * (1 - Math.abs(layer) / (layerReach + 4));

    for (let t = 0; t < Math.PI * 2; t += angleStep) {
      const x = 16 * Math.sin(t) ** 3;
      const y =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);

      points.push({
        x: x * scale,
        y: -y * scale,
        z: depth,
        layer,
        phase: Math.random() * Math.PI * 2,
        baseSize: 1.4 + Math.random() * 1.8,
        hueShift: Math.random() * 50,
      });
    }
  }

  celebration.heartPoints = points;
}

function buildStars() {
  const count = Math.round(240 * celebration.quality);
  celebration.stars = Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 24,
    y: (Math.random() - 0.5) * 16,
    z: Math.random() * 24 + 2,
    size: Math.random() * 2 + 0.5,
    drift: Math.random() * 0.45 + 0.18,
    phase: Math.random() * Math.PI * 2,
  }));
}

function buildSparks() {
  const count = Math.round(170 * celebration.quality);
  celebration.sparks = Array.from({ length: count }, () => ({
    angle: Math.random() * Math.PI * 2,
    radius: Math.random() * 6 + 1.5,
    y: (Math.random() - 0.5) * 9.5,
    z: (Math.random() - 0.5) * 11,
    size: Math.random() * 2.5 + 1,
    speed: Math.random() * 0.75 + 0.35,
    phase: Math.random() * Math.PI * 2,
  }));
}

function buildPetals() {
  const colors = ["248,124,164", "255,205,176", "255,231,204"];
  const count = Math.round(56 * celebration.quality);
  celebration.petals = Array.from({ length: count }, () => ({
    baseAngle: Math.random() * Math.PI * 2,
    radius: Math.random() * 5.5 + 2.8,
    depthOffset: (Math.random() - 0.5) * 10,
    fallSpeed: Math.random() * 0.16 + 0.06,
    spinSpeed: Math.random() * 0.9 + 0.45,
    sway: Math.random() * 1.2 + 0.4,
    seed: Math.random(),
    size: Math.random() * 0.7 + 0.8,
    tint: colors[Math.floor(Math.random() * colors.length)],
  }));
}

function buildRibbons() {
  const count = celebration.isMobile ? 4 : 5;
  celebration.ribbons = Array.from({ length: count }, (_, index) => ({
    radius: 3.5 + index * 0.7,
    width: 0.22 + index * 0.03,
    offset: index * 0.9,
    height: (index - (count - 1) / 2) * 1.15,
  }));
}

function initCelebrationScene() {
  resizeCelebrationCanvas();
  buildHeartPoints();
  buildStars();
  buildSparks();
  buildPetals();
  buildRibbons();
}

function rotatePoint(point, yaw, pitch, roll = 0) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  let x = point.x * cosY - point.z * sinY;
  let z = point.x * sinY + point.z * cosY;

  const cosX = Math.cos(pitch);
  const sinX = Math.sin(pitch);
  let y = point.y * cosX - z * sinX;
  z = point.y * sinX + z * cosX;

  if (roll) {
    const cosZ = Math.cos(roll);
    const sinZ = Math.sin(roll);
    const rotatedX = x * cosZ - y * sinZ;
    y = x * sinZ + y * cosZ;
    x = rotatedX;
  }

  return { x, y, z };
}

function projectPoint(point, cameraZ) {
  const depth = point.z + cameraZ;
  if (depth <= 0.1) {
    return null;
  }

  const scale = celebration.focalLength / depth;
  return {
    x: celebration.centerX + point.x * scale,
    y: celebration.centerY + point.y * scale,
    scale,
    depth,
  };
}

function drawGlow(x, y, size, color, alpha) {
  if (size <= 0) {
    return;
  }

  const gradient = celebration.ctx.createRadialGradient(x, y, 0, x, y, size);
  gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
  gradient.addColorStop(1, `rgba(${color}, 0)`);
  celebration.ctx.fillStyle = gradient;
  celebration.ctx.beginPath();
  celebration.ctx.arc(x, y, size, 0, Math.PI * 2);
  celebration.ctx.fill();
}

function drawBackdropHalo(elapsed) {
  const bloom = Math.min(celebration.width, celebration.height);
  const pulse = 0.08 + Math.sin(elapsed * 1.6) * 0.025;
  drawGlow(
    celebration.centerX,
    celebration.centerY - bloom * 0.04,
    bloom * (celebration.isMobile ? 0.34 : 0.26),
    "255,226,180",
    0.11 + pulse
  );
  drawGlow(
    celebration.centerX,
    celebration.centerY + bloom * 0.02,
    bloom * (celebration.isMobile ? 0.52 : 0.4),
    "248,124,164",
    0.08 + pulse * 0.8
  );
}

function drawStarField(elapsed, cameraZ) {
  celebration.stars.forEach((star) => {
    const point = {
      x: star.x + Math.sin(elapsed * star.drift + star.phase) * 0.28,
      y: star.y + Math.cos(elapsed * star.drift * 0.86 + star.phase) * 0.24,
      z:
        ((star.z - elapsed * (1.6 + star.drift * 2.4)) % 26 + 26) % 26 +
        1.4,
    };
    const projected = projectPoint(point, cameraZ);
    if (!projected) {
      return;
    }

    const twinkle =
      0.15 + ((Math.sin(elapsed * 2.1 + star.phase) + 1) * 0.08);
    drawGlow(
      projected.x,
      projected.y,
      star.size * projected.scale * 0.032,
      "255,233,198",
      twinkle
    );
  });
}

function drawRibbon(elapsed, cameraZ, sceneRotation) {
  celebration.ribbons.forEach((ribbon, ribbonIndex) => {
    celebration.ctx.beginPath();

    for (let step = 0; step <= 170; step += 1) {
      const angle =
        step * 0.108 +
        elapsed * (ribbonIndex % 2 === 0 ? 0.38 : -0.31) +
        ribbon.offset;
      const point = rotatePoint(
        {
          x: Math.cos(angle) * ribbon.radius,
          y:
            ribbon.height +
            Math.sin(step * 0.17 + elapsed * 1.1 + ribbon.offset) * 0.52,
          z: Math.sin(angle) * ribbon.radius,
        },
        sceneRotation.yaw * 0.65,
        sceneRotation.pitch,
        sceneRotation.roll
      );
      const projected = projectPoint(point, cameraZ);
      if (!projected) {
        continue;
      }

      if (step === 0) {
        celebration.ctx.moveTo(projected.x, projected.y);
      } else {
        celebration.ctx.lineTo(projected.x, projected.y);
      }
    }

    celebration.ctx.strokeStyle =
      ribbonIndex % 2 === 0
        ? "rgba(255, 223, 176, 0.18)"
        : "rgba(248, 124, 164, 0.16)";
    celebration.ctx.lineWidth =
      ribbon.width * (celebration.isMobile ? 7 : 9.5);
    celebration.ctx.stroke();
  });
}

function drawPetal(x, y, size, rotation, tint, alpha) {
  const ctx = celebration.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  const gradient = ctx.createLinearGradient(0, -size, 0, size * 1.1);
  gradient.addColorStop(0, `rgba(255, 249, 237, ${alpha})`);
  gradient.addColorStop(0.55, `rgba(${tint}, ${alpha * 0.95})`);
  gradient.addColorStop(1, `rgba(213, 59, 102, ${alpha * 0.16})`);

  ctx.fillStyle = gradient;
  ctx.shadowBlur = size * 1.35;
  ctx.shadowColor = `rgba(${tint}, ${alpha * 0.55})`;
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.1);
  ctx.bezierCurveTo(
    size * 0.82,
    -size * 0.62,
    size * 0.98,
    size * 0.22,
    0,
    size * 1.06
  );
  ctx.bezierCurveTo(
    -size * 0.98,
    size * 0.22,
    -size * 0.82,
    -size * 0.62,
    0,
    -size * 1.1
  );
  ctx.fill();
  ctx.restore();
}

function drawPetalCloud(elapsed, cameraZ, sceneRotation) {
  const petals = [];

  celebration.petals.forEach((petal) => {
    const fall = (elapsed * petal.fallSpeed + petal.seed) % 1;
    const angle = petal.baseAngle + elapsed * petal.spinSpeed;
    const point = rotatePoint(
      {
        x:
          Math.cos(angle) * petal.radius +
          Math.sin(elapsed * petal.sway + petal.seed * 9) * 0.7,
        y:
          -9.2 +
          fall * 18.4 +
          Math.sin(angle * 1.4 + petal.seed * 12) * 0.6,
        z: Math.sin(angle) * petal.radius + petal.depthOffset,
      },
      sceneRotation.yaw * 0.8,
      sceneRotation.pitch * 0.7,
      sceneRotation.roll * 0.5
    );

    const projected = projectPoint(point, cameraZ);
    if (!projected) {
      return;
    }

    petals.push({
      depth: projected.depth,
      x: projected.x,
      y: projected.y,
      size: petal.size * projected.scale * 0.024,
      rotation: angle + elapsed * 0.6 + petal.seed * Math.PI,
      tint: petal.tint,
      alpha: Math.min(0.42, 0.12 + projected.scale * 0.008),
    });
  });

  petals.sort((left, right) => left.depth - right.depth);
  petals.forEach((petal) => {
    drawPetal(
      petal.x,
      petal.y,
      petal.size,
      petal.rotation,
      petal.tint,
      petal.alpha
    );
  });
}

function drawHeartField(elapsed, cameraZ, sceneRotation) {
  const projectedPoints = [];
  const pulse = 1 + Math.sin(elapsed * 2.4) * 0.06;
  const innerYaw = elapsed * 0.95;
  const innerPitch = Math.sin(elapsed * 0.55) * 0.28;
  const innerRoll = Math.sin(elapsed * 0.36) * 0.12;

  celebration.heartPoints.forEach((point) => {
    const shapedPoint = rotatePoint(
      {
        x: point.x * pulse,
        y: point.y * pulse,
        z: point.z,
      },
      innerYaw,
      innerPitch,
      innerRoll
    );
    const stagedPoint = rotatePoint(
      {
        x: shapedPoint.x,
        y: shapedPoint.y + Math.sin(elapsed * 1.35 + point.phase) * 0.08,
        z: shapedPoint.z,
      },
      sceneRotation.yaw,
      sceneRotation.pitch,
      sceneRotation.roll
    );
    const projected = projectPoint(stagedPoint, cameraZ);
    if (!projected) {
      return;
    }

    projectedPoints.push({
      x: projected.x,
      y: projected.y,
      depth: projected.depth,
      layer: point.layer,
      size: point.baseSize * projected.scale * 0.018,
      color: `${Math.round(226 + Math.sin(elapsed + point.hueShift) * 18)}, ${Math.round(142 + point.hueShift * 0.45)}, ${Math.round(172 + point.hueShift * 0.28)}`,
      alpha: 0.16 + Math.min(0.14, projected.scale * 0.003),
    });
  });

  celebration.ctx.beginPath();
  for (let index = 1; index < projectedPoints.length; index += 1) {
    const previous = projectedPoints[index - 1];
    const current = projectedPoints[index];
    if (previous.layer !== current.layer || index % 5 !== 0) {
      continue;
    }

    celebration.ctx.moveTo(previous.x, previous.y);
    celebration.ctx.lineTo(current.x, current.y);
  }
  celebration.ctx.strokeStyle = "rgba(255, 217, 180, 0.08)";
  celebration.ctx.lineWidth = celebration.isMobile ? 0.8 : 1.1;
  celebration.ctx.stroke();

  projectedPoints
    .sort((left, right) => left.depth - right.depth)
    .forEach((point) => {
      drawGlow(point.x, point.y, point.size, point.color, point.alpha);
    });
}

function drawSparkOrbit(elapsed, cameraZ, sceneRotation) {
  celebration.sparks.forEach((spark, index) => {
    const orbitAngle = spark.angle + elapsed * spark.speed;
    const bob = Math.sin(elapsed * 1.4 + spark.phase + index * 0.04) * 0.85;
    const point = rotatePoint(
      {
        x: Math.cos(orbitAngle) * spark.radius,
        y: spark.y + bob,
        z: Math.sin(orbitAngle) * spark.radius + spark.z,
      },
      sceneRotation.yaw * 0.82,
      sceneRotation.pitch * 0.72,
      sceneRotation.roll * 0.4
    );
    const projected = projectPoint(point, cameraZ);
    if (!projected) {
      return;
    }

    drawGlow(
      projected.x,
      projected.y,
      spark.size * projected.scale * 0.014,
      index % 3 === 0 ? "255,226,180" : "249,134,181",
      0.18
    );
  });
}

function renderCelebrationFrame(timestamp) {
  if (!celebration.running) {
    return;
  }

  if (!celebration.startTime) {
    celebration.startTime = timestamp;
  }

  const elapsed = (timestamp - celebration.startTime) / 1000;
  const ctx = celebration.ctx;
  const cameraZ =
    (celebration.isMobile ? 16.5 : 15.2) + Math.sin(elapsed * 0.7) * 1.4;
  const sceneRotation = {
    yaw: Math.sin(elapsed * 0.42) * 0.46 + elapsed * 0.08,
    pitch: Math.cos(elapsed * 0.28) * 0.18,
    roll: Math.sin(elapsed * 0.22) * 0.08,
  };

  ctx.clearRect(0, 0, celebration.width, celebration.height);
  ctx.globalCompositeOperation = "source-over";
  drawBackdropHalo(elapsed);
  ctx.globalCompositeOperation = "screen";
  drawStarField(elapsed, cameraZ);
  drawRibbon(elapsed, cameraZ, sceneRotation);
  drawPetalCloud(elapsed, cameraZ, sceneRotation);
  drawHeartField(elapsed, cameraZ, sceneRotation);
  drawSparkOrbit(elapsed, cameraZ, sceneRotation);
  ctx.globalCompositeOperation = "source-over";
  celebration.rafId = window.requestAnimationFrame(renderCelebrationFrame);
}

function startCelebration() {
  initCelebrationScene();
  celebration.running = true;
  celebration.startTime = 0;
  celebration.rafId = window.requestAnimationFrame(renderCelebrationFrame);
}

function stopCelebration() {
  celebration.running = false;
  if (celebration.rafId) {
    window.cancelAnimationFrame(celebration.rafId);
    celebration.rafId = 0;
  }

  if (celebration.width && celebration.height) {
    celebration.ctx.clearRect(0, 0, celebration.width, celebration.height);
  }
}

function updateSceneTilt(clientX, clientY) {
  if (celebration.isMobile) {
    resetSceneTilt();
    return;
  }

  const rect = celebrationScene.getBoundingClientRect();
  const horizontal = (clientX - rect.left) / rect.width - 0.5;
  const vertical = (clientY - rect.top) / rect.height - 0.5;
  celebrationScene.style.setProperty("--scene-tilt-x", `${vertical * -8}deg`);
  celebrationScene.style.setProperty("--scene-tilt-y", `${horizontal * 10}deg`);
}

function resetSceneTilt() {
  celebrationScene.style.setProperty("--scene-tilt-x", "0deg");
  celebrationScene.style.setProperty("--scene-tilt-y", "0deg");
}

function showOverlay() {
  stopCelebration();
  completionOverlay.classList.add("is-active");
  completionOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  replayButton.disabled = false;
  startCelebration();
}

function completePuzzle() {
  if (state.completed) {
    return;
  }

  state.completed = true;
  selectionHintElement.textContent =
    "Completaste la sopa de letras. La escena romantica ya esta abierta.";
  statusMessageElement.textContent = "El gran final ya esta brillando en 3D.";
  overlayTimeoutId = window.setTimeout(showOverlay, 550);
}

boardElement.addEventListener("pointerdown", handlePointerDown);
boardElement.addEventListener("pointermove", handlePointerMove);
boardElement.addEventListener("pointerup", stopDragging);
boardElement.addEventListener("pointerleave", (event) => {
  if (!state.dragging) {
    return;
  }

  const nextTarget = event.relatedTarget;
  if (!nextTarget || !boardElement.contains(nextTarget)) {
    stopDragging();
  }
});

window.addEventListener("pointerup", stopDragging);
window.addEventListener("pointermove", (event) => {
  updateGlobalParallax(event.clientX, event.clientY);
});
window.addEventListener("pointerleave", resetGlobalParallax);
window.addEventListener("resize", () => {
  if (celebration.running) {
    initCelebrationScene();
  }
  resetSceneTilt();
  resetGlobalParallax();
});

celebrationScene.addEventListener("pointermove", (event) => {
  updateSceneTilt(event.clientX, event.clientY);
});
celebrationScene.addEventListener("pointerleave", resetSceneTilt);
celebrationScene.addEventListener("pointerup", resetSceneTilt);

replayButton.addEventListener("click", showOverlay);
playAgainButton.addEventListener("click", setupGame);
closeOverlayButton.addEventListener("click", () => {
  completionOverlay.classList.remove("is-active");
  completionOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  resetSceneTilt();
  resetGlobalParallax();
  stopCelebration();
});

setupGame();
