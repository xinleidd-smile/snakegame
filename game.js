/**
 * game.js - 贪吃蛇游戏核心逻辑
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

// 食物类型及其分值和颜色
const FOOD_TYPES = [
    { emoji: '🍎', points: 10, color: '#ff4757' },
    { emoji: '🍊', points: 15, color: '#ffa502' },
    { emoji: '🍇', points: 20, color: '#8e44ad' },
    { emoji: '🍓', points: 25, color: '#e84393' },
    { emoji: '⭐', points: 50, color: '#ffd200' }
];

export class SnakeGame {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // 网格配置
        this.gridSize = 20; // 每个格子的像素大小
        this.cols = 0;
        this.rows = 0;

        // 游戏状态
        this.state = 'idle'; // idle | playing | paused | gameover
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('snake_best') || '0');
        this.difficulty = 'easy';

        // 蛇
        this.snake = [];
        this.direction = DIR.RIGHT;
        this.nextDirection = DIR.RIGHT;
        this.growing = 0;

        // 食物
        this.food = null;
        this.foodType = null;
        this.foodAnimPhase = 0;

        // 特效粒子
        this.particles = [];

        // 游戏循环
        this.lastTime = 0;
        this.accumulator = 0;
        this.animFrameId = null;

        // 回调
        this.onScoreChange = options.onScoreChange || (() => {});
        this.onBestScoreChange = options.onBestScoreChange || (() => {});
        this.onGameOver = options.onGameOver || (() => {});
        this.onEat = options.onEat || (() => {});
        this.onStateChange = options.onStateChange || (() => {});

        // 初始化画布尺寸
        this.resize();
    }

    /**
     * 调整画布大小
     */
    resize() {
        const wrapper = this.canvas.parentElement;
        const maxW = Math.min(wrapper.clientWidth || 600, 600);
        // 保持正方形或接近正方形
        const maxH = Math.min(window.innerHeight * 0.5, maxW);

        this.cols = Math.floor(maxW / this.gridSize);
        this.rows = Math.floor(maxH / this.gridSize);

        // 确保最小尺寸
        this.cols = Math.max(this.cols, 15);
        this.rows = Math.max(this.rows, 15);

        this.canvas.width = this.cols * this.gridSize;
        this.canvas.height = this.rows * this.gridSize;
        this.canvas.style.width = this.canvas.width + 'px';
        this.canvas.style.height = this.canvas.height + 'px';
    }

    /**
     * 设置难度
     */
    setDifficulty(level) {
        this.difficulty = level;
    }

    /**
     * 获取当前速度（毫秒/步）
     */
    getSpeed() {
        return SPEED_MAP[this.difficulty] || 150;
    }

    /**
     * 初始化/重置游戏
     */
    reset() {
        // 蛇初始位置（中间偏左）
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
        this.particles = [];
        this.onScoreChange(this.score);
        this.spawnFood();
    }

    /**
     * 开始游戏
     */
    start() {
        this.reset();
        this.state = 'playing';
        this.onStateChange(this.state);
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.gameLoop(this.lastTime);
    }

    /**
     * 暂停/恢复
     */
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

    /**
     * 停止游戏循环
     */
    stop() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    /**
     * 设置方向
     */
    setDirection(dir) {
        // 防止180度转弯
        if (dir.x + this.direction.x === 0 && dir.y + this.direction.y === 0) return;
        this.nextDirection = dir;
    }

    /**
     * 生成食物
     */
    spawnFood() {
        const occupied = new Set(this.snake.map(s => `${s.x},${s.y}`));
        let attempts = 0;
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * this.cols),
                y: Math.floor(Math.random() * this.rows)
            };
            attempts++;
        } while (occupied.has(`${pos.x},${pos.y}`) && attempts < 1000);

        this.food = pos;

        // 随机食物类型，稀有食物概率更低
        const rand = Math.random();
        if (rand < 0.05) {
            this.foodType = FOOD_TYPES[4]; // ⭐ 5%
        } else if (rand < 0.15) {
            this.foodType = FOOD_TYPES[3]; // 🍓 10%
        } else if (rand < 0.30) {
            this.foodType = FOOD_TYPES[2]; // 🍇 15%
        } else if (rand < 0.55) {
            this.foodType = FOOD_TYPES[1]; // 🍊 25%
        } else {
            this.foodType = FOOD_TYPES[0]; // 🍎 45%
        }
    }

    /**
     * 游戏主循环
     */
    gameLoop(timestamp) {
        if (this.state !== 'playing') return;

        const delta = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.accumulator += delta;

        const speed = this.getSpeed();

        // 逻辑更新
        while (this.accumulator >= speed) {
            this.update();
            this.accumulator -= speed;
            if (this.state !== 'playing') return;
        }

        // 渲染
        this.render();

        // 更新粒子
        this.updateParticles();

        // 食物动画相位
        this.foodAnimPhase += delta * 0.003;

        this.animFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }

    /**
     * 逻辑更新（每步）
     */
    update() {
        this.direction = this.nextDirection;

        const head = this.snake[0];
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };

        // 碰墙检测
        if (newHead.x < 0 || newHead.x >= this.cols || newHead.y < 0 || newHead.y >= this.rows) {
            this.gameOver();
            return;
        }

        // 碰自身检测
        for (let i = 0; i < this.snake.length; i++) {
            if (this.snake[i].x === newHead.x && this.snake[i].y === newHead.y) {
                this.gameOver();
                return;
            }
        }

        // 移动蛇
        this.snake.unshift(newHead);

        // 吃食物检测
        if (this.food && newHead.x === this.food.x && newHead.y === this.food.y) {
            this.score += this.foodType.points;
            this.onScoreChange(this.score);
            this.onEat(this.food, this.foodType);

            // 生成吃食物粒子
            this.spawnEatParticles(this.food.x, this.food.y, this.foodType.color);

            // 蛇增长（不移除尾部）
            this.spawnFood();
        } else {
            // 正常移动，移除尾部
            if (this.growing > 0) {
                this.growing--;
            } else {
                this.snake.pop();
            }
        }
    }

    /**
     * 游戏结束
     */
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

        // 最后渲染一帧（显示碰撞状态）
        this.render();
    }

    /**
     * 生成吃食物粒子特效
     */
    spawnEatParticles(gx, gy, color) {
        const cx = (gx + 0.5) * this.gridSize;
        const cy = (gy + 0.5) * this.gridSize;
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
            const speed = 1.5 + Math.random() * 3;
            this.particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.02 + Math.random() * 0.02,
                size: 3 + Math.random() * 4,
                color: color
            });
        }
    }

    /**
     * 更新粒子
     */
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

    /**
     * 渲染
     */
    render() {
        const ctx = this.ctx;
        const gs = this.gridSize;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 清空画布
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, w, h);

        // 绘制网格
        this.drawGrid();

        // 绘制食物
        this.drawFood();

        // 绘制蛇
        this.drawSnake();

        // 绘制粒子
        this.drawParticles();

        // 绘制边框
        this.drawBorder();
    }

    /**
     * 绘制网格背景
     */
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

    /**
     * 绘制蛇
     */
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
                // 蛇头 - 更大更圆
                const headSize = gs - pad * 2;
                const radius = headSize * 0.4;

                // 发光效果
                ctx.shadowColor = '#43e97b';
                ctx.shadowBlur = 12;

                ctx.fillStyle = '#43e97b';
                this.roundRect(ctx, px + pad, py + pad, headSize, headSize, radius);
                ctx.fill();

                ctx.shadowBlur = 0;

                // 眼睛
                this.drawEyes(px, py, gs);
            } else {
                // 蛇身 - 渐变色
                const green = Math.floor(180 + 53 * ratio);
                const blue = Math.floor(80 + 43 * ratio);
                ctx.fillStyle = `rgb(${Math.floor(30 * ratio)}, ${green}, ${blue})`;

                const bodyPad = 2;
                const bodySize = gs - bodyPad * 2;
                const radius = bodySize * 0.3;

                this.roundRect(ctx, px + bodyPad, py + bodyPad, bodySize, bodySize, radius);
                ctx.fill();

                // 身体花纹（每隔一段）
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

    /**
     * 绘制蛇眼睛
     */
    drawEyes(px, py, gs) {
        const ctx = this.ctx;
        const cx = px + gs / 2;
        const cy = py + gs / 2;

        // 根据方向确定眼睛位置
        let eyeOffsetX = 0, eyeOffsetY = 0;
        const eyeSpread = gs * 0.22;
        const eyeForward = gs * 0.15;

        if (this.direction === DIR.RIGHT) {
            eyeOffsetX = eyeForward;
            // 两只眼睛上下分布
            this.drawSingleEye(ctx, cx + eyeOffsetX, cy - eyeSpread, gs);
            this.drawSingleEye(ctx, cx + eyeOffsetX, cy + eyeSpread, gs);
        } else if (this.direction === DIR.LEFT) {
            eyeOffsetX = -eyeForward;
            this.drawSingleEye(ctx, cx + eyeOffsetX, cy - eyeSpread, gs);
            this.drawSingleEye(ctx, cx + eyeOffsetX, cy + eyeSpread, gs);
        } else if (this.direction === DIR.UP) {
            eyeOffsetY = -eyeForward;
            this.drawSingleEye(ctx, cx - eyeSpread, cy + eyeOffsetY, gs);
            this.drawSingleEye(ctx, cx + eyeSpread, cy + eyeOffsetY, gs);
        } else {
            eyeOffsetY = eyeForward;
            this.drawSingleEye(ctx, cx - eyeSpread, cy + eyeOffsetY, gs);
            this.drawSingleEye(ctx, cx + eyeSpread, cy + eyeOffsetY, gs);
        }
    }

    /**
     * 绘制单只眼睛
     */
    drawSingleEye(ctx, ex, ey, gs) {
        // 白色眼球
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex, ey, gs * 0.13, 0, Math.PI * 2);
        ctx.fill();

        // 黑色瞳孔
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(ex, ey, gs * 0.06, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 绘制食物
     */
    drawFood() {
        if (!this.food) return;
        const ctx = this.ctx;
        const gs = this.gridSize;
        const fx = this.food.x * gs;
        const fy = this.food.y * gs;

        // 食物呼吸动画
        const breathe = Math.sin(this.foodAnimPhase) * 0.1 + 1;
        const size = gs * breathe;
        const offset = (gs - size) / 2;

        // 发光效果
        ctx.shadowColor = this.foodType.color;
        ctx.shadowBlur = 15 + Math.sin(this.foodAnimPhase * 2) * 5;

        // 绘制食物背景圆
        ctx.fillStyle = this.foodType.color + '33';
        ctx.beginPath();
        ctx.arc(fx + gs / 2, fy + gs / 2, size / 2 + 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        // 绘制emoji食物
        ctx.font = `${Math.floor(size * 0.8)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.foodType.emoji, fx + gs / 2, fy + gs / 2 + 1);

        // 分值提示
        ctx.font = `bold ${Math.floor(gs * 0.35)}px 'Noto Sans SC', sans-serif`;
        ctx.fillStyle = this.foodType.color;
        ctx.fillText(`+${this.foodType.points}`, fx + gs / 2, fy - 4);
    }

    /**
     * 绘制粒子
     */
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

    /**
     * 绘制边框
     */
    drawBorder() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(67, 233, 123, 0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, this.canvas.width - 2, this.canvas.height - 2);
    }

    /**
     * 圆角矩形辅助
     */
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

    /**
     * 获取难度标签
     */
    getDifficultyLabel() {
        return SPEED_LABEL[this.difficulty] || '简单';
    }
}

// 导出方向常量供外部使用
export { DIR };
