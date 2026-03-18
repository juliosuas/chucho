/* ============================================================
   CHUCHO Y LAS AVENTURAS DEL RÍO
   Educational Math Game for Kids (ages 5-8)
   Pure HTML5 Canvas + Vanilla JavaScript
   ============================================================ */

// ============================================================
// CONSTANTS & CONFIG
// ============================================================

const STATES = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    QUESTION: 'QUESTION',
    JUMPING: 'JUMPING',
    SPLASH: 'SPLASH',
    VICTORY: 'VICTORY'
};

const LEVELS = [
    { id: 1, name: 'Sumas fáciles', type: 'add', range: [1, 10] },
    { id: 2, name: 'Restas fáciles', type: 'sub', range: [1, 10] },
    { id: 3, name: 'Sumas y restas', type: 'mixed', range: [1, 20] },
    { id: 4, name: 'Multiplicación', type: 'mul', range: [1, 5] },
    { id: 5, name: 'Todo mezclado', type: 'all', range: [1, 20] }
];

const STONES_COUNT = 10;
const JUMP_DURATION = 600; // ms
const SPLASH_DURATION = 1200; // ms
const CELEBRATION_DURATION = 800; // ms

// ============================================================
// GLOBALS
// ============================================================

let canvas, ctx;
let W, H;
let gameState = STATES.MENU;
let currentLevel = 1;
let currentStone = 0; // 0 = left bank
let score = 0;
let streak = 0;
let bestStreak = 0;
let totalCorrect = 0;
let totalQuestions = 0;
let currentQuestion = null;
let animationTime = 0;
let jumpStartTime = 0;
let splashStartTime = 0;
let celebrationStartTime = 0;
let showingCelebration = false;

// Chucho position (canvas coords)
let chuchoX = 0;
let chuchoY = 0;
let chuchoTargetX = 0;
let chuchoTargetY = 0;
let chuchoJumpStartX = 0;
let chuchoJumpStartY = 0;

// Environment animation
let waterOffset = 0;
let cloudPositions = [];
let frogStates = []; // { lilyIndex, croakTimer, isCroaking, mouthOpen }
let sunRayAngle = 0;
let bgParticles = []; // fireflies, leaves

// Splash particles
let splashParticles = [];
let jumpParticles = [];
let fireworkParticles = [];
let celebrationParticles = [];

// Stone positions (computed on resize)
let stonePositions = []; // [{x,y}] — index 0..9

// Audio context
let audioCtx = null;

// High scores
let highScores = {};
let unlockedLevels = 1;

// DOM elements
let hudEl, levelDisplay, scoreDisplay, streakDisplay;
let startScreen, questionPanel, victoryScreen;
let questionText, answerButtons;
let splashMessage, correctMessage;
let btnPlay, btnNextLevel, btnMenu;
let levelButtonsContainer, highScoresDisplay;

// Time tracking
let lastTime = 0;
let deltaTime = 0;

// Ambient sound
let ambientNode = null;
let ambientGain = null;

// ============================================================
// INITIALIZATION
// ============================================================

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // DOM refs
    hudEl = document.getElementById('hud');
    levelDisplay = document.getElementById('level-display');
    scoreDisplay = document.getElementById('score-display');
    streakDisplay = document.getElementById('streak-display');
    startScreen = document.getElementById('start-screen');
    questionPanel = document.getElementById('question-panel');
    victoryScreen = document.getElementById('victory-screen');
    questionText = document.getElementById('question-text');
    answerButtons = document.getElementById('answer-buttons');
    splashMessage = document.getElementById('splash-message');
    correctMessage = document.getElementById('correct-message');
    btnPlay = document.getElementById('btn-play');
    btnNextLevel = document.getElementById('btn-next-level');
    btnMenu = document.getElementById('btn-menu');
    levelButtonsContainer = document.getElementById('level-buttons');
    highScoresDisplay = document.getElementById('high-scores-display');

    // Load saved data
    loadProgress();

    // Setup
    resizeCanvas();
    initClouds();
    initFrogs();
    initBgParticles();
    buildLevelButtons();
    updateHighScoresDisplay();

    // Events
    window.addEventListener('resize', resizeCanvas);
    btnPlay.addEventListener('click', startGame);
    btnNextLevel.addEventListener('click', nextLevel);
    btnMenu.addEventListener('click', goToMenu);

    // Start the loop
    gameState = STATES.MENU;
    showStartScreen();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    computeStonePositions();
    computeChuchoPosition();
}

function computeStonePositions() {
    stonePositions = [];
    const riverTop = H * 0.38;
    const riverBottom = H * 0.72;
    const riverMidY = (riverTop + riverBottom) / 2;
    const startX = W * 0.12;
    const endX = W * 0.88;

    for (let i = 0; i < STONES_COUNT; i++) {
        const t = i / (STONES_COUNT - 1);
        const x = startX + t * (endX - startX);
        // Zigzag pattern
        const zigzag = (i % 2 === 0) ? -1 : 1;
        const y = riverMidY + zigzag * (H * 0.06);
        stonePositions.push({ x, y });
    }
}

function computeChuchoPosition() {
    if (gameState === STATES.JUMPING) return; // Don't update during jump
    if (currentStone === 0) {
        // Left bank
        chuchoX = W * 0.06;
        chuchoY = H * 0.52;
    } else if (currentStone > STONES_COUNT) {
        // Right bank (victory)
        chuchoX = W * 0.94;
        chuchoY = H * 0.52;
    } else {
        const pos = stonePositions[currentStone - 1];
        chuchoX = pos.x;
        chuchoY = pos.y - 30;
    }
    chuchoTargetX = chuchoX;
    chuchoTargetY = chuchoY;
}

// ============================================================
// SAVE / LOAD
// ============================================================

function loadProgress() {
    try {
        const data = JSON.parse(localStorage.getItem('chucho_progress') || '{}');
        unlockedLevels = data.unlockedLevels || 1;
        highScores = data.highScores || {};
    } catch (e) {
        unlockedLevels = 1;
        highScores = {};
    }
}

function saveProgress() {
    localStorage.setItem('chucho_progress', JSON.stringify({
        unlockedLevels,
        highScores
    }));
}

// ============================================================
// CLOUDS & ENVIRONMENT INIT
// ============================================================

function initClouds() {
    cloudPositions = [];
    for (let i = 0; i < 5; i++) {
        cloudPositions.push({
            x: Math.random() * (W + 200) - 100,
            y: H * 0.05 + Math.random() * H * 0.15,
            size: 40 + Math.random() * 50,
            speed: 8 + Math.random() * 15
        });
    }
}

function initFrogs() {
    frogStates = [];
    // Place frogs on some stones (every other)
    for (let i = 0; i < STONES_COUNT; i++) {
        if (i % 3 === 1) {
            frogStates.push({
                stoneIndex: i,
                croakTimer: Math.random() * 5000,
                isCroaking: false,
                mouthOpen: 0,
                eyeBlink: 0,
                blinkTimer: Math.random() * 3000
            });
        }
    }
}

function initBgParticles() {
    bgParticles = [];
    for (let i = 0; i < 15; i++) {
        bgParticles.push({
            x: Math.random() * W,
            y: H * 0.1 + Math.random() * H * 0.5,
            size: 2 + Math.random() * 3,
            alpha: Math.random(),
            speed: 0.2 + Math.random() * 0.5,
            phase: Math.random() * Math.PI * 2,
            type: Math.random() > 0.5 ? 'firefly' : 'leaf'
        });
    }
}

