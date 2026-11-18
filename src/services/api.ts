import {
  Investigation,
  ForensicAnalysisResult,
  ClaimVerificationResult,
  CampaignAnalysisResult,
  ModelRegistryItem,
} from "../types";
import type {CorrelationResult,MediaContextInput} from '../correlationTypes';
export const correlateInvestigation=(id:string,contexts?:MediaContextInput[])=>post<{investigation:Investigation;result:CorrelationResult}>(`/api/investigations/${encodeURIComponent(id)}/correlate`,contexts===undefined?{}:{contexts});
export const extractionRequest=(id:string,action:string,body:unknown)=>post<{investigation:Investigation}>(`/api/investigations/${encodeURIComponent(id)}/${action}`,body);

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  let res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(180000),
    ...init,
  });
  if(res.status===401){
    const health=await fetch('/api/health').then(r=>r.json()).catch(()=>null);
    if(health?.publicGuests){
      guestBootstrap??=fetch('/api/guest/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>{if(!r.ok)throw new Error('Public session unavailable; please retry shortly')}).finally(()=>{guestBootstrap=undefined});
      await guestBootstrap;
      res=await fetch(url,{headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(180000),...init});
    }
  }
  if(!res.headers.get('content-type')?.includes('application/json'))throw new Error('The analysis service is starting or unavailable. Wait about one minute and retry; no analysis result was produced.');
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) window.dispatchEvent(new Event("veritas:auth-required"));
  if (!res.ok) {
    const error=new Error(data.analysis?`${data.analysis.state}: ${data.error || 'Analysis failed'}. ${data.analysis.summary}`:data.error || `Request failed (${res.status})`);
    Object.assign(error,{analysis:data.analysis,status:res.status});throw error;
  }
  return data as T;
}
let guestBootstrap:Promise<void>|undefined;
const post = <T>(url: string, body: any) =>
  req<T>(url, { method: "POST", body: JSON.stringify(body) });

export interface Health {
  publicGuests?:boolean;
  storage?:string;
  cloudProfile?:string|null;
  authoredDemonstration?: boolean;
  status: string;
  authenticationMode: string;
  engines: { task: string; status: string; modelId: string; version: string }[];
  geminiConfigured: boolean;
  geminiReady: boolean;
  geminiStatus: string;
  geminiMessage: string;
  geminiModel: string | null;
  activeInvestigations: number;
}
export interface Stats {
  postsIngested: number;
  alertsRaised: number;
  byLanguage: Record<string, number>;
  threatLevel: string;
  recentAlertCount: number;
}
export interface Report {
  reportId: string;
  generatedAt: string;
  integrityHash: string;
  geminiConfigured: boolean;
  recommendations: string[];
  investigation: Investigation;
}

export const fetchHealth = () => req<Health>("/api/health");
export const fetchStats = () => req<Stats>("/api/stats");
export const fetchModels = () =>
  req<{ models: ModelRegistryItem[] }>("/api/models").then((d) => d.models);
export const fetchInvestigations = () =>
  req<{ investigations: Investigation[] }>("/api/investigations").then((d) => d.investigations);
export const createInvestigation = (p: Partial<Investigation>) =>
  post<{ investigation: Investigation }>("/api/investigations", p).then((d) => d.investigation);
export const deleteInvestigation = (id: string) =>
  req(`/api/investigations/${id}`, { method: "DELETE" });
export const attachResult = (id: string, kind: "media" | "claim" | "campaign", result: any) =>
  post<{ investigation: Investigation }>(`/api/investigations/${id}/attach`, { kind, result }).then(
    (d) => d.investigation,
  );
export const analyzeMedia = (p: {
  modality: string;
  geminiConsent?: boolean;
  fileName: string;
  mimeType: string;
  measurements: any;
  mediaData?: string;
  originalImageData?: string;
  temporalIntervalSeconds?: number;
  keyframes?: string[];
  frameTimes?: number[];
  detailTiles?: string[];
  audioSegments?: { start: number; end: number; data: string }[];
}) =>
  post<{ result: ForensicAnalysisResult }>("/api/forensics/analyze-media", p).then((d) => d.result);
export const extractClaims=(claimText:string)=>post<{originalInput:string;candidates:import('../claimTypes').ClaimCandidate[];method:string;limitations:string[]}>('/api/claims/extract',{claimText});
export const verifyClaim = (claimText: string,selection?:import('../claimTypes').ClaimSelection) =>
  post<{ result: ClaimVerificationResult }>("/api/claims/verify", { claimText,selection }).then(
    (d) => d.result,
  );
export const reviewClaim = (
  result: ClaimVerificationResult,
  reviews: { url: string; sourceId?:string; stance: string; quote: string; contextConfirmed: boolean }[],
  note: string,
) =>
  post<{ result: ClaimVerificationResult }>("/api/claims/review", { result, reviews, note }).then(
    (d) => d.result,
  );
export const analyzeCampaign = (p: {
  coverage?:import('../../server/campaignEpisodes').CampaignCoverage;
  datasetName: string;
  posts?: any[];
  csv?: string;
  isSimulated?: boolean;
  config?: { windowSeconds: number; minSamples: number; threshold: number; algorithm?:'density_baseline_v1'|'episodes_v1' };
}) => post<{ result: CampaignAnalysisResult }>("/api/campaigns/analyze", p).then((d) => d.result);
export const runDemoScenario = () =>
  post<{ investigation: Investigation }>("/api/demo/scenario", {}).then((d) => d.investigation);
export const fetchReport = (id: string) =>
  req<{ report: Report }>(`/api/reports/${id}`).then((d) => d.report);
