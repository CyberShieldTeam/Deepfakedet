/** Loopback-only built-client smoke harness using the real API, without Vite middleware. */
import express from 'express';
import path from 'node:path';

if (process.env.NODE_ENV === 'production') throw new Error('Use the production server for production security');
process.env.VERITAS_EMBEDDED = 'true';
const { app } = await import('../server');
app.use(express.static(path.resolve('dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
const port = Number(process.env.PORT || 3017);
app.listen(port, '127.0.0.1', () => console.log(`Built-client smoke: http://127.0.0.1:${port}`));
