import { dateKey } from './util.js';

const PAST_DAYS = 14;
const FORECAST_DAYS = 7;
const EMA_ALPHA = 0.3;

const TOKENS = {
  ink: '#1e3a4c',
  muted: '#7f97a4',
  line: 'rgba(30, 58, 76, 0.1)',
  thriving: 'rgba(180, 215, 190, 0.35)',
  watch:    'rgba(230, 220, 170, 0.38)',
  struggle: 'rgba(210, 170, 170, 0.35)',
};

export function mount(canvas, entries) {
  const render = () => renderChart(canvas, entries);
  render();
  window.addEventListener('resize', render);
  return () => window.removeEventListener('resize', render);
}

export function renderChart(canvas, entries) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const cssW = canvas.clientWidth || 460;
  const cssH = canvas.clientHeight || 180;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const padL = 14, padR = 14, padT = 14, padB = 18;
  const chartW = cssW - padL - padR;
  const chartH = cssH - padT - padB;

  const totalCols = PAST_DAYS + FORECAST_DAYS;
  const stepX = chartW / (totalCols - 1);
  const moodToY = m => padT + chartH - ((m - 1) / 4) * chartH;

  drawZones(ctx, padL, padT, chartW, chartH, moodToY);
  drawDividers(ctx, padL, padT, chartW, chartH, moodToY);

  const series = buildSeries(entries);
  const smoothed = smoothEMA(series, EMA_ALPHA);

  drawRawDots(ctx, series, padL, stepX, moodToY);
  drawTrendLine(ctx, smoothed, padL, stepX, moodToY);

  const lastIdx = lastDefinedIndex(smoothed);
  if (lastIdx >= 2) {
    const forecast = forecastFromSmoothed(smoothed, lastIdx);
    drawForecast(ctx, smoothed[lastIdx], forecast, padL, stepX, moodToY);
  }

  drawTodayMarker(ctx, padL + (PAST_DAYS - 1) * stepX, padT, chartH);
}

function buildSeries(entries) {
  const entryByDate = {};
  for (const e of entries) {
    const k = dateKey(e.date);
    if (!(k in entryByDate)) entryByDate[k] = e.mood;
  }
  const out = [];
  for (let i = PAST_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dateKey(d);
    out.push(entryByDate[k] ?? null);
  }
  return out;
}

function smoothEMA(series, alpha) {
  const out = new Array(series.length).fill(null);
  let prev = null;
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (v == null) {
      if (prev != null) out[i] = prev;
      continue;
    }
    prev = prev == null ? v : alpha * v + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}

function lastDefinedIndex(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i;
  return -1;
}

function forecastFromSmoothed(smoothed, lastIdx) {
  const windowSize = Math.min(10, lastIdx + 1);
  const startIdx = lastIdx - windowSize + 1;
  const pts = [];
  let totalW = 0, wSumX = 0, wSumY = 0;
  for (let i = startIdx; i <= lastIdx; i++) {
    if (smoothed[i] == null) continue;
    const w = (i - startIdx + 1) / windowSize;
    pts.push({ x: i, y: smoothed[i], w });
    totalW += w;
    wSumX += w * i;
    wSumY += w * smoothed[i];
  }
  if (pts.length < 2) return [];

  const meanX = wSumX / totalW;
  const meanY = wSumY / totalW;
  let num = 0, den = 0;
  for (const p of pts) {
    num += p.w * (p.x - meanX) * (p.y - meanY);
    den += p.w * (p.x - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  const out = [];
  for (let i = 1; i <= FORECAST_DAYS; i++) {
    const x = lastIdx + i;
    const y = clamp(intercept + slope * x, 1, 5);
    const spread = 0.3 + (0.7 - 0.3) * ((i - 1) / (FORECAST_DAYS - 1));
    out.push({ offset: i, y, spread });
  }
  return out;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function drawZones(ctx, padL, padT, chartW, chartH, moodToY) {
  const yThrivingBot = moodToY(3.5);
  const yWatchBot = moodToY(2.5);
  ctx.fillStyle = TOKENS.thriving;
  ctx.fillRect(padL, padT, chartW, yThrivingBot - padT);
  ctx.fillStyle = TOKENS.watch;
  ctx.fillRect(padL, yThrivingBot, chartW, yWatchBot - yThrivingBot);
  ctx.fillStyle = TOKENS.struggle;
  ctx.fillRect(padL, yWatchBot, chartW, padT + chartH - yWatchBot);
}

function drawDividers(ctx, padL, padT, chartW, chartH, moodToY) {
  ctx.strokeStyle = TOKENS.line;
  ctx.lineWidth = 0.5;
  [3.5, 2.5].forEach(m => {
    const y = moodToY(m);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();
  });
}

function drawRawDots(ctx, series, padL, stepX, moodToY) {
  ctx.fillStyle = TOKENS.muted;
  ctx.globalAlpha = 0.4;
  series.forEach((v, i) => {
    if (v == null) return;
    ctx.beginPath();
    ctx.arc(padL + i * stepX, moodToY(v), 2.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawTrendLine(ctx, smoothed, padL, stepX, moodToY) {
  const pts = [];
  smoothed.forEach((v, i) => {
    if (v == null) return;
    pts.push({ x: padL + i * stepX, y: moodToY(v) });
  });
  if (pts.length < 2) return;
  ctx.strokeStyle = TOKENS.ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();
}

function drawForecast(ctx, lastSmoothed, forecast, padL, stepX, moodToY) {
  if (forecast.length === 0) return;
  const lastIdx = PAST_DAYS - 1;
  const startX = padL + lastIdx * stepX;
  const startY = moodToY(lastSmoothed);

  ctx.fillStyle = TOKENS.ink;
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  forecast.forEach(f => {
    const x = padL + (lastIdx + f.offset) * stepX;
    ctx.lineTo(x, moodToY(f.y + f.spread));
  });
  for (let i = forecast.length - 1; i >= 0; i--) {
    const f = forecast[i];
    const x = padL + (lastIdx + f.offset) * stepX;
    ctx.lineTo(x, moodToY(f.y - f.spread));
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = TOKENS.ink;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  forecast.forEach(f => {
    const x = padL + (lastIdx + f.offset) * stepX;
    ctx.lineTo(x, moodToY(f.y));
  });
  ctx.stroke();
  ctx.setLineDash([]);

  const last = forecast[forecast.length - 1];
  const endX = padL + (lastIdx + last.offset) * stepX;
  const endY = moodToY(last.y);
  ctx.beginPath();
  ctx.arc(endX, endY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = TOKENS.ink;
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawTodayMarker(ctx, x, padT, chartH) {
  ctx.strokeStyle = TOKENS.muted;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x, padT);
  ctx.lineTo(x, padT + chartH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}