// ============================================================
// AUDIO SYSTEM (Web Audio API)
// ============================================================

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playJumpSound() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.4);
}

function playSplashSound() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    // Bubble effect
    for (let i = 0; i < 5; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        const startFreq = 500 - i * 60;
        osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime + i * 0.06);
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + i * 0.06 + 0.2);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.06 + 0.25);
        osc.start(audioCtx.currentTime + i * 0.06);
        osc.stop(audioCtx.currentTime + i * 0.06 + 0.25);
    }
}

function playCorrectSound() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    // Happy chime — major arpeggio
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.1 + 0.4);
        osc.start(audioCtx.currentTime + i * 0.1);
        osc.stop(audioCtx.currentTime + i * 0.1 + 0.4);
    });
}

function playWrongSound() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    // Sad trombone — descending
    const notes = [311, 293, 277, 261]; // Eb4, D4, Db4, C4
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.25);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime + i * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.25 + 0.3);
        osc.start(audioCtx.currentTime + i * 0.25);
        osc.stop(audioCtx.currentTime + i * 0.25 + 0.3);
    });
}

function playVictorySound() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    // Fanfare
    const melody = [523, 659, 784, 1047, 784, 1047, 1318];
    melody.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.35);
        osc.start(audioCtx.currentTime + i * 0.15);
        osc.stop(audioCtx.currentTime + i * 0.15 + 0.35);
    });
}

function startAmbientSound() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (ambientNode) return;

    // Create gentle ambient noise (filtered white noise for river/jungle)
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    ambientNode = audioCtx.createBufferSource();
    ambientNode.buffer = buffer;
    ambientNode.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.04;

    ambientNode.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(audioCtx.destination);
    ambientNode.start();
}

function stopAmbientSound() {
    if (ambientNode) {
        try { ambientNode.stop(); } catch (e) {}
        ambientNode = null;
        ambientGain = null;
    }
}

// ============================================================
// LEVEL BUTTONS & UI
// ============================================================

function buildLevelButtons() {
    levelButtonsContainer.innerHTML = '';
    LEVELS.forEach((level, i) => {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.textContent = level.id;
        btn.title = level.name;

        if (level.id > unlockedLevels) {
            btn.classList.add('locked');
            btn.textContent = '🔒';
        } else {
            btn.addEventListener('click', () => selectLevel(level.id));
        }

        if (level.id === currentLevel) {
            btn.classList.add('selected');
        }

        levelButtonsContainer.appendChild(btn);
    });
}

function selectLevel(levelId) {
    if (levelId > unlockedLevels) return;
    currentLevel = levelId;
    buildLevelButtons();
}

function updateHighScoresDisplay() {
    let html = '';
    const keys = Object.keys(highScores);
    if (keys.length > 0) {
        html = '<p style="margin-top:10px">🏆 Mejores puntajes:</p>';
        keys.sort((a, b) => parseInt(a) - parseInt(b));
        keys.forEach(k => {
            html += `<span style="margin:0 8px">Nivel ${k}: ⭐${highScores[k]}</span>`;
        });
    }
    highScoresDisplay.innerHTML = html;
}

function updateHUD() {
    levelDisplay.textContent = `Nivel: ${currentLevel}`;
    scoreDisplay.textContent = `Estrellas: ⭐ ${score}`;
    if (streak >= 2) {
        streakDisplay.textContent = `🔥 x${streak}`;
        streakDisplay.classList.remove('hidden');
    } else {
        streakDisplay.textContent = '';
    }
}

// ============================================================
// GAME STATE MANAGEMENT
// ============================================================

function showStartScreen() {
    startScreen.classList.remove('hidden');
    victoryScreen.classList.add('hidden');
    questionPanel.classList.add('hidden');
    hudEl.style.display = 'none';
    gameState = STATES.MENU;
    buildLevelButtons();
    updateHighScoresDisplay();
}

function startGame() {
    initAudio();
    startAmbientSound();
    startScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');
    questionPanel.classList.add('hidden');
    hudEl.style.display = 'flex';

    currentStone = 0;
    score = 0;
    streak = 0;
    bestStreak = 0;
    totalCorrect = 0;
    totalQuestions = 0;
    splashParticles = [];
    jumpParticles = [];
    fireworkParticles = [];
    celebrationParticles = [];

    computeStonePositions();
    computeChuchoPosition();
    updateHUD();

    gameState = STATES.PLAYING;

    // Show first question after short delay
    setTimeout(showQuestion, 600);
}

function showQuestion() {
    currentQuestion = generateQuestion(currentLevel);
    questionText.textContent = currentQuestion.text;
    answerButtons.innerHTML = '';

    currentQuestion.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => handleAnswer(opt, btn));
        // Touch support
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleAnswer(opt, btn);
        });
        answerButtons.appendChild(btn);
    });

    questionPanel.classList.remove('hidden');
    gameState = STATES.QUESTION;
}

function handleAnswer(answer, btnEl) {
    if (gameState !== STATES.QUESTION) return;
    totalQuestions++;

    // Disable all buttons
    const allBtns = answerButtons.querySelectorAll('.answer-btn');
    allBtns.forEach(b => b.style.pointerEvents = 'none');

    if (answer === currentQuestion.answer) {
        // CORRECT!
        btnEl.classList.add('correct');
        playCorrectSound();
        score++;
        streak++;
        totalCorrect++;
        if (streak > bestStreak) bestStreak = streak;
        updateHUD();

        // Bonus star for streak
        if (streak % 3 === 0) {
            score++;
            updateHUD();
        }

        showCorrectMessage();

        setTimeout(() => {
            questionPanel.classList.add('hidden');
            startJump();
        }, 600);
    } else {
        // WRONG
        btnEl.classList.add('wrong');
        // Highlight correct answer
        allBtns.forEach(b => {
            if (parseInt(b.textContent) === currentQuestion.answer || b.textContent == currentQuestion.answer) {
                b.classList.add('correct');
            }
        });
        playWrongSound();
        streak = 0;
        updateHUD();

        showSplashMessage();

        setTimeout(() => {
            questionPanel.classList.add('hidden');
            startSplash();
        }, 800);
    }
}

function startJump() {
    gameState = STATES.JUMPING;
    jumpStartTime = performance.now();
    playJumpSound();

    // Calculate target
    chuchoJumpStartX = chuchoX;
    chuchoJumpStartY = chuchoY;

    currentStone++;

    if (currentStone > STONES_COUNT) {
        // Jump to right bank
        chuchoTargetX = W * 0.94;
        chuchoTargetY = H * 0.52;
    } else {
        const pos = stonePositions[currentStone - 1];
        chuchoTargetX = pos.x;
        chuchoTargetY = pos.y - 30;
    }

    // Spawn jump particles at start
    for (let i = 0; i < 8; i++) {
        jumpParticles.push({
            x: chuchoJumpStartX,
            y: chuchoJumpStartY + 20,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3 - 1,
            life: 1,
            color: ['#FFD700', '#FF6B35', '#2ECC71'][Math.floor(Math.random() * 3)],
            size: 3 + Math.random() * 4
        });
    }
}

