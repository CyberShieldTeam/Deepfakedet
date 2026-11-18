/** Explicit small pinned Apache-2.0 asset acquisition at build, never on visitor requests. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {OCR_MODEL} from '../server/extraction.ts';
const valid=data=>data.length===OCR_MODEL.bytes&&createHash('sha256').update(data).digest('hex')===OCR_MODEL.sha256;
if(fs.existsSync(OCR_MODEL.path)){if(!valid(fs.readFileSync(OCR_MODEL.path)))throw new Error('Existing OCR data mismatch; refusing overwrite');}
else{
 const response=await fetch(`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${OCR_MODEL.revision}/eng.traineddata`,{signal:AbortSignal.timeout(30000),redirect:'error'});
 if(!response.ok||!response.body)throw new Error('Pinned OCR data unavailable');
 let length=0;const chunks=[];
 for await(const chunk of response.body){length+=chunk.length;if(length>OCR_MODEL.bytes)throw new Error('OCR download size exceeded');chunks.push(chunk);}
 const data=Buffer.concat(chunks);if(!valid(data))throw new Error('OCR data hash/size mismatch');
 fs.mkdirSync(path.dirname(OCR_MODEL.path),{recursive:true});fs.writeFileSync(OCR_MODEL.path,data,{flag:'wx'});
}
console.log('Pinned English OCR data verified; no classifier checkpoint downloaded');
