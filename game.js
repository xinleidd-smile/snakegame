/**
 * game.js - 贪吃蛇游戏核心逻辑
 * 支持水果食物 + 炸弹障碍
 */

// 方向常量
const DIR = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

// 难度配置（毫秒/帧）
const SPEED_MAP = {
    easy: 150,
    medium: 100,
    hard: 65,
    insane: 40
};

const SPEED_LABEL = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
    insane: '地狱'
};

// 水果食物类型及其分值和颜色
const FOOD_TYPES = [
    { emoji: '🍎', name: '苹果', points: 10, color: '#ff4757' },
    { emoji: '🍊', name: '橙子', points: 15, color: '#ffa502' },
    { emoji: '🍇', name: '葡萄', points: 20, color: '#8e44ad' },
    { emoji: '🍓', name: '草莓', points: 25, color: '#e84393' },
    { emoji: '🍑', name: '蜜桃', points: 30, color: '#fd79a8' },
    { emoji: '🍉', name: '西瓜', points: 35, color: '#00b894' },
    { emoji: '🍒', name: '樱桃', points: 40, color: '#d63031' },
    { emoji: '🥝', name: '猕猴桃', points: 45, color: '#a3cb38' },
    { emoji: '🍌', name: '香蕉', points: 50, color: '#fdcb6e' },
    { emoji: '🌟', name: '幸运星', points: 80, color: '#ffd200' }
];

// 炸弹配置
const BOMB_CONFIG = {
    emoji: '💣',
    penalty: 20,
    color: '#ff4757',
    warningColor: '#ff6b6b',
    countByDifficulty: {
        easy: 2,
        medium: 3,
        hard: 5,
        insane: 7
    },
    refreshInterval: 30
};

export class SnakeGame {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.gridSize = 20;
        this.cols = 0;
        this.rows = 0;