function startSplash() {
    gameState = STATES.SPLASH;
    splashStartTime = performance.now();
    playSplashSound();

    // Determine splash position (next stone position or current)
    let splashX, splashY;
    if (currentStone < STONES_COUNT) {
        const nextPos = stonePositions[currentStone]; // Next stone
        splashX = nextPos.x;
        splashY = nextPos.y;
    } else {
        splashX = chuchoX + 60;
        splashY = chuchoY + 20;
    }

    // Create splash particles
    for (let i = 0; i < 25; i++) {
        const angle = (Math.PI * 2 * i) / 25 + Math.random() * 0.3;
        const speed = 2 + Math.random() * 5;
        splashParticles.push({
            x: splashX,
            y: splashY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,
            life: 1,
            size: 3 + Math.random() * 6,
            color: Math.random() > 0.3 ? '#5DADE2' : '#AED6F1'
        });
    }
}

function showSplashMessage() {
    splashMessage.classList.remove('hidden');
    setTimeout(() => splashMessage.classList.add('hidden'), 1500);
}

function showCorrectMessage() {
    correctMessage.classList.remove('hidden');
    // Choose random encouraging phrase
    const phrases = ['¡Muy bien!', '¡Excelente!', '¡Genial!', '¡Fantástico!', '¡Increíble!', '¡Bravo!'];
    correctMessage.querySelector('span').textContent = phrases[Math.floor(Math.random() * phrases.length)];
    setTimeout(() => correctMessage.classList.add('hidden'), 1500);
}

function showVictory() {
    gameState = STATES.VICTORY;
    playVictorySound();
    stopAmbientSound();

    // Calculate stars (1-3)
    const accuracy = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;
    let stars = 1;
    if (accuracy >= 0.9) stars = 3;
    else if (accuracy >= 0.7) stars = 2;

    // Update high score
    if (!highScores[currentLevel] || score > highScores[currentLevel]) {
        highScores[currentLevel] = score;
    }

    // Unlock next level
    if (currentLevel >= unlockedLevels && currentLevel < LEVELS.length) {
        unlockedLevels = currentLevel + 1;
    }

    saveProgress();

    // Update victory screen
    document.getElementById('victory-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('victory-score').textContent = `Estrellas ganadas: ${score} | Racha máxima: ${bestStreak}`;

    const messages = [
        '¡Chucho cruzó el río! 🎉',
        '¡Eres un genio de las matemáticas! 🧠',
        '¡El río no es rival para ti! 💪'
    ];
    document.getElementById('victory-message').textContent = messages[Math.floor(Math.random() * messages.length)];

    // Show/hide next level button
    if (currentLevel < LEVELS.length) {
        btnNextLevel.classList.remove('hidden');
    } else {
        btnNextLevel.classList.add('hidden');
    }

    // Launch fireworks
    launchFireworks();

    victoryScreen.classList.remove('hidden');
    hudEl.style.display = 'none';
}

function nextLevel() {
    if (currentLevel < LEVELS.length) {
        currentLevel++;
    }
    victoryScreen.classList.add('hidden');
    startGame();
}

function goToMenu() {
    stopAmbientSound();
    victoryScreen.classList.add('hidden');
    questionPanel.classList.add('hidden');
    currentStone = 0;
    computeChuchoPosition();
    showStartScreen();
}

// ============================================================
// QUESTION GENERATION
// ============================================================

function generateQuestion(level) {
    const levelData = LEVELS[level - 1];
    let type = levelData.type;
    const [min, max] = levelData.range;

    // For 'mixed' and 'all', pick randomly
    if (type === 'mixed') {
        type = Math.random() > 0.5 ? 'add' : 'sub';
    } else if (type === 'all') {
        const types = ['add', 'sub', 'mul'];
        type = types[Math.floor(Math.random() * types.length)];
    }

    let a, b, answer, text;

    switch (type) {
        case 'add':
            a = randInt(min, max);
            b = randInt(min, max);
            answer = a + b;
            text = `${a} + ${b} = ?`;
            break;
        case 'sub':
            a = randInt(min, max);
            b = randInt(min, Math.min(a, max)); // Ensure non-negative
            answer = a - b;
            text = `${a} - ${b} = ?`;
            break;
        case 'mul':
            a = randInt(1, max);
            b = randInt(1, max);
            answer = a * b;
            text = `${a} × ${b} = ?`;
            break;
        default:
            a = randInt(min, max);
            b = randInt(min, max);
            answer = a + b;
            text = `${a} + ${b} = ?`;
    }

    // Generate wrong options
    const options = [answer];
    while (options.length < 4) {
        let wrong;
        const offset = randInt(1, 5) * (Math.random() > 0.5 ? 1 : -1);
        wrong = answer + offset;
        if (wrong < 0) wrong = answer + Math.abs(offset);
        if (!options.includes(wrong)) {
            options.push(wrong);
        }
    }

    // Shuffle options
    shuffleArray(options);

    return { text, answer, options };
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// ============================================================
// FIREWORKS
// ============================================================

function launchFireworks() {
    fireworkParticles = [];
    // Launch several bursts with delays
    for (let burst = 0; burst < 6; burst++) {
        setTimeout(() => {
            const cx = W * 0.2 + Math.random() * W * 0.6;
            const cy = H * 0.15 + Math.random() * H * 0.3;
            const color = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF922B', '#CC5DE8'][burst % 6];
            for (let i = 0; i < 40; i++) {
                const angle = (Math.PI * 2 * i) / 40;
                const speed = 2 + Math.random() * 4;
                fireworkParticles.push({
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1,
                    color: color,
                    size: 2 + Math.random() * 3,
                    gravity: 0.03
                });
            }
        }, burst * 400);
    }
}

// ============================================================
// MAIN GAME LOOP
// ============================================================

function gameLoop(timestamp) {
    deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    animationTime = timestamp;

    update(deltaTime, timestamp);
    render();

    requestAnimationFrame(gameLoop);
}

// ============================================================
// UPDATE
// ============================================================

function update(dt, time) {
    // Always update environment
    updateWater(dt);
    updateClouds(dt);
    updateFrogs(dt);
    updateBgParticles(dt);
    updateParticles(dt);

    if (gameState === STATES.JUMPING) {
        updateJump(time);
    }

    if (gameState === STATES.SPLASH) {
        updateSplash(time);
    }

    if (gameState === STATES.VICTORY) {
        updateFireworks(dt);
    }
}

function updateWater(dt) {
    waterOffset += dt * 0.03;
}

function updateClouds(dt) {
    cloudPositions.forEach(cloud => {
        cloud.x += cloud.speed * (dt / 1000);
        if (cloud.x > W + 150) {
            cloud.x = -150;
            cloud.y = H * 0.05 + Math.random() * H * 0.15;
        }
    });
}

function updateFrogs(dt) {
    frogStates.forEach(frog => {
        frog.croakTimer -= dt;
        if (frog.croakTimer <= 0) {
            frog.isCroaking = true;
            frog.mouthOpen = 1;
            frog.croakTimer = 3000 + Math.random() * 5000;
            // Croak sound
            if (audioCtx && gameState !== STATES.MENU) {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'square';
                osc.frequency.setValueAtTime(120, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
                osc.start(audioCtx.currentTime);
                osc.stop(audioCtx.currentTime + 0.15);
            }
        }

        if (frog.isCroaking) {
            frog.mouthOpen -= dt / 300;
            if (frog.mouthOpen <= 0) {
                frog.mouthOpen = 0;
                frog.isCroaking = false;
            }
        }

        // Blink
        frog.blinkTimer -= dt;
        if (frog.blinkTimer <= 0) {
            frog.eyeBlink = 1;
            frog.blinkTimer = 2000 + Math.random() * 4000;
        }
        if (frog.eyeBlink > 0) {
            frog.eyeBlink -= dt / 200;
            if (frog.eyeBlink < 0) frog.eyeBlink = 0;
        }
    });
}

function updateBgParticles(dt) {
    bgParticles.forEach(p => {
        p.phase += dt * 0.002;
        if (p.type === 'firefly') {
            p.alpha = 0.3 + Math.sin(p.phase) * 0.5;
            p.x += Math.sin(p.phase * 0.7) * 0.3;
            p.y += Math.cos(p.phase * 0.5) * 0.2;
        } else {
            p.x += p.speed;
            p.y += Math.sin(p.phase) * 0.3 + 0.1;
            if (p.y > H * 0.7) {
                p.y = H * 0.1;
                p.x = Math.random() * W;
            }
            if (p.x > W + 10) p.x = -10;
        }
    });
}

function updateParticles(dt) {
    // Splash particles
    splashParticles = splashParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life -= dt / 800;
        return p.life > 0;
    });

    // Jump particles
    jumpParticles = jumpParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= dt / 600;
        return p.life > 0;
    });

    // Celebration particles
    celebrationParticles = celebrationParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02;
        p.life -= dt / 1000;
        return p.life > 0;
    });
}

