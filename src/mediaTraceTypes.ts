export interface ImageInputTrace{
  sourceSha256:string;sourceBytes:number;format:'JPEG'|'PNG'|'WEBP';originalSize:number[];orientedSize:number[];
  sourceMode:string;exifOrientationApplied:boolean;decodedRgbSha256:string;conversion:string;
  tensor:{sha256:string;shape:number[];dtype:string}|null;
}
export interface AudioInputTrace{
  sourceSha256:string;decoded:true;resampledFloat32Sha256:string;modelSamples:number;windowSamples:64600;
  skippedWindows:{start_seconds:number;end_seconds:number;reason:'short_tail'|'below_rms_silence_gate'}[];
  speechPresence:'not_verified';status:'segments_available'|'no_usable_windows';conversion:string;
}
