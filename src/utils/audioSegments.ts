/** Encode mono PCM as a real 16-bit WAV; no synthetic detection values are generated. */
export function encodeWav(samples: Float32Array, sampleRate: number) {
  const bytes = new Uint8Array(44 + samples.length * 2),
    view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}
export function segmentSamples(samples: Float32Array, sampleRate: number, seconds = 5) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(seconds) || seconds <= 0)
    throw new Error("Invalid audio segmentation configuration");
  const size = Math.max(1, Math.floor(sampleRate * seconds));
  return Array.from({ length: Math.ceil(samples.length / size) }, (_, i) => ({
    start: (i * size) / sampleRate,
    end: Math.min(samples.length, (i + 1) * size) / sampleRate,
    samples: samples.slice(i * size, (i + 1) * size),
  }));
}