function updateFireworks(dt) {
    fireworkParticles = fireworkParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.life -= dt / 1500;
        return p.life > 0;
    });
}

function updateJump(time) {
    const elapsed = time - jumpStartTime;
    const progress = Math.min(elapsed / JUMP_DURATION, 1);

    // Ease in-out
    const t = easeInOutQuad(progress);

    // Interpolate position
    chuchoX = chuchoJumpStartX + (chuchoTargetX - chuchoJumpStartX) * t;

    // Arc: parabolic jump
    const jumpHeight = 120 + Math.abs(chuchoTargetX - chuchoJumpStartX) * 0.15;
    const arc = -4 * jumpHeight * t * (t - 1);
    const linearY = chuchoJumpStartY + (chuchoTargetY - chuchoJumpStartY) * t;
    chuchoY = linearY - arc;

    // Spawn trail particles
    if (Math.random() > 0.5) {
        jumpParticles.push({
            x: chuchoX,
            y: chuchoY + 25,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 2,
            life: 0.8,
            color: '#FFD700',
            size: 2 + Math.random() * 3
        });
    }

    if (progress >= 1) {
        chuchoX = chuchoTargetX;
        chuchoY = chuchoTargetY;

        // Landing particles
        for (let i = 0; i < 6; i++) {
            celebrationParticles.push({
                x: chuchoX,
                y: chuchoY + 20,
                vx: (Math.random() - 0.5) * 3,
                vy: -Math.random() * 2 - 1,
                life: 1,
                color: ['#FFD700', '#2ECC71', '#3498DB'][Math.floor(Math.random() * 3)],
                size: 3 + Math.random() * 3
            });
        }

        if (currentStone > STONES_COUNT) {
            // Victory!
            setTimeout(showVictory, 500);
            gameState = STATES.PLAYING; // Temp state while waiting
        } else {
            gameState = STATES.PLAYING;
            setTimeout(showQuestion, 500);
        }
    }
}

function updateSplash(time) {
    const elapsed = time - splashStartTime;
    if (elapsed >= SPLASH_DURATION) {
        // Reset — Chucho goes back to current position
        computeChuchoPosition();
        gameState = STATES.PLAYING;
        setTimeout(showQuestion, 400);
    }
}

function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ============================================================
// RENDER
// ============================================================

function render() {
    ctx.clearRect(0, 0, W, H);

    drawSky();
    drawSun();
    drawMountains();
    drawClouds();
    drawJungle();
    drawRiverBanks();
    drawRiver();
    drawStones();
    drawFrogs();
    drawLilyPads();
    drawBgParticles();

    // Draw Chucho
    if (gameState === STATES.SPLASH) {
        drawChuchoSplash();
    } else {
        drawChucho(chuchoX, chuchoY, animationTime);
    }

    // Particles on top
    drawParticles(splashParticles);
    drawParticles(jumpParticles);
    drawParticles(celebrationParticles);
    drawParticles(fireworkParticles);

    // Progress indicator on stones
    drawProgressIndicator();
}

// ============================================================
// DRAW — SKY
// ============================================================

function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.5, '#B0E0FF');
    gradient.addColorStop(1, '#E0F7FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H * 0.45);
}

// ============================================================
// DRAW — SUN
// ============================================================

function drawSun() {
    const sunX = W * 0.88;
    const sunY = H * 0.08;
    const sunRadius = 35;

    sunRayAngle += 0.005;

    // Rays
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(sunRayAngle);
    for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (sunRadius + 5), Math.sin(angle) * (sunRadius + 5));
        ctx.lineTo(Math.cos(angle) * (sunRadius + 25), Math.sin(angle) * (sunRadius + 25));
        ctx.strokeStyle = 'rgba(255, 200, 50, 0.6)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
    ctx.restore();

    // Sun body
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
    sunGrad.addColorStop(0, '#FFF176');
    sunGrad.addColorStop(0.7, '#FFD54F');
    sunGrad.addColorStop(1, '#FFB300');
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Sun face
    ctx.fillStyle = '#F57F17';
    // Eyes
    ctx.beginPath();
    ctx.arc(sunX - 10, sunY - 4, 3, 0, Math.PI * 2);
    ctx.arc(sunX + 10, sunY - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.beginPath();
    ctx.arc(sunX, sunY + 4, 10, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = '#F57F17';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// ============================================================
// DRAW — MOUNTAINS
// ============================================================

function drawMountains() {
    // Far mountains
    ctx.fillStyle = '#5B8C5A';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.35);
    for (let x = 0; x <= W; x += W / 8) {
        const peakY = H * 0.12 + Math.sin(x * 0.003 + 1) * H * 0.08;
        ctx.lineTo(x, peakY);
    }
    ctx.lineTo(W, H * 0.35);
    ctx.closePath();
    ctx.fill();

    // Near mountains
    ctx.fillStyle = '#4A7C59';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.38);
    for (let x = 0; x <= W; x += W / 6) {
        const peakY = H * 0.2 + Math.sin(x * 0.005 + 3) * H * 0.06;
        ctx.lineTo(x, peakY);
    }
    ctx.lineTo(W, H * 0.38);
    ctx.closePath();
    ctx.fill();
}

// ============================================================
// DRAW — CLOUDS
// ============================================================

function drawClouds() {
    cloudPositions.forEach(cloud => {
        drawCloud(cloud.x, cloud.y, cloud.size);
    });
}

function drawCloud(x, y, size) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.35, y - size * 0.15, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.7, y, size * 0.45, 0, Math.PI * 2);
    ctx.arc(x + size * 0.35, y + size * 0.1, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
}

