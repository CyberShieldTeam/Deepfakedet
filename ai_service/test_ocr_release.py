import copy,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image,ImageDraw
from ai_service.ocr_release import make_plan,write_new,run_job,aggregate,read_json,digest,encode
from ai_service.screenshot_annotation import create_packet,verify_adjudication,PROTOCOL_HASH
class ReleaseControls(unittest.TestCase):
    def fixture(self,root,count=3):
        rows=[]
        for i in range(count):
            im=Image.new('RGB',(70+i,40),'white');ImageDraw.Draw(im).rectangle((i,1,30+i,30),fill=(i*31%255,40,150));f=root/f'{i}.png';im.save(f)
            rows.append(dict(id=f'id-{i}',path=f.name,sha256=digest(f.read_bytes()),dimensions=list(im.size),sourceGroup=f'source-{i}',family=f'family-{i}',lineage=f'lineage-{i}',split='development',sourceLanguage='English',languageBasis='authored',recognitionLanguage='eng',quality='clear',rotation='0',resolution='small',density='sparse',sourceCategory='authored_screen_control',annotationStatus='authored',reference='test'))
        m=dict(schemaVersion=3,scope='authored_controls',datasetId='control-not-independent',datasetVersion='1',publisher='control',officialSource='control',rights='control',permissionEvidence='control',annotationProtocol='control',annotationProvenance='control',approvedBy='control',approvedAt='2026-11-17',resourceApproval=dict(approvedBy='control',reference='control',maxPasses=count*2),profiles=['baseline','upscale2'],rows=rows)
        f=root/'manifest.json';f.write_text(json.dumps(m));return f,m
    def test_deterministic_batches_and_group_leakage(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);f,m=self.fixture(root,55);p=make_plan(f);self.assertEqual([len(j['ids']) for j in p['jobs']],[50,5,50,5]);self.assertEqual(p['jobs'],make_plan(f)['jobs']);self.assertEqual(p['holdout']['observations'],0)
            m['rows'][1]['split']='holdout';m['rows'][1]['family']=m['rows'][0]['family'];f.write_text(json.dumps(m));self.assertRaisesRegex(ValueError,'leakage',make_plan,f)
    def test_resume_failure_accounting_and_tamper(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);f,m=self.fixture(root);p=make_plan(f);pf=root/'plan.json';write_new(pf,p);out=root/'results'
            fake=lambda row,profile:dict(state='FAILED' if row['id']=='id-1' else 'COMPLETE',text=None if row['id']=='id-1' else 'test',wallSeconds=.1,sampledPeakOcrTreeRssBytes=123)
            with patch('ai_service.ocr_release.measure',fake):
                self.assertRaises(FileNotFoundError,run_job,pf,p['jobs'][1]['id'],out)
                first=run_job(pf,p['jobs'][0]['id'],out);self.assertEqual(first['completed'],3);self.assertEqual(run_job(pf,p['jobs'][0]['id'],out)['reused'],3)
                report=aggregate(pf,out);self.assertEqual(report['recordedPasses'],3);self.assertEqual(report['groups']['baseline/sourceLanguage/English']['failureAsEmpty']['CER'],1/3);self.assertEqual(report['groups']['upscale2/sourceLanguage/English']['missing'],3)
                run_job(pf,p['jobs'][1]['id'],out);self.assertEqual(aggregate(pf,out)['recordedPasses'],6)
            file=next(out.glob('observation_*.json'));row=read_json(file);row['text']='tampered';file.write_text(json.dumps(row));self.assertRaisesRegex(ValueError,'checksum',aggregate,pf,out)
    def test_frozen_manifest_and_holdout_access(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);f,m=self.fixture(root);m['rows'][1]['split']='holdout';m['rows'][1]['sourceGroup']='heldout';m['rows'][1]['family']='heldout';m['rows'][1]['lineage']='heldout'
            # Distinct noise defeats the near-duplicate screen; this is a software gate control only.
            import random
            im=Image.new('RGB',(100,100));rng=random.Random(43);im.putdata([tuple(rng.randrange(256) for _ in range(3)) for _ in range(10000)]);im.save(root/'1.png');m['rows'][1]['dimensions']=[100,100];m['rows'][1]['sha256']=digest((root/'1.png').read_bytes());f.write_text(json.dumps(m))
            p=make_plan(f);self.assertEqual(p['holdout']['observations'],1);self.assertTrue(all('id-1' not in j['ids'] for j in p['jobs']));pf=root/'plan.json';write_new(pf,p)
            self.assertRaises(ValueError,run_job,pf,'holdout',root/'out')
            m['rows'][0]['reference']='post-freeze change';f.write_text(json.dumps(m));self.assertRaisesRegex(ValueError,'Frozen manifest',aggregate,pf,root/'out')
    def test_blind_packet_and_no_invented_adjudication(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);f,m=self.fixture(root);m['rows'][0]['reference']='DO_NOT_LEAK_PUBLISHER_LABEL_43';f.write_text(json.dumps(m));create_packet(f,root/'packet','control-participant-not-a-human-study');packet=read_json(root/'packet/annotation-template.json');self.assertNotIn('reference',packet['items'][0]);self.assertNotIn('prediction',packet['items'][0]);self.assertNotIn('DO_NOT_LEAK_PUBLISHER_LABEL_43',json.dumps(packet))
            base=dict(annotatorId='fixture-1',recordedAt='2026-11-17T00:00:00Z',sourceLanguage='English',uncertainty='',blinded=True,protocolSha256=PROTOCOL_HASH,sourceSha256=m['rows'][0]['sha256'],dimensions=m['rows'][0]['dimensions'],noText=False,regions=[dict(id='r',order=0,bbox=[0,0,50,30],language='English',legibility='legible',text='test')])
            value=dict(transcriptions=[base,{**base,'annotatorId':'fixture-2'}],adjudication={**base,'annotatorId':'fixture-adjudicator','differencesReviewed':True,'completeScreenTranscription':True});self.assertEqual(verify_adjudication(value,base['sourceSha256'],base['dimensions'])['reference'],'test')
            value['transcriptions'][1]['annotatorId']='fixture-1';self.assertRaises(ValueError,verify_adjudication,value,base['sourceSha256'],base['dimensions'])
    def test_admission_budgets_paths_languages_pending_and_duplicates(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);f,m=self.fixture(root)
            for change in [dict(path='../outside.png'),dict(sha256='0'*64),dict(dimensions=[1,1]),dict(sourceLanguage='English',languageBasis='eng')]:
                bad=copy.deepcopy(m);bad['rows'][0].update(change);f.write_text(json.dumps(bad));self.assertRaises((ValueError,FileNotFoundError),make_plan,f)
            bad=copy.deepcopy(m);bad['resourceApproval']['maxPasses']=1;f.write_text(json.dumps(bad));self.assertRaises(ValueError,make_plan,f)
            m['scope']='provisional_publisher'
            for row in m['rows']:row.update(annotationStatus='pending',reference=None,sourceLanguage='unknown',languageBasis='unavailable')
            f.write_text(json.dumps(m));p=make_plan(f);pf=root/'plan.json';write_new(pf,p);out=root/'out';out.mkdir()
            self.assertIsNone(aggregate(pf,out)['groups']['baseline/sourceLanguage/unknown']['metrics'])
            self.assertEqual(aggregate(pf,out)['groups']['baseline/sourceLanguage/unknown']['statusCounts']['MISSING'],3)
            (out/'observation_duplicate.json').write_text('{}');self.assertRaisesRegex(ValueError,'duplicate',aggregate,pf,out)
    def test_family_job_cap_and_near_duplicate_screen(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);f,m=self.fixture(root,51)
            for row in m['rows']:row['family']='one-family'
            f.write_text(json.dumps(m));self.assertRaisesRegex(ValueError,'Family exceeds',make_plan,f)
            m['rows']=m['rows'][:2];m['rows'][1].update(split='holdout',family='other-family');f.write_text(json.dumps(m));self.assertRaisesRegex(ValueError,'Near-duplicate',make_plan,f)
if __name__=='__main__':unittest.main()
