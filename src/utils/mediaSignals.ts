/**
 * Real browser-side signal extraction. Every number here is computed from the
 * uploaded file's actual bytes/pixels/samples — nothing is simulated.
 */
import { encodeWav, segmentSamples } from "./audioSegments";

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Could not decode image"));
    img.src = url;
  });

const fileToDataURL = (f: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });

const AI_GENERATORS =
  /(OpenAI|ChatGPT|DALL[·.\-]?E|GPT-4o|gpt-image|Adobe Firefly|Midjourney|Stable Diffusion|Imagen|Gemini|Bing Image Creator|Microsoft Designer|Ideogram|Leonardo\.Ai)/gi;

/**
 * Provenance metadata: C2PA Content Credentials (JUMBF "c2pa" boxes) and the IPTC DigitalSourceType
 * values that mark generative-AI output. Their presence is meaningful; their absence proves nothing
 * (screenshots, messaging apps and most editors strip them).
 */
async function readProvenance(
  file: File,
): Promise<{ c2paManifest: boolean; provenanceAI: boolean; provenanceHints: string }> {
  const bytes = new Uint8Array(
    await file.slice(0, Math.min(file.size, 30 * 1024 * 1024)).arrayBuffer(),
  );
  const text = new TextDecoder("latin1").decode(bytes);
  const c2paManifest = /c2pa/.test(text) && /jumb|jumd/.test(text);
  const sourceType =
    /compositeWithTrainedAlgorithmicMedia|trainedAlgorithmicMedia|algorithmicMedia/.exec(text)?.[0];
  const hints =
    c2paManifest || sourceType || /<x:xmpmeta/.test(text)
      ? Array.from(new Set((text.match(AI_GENERATORS) || []).map((h) => h.trim())))
      : [];
  const provenanceAI = !!sourceType || (c2paManifest && hints.length > 0);
  return {
    c2paManifest,
    provenanceAI,
    provenanceHints: [...(sourceType ? [sourceType] : []), ...hints].slice(0, 4).join(", "),
  };
}

/** Scan JPEG APP1 for an Exif block and pull the ASCII Software tag if present. */
async function readExif(file: File): Promise<{ hasExif: boolean; software?: string }> {
  const buf = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const text = new TextDecoder("latin1").decode(buf);
  const hasExif = text.includes("Exif\0\0") || /<x:xmpmeta/.test(text);
  const sw = text.match(
    /(Adobe Photoshop[^\0]{0,30}|GIMP[^\0]{0,10}|Stable Diffusion|Midjourney|DALL·?E|Firefly|Canva|Snapseed[^\0]{0,10})/i,
  );
  return { hasExif, software: sw?.[1]?.trim() };
}

export interface ImageSignals {
  measurements: Record<string, number | string | boolean>;
  elaDataUrl: string;
  previewDataUrl: string;
  /** Quadrant crops at native resolution (≤1024px each) for close inspection by the model. */
  detailTiles: string[];
}

function quadrantTiles(img: HTMLImageElement): string[] {
  const W = img.naturalWidth,
    H = img.naturalHeight;
  if (Math.max(W, H) < 768) return [];
  const tw = Math.ceil(W / 2),
    th = Math.ceil(H / 2),
    s = Math.min(1, 1024 / Math.max(tw, th));
  const c = document.createElement("canvas");
  c.width = Math.round(tw * s);
  c.height = Math.round(th * s);
  const ctx = c.getContext("2d")!;
  return [
    [0, 0],
    [tw, 0],
    [0, th],
    [tw, th],
  ].map(([x, y]) => {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, x, y, tw, th, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.92);
  });
}