        this.state = 'idle';
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('snake_best') || '0');
        this.difficulty = 'easy';

        this.snake = [];
        this.direction = DIR.RIGHT;
        this.nextDirection = DIR.RIGHT;
        this.growing = 0;

        this.food = null;
        this.foodType = null;
        this.foodAnimPhase = 0;

        this.bombs = [];
        this.bombAnimPhase = 0;
        this.stepCount = 0;

        this.particles = [];

        this.lastTime = 0;
        this.accumulator = 0;
        this.animFrameId = null;

        this.onScoreChange = options.onScoreChange || (() => {});
        this.onBestScoreChange = options.onBestScoreChange || (() => {});
        this.onGameOver = options.onGameOver || (() => {});
        this.onEat = options.onEat || (() => {});
        this.onBomb = options.onBomb || (() => {});
        this.onStateChange = options.onStateChange || (() => {});

        this.resize();
    }

    resize() {
        const wrapper = this.canvas.parentElement;
        const maxW = Math.min(wrapper.clientWidth || 600, 600);
        const availableH = window.innerHeight - 260;
        const maxH = Math.min(Math.max(availableH, 200), maxW);

        this.cols = Math.floor(maxW / this.gridSize);
        this.rows = Math.floor(maxH / this.gridSize);

        this.cols = Math.max(this.cols, 15);
        this.rows = Math.max(this.rows, 10);

        this.canvas.width = this.cols * this.gridSize;
        this.canvas.height = this.rows * this.gridSize;
        this.canvas.style.width = this.canvas.width + 'px';
        this.canvas.style.height = this.canvas.height + 'px';
    }

    setDifficulty(level) {
        this.difficulty = level;
    }

    getSpeed() {
        return SPEED_MAP[this.difficulty] || 150;
    }

    getBombCount() {
        return BOMB_CONFIG.countByDifficulty[this.difficulty] || 2;
    }

    reset() {
        const startX = Math.floor(this.cols / 4);
        const startY = Math.floor(this.rows / 2);
        this.snake = [
            { x: startX + 2, y: startY },
            { x: startX + 1, y: startY },
            { x: startX, y: startY }
        ];
        this.direction = DIR.RIGHT;
        this.nextDirection = DIR.RIGHT;
        this.growing = 0;
        this.score = 0;
        this.stepCount = 0;
        this.particles = [];
        this.bombs = [];
        this.onScoreChange(this.score);
        this.spawnFood();
        this.spawnBombs();
    }

    start() {
        this.reset();
        this.state = 'playing';
        this.onStateChange(this.state);
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.gameLoop(this.lastTime);
    }

    togglePause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            this.onStateChange(this.state);
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }
        } else if (this.state === 'paused') {
            this.state = 'playing';
            this.onStateChange(this.state);
            this.lastTime = performance.now();
            this.accumulator = 0;
            this.gameLoop(this.lastTime);
        }
    }

    stop() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    setDirection(dir) {
        if (dir.x + this.direction.x === 0 && dir.y + this.direction.y === 0) return;
        this.nextDirection = dir;
    }

    getOccupiedSet() {
        const occupied = new Set();
        this.snake.forEach(s => occupied.add(`${s.x},${s.y}`));
        if (this.food) occupied.add(`${this.food.x},${this.food.y}`);
        this.bombs.forEach(b => occupied.add(`${b.x},${b.y}`));
        return occupied;
    }

    findFreePosition(occupied) {
        let attempts = 0;
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * this.cols),
                y: Math.floor(Math.random() * this.rows)
            };
            attempts++;
        } while (occupied.has(`${pos.x},${pos.y}`) && attempts < 1000);
        return pos;
    }

    spawnFood() {
        const occupied = this.getOccupiedSet();
        this.food = this.findFreePosition(occupied);

        const rand = Math.random();
        if (rand < 0.03) {
            this.foodType = FOOD_TYPES[9];
        } else if (rand < 0.07) {
            this.foodType = FOOD_TYPES[8];
        } else if (rand < 0.12) {
            this.foodType = FOOD_TYPES[7];
        } else if (rand < 0.18) {
            this.foodType = FOOD_TYPES[6];
        } else if (rand < 0.26) {
            this.foodType = FOOD_TYPES[5];
        } else if (rand < 0.36) {
            this.foodType = FOOD_TYPES[4];
        } else if (rand < 0.48) {
            this.foodType = FOOD_TYPES[3];
        } else if (rand < 0.62) {
            this.foodType = FOOD_TYPES[2];
        } else if (rand < 0.80) {
            this.foodType = FOOD_TYPES[1];
        } else {
            this.foodType = FOOD_TYPES[0];
        }
    }

    spawnBombs() {
        this.bombs = [];
        const count = this.getBombCount();
        const occupied = this.getOccupiedSet();

        for (let i = 0; i < count; i++) {
            const pos = this.findFreePosition(occupied);
            this.bombs.push({ x: pos.x, y: pos.y });
            occupied.add(`${pos.x},${pos.y}`);
        }
    }

    refreshBombs() {
        this.bombs = [];
        const count = this.getBombCount();
        const occupied = this.getOccupiedSet();

        for (let i = 0; i < count; i++) {
            const pos = this.findFreePosition(occupied);
            this.bombs.push({ x: pos.x, y: pos.y });
            occupied.add(`${pos.x},${pos.y}`);
        }
    }

    checkBombCollision(x, y) {
        for (let i = 0; i < this.bombs.length; i++) {
            if (this.bombs[i].x === x && this.bombs[i].y === y) {
                return i;
            }
        }
        return -1;
    }

    gameLoop(timestamp) {
        if (this.state !== 'playing') return;

        const delta = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.accumulator += delta;

        const speed = this.getSpeed();

        while (this.accumulator >= speed) {
            this.update();
            this.accumulator -= speed;
            if (this.state !== 'playing') return;
        }

        this.render();
        this.updateParticles();

        this.foodAnimPhase += delta * 0.003;
        this.bombAnimPhase += delta * 0.004;

        this.animFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }

    update() {
        this.direction = this.nextDirection;
        this.stepCount++;

        const head = this.snake[0];
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };

        if (newHead.x < 0 || newHead.x >= this.cols || newHead.y < 0 || newHead.y >= this.rows) {
            this.gameOver();
            return;
        }

        for (let i = 0; i < this.snake.length; i++) {
            if (this.snake[i].x === newHead.x && this.snake[i].y === newHead.y) {
                this.gameOver();
                return;
            }
        }

        this.snake.unshift(newHead);

        if (this.food && newHead.x === this.food.x && newHead.y === this.food.y) {
            this.score += this.foodType.points;
            this.onScoreChange(this.score);
            this.onEat(this.food, this.foodType);

            this.spawnEatParticles(this.food.x, this.food.y, this.foodType.color);
            this.spawnFood();
        } else {
            if (this.growing > 0) {
                this.growing--;
            } else {
                this.snake.pop();
            }
        }

        const bombIdx = this.checkBombCollision(newHead.x, newHead.y);
        if (bombIdx !== -1) {
            const penalty = BOMB_CONFIG.penalty;
            this.score = Math.max(0, this.score - penalty);
            this.onScoreChange(this.score);

            this.spawnBombParticles(newHead.x, newHead.y);
            this.onBomb(penalty);

            this.bombs.splice(bombIdx, 1);
            const occupied = this.getOccupiedSet();
            const newPos = this.findFreePosition(occupied);
            this.bombs.push({ x: newPos.x, y: newPos.y });

            if (this.snake.length > 3) {
                this.snake.pop();
            }
        }

        if (this.stepCount % BOMB_CONFIG.refreshInterval === 0) {
            this.refreshBombs();
        }
    }

    gameOver() {
        this.state = 'gameover';
        this.stop();

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('snake_best', this.bestScore.toString());
            this.onBestScoreChange(this.bestScore);
        }

        this.onGameOver(this.score);
        this.onStateChange(this.state);
        this.render();
    }

    spawnEatParticles(gx, gy, color) {
        const cx = (gx + 0.5) * this.gridSize;
        const cy = (gy + 0.5) * this.gridSize;
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
            const speed = 1.5 + Math.random() * 3;
            this.particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.02 + Math.random() * 0.02,
                size: 3 + Math.random() * 4,
                color: color
            });
        }
    }

    spawnBombParticles(gx, gy) {
        const cx = (gx + 0.5) * this.gridSize;
        const cy = (gy + 0.5) * this.gridSize;
        const colors = ['#ff4757', '#ff6348', '#ffa502', '#ff3838', '#ff9f1a'];
        for (let i = 0; i < 18; i++) {
            const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
            const speed = 2 + Math.random() * 4;
            this.particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.015 + Math.random() * 0.02,
                size: 4 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.vx *= 0.96;
            p.vy *= 0.96;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, w, h);

        this.drawGrid();
        this.drawBombWarningZones();
        this.drawBombs();
        this.drawFood();
        this.drawSnake();
        this.drawParticles();
        this.drawBorder();
    }

    drawGrid() {
        const ctx = this.ctx;
        const gs = this.gridSize;
        ctx.strokeStyle = 'rgba(67, 233, 123, 0.04)';
        ctx.lineWidth = 0.5;

        for (let x = 0; x <= this.cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * gs, 0);
            ctx.lineTo(x * gs, this.canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= this.rows; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * gs);
            ctx.lineTo(this.canvas.width, y * gs);
            ctx.stroke();
        }
    }

    drawSnake() {
        const ctx = this.ctx;
        const gs = this.gridSize;
        const len = this.snake.length;

        for (let i = 0; i < len; i++) {
            const seg = this.snake[i];
            const ratio = 1 - (i / len) * 0.5;
            const px = seg.x * gs;
            const py = seg.y * gs;
            const pad = 1;

            if (i === 0) {
                const headSize = gs - pad * 2;
                const radius = headSize * 0.4;

                ctx.shadowColor = '#43e97b';
                ctx.shadowBlur = 12;

                ctx.fillStyle = '#43e97b';
                this.roundRect(ctx, px + pad, py + pad, headSize, headSize, radius);
                ctx.fill();

                ctx.shadowBlur = 0;
                this.drawEyes(px, py, gs);
            } else {
                const green = Math.floor(180 + 53 * ratio);
                const blue = Math.floor(80 + 43 * ratio);
                ctx.fillStyle = `rgb(${Math.floor(30 * ratio)}, ${green}, ${blue})`;

                const bodyPad = 2;
                const bodySize = gs - bodyPad * 2;
                const radius = bodySize * 0.3;

                this.roundRect(ctx, px + bodyPad, py + bodyPad, bodySize, bodySize, radius);
                ctx.fill();

                if (i % 3 === 0) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * ratio})`;
                    const dotSize = bodySize * 0.3;
                    ctx.beginPath();
                    ctx.arc(px + gs / 2, py + gs / 2, dotSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    drawEyes(px, py, gs) {
        const ctx = this.ctx;
        const cx = px + gs / 2;
        const cy = py + gs / 2;

        const eyeSpread = gs * 0.22;
        const eyeForward = gs * 0.15;

        if (this.direction === DIR.RIGHT) {
            this.drawSingleEye(ctx, cx + eyeForward, cy - eyeSpread, gs);
            this.drawSingleEye(ctx, cx + eyeForward, cy + eyeSpread, gs);
        } else if (this.direction === DIR.LEFT) {
            this.drawSingleEye(ctx, cx - eyeForward, cy - eyeSpread, gs);
            this.drawSingleEye(ctx, cx - eyeForward, cy + eyeSpread, gs);
        } else if (this.direction === DIR.UP) {
            this.drawSingleEye(ctx, cx - eyeSpread, cy - eyeForward, gs);
            this.drawSingleEye(ctx, cx + eyeSpread, cy - eyeForward, gs);
        } else {
            this.drawSingleEye(ctx, cx - eyeSpread, cy + eyeForward, gs);
            this.drawSingleEye(ctx, cx + eyeSpread, cy + eyeForward, gs);
        }
    }

    drawSingleEye(ctx, ex, ey, gs) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex, ey, gs * 0.13, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(ex, ey, gs * 0.06, 0, Math.PI * 2);
        ctx.fill();
    }

    drawFood() {
        if (!this.food) return;
        const ctx = this.ctx;
        const gs = this.gridSize;
        const fx = this.food.x * gs;
        const fy = this.food.y * gs;

        const breathe = Math.sin(this.foodAnimPhase) * 0.1 + 1;
        const size = gs * breathe;

        ctx.shadowColor = this.foodType.color;
        ctx.shadowBlur = 15 + Math.sin(this.foodAnimPhase * 2) * 5;

        ctx.fillStyle = this.foodType.color + '33';
        ctx.beginPath();
        ctx.arc(fx + gs / 2, fy + gs / 2, size / 2 + 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.font = `${Math.floor(size * 0.8)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.foodType.emoji, fx + gs / 2, fy + gs / 2 + 1);

        ctx.font = `bold ${Math.floor(gs * 0.35)}px 'Noto Sans SC', sans-serif`;
        ctx.fillStyle = this.foodType.color;
        ctx.fillText(`+${this.foodType.points}`, fx + gs / 2, fy - 4);
    }

    drawBombWarningZones() {
        const ctx = this.ctx;
        const gs = this.gridSize;
        const pulse = Math.sin(this.bombAnimPhase * 2) * 0.3 + 0.5;

        for (const bomb of this.bombs) {
            const bx = bomb.x * gs;
            const by = bomb.y * gs;

            ctx.fillStyle = `rgba(255, 71, 87, ${0.06 * pulse})`;
            ctx.fillRect(bx - gs * 0.2, by - gs * 0.2, gs * 1.4, gs * 1.4);
        }
    }

    drawBombs() {
        const ctx = this.ctx;
        const gs = this.gridSize;

        for (const bomb of this.bombs) {
            const bx = bomb.x * gs;
            const by = bomb.y * gs;

            const shake = Math.sin(this.bombAnimPhase * 3 + bomb.x * 0.5) * 1.5;
            const wobble = Math.cos(this.bombAnimPhase * 2.5 + bomb.y * 0.7) * 1;

            const glowIntensity = 8 + Math.sin(this.bombAnimPhase * 4) * 4;
            ctx.shadowColor = BOMB_CONFIG.color;
            ctx.shadowBlur = glowIntensity;

            ctx.font = `${Math.floor(gs * 0.85)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                BOMB_CONFIG.emoji,
                bx + gs / 2 + shake,
                by + gs / 2 + wobble + 1
            );

            ctx.shadowBlur = 0;

            ctx.font = `bold ${Math.floor(gs * 0.32)}px 'Noto Sans SC', sans-serif`;
            ctx.fillStyle = '#ff4757';
            ctx.fillText(`-${BOMB_CONFIG.penalty}`, bx + gs / 2 + shake, by - 3 + wobble);
        }
    }

    drawParticles() {
        const ctx = this.ctx;
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawBorder() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(67, 233, 123, 0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, this.canvas.width - 2, this.canvas.height - 2);
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    getDifficultyLabel() {
        return SPEED_LABEL[this.difficulty] || '简单';
    }
}

export { DIR };