// ============================================================
// DRAW — JUNGLE (Trees on banks)
// ============================================================

function drawJungle() {
    // Left bank trees
    drawPalmTree(W * 0.02, H * 0.4, 0.8);
    drawPalmTree(W * 0.08, H * 0.36, 1);
    drawBush(W * 0.04, H * 0.48, 30);
    drawBush(W * 0.01, H * 0.5, 25);

    // Right bank trees
    drawPalmTree(W * 0.92, H * 0.38, 0.9);
    drawPalmTree(W * 0.97, H * 0.42, 0.7);
    drawBush(W * 0.93, H * 0.48, 28);
    drawBush(W * 0.98, H * 0.52, 22);

    // Background vegetation
    drawBush(W * 0.15, H * 0.37, 20);
    drawBush(W * 0.85, H * 0.37, 20);
    
    // Flowers
    drawFlower(W * 0.03, H * 0.54, '#FF6B6B');
    drawFlower(W * 0.07, H * 0.52, '#FFD93D');
    drawFlower(W * 0.95, H * 0.54, '#CC5DE8');
    drawFlower(W * 0.91, H * 0.50, '#FF922B');
}

function drawPalmTree(x, y, scale) {
    const s = scale;
    // Trunk
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 8 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 5 * s, y - 50 * s, x + 3 * s, y - 100 * s);
    ctx.stroke();

    // Leaves
    const leafColors = ['#2D8B2E', '#228B22', '#1E7A1E'];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + Math.sin(animationTime * 0.001 + i) * 0.1;
        ctx.fillStyle = leafColors[i % leafColors.length];
        ctx.save();
        ctx.translate(x + 3 * s, y - 100 * s);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, -25 * s, 8 * s, 30 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Coconuts
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(x + 3 * s, y - 95 * s, 4 * s, 0, Math.PI * 2);
    ctx.arc(x - 2 * s, y - 93 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
}

function drawBush(x, y, size) {
    const colors = ['#228B22', '#2ECC71', '#1E8C45'];
    colors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + (i - 1) * size * 0.5, y - size * 0.3, size * (0.5 + i * 0.1), 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawFlower(x, y, color) {
    const size = 5 + Math.sin(animationTime * 0.003 + x) * 2;
    // Petals
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * size, y + Math.sin(angle) * size, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }
    // Center
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
}

// ============================================================
// DRAW — RIVER BANKS
// ============================================================

function drawRiverBanks() {
    const bankColor = '#8B6D3A';
    const grassColor = '#4CAF50';
    const riverTop = H * 0.38;
    const riverBottom = H * 0.72;

    // Top bank (land above river)
    ctx.fillStyle = grassColor;
    ctx.fillRect(0, riverTop - 15, W, 20);
    ctx.fillStyle = bankColor;
    ctx.fillRect(0, riverTop - 5, W, 10);

    // Bottom bank
    ctx.fillStyle = bankColor;
    ctx.fillRect(0, riverBottom - 5, W, 10);
    ctx.fillStyle = grassColor;
    ctx.fillRect(0, riverBottom + 2, W, 20);

    // Ground below river
    const groundGrad = ctx.createLinearGradient(0, riverBottom, 0, H);
    groundGrad.addColorStop(0, '#5D8A3C');
    groundGrad.addColorStop(0.3, '#4A7C2E');
    groundGrad.addColorStop(1, '#3D6B24');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, riverBottom + 15, W, H - riverBottom);

    // Grass tufts on bottom
    ctx.fillStyle = '#6DB33F';
    for (let x = 0; x < W; x += 30) {
        const grassH = 5 + Math.sin(x * 0.1 + animationTime * 0.002) * 3;
        ctx.beginPath();
        ctx.moveTo(x, riverBottom + 18);
        ctx.lineTo(x + 5, riverBottom + 18 - grassH);
        ctx.lineTo(x + 10, riverBottom + 18);
        ctx.fill();
    }
}

// ============================================================
// DRAW — RIVER (with animated waves)
// ============================================================

function drawRiver() {
    const riverTop = H * 0.38;
    const riverBottom = H * 0.72;

    // Main water
    const waterGrad = ctx.createLinearGradient(0, riverTop, 0, riverBottom);
    waterGrad.addColorStop(0, '#2196F3');
    waterGrad.addColorStop(0.3, '#1E88E5');
    waterGrad.addColorStop(0.7, '#1565C0');
    waterGrad.addColorStop(1, '#0D47A1');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, riverTop, W, riverBottom - riverTop);

    // Animated wave lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    for (let row = 0; row < 6; row++) {
        const y = riverTop + 20 + row * ((riverBottom - riverTop - 40) / 6);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 5) {
            const waveY = y + Math.sin((x + waterOffset + row * 50) * 0.03) * 4;
            if (x === 0) ctx.moveTo(x, waveY);
            else ctx.lineTo(x, waveY);
        }
        ctx.stroke();
    }

    // Shimmer highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < 12; i++) {
        const shimmerX = ((i * 137 + waterOffset * 0.5) % (W + 40)) - 20;
        const shimmerY = riverTop + 30 + (i * 47) % (riverBottom - riverTop - 60);
        ctx.beginPath();
        ctx.ellipse(shimmerX, shimmerY, 15 + Math.sin(animationTime * 0.002 + i) * 5, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================================
// DRAW — STONES
// ============================================================

function drawStones() {
    stonePositions.forEach((pos, i) => {
        drawStone(pos.x, pos.y, i);
    });
}

function drawStone(x, y, index) {
    const stoneW = 42;
    const stoneH = 22;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 5, stoneW * 0.55, stoneH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone body
    const stoneGrad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, stoneW * 0.6);
    stoneGrad.addColorStop(0, '#A0A0A0');
    stoneGrad.addColorStop(0.5, '#808080');
    stoneGrad.addColorStop(1, '#606060');
    ctx.fillStyle = stoneGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, stoneW * 0.5, stoneH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x - 5, y - 4, stoneW * 0.2, stoneH * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // If this stone has been passed, show a little checkmark or glow
    if (index < currentStone) {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y, stoneW * 0.55, stoneH * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Stone number
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(index + 1, x, y);
}

// ============================================================
// DRAW — LILY PADS
// ============================================================

function drawLilyPads() {
    // Draw lily pads between some stones
    for (let i = 0; i < STONES_COUNT; i++) {
        if (i % 2 === 0) {
            const pos = stonePositions[i];
            const padX = pos.x + 25;
            const padY = pos.y + 15;
            drawLilyPad(padX, padY);
        }
    }
}

function drawLilyPad(x, y) {
    const size = 14;
    ctx.fillStyle = '#27AE60';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Notch in lily pad
    ctx.fillStyle = '#1E88E5';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y - 3);
    ctx.lineTo(x + size, y + 3);
    ctx.closePath();
    ctx.fill();

    // Veins
    ctx.strokeStyle = '#1E8449';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const angle = Math.PI * 0.3 + (Math.PI * 1.4 * i) / 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * size * 0.8, y + Math.sin(angle) * size * 0.8);
        ctx.stroke();
    }
}

// ============================================================
// DRAW — FROGS
// ============================================================

function drawFrogs() {
    frogStates.forEach(frog => {
        if (frog.stoneIndex < stonePositions.length) {
            const pos = stonePositions[frog.stoneIndex];
            drawFrog(pos.x + 28, pos.y + 10, frog);
        }
    });
}

