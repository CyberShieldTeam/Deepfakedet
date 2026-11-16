"""Exact bounded transcription metrics. Coverage and operational failures never disappear."""
import unicodedata

def edit_distance(a,b):
    """Myers bit-vector Levenshtein, exact unit insert/delete/substitute costs."""
    if len(a)>len(b):a,b=b,a
    if not a:return len(b)
    masks={}
    for i,c in enumerate(a):masks[c]=masks.get(c,0)|(1<<i)
    full=(1<<len(a))-1;last=1<<(len(a)-1);positive=full;negative=0;score=len(a)
    for c in b:
        equal=masks.get(c,0);x=equal|negative
        d=(((equal&positive)+positive)^positive)|equal|negative
        hp=negative|~(d|positive);hn=positive&d
        score+=bool(hp&last)-bool(hn&last)
        hp=(hp<<1)|1;hn<<=1
        positive=(hn|~(d|hp))&full;negative=hp&d&full
    return score

def normalize(text):return unicodedata.normalize('NFC',text).rstrip('\n')
def score_observations(rows):
    chars=words=cer=wer=exact=texts=empty=empty_correct=failed=unavailable=partial=missing=0
    successful_chars=successful_words=successful_cer=successful_wer=0
    for row in rows:
        if not isinstance(row.get('reference'),str) or len(row['reference'])>4000:raise ValueError('Ground truth budget/type')
        state=row.get('state');prediction=row.get('text')
        if state not in ['COMPLETE','NO_TEXT_DETECTED','PARTIAL','FAILED','UNAVAILABLE','MISSING']:raise ValueError('Unknown OCR state')
        if prediction is not None and (not isinstance(prediction,str) or len(prediction)>20000):raise ValueError('Prediction budget/type')
        operational=state in ['FAILED','UNAVAILABLE','MISSING']
        if not operational and prediction is None:raise ValueError('Successful OCR requires recorded text')
        failed+=state=='FAILED';unavailable+=state=='UNAVAILABLE';partial+=state=='PARTIAL';missing+=state=='MISSING'
        a=normalize(row['reference']);b='' if operational else normalize(prediction)
        if a:
            texts+=1;chars+=len(a);words+=len(a.split());ce=edit_distance(a,b);we=edit_distance(a.split(),b.split());cer+=ce;wer+=we;exact+=not operational and a==b
            if not operational:successful_chars+=len(a);successful_words+=len(a.split());successful_cer+=ce;successful_wer+=we
        else:empty+=1;empty_correct+=not operational and not b.strip()
    ratio=lambda a,b:a/b if b else None
    return dict(observations=len(rows),annotatedTextObservations=texts,noTextObservations=empty,noTextCorrect=empty_correct,technicalFailures=failed,unavailable=unavailable,missing=missing,partial=partial,
                failureAsEmpty=dict(characterErrors=cer,characters=chars,wordErrors=wer,words=words,CER=ratio(cer,chars),WER=ratio(wer,words),exactMatchRate=ratio(exact,texts)),
                conditionalSuccessful=dict(CER=ratio(successful_cer,successful_chars),WER=ratio(successful_wer,successful_words)),
                evaluatedCoverage=ratio(len(rows)-failed-unavailable-missing,len(rows)),complete=missing==0,
                policy='All expected observations counted. FAILED/UNAVAILABLE/MISSING score as empty for failureAsEmpty; conditionalSuccessful excludes them and must not be reported alone. PARTIAL retains text and is disclosed; no-text operational failures never count as correct.')
