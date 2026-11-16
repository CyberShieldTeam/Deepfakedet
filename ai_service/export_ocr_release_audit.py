"""Opt-in metadata export. Omits local paths, pixels, transcripts and participant identities."""
import argparse,subprocess
from ai_service.ocr_release import validate_plan,write_new

def export(plan_file,output):
    plan,m,rows=validate_plan(plan_file)
    audit=dict(schemaVersion=1,scope=m['scope'],datasetId=m['datasetId'],datasetVersion=m['datasetVersion'],
        provenance={k:m[k] for k in ['publisher','officialSource','rights','permissionEvidence','annotationProtocol','annotationProvenance']},
        manifestSha256=plan['manifestSha256'],planSha256=plan['planSha256'],configuration=plan['configuration'],
        nodeVersion=subprocess.check_output(['node','--version'],text=True).strip(),limits=plan['limits'],holdout=plan['holdout'],jobs=plan['jobs'],
        observations=[{k:r[k] for k in ['id','sha256','dimensions','sourceGroup','family','lineage','split','annotationStatus','sourceLanguage','languageBasis','recognitionLanguage','quality','rotation','resolution','density','sourceCategory']} for r in rows],
        limitations=['Review source IDs/provenance for privacy and sharing rights before distributing.','No local paths, image bytes, transcriptions or participant identities exported.','A metadata seal is not independent scientific validation.'])
    write_new(output,audit)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('plan');p.add_argument('--output',required=True);args=p.parse_args();export(args.plan,args.output);print('Metadata audit exported; review privacy/rights before sharing.')
