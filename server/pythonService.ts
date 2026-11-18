/** Server-to-server secret, never included in client responses or browser configuration. */
export function pythonServiceHeaders():Record<string,string>{
  const token=process.env.VERITAS_AI_SERVICE_TOKEN?.trim();
  return {'Content-Type':'application/json',...(token?{'X-Veritas-Service-Token':token}:{})};
}
