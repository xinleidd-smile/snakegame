/**
 * main.js - 主入口文件
 * 负责初始化游戏、绑定UI事件、处理输入
 */

import { SnakeGame, DIR } from './game.js';
import {
    playEatSound,
    playGameOverSound,
    playClickSound,
    playTurnSound,
    playBombSound,
    startBgm,
    stopBgm,
    isBgmPlaying
} from './audio.js';

// ========== DOM 元素 ==========
const canvas = document.getElementById('game-canvas');
const overlay = document.getElementById('overlay');
const overlayContent = document.getElementById('overlay-content');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const currentLevelEl = document.getElementById('current-level');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnSound = document.getElementById('btn-sound');
const btnMusic = document.getElementById('btn-music');
const diffBtns = document.querySelectorAll('.diff-btn');
const dpadBtns = document.querySelectorAll('.dpad-btn[data-dir]');
const bgDecor = document.getElementById('bg-decor');

// ========== 状态 ==========
let soundEnabled = true;
let musicEnabled = false;

// ========== 初始化游戏 ==========
const game = new SnakeGame(canvas, {
    onScoreChange(score) {
        scoreEl.textContent = score;
        scoreEl.classList.remove('bump');
        void scoreEl.offsetWidth;
        scoreEl.classList.add('bump');
    },
    onBestScoreChange(best) {
        bestScoreEl.textContent = best;
    },
    onGameOver(finalScore) {
        if (soundEnabled) playGameOverSound();
        if (musicEnabled) stopBgm();
        showGameOverOverlay(finalScore);
    },
    onEat(food, foodType) {
        if (soundEnabled) playEatSound();
    },
    onBomb(penalty) {
        if (soundEnabled) playBombSound();
        const wrapper = document.getElementById('canvas-wrapper');
        wrapper.classList.add('shake');
        setTimeout(() => wrapper.classList.remove('shake'), 300);
    },
    onStateChange(state) {
        updateUI(state);
    }
});

bestScoreEl.textContent = game.bestScore;

// ========== 覆盖层管理 ==========
function showStartOverlay() {
    overlay.classList.remove('hidden');
    overlayContent.innerHTML = `
        <div style="font-size:4rem; margin-bottom:12px;">🐍</div>
        <h2 style="color:#43e97b;">贪吃蛇大作战</h2>
        <p>选择难度后点击开始游戏</p>
        <p class="start-hint">按 空格键 或 点击开始 🎮</p>
    `;
}

function showPauseOverlay() {
    overlay.classList.remove('hidden');
    overlayContent.innerHTML = `
        <div style="font-size:3rem; margin-bottom:12px;">⏸️</div>
        <h2 style="color:#ffd200;">游戏暂停</h2>
        <p>按 空格键 或 点击继续</p>
        <button class="overlay-btn primary" id="btn-resume">▶ 继续游戏</button>
    `;
    document.getElementById('btn-resume').addEventListener('click', () => {
        if (soundEnabled) playClickSound();
        game.togglePause();
    });
}

function showGameOverOverlay(finalScore) {
    const isNewBest = finalScore >= game.bestScore && finalScore > 0;
    overlay.classList.remove('hidden');
    overlayContent.innerHTML = `
        <div style="font-size:2.5rem; margin-bottom:6px;">💀</div>
        <h2 style="color:#ff4757;">游戏结束</h2>
        ${isNewBest ? '<p style="color:#ffd200; font-weight:bold;">🎉 新纪录！</p>' : ''}
        <div class="final-score">${finalScore}</div>
        <p>分</p>
        <button class="overlay-btn primary" id="btn-restart">🔄 再来一局</button>
    `;
    document.getElementById('btn-restart').addEventListener('click', () => {
        if (soundEnabled) playClickSound();
        startGame();
    });

    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (canvasWrapper) {
        canvasWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function hideOverlay() {
    overlay.classList.add('hidden');
}

// ========== UI 更新 ==========
function updateUI(state) {
    if (state === 'playing') {
        hideOverlay();
        btnStart.classList.add('hidden');
        btnPause.classList.remove('hidden');
        btnPause.textContent = '⏸ 暂停';
    } else if (state === 'paused') {
        showPauseOverlay();
        btnPause.textContent = '▶ 继续';
    } else if (state === 'gameover') {
        btnPause.classList.add('hidden');
        btnStart.classList.remove('hidden');
        btnStart.textContent = '🔄 重新开始';
    } else {
        btnStart.classList.remove('hidden');
        btnPause.classList.add('hidden');
        btnStart.textContent = '▶ 开始游戏';
    }
}

// ========== 开始游戏 ==========
function startGame() {
    game.start();
    if (musicEnabled) startBgm();
}

// ========== 事件绑定 ==========
btnStart.addEventListener('click', () => {
    if (soundEnabled) playClickSound();
    startGame();
});

btnPause.addEventListener('click', () => {
    if (soundEnabled) playClickSound();
    game.togglePause();
});

btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSound.textContent = soundEnabled ? '🔊 音效' : '🔇 音效';
    btnSound.classList.toggle('muted', !soundEnabled);
    if (soundEnabled) playClickSound();
});

