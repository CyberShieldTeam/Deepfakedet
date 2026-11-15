import type { ImageDiagnostics } from '../src/types';

export async function callImageEvidence(data: string, endpoint: string, fetcher: typeof fetch = fetch): Promise<ImageDiagnostics> {
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!match || match[1].length > 4 * Math.ceil(10 * 1024 * 1024 / 3)) throw new Error('Unsupported or oversized image evidence input');
  const response = await fetcher(`${endpoint.replace(/\/$/, '')}/v1/image/evidence`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: match[1] }), signal: AbortSignal.timeout(20_000), redirect: 'error'
  });
  if (!response.ok) throw new Error('Image evidence service unavailable');
  const value = await response.json() as ImageDiagnostics;
  const c = value?.c2pa, s = value?.signals, m = value?.metadata;
  const strings = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && v.every(x => typeof x === 'string' && x.length <= 200);
  if (value?.scope !== 'image_provenance_and_signals' || value.classification !== 'INCONCLUSIVE' ||
      value.decision_probability !== null || typeof value.note !== 'string' || !c || !s || !m ||
      !['absent','valid_untrusted','valid_trusted','invalid','unavailable','failed'].includes(c.status) ||
      !['none','operator_anchors'].includes(c.trust_policy) ||
      !['declared','not_declared','not_assessed'].includes(c.ai_disclosure) ||
      !strings(c.validation_codes,32) || !strings(c.source_types,16) || typeof c.note !== 'string' ||
      (c.signer !== null && (typeof c.signer !== 'string' || c.signer.length > 160)) ||
      (c.status === 'valid_trusted' && (c.trust_policy !== 'operator_anchors' || c.validation_state !== 'Trusted')) ||
      (c.status === 'valid_untrusted' && !['Valid','Trusted'].includes(c.validation_state || '')) ||
      (c.status === 'invalid' && c.validation_state !== 'Invalid') ||
      (!['valid_trusted','valid_untrusted'].includes(c.status) && c.ai_disclosure !== 'not_assessed') ||
      typeof m.exif_present !== 'boolean' || m.fields_verified !== false || !m.fields ||
      typeof m.fields !== 'object' || Array.isArray(m.fields) || Object.keys(m.fields).length > 8 ||
      Object.values(m.fields).some(v => typeof v !== 'string' || v.length > 160) ||
      !Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width < 1 || m.height < 1 ||
      m.width * m.height > 24_000_000 || !['JPEG','PNG','WEBP'].includes(m.format) ||
      !['measured','skipped'].includes(s.status) ||
      (s.status === 'measured' && (
        !Number.isInteger(s.analysis_width) || !Number.isInteger(s.analysis_height) ||
        s.analysis_width! < 1 || s.analysis_height! < 1 || s.analysis_width! > 512 || s.analysis_height! > 512 ||
        !Number.isFinite(s.high_frequency_energy_fraction) || s.high_frequency_energy_fraction! < 0 || s.high_frequency_energy_fraction! > 1 ||
        !Number.isFinite(s.noise_residual_std) || s.noise_residual_std! < 0 ||
        !Number.isFinite(s.laplacian_variance) || s.laplacian_variance! < 0))) {
    throw new Error('Invalid image evidence response');
  }
  return value;
}
