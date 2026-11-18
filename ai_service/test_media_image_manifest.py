import copy
import hashlib
import io
import random
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image

from ai_service.image_benchmark import fingerprints
from ai_service.media_image_manifest import ADMISSION_POLICY,admission_policy_sha256,expected_label_basis,validate_media_image_manifest


DATASET='OwensLab/CommunityForensics-Eval'
REVISION='0123456789abcdef0123456789abcdef01234567'
LICENSE='test-only research fixture; no sample authenticity claim'
PROTOCOL={
    'version':'manifest-validation-test-v1','dataset':DATASET,'revision':REVISION,
    'roles':{'development':{'genuine':1,'synthetic':1},'held_out':{'genuine':1,'synthetic':1}},
}
PROTOCOL_BYTES=b'{"protocol":"manifest-validation-test-v1"}'
PROTOCOL_SHA=hashlib.sha256(PROTOCOL_BYTES).hexdigest()
SOURCE=f'https://huggingface.co/datasets/{DATASET}/tree/{REVISION}'


class MediaImageManifestTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        rows=[]
        fixtures=[('genuine','development','publisher_labelled_real','coco','0'*16),
                  ('synthetic','development','sdxl',None,'f'*16),
                  ('genuine','held_out','publisher_labelled_real','coco','5'*16),
                  ('synthetic','held_out','midjourney',None,'a'*16)]
        for index,(label,role,generator,source_dataset,phash) in enumerate(fixtures):
            sample_id=f'{index+1:024x}';pixels=random.Random(index+123).randbytes(640*480*3)
            image=Image.frombytes('RGB',(640,480),pixels);stream=io.BytesIO();image.save(stream,format='JPEG',quality=94)
            raw=stream.getvalue()
            with Image.open(io.BytesIO(raw)) as source:decoded=source.convert('RGB')
            image_path=self.root/'images'/f'{sample_id}.jpg';image_path.parent.mkdir(parents=True,exist_ok=True);image_path.write_bytes(raw)
            rows.append({
                'id':sample_id,'path':str(image_path.relative_to(self.root)).replace('\\','/'),
                'sha256':hashlib.sha256(raw).hexdigest(),'decodedSha256':hashlib.sha256(decoded.tobytes()).hexdigest(),
                'perceptualHash':f'{fingerprints(decoded):016x}','label':label,'role':role,'group':hashlib.sha256(f'group-{index}'.encode()).hexdigest(),
                'promptGroup':hashlib.sha256(f'prompt-{index}'.encode()).hexdigest() if label=='synthetic' else None,
                'generator':generator,'sourceDataset':source_dataset,'source':SOURCE,'publisherImageName':f'publisher-{index}',
                'shard':f'data/CompEval-{index:05d}-of-00413.parquet','index':index,'license':LICENSE,
                'labelBasis':expected_label_basis(label,generator,source_dataset),
                'geometry':{'format':'JPEG','width':640,'height':480,'orientedSize':[640,480],'mode':'RGB'},
            })
        self.manifest={
            'schemaVersion':2,'dataset':DATASET,'revision':REVISION,'license':LICENSE,'protocolSha256':PROTOCOL_SHA,
            'admissionPolicy':copy.deepcopy(ADMISSION_POLICY),'admissionPolicySha256':admission_policy_sha256(),
            'inventorySha256':hashlib.sha256(b'inventory').hexdigest(),'exclusions':{},'rows':rows,
            'scope':'authored manifest structure fixture; labels are not observations',
        }

    def tearDown(self):self.temp.cleanup()

    def validate(self,manifest=None):
        return validate_media_image_manifest(manifest or self.manifest,self.root,PROTOCOL,PROTOCOL_BYTES,DATASET,REVISION,LICENSE)

    def test_valid_manifest_keeps_frozen_partitions_and_provenance(self):
        self.assertEqual(len(self.validate()),4)
        self.assertIn('not independently audited',self.manifest['rows'][0]['labelBasis'])

    def test_schema_identity_and_license_fail_before_inference(self):
        for field,value,code in [('schemaVersion',1,'MANIFEST_SCHEMA_VERSION'),('dataset','other','DATASET_IDENTITY'),
                                 ('license','unreviewed','DATASET_LICENSE'),('protocolSha256','0'*64,'FROZEN_PROTOCOL_CHANGED'),
                                 ('admissionPolicySha256','0'*64,'ADMISSION_POLICY_CHANGED')]:
            manifest=copy.deepcopy(self.manifest);manifest[field]=value
            with self.subTest(field=field),self.assertRaisesRegex(ValueError,code):self.validate(manifest)

    def test_row_schema_and_ground_truth_basis_are_required(self):
        manifest=copy.deepcopy(self.manifest);del manifest['rows'][0]['labelBasis']
        with self.assertRaisesRegex(ValueError,'ROW_SCHEMA'):self.validate(manifest)
        manifest=copy.deepcopy(self.manifest);manifest['rows'][0]['labelBasis']='camera verified original'
        with self.assertRaisesRegex(ValueError,'LABEL_BASIS'):self.validate(manifest)

    def test_source_bytes_and_duplicate_hashes_are_rejected(self):
        manifest=copy.deepcopy(self.manifest);manifest['rows'][0]['sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'SOURCE_HASH_MISMATCH'):self.validate(manifest)
        manifest=copy.deepcopy(self.manifest);manifest['rows'][1]['decodedSha256']=manifest['rows'][0]['decodedSha256']
        with self.assertRaisesRegex(ValueError,'DUPLICATE_DECODED_HASH'):self.validate(manifest)

    def test_decoded_and_perceptual_hashes_are_verified_against_original_bytes(self):
        manifest=copy.deepcopy(self.manifest);manifest['rows'][0]['decodedSha256']='1'*64
        with self.assertRaisesRegex(ValueError,'DECODED_HASH_MISMATCH'):self.validate(manifest)
        manifest=copy.deepcopy(self.manifest);actual=int(manifest['rows'][0]['perceptualHash'],16)
        manifest['rows'][0]['perceptualHash']=f'{actual ^ 0xffffffffffffffff:016x}'
        with self.assertRaisesRegex(ValueError,'PERCEPTUAL_HASH_MISMATCH'):self.validate(manifest)

    def test_source_prompt_and_perceptual_duplicates_are_rejected(self):
        manifest=copy.deepcopy(self.manifest);manifest['rows'][2]['group']=manifest['rows'][0]['group']
        with self.assertRaisesRegex(ValueError,'SOURCE_GROUP_DUPLICATE_OR_LEAKAGE'):self.validate(manifest)
        manifest=copy.deepcopy(self.manifest);manifest['rows'][3]['promptGroup']=manifest['rows'][1]['promptGroup']
        with self.assertRaisesRegex(ValueError,'PROMPT_GROUP_DUPLICATE_OR_LEAKAGE'):self.validate(manifest)
        manifest=copy.deepcopy(self.manifest)
        row=manifest['rows'][3];source_path=self.root/manifest['rows'][0]['path']
        with Image.open(source_path) as source:near=Image.eval(source.convert('RGB'),lambda value:min(255,value+1))
        encoded=io.BytesIO();near.save(encoded,format='JPEG',quality=94);raw=encoded.getvalue()
        (self.root/row['path']).write_bytes(raw)
        with Image.open(io.BytesIO(raw)) as decoded:decoded=decoded.convert('RGB')
        row['sha256']=hashlib.sha256(raw).hexdigest();row['decodedSha256']=hashlib.sha256(decoded.tobytes()).hexdigest()
        row['perceptualHash']=f'{fingerprints(decoded):016x}'
        with self.assertRaisesRegex(ValueError,'PERCEPTUAL_DUPLICATE'):self.validate(manifest)

    def test_paths_geometry_labels_and_quotas_are_checked(self):
        manifest=copy.deepcopy(self.manifest);manifest['rows'][0]['path']='../outside.jpg'
        with self.assertRaisesRegex(ValueError,'IMAGE_PATH'):self.validate(manifest)
        manifest=copy.deepcopy(self.manifest);manifest['rows'][0]['geometry']['width']=0
        with self.assertRaisesRegex(ValueError,'IMAGE_GEOMETRY'):self.validate(manifest)
        manifest=copy.deepcopy(self.manifest);manifest['rows'][0]['role']='held_out'
        with self.assertRaisesRegex(ValueError,'FROZEN_QUOTA'):self.validate(manifest)

    def test_invalid_manifest_is_rejected_before_checkpoint_lookup(self):
        from ai_service import evaluate_media_images
        manifest=copy.deepcopy(self.manifest);manifest['dataset']='unreviewed-source'
        path=self.root/'manifest.json';path.write_text(__import__('json').dumps(manifest),encoding='utf-8')
        inventory_path=self.root/'inventory.json';inventory_path.write_text('{}',encoding='utf-8')
        with patch.object(evaluate_media_images,'cached_snapshot') as load:
            with self.assertRaisesRegex(ValueError,'MANIFEST_SCHEMA'):
                evaluate_media_images.evaluate('community',path,self.root/'result.json',inventory_path,'0'*64)
            load.assert_not_called()

    def test_matched_preprocessing_is_deterministic_and_preserves_source_pixels(self):
        from PIL import Image
        from ai_service.evaluate_media_images import derived
        image=Image.new('RGB',(640,480),(12,80,190));original=image.tobytes()
        first,first_hash=derived(image);second,second_hash=derived(image)
        self.assertEqual(first.size,(256,256));self.assertEqual(first_hash,second_hash)
        self.assertEqual(first.tobytes(),second.tobytes());self.assertEqual(image.tobytes(),original)


if __name__=='__main__':unittest.main()
