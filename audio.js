/**
 * audio.js - 音频模块
 * 使用 Web Audio API 生成游戏音效和背景音乐
 */

// 音频上下文（延迟初始化，需要用户交互后才能创建）
let audioCtx = null;

/**
 * 确保音频上下文已初始化
 */
function ensureContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

/**
 * 播放吃食物音效 - 清脆的上升音
 */
export function playEatSound() {
    try {
        const ctx = ensureContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
        // 静默处理
    }
}

/**
 * 播放游戏结束音效 - 下降的悲伤音
 */
export function playGameOverSound() {
    try {
        const ctx = ensureContext();

        // 第一个音
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(500, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
        gain1.gain.setValueAtTime(0.12, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.4);

        // 第二个音（延迟）
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(350, ctx.currentTime + 0.2);
        osc2.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.6);
        gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
        osc2.start(ctx.currentTime + 0.2);
        osc2.stop(ctx.currentTime + 0.7);
    } catch (e) {
        // 静默处理
    }
}

/**
 * 播放按钮点击音效
 */
export function playClickSound() {
    try {
        const ctx = ensureContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        // 静默处理
    }
}

/**
 * 播放转向音效
 */
export function playTurnSound() {
    try {
        const ctx = ensureContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);

        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
        // 静默处理
    }
}

/* ========== 背景音乐模块 ========== */

let bgmInterval = null;
let bgmPlaying = false;

// 简单的旋律音符序列（频率）
const melodyNotes = [
    523, 587, 659, 698, 784, 698, 659, 587,
    523, 440, 494, 523, 587, 523, 494, 440,
    392, 440, 494, 523, 587, 659, 587, 523,
    494, 440, 392, 440, 494, 523, 494, 440
];

let noteIndex = 0;

function playBgmNote() {
    try {
        const ctx = ensureContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        const freq = melodyNotes[noteIndex % melodyNotes.length];
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.28);

        noteIndex++;
    } catch (e) {
        // 静默处理
    }
}

/**
 * 开始播放背景音乐
 */
export function startBgm() {
    if (bgmPlaying) return;
    bgmPlaying = true;
    noteIndex = 0;
    bgmInterval = setInterval(playBgmNote, 300);
}

/**
 * 停止背景音乐
 */
export function stopBgm() {
    bgmPlaying = false;
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
}

/**
 * 背景音乐是否正在播放
 */
export function isBgmPlaying() {
    return bgmPlaying;
}