function drawFrog(x, y, frogState) {
    const s = 0.8; // scale

    // Body
    ctx.fillStyle = '#27AE60';
    ctx.beginPath();
    ctx.ellipse(x, y, 12 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#2ECC71';
    ctx.beginPath();
    ctx.ellipse(x, y - 8 * s, 9 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeOpen = 1 - frogState.eyeBlink;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x - 5 * s, y - 12 * s, 4 * s, 4 * s * Math.max(eyeOpen, 0.1), 0, 0, Math.PI * 2);
    ctx.ellipse(x + 5 * s, y - 12 * s, 4 * s, 4 * s * Math.max(eyeOpen, 0.1), 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    if (eyeOpen > 0.3) {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x - 5 * s, y - 12 * s, 2 * s, 0, Math.PI * 2);
        ctx.arc(x + 5 * s, y - 12 * s, 2 * s, 0, Math.PI * 2);
        ctx.fill();
    }

    // Mouth
    if (frogState.mouthOpen > 0.1) {
        ctx.fillStyle = '#E74C3C';
        ctx.beginPath();
        ctx.ellipse(x, y - 5 * s, 5 * s, 3 * s * frogState.mouthOpen, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Closed mouth smile
        ctx.strokeStyle = '#1E8449';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y - 6 * s, 4 * s, 0.2, Math.PI - 0.2);
        ctx.stroke();
    }

    // Front legs
    ctx.strokeStyle = '#27AE60';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8 * s, y + 2 * s);
    ctx.lineTo(x - 14 * s, y + 8 * s);
    ctx.moveTo(x + 8 * s, y + 2 * s);
    ctx.lineTo(x + 14 * s, y + 8 * s);
    ctx.stroke();
}

// ============================================================
// DRAW — BG PARTICLES (fireflies, leaves)
// ============================================================