/** Error Level Analysis: re-encode at JPEG q=0.90, amplify |original − recompressed|. */
export async function analyzeImage(file: File, amplify = 15): Promise<ImageSignals> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // 1536px keeps enough detail for generation-artifact inspection when the original is too large to send
    const scale = Math.min(1, 1536 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale),
      h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const orig = ctx.getImageData(0, 0, w, h);
    // Never add lossy compression before analysis: tests showed JPEG re-encoding (even q=0.92) erases the
    // fine-grained detail a vision model uses to recognise generated images (99% → 0% on the same picture).
    // Send the original bytes when reasonable; otherwise downscale losslessly (PNG).
    const sendOriginal =
      file.size <= 8 * 1024 * 1024 &&
      Math.max(img.naturalWidth, img.naturalHeight) <= 3072 &&
      /image\/(png|jpeg|webp)/.test(file.type);
    const previewDataUrl = sendOriginal ? await fileToDataURL(file) : c.toDataURL("image/png");

    const reBlob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
    const reUrl = URL.createObjectURL(reBlob);
    const re = await loadImage(reUrl);
    URL.revokeObjectURL(reUrl);
    const c2 = document.createElement("canvas");
    c2.width = w;
    c2.height = h;
    const ctx2 = c2.getContext("2d", { willReadFrequently: true })!;
    ctx2.drawImage(re, 0, 0);
    const rec = ctx2.getImageData(0, 0, w, h);

    const out = ctx2.createImageData(w, h);
    const B = 16,
      bw = Math.ceil(w / B),
      bh = Math.ceil(h / B);
    const blockSum = new Float64Array(bw * bh),
      blockN = new Float64Array(bw * bh);
    let total = 0;
    for (let i = 0; i < orig.data.length; i += 4) {
      const d =
        (Math.abs(orig.data[i] - rec.data[i]) +
          Math.abs(orig.data[i + 1] - rec.data[i + 1]) +
          Math.abs(orig.data[i + 2] - rec.data[i + 2])) /
        3;
      total += d;
      const v = Math.min(255, d * amplify);
      out.data[i] = v;
      out.data[i + 1] = v * 0.85;
      out.data[i + 2] = Math.min(255, v * 1.4);
      out.data[i + 3] = 255;
      const px = (i / 4) % w,
        py = Math.floor(i / 4 / w);
      const bi = Math.floor(py / B) * bw + Math.floor(px / B);
      blockSum[bi] += d;
      blockN[bi]++;
    }
    ctx2.putImageData(out, 0, 0);
    const blocks = Array.from(blockSum, (s, i) => s / (blockN[i] || 1)).sort((a, b) => a - b);
    const median = blocks[Math.floor(blocks.length / 2)] || 0.0001;
    const p99 = blocks[Math.floor(blocks.length * 0.99)] || 0;
    const mean = total / (w * h);
    const exif =
      file.type.includes("jpeg") || /\.jpe?g$/i.test(file.name)
        ? await readExif(file)
        : { hasExif: false };
    const provenance = await readProvenance(file);
    return {
      elaDataUrl: c2.toDataURL("image/png"),
      previewDataUrl,
      detailTiles: quadrantTiles(img),
      measurements: {
        analysisInput: sendOriginal ? "original file bytes" : `lossless PNG resize to ${w}×${h}`,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: file.type || "unknown",
        fileSizeKB: Math.round(file.size / 1024),
        elaMean: Number(mean.toFixed(3)),
        elaScore: Math.min(100, Math.round(mean * 12)),
        elaBlockRatio: Number((p99 / Math.max(median, 0.05)).toFixed(2)),
        hasExif: exif.hasExif,
        ...(exif.software ? { exifSoftware: exif.software } : {}),
        c2paManifest: provenance.c2paManifest,
        provenanceAI: provenance.provenanceAI,
        ...(provenance.provenanceHints ? { provenanceHints: provenance.provenanceHints } : {}),
      },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface VideoSignals {
  measurements: Record<string, number | string | boolean>;
  frames: { t: number; diff: number; z: number; thumb: string }[];
  keyframes: string[];
}

/** Sample N frames, compute mean absolute difference between consecutive frames, flag z>3 spikes. */
export async function analyzeVideo(
  file: File,
  n = 16,
  onProgress?: (p: number) => void,
  intervalSeconds?: number,
): Promise<VideoSignals> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "auto";
  v.src = url;
  v.playsInline = true;
  await new Promise<void>((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () =>
      rej(new Error("Browser could not decode this video (try MP4/H.264 or WEBM)."));
  });
  // MediaRecorder / screen-recorder WebM files often report duration = Infinity until the browser is
  // forced to scan to the end; seeking far past the end makes it compute the real value.
  if (!isFinite(v.duration) || v.duration <= 0) {
    await new Promise<void>((res) => {
      const done = () => {
        v.ondurationchange = null;
        res();
      };
      v.ondurationchange = () => isFinite(v.duration) && v.duration > 0 && done();
      setTimeout(done, 4000);
      v.currentTime = 1e101;
    });
  }
  const dur = v.duration;
  if (!isFinite(dur) || dur <= 0) {
    URL.revokeObjectURL(url);
    throw new Error(
      "Could not determine the video duration (file may be truncated or still being recorded).",
    );
  }
  if (dur > 3600) {
    URL.revokeObjectURL(url);
    throw new Error(
      "Clip exceeds the one-hour browser processing limit. Trim the relevant interval.",
    );
  }
  if (intervalSeconds) n = Math.max(2, Math.min(32, Math.ceil(dur / intervalSeconds)));
  const W = 160,
    H = Math.max(1, Math.round((160 * v.videoHeight) / (v.videoWidth || 1)));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const big = document.createElement("canvas");
  big.width = 480;
  big.height = Math.round((480 * H) / W);
  const bctx = big.getContext("2d")!;
  const seek = (t: number) =>
    new Promise<void>((res, rej) => {
      const timeout = setTimeout(() => rej(new Error("Video frame seek timed out")), 10000);
      v.onseeked = () => {
        clearTimeout(timeout);
        res();
      };
      v.currentTime = t;
    });
  const frames: VideoSignals["frames"] = [];
  let prev: Uint8ClampedArray | null = null;
  for (let i = 0; i < n; i++) {
    const t = Math.min(dur - 0.05, (dur * (i + 0.5)) / n);
    await seek(Math.max(0, t));
    ctx.drawImage(v, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let diff = 0;
    if (prev) {
      for (let k = 0; k < d.length; k += 4)
        diff +=
          Math.abs(d[k] - prev[k]) +
          Math.abs(d[k + 1] - prev[k + 1]) +
          Math.abs(d[k + 2] - prev[k + 2]);
      diff /= (d.length / 4) * 3;
    }
    prev = new Uint8ClampedArray(d);
    bctx.drawImage(v, 0, 0, big.width, big.height);
    frames.push({ t, diff, z: 0, thumb: big.toDataURL("image/jpeg", 0.7) });
    onProgress?.((i + 1) / n);
  }
  URL.revokeObjectURL(url);
  const diffs = frames
    .slice(1)
    .map((f) => f.diff)
    .sort((a, b) => a - b);
  // Robust z-score (median / MAD) so one big cut does not hide itself
  const med = diffs[Math.floor(diffs.length / 2)] || 0;
  const mad =
    diffs.map((d) => Math.abs(d - med)).sort((a, b) => a - b)[Math.floor(diffs.length / 2)] || 0.5;
  frames.forEach(
    (f, i) => (f.z = i === 0 ? 0 : Number(((f.diff - med) / (1.4826 * mad)).toFixed(2))),
  );
  const cuts = frames.filter((f) => f.z > 3);
  const mean = diffs.reduce((s, d) => s + d, 0) / (diffs.length || 1);
  return {
    frames,
    keyframes: frames.map((f) => f.thumb),
    measurements: {
      duration: Number(dur.toFixed(2)),
      width: v.videoWidth,
      height: v.videoHeight,
      framesSampled: n,
      samplingIntervalSeconds: Number((dur / n).toFixed(2)),
      fileSizeKB: Math.round(file.size / 1024),
      meanFrameDiff: Number(mean.toFixed(2)),
      cutCount: cuts.length,
      cutTimes: cuts.map((c) => c.t.toFixed(1) + "s").join(", "),
    },
  };
}

/** In-place radix-2 FFT, returns magnitudes of the first half. */
function fftMag(re: Float32Array): Float32Array {
  const n = re.length,
    im = new Float32Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len,
      wr = Math.cos(ang),
      wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1,
        ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  const out = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(re[i], im[i]);
  return out;
}

export interface AudioSignals {
  segments: { start: number; end: number; data: string }[];
  measurements: Record<string, number | string | boolean>;
  waveform: number[];
  spectrogram: Float32Array[]; // columns of dB magnitudes
  sampleRate: number;
}

export async function analyzeAudio(file: File): Promise<AudioSignals> {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ac = new Ctx();
  let buf: AudioBuffer;
  try {
    buf = await ac.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("Browser could not decode this audio file (try MP3/WAV/M4A).");
  } finally {
    ac.close();
  }
  const x = buf.getChannelData(0),
    sr = buf.sampleRate;
  if (buf.duration > 120)
    throw new Error(
      "Browser audio analysis supports clips up to 120 seconds. Trim the interval of interest.",
    );
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * 16000)), 16000);
  const source = offline.createBufferSource();
  source.buffer = buf;
  source.connect(offline.destination);
  source.start();
  const mono = (await offline.startRendering()).getChannelData(0);
  const segments = await Promise.all(
    segmentSamples(mono, 16000, 5).map(async (s) => ({
      start: s.start,
      end: s.end,
      data: await fileToDataURL(new Blob([encodeWav(s.samples, 16000)], { type: "audio/wav" })),
    })),
  );
  // waveform envelope
  const bins = 600,
    step = Math.floor(x.length / bins) || 1;
  const waveform: number[] = [];
  for (let b = 0; b < bins; b++) {
    let m = 0;
    for (let i = b * step; i < (b + 1) * step && i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
    waveform.push(m);
  }
  // frame RMS for pauses / loudness variation (20 ms)
  const fl = Math.floor(sr * 0.02),
    rms: number[] = [];
  let clip = 0;
  for (let i = 0; i + fl <= x.length; i += fl) {
    let s = 0;
    for (let k = i; k < i + fl; k++) {
      s += x[k] * x[k];
      if (Math.abs(x[k]) > 0.99) clip++;
    }
    rms.push(Math.sqrt(s / fl));
  }
  const peak = Math.max(...rms, 1e-6);
  const pauseRatio = rms.filter((r) => r < peak * 0.05).length / (rms.length || 1);
  const voiced = rms.filter((r) => r >= peak * 0.05);
  const vm = voiced.reduce((s, r) => s + r, 0) / (voiced.length || 1);
  const rmsCV =
    Math.sqrt(voiced.reduce((s, r) => s + (r - vm) ** 2, 0) / (voiced.length || 1)) / (vm || 1);
  // spectrogram + spectral stats
  const N = 1024,
    hop = Math.max(N, Math.floor(x.length / 300));
  const spectrogram: Float32Array[] = [];
  let hf = 0,
    tot = 0,
    rollSum = 0,
    cols = 0;
  const hfBin = Math.floor((8000 / sr) * N);
  for (let i = 0; i + N <= x.length; i += hop) {
    const seg = new Float32Array(N);
    for (let k = 0; k < N; k++)
      seg[k] = x[i + k] * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (N - 1)));
    const mag = fftMag(seg);
    let e = 0;
    const en = new Float32Array(mag.length);
    for (let k = 0; k < mag.length; k++) {
      en[k] = mag[k] * mag[k];
      e += en[k];
    }
    if (e > 1e-6) {
      tot += e;
      for (let k = hfBin; k < mag.length; k++) hf += en[k];
      let acc = 0,
        roll = 0;
      for (let k = 0; k < mag.length; k++) {
        acc += en[k];
        if (acc >= 0.85 * e) {
          roll = k;
          break;
        }
      }
      rollSum += (roll * sr) / N;
      cols++;
    }
    spectrogram.push(mag.map((m) => 20 * Math.log10(m + 1e-6)));
  }
  return {
    waveform,
    spectrogram,
    sampleRate: sr,
    segments,
    measurements: {
      duration: Number(buf.duration.toFixed(2)),
      sampleRate: sr,
      channels: buf.numberOfChannels,
      fileSizeKB: Math.round(file.size / 1024),
      hfEnergyRatio: Number((tot ? hf / tot : 0).toFixed(5)),
      spectralRolloffHz: Math.round(cols ? rollSum / cols : 0),
      pauseRatio: Number(pauseRatio.toFixed(3)),
      rmsCV: Number(rmsCV.toFixed(3)),
      clippingRatio: Number((clip / x.length).toFixed(5)),
    },
  };
}

export async function smallDataUrl(
  file: File,
  maxBytes = 7 * 1024 * 1024,
): Promise<string | undefined> {
  return file.size <= maxBytes ? fileToDataURL(file) : undefined;
}
