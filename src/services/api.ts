import { Investigation, ForensicAnalysisResult, ClaimVerificationResult, CampaignAnalysisResult, ModelRegistryItem } from '../types';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
const post = <T,>(url: string, body: any) => req<T>(url, { method: 'POST', body: JSON.stringify(body) });

export interface Health { status: string; geminiConfigured: boolean; geminiReady: boolean; geminiStatus: string; geminiMessage: string; geminiModel: string | null; activeInvestigations: number }
export interface Stats { postsIngested: number; alertsRaised: number; byLanguage: Record<string, number>; threatLevel: string; recentAlertCount: number }
export interface Report { reportId: string; generatedAt: string; integrityHash: string; geminiConfigured: boolean; recommendations: string[]; investigation: Investigation }

export const fetchHealth = () => req<Health>('/api/health');
export const fetchStats = () => req<Stats>('/api/stats');
export const fetchModels = () => req<{ models: ModelRegistryItem[] }>('/api/models').then(d => d.models);
export const fetchInvestigations = () => req<{ investigations: Investigation[] }>('/api/investigations').then(d => d.investigations);
export const createInvestigation = (p: Partial<Investigation>) => post<{ investigation: Investigation }>('/api/investigations', p).then(d => d.investigation);
export const deleteInvestigation = (id: string) => req(`/api/investigations/${id}`, { method: 'DELETE' });
export const attachResult = (id: string, kind: 'media' | 'claim' | 'campaign', result: any) =>
  post<{ investigation: Investigation }>(`/api/investigations/${id}/attach`, { kind, result }).then(d => d.investigation);
export const analyzeMedia = (p: { modality: string; fileName: string; mimeType: string; measurements: any; mediaData?: string; keyframes?: string[]; detailTiles?: string[] }) =>
  post<{ result: ForensicAnalysisResult }>('/api/forensics/analyze-media', p).then(d => d.result);
export const verifyClaim = (claimText: string) => post<{ result: ClaimVerificationResult }>('/api/claims/verify', { claimText }).then(d => d.result);
export const analyzeCampaign = (p: { datasetName: string; posts?: any[]; csv?: string; isSimulated?: boolean }) =>
  post<{ result: CampaignAnalysisResult }>('/api/campaigns/analyze', p).then(d => d.result);
export const runDemoScenario = () => post<{ investigation: Investigation }>('/api/demo/scenario', {}).then(d => d.investigation);
export const fetchReport = (id: string) => req<{ report: Report }>(`/api/reports/${id}`).then(d => d.report);
