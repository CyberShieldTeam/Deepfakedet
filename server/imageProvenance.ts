export interface ImageProvenance {
  status: 'absent' | 'valid' | 'trusted' | 'invalid' | 'unknown' | 'unavailable';
  note: string;
  aiDeclaration: boolean;
  claimGenerator?: string | null;
  exif: { present: boolean; software: string | null };
}

export async function callImageProvenance(dataUrl: string, endpoint: string, fetcher: typeof fetch = fetch): Promise<ImageProvenance> {
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || match[1].length > 4 * Math.ceil(8 * 1024 * 1024 / 3))
    throw new Error('Unsupported or oversized original image');
  const response = await fetcher(`${endpoint.replace(/\/$/, '')}/v1/image/provenance`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: match[1] }), signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Image provenance service returned HTTP ${response.status}`);
  const value = await response.json() as ImageProvenance;
  if (!['absent', 'valid', 'trusted', 'invalid', 'unknown', 'unavailable'].includes(value.status) ||
      typeof value.note !== 'string' || typeof value.aiDeclaration !== 'boolean' ||
      typeof value.exif?.present !== 'boolean' ||
      (value.exif.software !== null && typeof value.exif.software !== 'string') ||
      (value.aiDeclaration && !['valid', 'trusted'].includes(value.status)))
    throw new Error('Invalid image provenance response');
  return value;
}
