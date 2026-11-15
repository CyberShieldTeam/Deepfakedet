import assert from 'node:assert/strict';
import { callImageEvidence } from '../server/imageEvidence';
import { analyzeMediaPipeline } from '../server/mediaPipeline';
import { mediaInput } from '../server/security';
import type { ImageDiagnostics } from '../src/types';
import { reportHtml } from '../src/components/ReportModal';
import { buildDemoInvestigation } from '../server/demoScenario';

const evidence: ImageDiagnostics = {
  scope: 'image_provenance_and_signals', classification: 'INCONCLUSIVE', decision_probability: null, note: 'Not a verdict',
  metadata: { width:64,height:64,format:'PNG',exif_present:false,fields:{},fields_verified:false,note:'Editable' },
  c2pa: { status:'valid_untrusted',sdk:'c2pa-python@test',trust_policy:'none',validation_state:'Valid',validation_codes:[],
    source_types:[],ai_disclosure:'not_declared',signer:null,note:'Offline' },
  signals: { status:'measured',analysis_width:64,analysis_height:64,high_frequency_energy_fraction:.4,noise_residual_std:3,laplacian_variance:4 }
};
const data='data:image/png;base64,aGVsbG8=';
const fetchValue = (value: unknown) => (async () => new Response(JSON.stringify(value))) as typeof fetch;
assert.equal((await callImageEvidence(data,'http://127.0.0.1',fetchValue(evidence))).c2pa.status,'valid_untrusted');
for (const value of [
  {...evidence,decision_probability:.9},
  {...evidence,c2pa:{...evidence.c2pa,status:'valid_trusted'}},
  {...evidence,c2pa:{...evidence.c2pa,status:'invalid',validation_state:'Invalid',ai_disclosure:'declared'}},
  {...evidence,signals:{...evidence.signals,noise_residual_std:NaN}},
  {...evidence,metadata:{...evidence.metadata,fields_verified:true}}
]) await assert.rejects(callImageEvidence(data,'http://127.0.0.1',fetchValue(value)));

const previousFetch=globalThis.fetch, previousEndpoint=process.env.VERITAS_AI_SERVICE_URL;
try {
  process.env.VERITAS_AI_SERVICE_URL='http://127.0.0.1:8001';
  let evidenceCalls=0;
  globalThis.fetch=(async (input: string | URL | Request, init?: RequestInit) => {
    if(String(input).endsWith('/v1/image/evidence')) {
      evidenceCalls++;
      assert.equal(JSON.parse(String(init?.body)).image_base64,'b3JpZ2luYWw=');
      return new Response(JSON.stringify(evidence));
    }
    return new Response('classifier unavailable',{status:503});
  }) as typeof fetch;
  const input={modality:'image' as const,fileName:'sample.png',measurements:{analysisInput:'lossless PNG resize to 64×64'},mediaData:data};
  const skipped=await analyzeMediaPipeline(input);
  assert.equal(evidenceCalls,0,'Never verify credentials on the classifier resize');
  assert.equal(skipped.aiGeneratedProbability,null);
  const result=await analyzeMediaPipeline({...input,originalImageData:'data:image/png;base64,b3JpZ2luYWw='});
  assert.equal(evidenceCalls,1);
  assert.equal(result.imageDiagnostics?.c2pa.status,'valid_untrusted');
  assert.equal(result.authenticity,'inconclusive');
  assert.equal(result.aiGeneratedProbability,null);
} finally {
  globalThis.fetch=previousFetch;
  if(previousEndpoint===undefined) delete process.env.VERITAS_AI_SERVICE_URL;
  else process.env.VERITAS_AI_SERVICE_URL=previousEndpoint;
}
const png='data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
assert.equal(mediaInput.safeParse({modality:'image',fileName:'a.png',mimeType:'image/png',measurements:{},mediaData:png,originalImageData:png}).success,true);
assert.equal(mediaInput.safeParse({modality:'audio',fileName:'a.wav',mimeType:'audio/wav',measurements:{},originalImageData:png}).success,false);
const investigation=buildDemoInvestigation();
investigation.mediaFindings=[{...investigation.mediaFindings![0],imageDiagnostics:{...evidence,
  c2pa:{...evidence.c2pa,signer:'<script>untrusted</script>'}}}];
const html=reportHtml({reportId:'evidence-test',generatedAt:new Date().toISOString(),integrityHash:'test',
  geminiConfigured:false,recommendations:[],investigation});
assert.ok(html.includes('valid_untrusted'));
assert.ok(html.includes('&lt;script&gt;untrusted&lt;/script&gt;'));
assert.ok(!html.includes('<script>untrusted'));
console.log('Image provenance contracts passed: original bytes, no classifier dependency, fail-closed trust, no replacement verdict.');
