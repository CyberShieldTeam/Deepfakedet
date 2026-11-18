import {cloudRouting,writeCloudOutput} from './vercel-output.mjs';
cloudRouting(process.env.VERITAS_BACKEND_ORIGIN); // Refuse a frontend-only release before building.
process.env.VITE_PUBLIC_GUEST_MODE='1';
const {build}=await import('vite');await build();writeCloudOutput();