function drawBgParticles() {
    bgParticles.forEach(p => {
        if (p.type === 'firefly') {
            ctx.fillStyle = `rgba(255, 255, 100, ${Math.max(0, p.alpha)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            // Glow
            ctx.fillStyle = `rgba(255, 255, 100, ${Math.max(0, p.alpha * 0.3)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Leaf
            ctx.fillStyle = `rgba(80, 160, 60, ${0.5 + Math.sin(p.phase) * 0.3})`;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.phase);
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    });
}

// ============================================================
// DRAW — CHUCHO CHARACTER
// ============================================================

function drawChucho(x, y, time) {
    const bob = Math.sin(time * 0.004) * 3; // Idle bobbing
    const drawY = y + bob;
    const s = 1; // scale

    ctx.save();
    ctx.translate(x, drawY);

    // === SNEAKERS ===
    // Left shoe
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.ellipse(-10 * s, 40 * s, 10 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right shoe
    ctx.beginPath();
    ctx.ellipse(10 * s, 40 * s, 10 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shoe details
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-10 * s, 40 * s, 7 * s, 3 * s, 0, 0, Math.PI);
    ctx.ellipse(10 * s, 40 * s, 7 * s, 3 * s, 0, 0, Math.PI);
    ctx.fill();

    // === LEGS ===
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(-14 * s, 22 * s, 8 * s, 20 * s);
    ctx.fillRect(6 * s, 22 * s, 8 * s, 20 * s);

    // === BODY (BLUE OVERALLS) ===
    ctx.fillStyle = '#3498DB';
    ctx.beginPath();
    ctx.roundRect(-18 * s, -5 * s, 36 * s, 30 * s, 5);
    ctx.fill();

    // Overall straps
    ctx.fillStyle = '#2980B9';
    ctx.fillRect(-16 * s, -5 * s, 6 * s, 12 * s);
    ctx.fillRect(10 * s, -5 * s, 6 * s, 12 * s);

    // Overall pocket
    ctx.fillStyle = '#2980B9';
    ctx.fillRect(-6 * s, 10 * s, 12 * s, 8 * s);
    ctx.strokeStyle = '#2471A3';
    ctx.lineWidth = 1;
    ctx.strokeRect(-6 * s, 10 * s, 12 * s, 8 * s);

    // Overall buttons
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(-13 * s, 0, 2.5 * s, 0, Math.PI * 2);
    ctx.arc(13 * s, 0, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // === ARMS ===
    const armSwing = Math.sin(time * 0.006) * 0.15;

    // Left arm
    ctx.save();
    ctx.translate(-18 * s, 2 * s);
    ctx.rotate(-0.3 + armSwing);
    ctx.fillStyle = '#FDBCB4';
    ctx.fillRect(-4 * s, 0, 8 * s, 20 * s);
    // Hand
    ctx.fillStyle = '#FDBCB4';
    ctx.beginPath();
    ctx.arc(0, 22 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Right arm
    ctx.save();
    ctx.translate(18 * s, 2 * s);
    ctx.rotate(0.3 - armSwing);
    ctx.fillStyle = '#FDBCB4';
    ctx.fillRect(-4 * s, 0, 8 * s, 20 * s);
    // Hand
    ctx.beginPath();
    ctx.arc(0, 22 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // === HEAD ===
    // Neck
    ctx.fillStyle = '#FDBCB4';
    ctx.fillRect(-5 * s, -12 * s, 10 * s, 10 * s);

    // Head circle
    ctx.fillStyle = '#FDBCB4';
    ctx.beginPath();
    ctx.arc(0, -26 * s, 18 * s, 0, Math.PI * 2);
    ctx.fill();

    // === HAIR ===
    ctx.fillStyle = '#5D4037';
    ctx.beginPath();
    ctx.arc(0, -30 * s, 16 * s, Math.PI, Math.PI * 2);
    ctx.fill();
    // Hair tufts
    ctx.beginPath();
    ctx.ellipse(-12 * s, -30 * s, 6 * s, 10 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(12 * s, -30 * s, 6 * s, 10 * s, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // === RED CAP ===
    ctx.fillStyle = '#E74C3C';
    // Cap top
    ctx.beginPath();
    ctx.arc(0, -34 * s, 16 * s, Math.PI, Math.PI * 2);
    ctx.fill();
    // Cap brim
    ctx.fillStyle = '#C0392B';
    ctx.beginPath();
    ctx.ellipse(12 * s, -30 * s, 14 * s, 4 * s, 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Cap button on top
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.arc(0, -49 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // === FACE ===
    // Eyes
    const blinkPhase = Math.sin(time * 0.003);
    const eyeHeight = blinkPhase > 0.97 ? 1 : 5; // Occasional blink

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-7 * s, -28 * s, 6 * s, eyeHeight * s, 0, 0, Math.PI * 2);
    ctx.ellipse(7 * s, -28 * s, 6 * s, eyeHeight * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    if (eyeHeight > 1) {
        ctx.fillStyle = '#2C3E50';
        ctx.beginPath();
        ctx.arc(-6 * s, -27 * s, 3 * s, 0, Math.PI * 2);
        ctx.arc(8 * s, -27 * s, 3 * s, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-5 * s, -29 * s, 1.2 * s, 0, Math.PI * 2);
        ctx.arc(9 * s, -29 * s, 1.2 * s, 0, Math.PI * 2);
        ctx.fill();
    }

    // Eyebrows
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12 * s, -34 * s);
    ctx.lineTo(-4 * s, -35 * s);
    ctx.moveTo(4 * s, -35 * s);
    ctx.lineTo(12 * s, -34 * s);
    ctx.stroke();

    // Nose
    ctx.fillStyle = '#E8A090';
    ctx.beginPath();
    ctx.arc(0, -23 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (big smile)
    ctx.strokeStyle = '#C0392B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -18 * s, 8 * s, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Cheeks (blush)
    ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-13 * s, -22 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(13 * s, -22 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // === EARS ===
    ctx.fillStyle = '#FDBCB4';
    ctx.beginPath();
    ctx.ellipse(-17 * s, -26 * s, 4 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(17 * s, -26 * s, 4 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Inner ear
    ctx.fillStyle = '#E8A090';
    ctx.beginPath();
    ctx.ellipse(-17 * s, -26 * s, 2.5 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(17 * s, -26 * s, 2.5 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ============================================================
// DRAW — CHUCHO SPLASH (falling into water)
// ============================================================

function drawChuchoSplash() {
    const elapsed = animationTime - splashStartTime;
    const progress = Math.min(elapsed / SPLASH_DURATION, 1);

    // Chucho sinks into water
    let drawX, drawY;
    if (currentStone < STONES_COUNT) {
        const nextPos = stonePositions[currentStone];
        drawX = nextPos.x;
        drawY = nextPos.y;
    } else {
        drawX = chuchoX + 60;
        drawY = chuchoY + 20;
    }

    const sinkAmount = progress * 50;
    const wobble = Math.sin(elapsed * 0.02) * 10 * (1 - progress);

    ctx.save();
    // Clip to show sinking
    if (progress < 0.7) {
        ctx.globalAlpha = 1;
        drawChucho(drawX + wobble, drawY + sinkAmount - 20, animationTime);
    }

    // Water circles
    ctx.globalAlpha = 1 - progress;
    for (let ring = 0; ring < 3; ring++) {
        const ringProgress = Math.min((elapsed - ring * 150) / 600, 1);
        if (ringProgress > 0) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - ringProgress)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(drawX, drawY + 5, 20 * ringProgress + ring * 10, 8 * ringProgress + ring * 4, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    ctx.restore();
}

// ============================================================
// DRAW — PARTICLES
// ============================================================

function drawParticles(particles) {
    particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// ============================================================
// DRAW — PROGRESS INDICATOR
// ============================================================

function drawProgressIndicator() {
    if (gameState === STATES.MENU || gameState === STATES.VICTORY) return;

    // Draw a small progress bar at the top
    const barW = Math.min(W * 0.5, 300);
    const barH = 8;
    const barX = (W - barW) / 2;
    const barY = 50;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Progress
    const progress = currentStone / STONES_COUNT;
    ctx.fillStyle = '#2ECC71';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, 4);
    ctx.fill();

    // Stone markers
    for (let i = 0; i < STONES_COUNT; i++) {
        const markerX = barX + (barW * (i + 1)) / STONES_COUNT;
        ctx.fillStyle = i < currentStone ? '#FFD700' : 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(markerX, barY + barH / 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================================
// CANVAS POLYFILLS
// ============================================================

// roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        if (Array.isArray(r) && r.length === 1) r = [r[0], r[0], r[0], r[0]];
        const [tl, tr, br, bl] = r;
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br);
        this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

// ============================================================
// DRAW — TITLE SCREEN CHUCHO (animated dancing)
// ============================================================

function drawMenuChucho(time) {
    // Draw Chucho on the left bank, doing a little dance
    const baseX = W * 0.5;
    const baseY = H * 0.55;
    const dance = Math.sin(time * 0.005) * 5;
    const sway = Math.sin(time * 0.003) * 3;

    ctx.save();
    ctx.translate(baseX + sway, baseY + dance);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 45, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    drawChucho(baseX + sway, baseY + dance, time);

    // Speech bubble
    const bubbleX = baseX + 50;
    const bubbleY = baseY - 60;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(bubbleX, bubbleY, 55, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bubble tail
    ctx.beginPath();
    ctx.moveTo(bubbleX - 15, bubbleY + 18);
    ctx.lineTo(bubbleX - 30, bubbleY + 30);
    ctx.lineTo(bubbleX - 5, bubbleY + 18);
    ctx.fill();

    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const phrases = ['¡Vamos a jugar!', '¡Crucemos el río!', '¡Matemáticas!'];
    const phraseIdx = Math.floor(time / 3000) % phrases.length;
    ctx.fillText(phrases[phraseIdx], bubbleX, bubbleY);
}

// ============================================================
// DRAW — BUTTERFLIES (ambient decoration)
// ============================================================

let butterflies = [];

function initButterflies() {
    butterflies = [];
    for (let i = 0; i < 4; i++) {
        butterflies.push({
            x: W * 0.1 + Math.random() * W * 0.8,
            y: H * 0.2 + Math.random() * H * 0.25,
            phase: Math.random() * Math.PI * 2,
            speed: 0.5 + Math.random() * 1,
            wingPhase: Math.random() * Math.PI * 2,
            color: ['#FF6B6B', '#FFD93D', '#CC5DE8', '#4D96FF'][i],
            size: 4 + Math.random() * 3
        });
    }
}

function updateButterflies(dt) {
    butterflies.forEach(b => {
        b.phase += dt * 0.001;
        b.wingPhase += dt * 0.015;
        b.x += Math.sin(b.phase * 0.7) * b.speed;
        b.y += Math.cos(b.phase * 0.5) * b.speed * 0.5;

        // Keep in bounds
        if (b.x < 0) b.x = W;
        if (b.x > W) b.x = 0;
        if (b.y < H * 0.1) b.y = H * 0.45;
        if (b.y > H * 0.5) b.y = H * 0.15;
    });
}

function drawButterflies() {
    butterflies.forEach(b => {
        const wingAngle = Math.sin(b.wingPhase) * 0.6;
        ctx.save();
        ctx.translate(b.x, b.y);

        // Left wing
        ctx.fillStyle = b.color;
        ctx.save();
        ctx.rotate(-wingAngle);
        ctx.beginPath();
        ctx.ellipse(-b.size, 0, b.size, b.size * 0.6, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Right wing
        ctx.save();
        ctx.rotate(wingAngle);
        ctx.beginPath();
        ctx.ellipse(b.size, 0, b.size, b.size * 0.6, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Body
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.5, b.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
}

// ============================================================
// DRAW — DRAGONFLIES (near water)
// ============================================================

let dragonflies = [];

function initDragonflies() {
    dragonflies = [];
    for (let i = 0; i < 3; i++) {
        dragonflies.push({
            x: W * 0.2 + Math.random() * W * 0.6,
            y: H * 0.4 + Math.random() * H * 0.15,
            phase: Math.random() * Math.PI * 2,
            speed: 1 + Math.random() * 2,
            wingBeat: 0
        });
    }
}

function updateDragonflies(dt) {
    dragonflies.forEach(d => {
        d.phase += dt * 0.002;
        d.wingBeat += dt * 0.03;
        d.x += Math.sin(d.phase) * d.speed;
        d.y += Math.cos(d.phase * 1.3) * d.speed * 0.3;

        if (d.x < W * 0.05) d.x = W * 0.95;
        if (d.x > W * 0.95) d.x = W * 0.05;
    });
}

function drawDragonflies() {
    dragonflies.forEach(d => {
        const wingPos = Math.sin(d.wingBeat) * 0.8;

        ctx.save();
        ctx.translate(d.x, d.y);

        // Body
        ctx.fillStyle = '#1ABC9C';
        ctx.beginPath();
        ctx.ellipse(0, 0, 2, 10, Math.sin(d.phase) * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Wings
        ctx.fillStyle = 'rgba(200, 230, 255, 0.5)';
        ctx.save();
        ctx.rotate(wingPos * 0.5);
        ctx.beginPath();
        ctx.ellipse(-6, -2, 8, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.rotate(-wingPos * 0.5);
        ctx.beginPath();
        ctx.ellipse(6, -2, 8, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Head
        ctx.fillStyle = '#16A085';
        ctx.beginPath();
        ctx.arc(0, -10, 3, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#E74C3C';
        ctx.beginPath();
        ctx.arc(-1.5, -11, 1, 0, Math.PI * 2);
        ctx.arc(1.5, -11, 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
}

// ============================================================
// DRAW — WATER RIPPLES (at Chucho's position on stones)
// ============================================================

function drawWaterRipples() {
    if (currentStone > 0 && currentStone <= STONES_COUNT && gameState !== STATES.JUMPING) {
        const pos = stonePositions[currentStone - 1];
        const time = animationTime;

        // Subtle ripples around the stone Chucho is standing on
        for (let i = 0; i < 2; i++) {
            const ripplePhase = (time * 0.002 + i * Math.PI) % (Math.PI * 2);
            const rippleSize = 15 + Math.sin(ripplePhase) * 10;
            const rippleAlpha = Math.max(0, 0.15 - Math.sin(ripplePhase) * 0.1);

            ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(pos.x, pos.y + 12, rippleSize + i * 8, 4 + i * 2, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// ============================================================
// DRAW — FISH jumping in river (occasional)
// ============================================================

let fishJumps = [];

function updateFishJumps(dt) {
    // Randomly spawn fish jumps
    if (Math.random() < 0.001 && fishJumps.length < 2) {
        const riverTop = H * 0.38;
        const riverBottom = H * 0.72;
        fishJumps.push({
            x: W * 0.1 + Math.random() * W * 0.8,
            baseY: riverTop + 20 + Math.random() * (riverBottom - riverTop - 40),
            phase: 0,
            maxPhase: Math.PI,
            speed: 0.003 + Math.random() * 0.002,
            size: 6 + Math.random() * 4,
            color: Math.random() > 0.5 ? '#FF922B' : '#FFD93D'
        });
    }

    fishJumps = fishJumps.filter(f => {
        f.phase += dt * f.speed;
        return f.phase < f.maxPhase;
    });
}

function drawFishJumps() {
    fishJumps.forEach(f => {
        const jumpY = -Math.sin(f.phase) * 30;
        const rotation = f.phase < Math.PI / 2 ? -0.5 : 0.5;

        ctx.save();
        ctx.translate(f.x, f.baseY + jumpY);
        ctx.rotate(rotation);

        // Fish body
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size, f.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail
        ctx.beginPath();
        ctx.moveTo(-f.size, 0);
        ctx.lineTo(-f.size - 5, -4);
        ctx.lineTo(-f.size - 5, 4);
        ctx.closePath();
        ctx.fill();

        // Eye
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(f.size * 0.5, -1, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Water splash at entry/exit
        if (f.phase < 0.3 || f.phase > Math.PI - 0.3) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(
                    (Math.random() - 0.5) * 10,
                    f.baseY + jumpY > f.baseY ? 5 : -5,
                    2 + Math.random() * 2,
                    0, Math.PI * 2
                );
                ctx.fill();
            }
        }

        ctx.restore();
    });
}

// ============================================================
// ENHANCED RENDER (with all extras)
// ============================================================

// Override the render function to include new elements
const _originalRender = render;
render = function () {
    ctx.clearRect(0, 0, W, H);

    drawSky();
    drawSun();
    drawMountains();
    drawClouds();
    drawJungle();
    drawRiverBanks();
    drawRiver();
    drawFishJumps();
    drawWaterRipples();
    drawStones();
    drawFrogs();
    drawLilyPads();
    drawBgParticles();
    drawButterflies();
    drawDragonflies();

    // Draw Chucho
    if (gameState === STATES.MENU) {
        drawMenuChucho(animationTime);
    } else if (gameState === STATES.SPLASH) {
        drawChuchoSplash();
    } else {
        drawChucho(chuchoX, chuchoY, animationTime);
    }

    // Particles on top
    drawParticles(splashParticles);
    drawParticles(jumpParticles);
    drawParticles(celebrationParticles);
    drawParticles(fireworkParticles);

    // Progress indicator
    drawProgressIndicator();
};

// Override update to include new elements
const _originalUpdate = update;
update = function (dt, time) {
    updateWater(dt);
    updateClouds(dt);
    updateFrogs(dt);
    updateBgParticles(dt);
    updateParticles(dt);
    updateButterflies(dt);
    updateDragonflies(dt);
    updateFishJumps(dt);

    if (gameState === STATES.JUMPING) {
        updateJump(time);
    }

    if (gameState === STATES.SPLASH) {
        updateSplash(time);
    }

    if (gameState === STATES.VICTORY) {
        updateFireworks(dt);
    }
};

// Override init to include new initializations
const _originalInit = init;
init = function () {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    hudEl = document.getElementById('hud');
    levelDisplay = document.getElementById('level-display');
    scoreDisplay = document.getElementById('score-display');
    streakDisplay = document.getElementById('streak-display');
    startScreen = document.getElementById('start-screen');
    questionPanel = document.getElementById('question-panel');
    victoryScreen = document.getElementById('victory-screen');
    questionText = document.getElementById('question-text');
    answerButtons = document.getElementById('answer-buttons');
    splashMessage = document.getElementById('splash-message');
    correctMessage = document.getElementById('correct-message');
    btnPlay = document.getElementById('btn-play');
    btnNextLevel = document.getElementById('btn-next-level');
    btnMenu = document.getElementById('btn-menu');
    levelButtonsContainer = document.getElementById('level-buttons');
    highScoresDisplay = document.getElementById('high-scores-display');

    loadProgress();

    resizeCanvas();
    initClouds();
    initFrogs();
    initBgParticles();
    initButterflies();
    initDragonflies();
    buildLevelButtons();
    updateHighScoresDisplay();

    window.addEventListener('resize', () => {
        resizeCanvas();
        initButterflies();
        initDragonflies();
    });
    btnPlay.addEventListener('click', startGame);
    btnNextLevel.addEventListener('click', nextLevel);
    btnMenu.addEventListener('click', goToMenu);

    // Keyboard shortcut: Enter to start/continue
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (gameState === STATES.MENU) startGame();
        }
        // Number keys for quick answer
        if (gameState === STATES.QUESTION) {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 4) {
                const btns = answerButtons.querySelectorAll('.answer-btn');
                if (btns[num - 1]) btns[num - 1].click();
            }
        }
    });

    gameState = STATES.MENU;
    showStartScreen();
    requestAnimationFrame(gameLoop);
};

// ============================================================
// START
// ============================================================

window.addEventListener('DOMContentLoaded', init);
