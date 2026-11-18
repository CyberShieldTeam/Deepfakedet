import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import type { OcrAttempt, OcrReview, OcrWordBox } from '../types';
import { Button, ErrorBox } from './ui';

const sha256 = async (file: File) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(x => x.toString(16).padStart(2, '0')).join('');

async function transformed(file: File, rotation: number, enhance: boolean): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = enhance && Math.min(bitmap.width, bitmap.height) < 1200 ? Math.min(3, 1200 / Math.min(bitmap.width, bitmap.height)) : 1;
  const swap = Math.abs(rotation) % 180 === 90;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((swap ? bitmap.height : bitmap.width) * scale);
  canvas.height = Math.round((swap ? bitmap.width : bitmap.height) * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180); ctx.scale(scale, scale);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2); bitmap.close();
  if (enhance) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) { const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; const v = Math.max(0, Math.min(255, (y - 128) * 1.35 + 128)); d[i] = d[i + 1] = d[i + 2] = v; }
    ctx.putImageData(image, 0, 0);
  }
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image preprocessing failed')), 'image/png'));
}

const boxesFrom = (data: any): OcrWordBox[] => {
  const words: any[] = [];
  for (const block of data.blocks || []) for (const paragraph of block.paragraphs || []) for (const line of paragraph.lines || []) words.push(...(line.words || []));
  return words.map(w => ({ text: w.text, confidence: w.confidence, x: w.bbox.x0, y: w.bbox.y0, width: w.bbox.x1 - w.bbox.x0, height: w.bbox.y1 - w.bbox.y0 }));
};

export const OcrClaimInput: React.FC<{ onText: (text: string) => void; onReview: (review: OcrReview) => void }> = ({ onText, onReview }) => {
  const [review, setReview] = useState<OcrReview | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const run = async (file: File) => {
    setBusy(true); setError('');
    const worker = await createWorker('eng');
    try {
      const specs = [{ name: 'original', rotation: 0, enhance: false }, { name: 'grayscale-contrast-upscale', rotation: 0, enhance: true }, { name: 'rotate-90-enhanced', rotation: 90, enhance: true }, { name: 'rotate-270-enhanced', rotation: 270, enhance: true }];
      const attempts: OcrAttempt[] = [];
      for (const spec of specs) {
        const blob = await transformed(file, spec.rotation, spec.enhance);
        const { data } = await worker.recognize(blob, {}, { blocks: true } as any);
        attempts.push({ transformation: spec.name, rotationDegrees: spec.rotation, text: data.text.trim(), confidence: Number(data.confidence.toFixed(1)), boxes: boxesFrom(data) });
      }
      const best = attempts.sort((a, b) => (b.text ? b.confidence : -1) - (a.text ? a.confidence : -1))[0];
      const next: OcrReview = { originalText: best?.text || '', reviewedText: best?.text || '', imageSha256: await sha256(file), selectedTransformation: best?.transformation || 'none', attempts, history: [] };
      setReview(next); onText(next.reviewedText); onReview(next);
    } catch (e: any) { setError(e.message || 'OCR failed'); } finally { await worker.terminate(); setBusy(false); }
  };
  return <div className="space-y-2 rounded-lg border border-slate-800 p-3">
    <div className="text-xs font-medium text-slate-300">Extract text from an image (optional)</div>
    <input type="file" accept="image/*" disabled={busy} className="text-xs text-slate-400" onChange={e => e.target.files?.[0] && run(e.target.files[0])} />
    {busy && <div className="text-xs text-cyan-300">Trying four bounded OCR transformations locally…</div>}
    {error && <ErrorBox message={error} />}
    {review && <>
      <textarea rows={5} value={review.reviewedText} onChange={e => { const reviewedText = e.target.value; const next = { ...review, reviewedText }; setReview(next); onText(reviewedText); onReview(next); }} className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm" aria-label="Review and correct OCR text" />
      <div className="flex flex-wrap gap-2 text-[10px] text-slate-500"><span>Selected: {review.selectedTransformation}</span><span>Original OCR preserved</span><span>{review.attempts.find(a => a.transformation === review.selectedTransformation)?.boxes.length || 0} word boxes</span><span className="break-all">SHA-256 {review.imageSha256}</span></div>
      <Button variant="ghost" onClick={() => { const next = { ...review, history: [...review.history, { text: review.reviewedText, changedAt: new Date().toISOString(), note: 'Human-reviewed OCR text' }] }; setReview(next); onReview(next); }}>Record correction</Button>
    </>}
  </div>;
};
