import gzip,json,unittest
from ai_service.admit_hiertext_sample import annotation_records
class StreamingAnnotationControls(unittest.TestCase):
    def test_original_unicode_and_nested_records_preserved(self):
        rows=[dict(id='a',text='हिन्दी తెలుగు “quoted”',nested={'items':[1,2,3]}),dict(id='b',text='x'*100000)]
        data=gzip.compress(json.dumps(dict(info={'version':'fixed'},annotations=rows),ensure_ascii=False).encode());self.assertEqual(list(annotation_records(data)),rows)
    def test_incomplete_and_buffer_budget_fail_closed(self):
        for text in ['{"annotations":[{"unfinished":','x'*(4*1024*1024+1)]:
            with self.assertRaises(ValueError):list(annotation_records(gzip.compress(text.encode())))
if __name__=='__main__':unittest.main()