btnMusic.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    btnMusic.textContent = musicEnabled ? '🎵 音乐' : '🎵 静音';
    btnMusic.classList.toggle('muted', !musicEnabled);

    if (musicEnabled && game.state === 'playing') {
        startBgm();
    } else {
        stopBgm();
    }
    if (soundEnabled) playClickSound();
});

diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (soundEnabled) playClickSound();
        diffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = btn.dataset.speed;
        game.setDifficulty(speed);
        currentLevelEl.textContent = game.getDifficultyLabel();
    });
});

// ========== 键盘控制 ==========
const keyDirMap = {
    ArrowUp: DIR.UP,
    ArrowDown: DIR.DOWN,
    ArrowLeft: DIR.LEFT,
    ArrowRight: DIR.RIGHT,
    w: DIR.UP, W: DIR.UP,
    s: DIR.DOWN, S: DIR.DOWN,
    a: DIR.LEFT, A: DIR.LEFT,
    d: DIR.RIGHT, D: DIR.RIGHT
};

document.addEventListener('keydown', (e) => {
    const dir = keyDirMap[e.key];
    if (dir) {
        e.preventDefault();
        if (game.state === 'playing') {
            game.setDirection(dir);
            if (soundEnabled) playTurnSound();
        }
        return;
    }

    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (game.state === 'idle' || game.state === 'gameover') {
            if (soundEnabled) playClickSound();
            startGame();
        } else if (game.state === 'playing' || game.state === 'paused') {
            if (soundEnabled) playClickSound();
            game.togglePause();
        }
    }
});

// ========== 虚拟方向键（移动端） ==========
const dirMap = {
    up: DIR.UP,
    down: DIR.DOWN,
    left: DIR.LEFT,
    right: DIR.RIGHT
};

dpadBtns.forEach(btn => {
    const handler = (e) => {
        e.preventDefault();
        const dir = dirMap[btn.dataset.dir];
        if (dir && game.state === 'playing') {
            game.setDirection(dir);
            if (soundEnabled) playTurnSound();
        }
    };
    btn.addEventListener('touchstart', handler, { passive: false });
    btn.addEventListener('mousedown', handler);
});

// ========== 触摸滑动手势 ==========
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
    if (game.state !== 'playing') return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 20) return;

    let dir;
    if (absDx > absDy) {
        dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    } else {
        dir = dy > 0 ? DIR.DOWN : DIR.UP;
    }

    game.setDirection(dir);
    if (soundEnabled) playTurnSound();
}, { passive: true });

// ========== 窗口大小变化 ==========
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (game.state === 'idle' || game.state === 'gameover') {
            game.resize();
            game.render();
        }
    }, 200);
});

// ========== 背景装饰粒子 ==========
function createBgParticles() {
    const colors = ['#43e97b', '#38f9d7', '#ffd200', '#ff4757', '#8e44ad'];
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'bg-particle';
        const size = 4 + Math.random() * 12;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.background = color;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = (100 + Math.random() * 20) + '%';
        particle.style.animationDuration = (8 + Math.random() * 15) + 's';
        particle.style.animationDelay = Math.random() * 10 + 's';
        bgDecor.appendChild(particle);
    }
}

// ========== 初始化 ==========
function init() {
    createBgParticles();
    showStartOverlay();
    game.resize();
    game.render();
}

init();
