import fs from 'node:fs';
import {tokenize,jaccard} from '../../server/campaign';
const pairs=[
  ['English paraphrase','Fictional museum offers free admission today.','There is no entry charge at the fictional museum today.'],
  ['Hindi paraphrase','काल्पनिक संग्रहालय में आज प्रवेश निःशुल्क है।','आज काल्पनिक संग्रहालय देखने का कोई शुल्क नहीं है।'],
  ['Telugu paraphrase','కల్పిత సంగ్రహాలయంలో ఈరోజు ప్రవేశం ఉచితం.','ఈ రోజు కల్పిత సంగ్రహాలయాన్ని చూడటానికి రుసుము లేదు.'],
  ['English Hindi translation','Fictional museum entry is free today.','काल्पनिक संग्रहालय में आज प्रवेश निःशुल्क है।'],
  ['English Telugu translation','Fictional museum entry is free today.','కల్పిత సంగ్రహాలయంలో ఈరోజు ప్రవేశం ఉచితం.'],
  ['Legitimate emergency sharing','Fictional flood warning: follow official evacuation routes.','Fictional flood warning: follow official evacuation routes.'],
  ['Repeated scheduled announcement','Fictional official bulletin: clinic opens at nine.','Fictional official bulletin: clinic opens at nine.'],
  ['Contradictory English context','The fictional museum is open today.','The fictional museum is not open today.'],
  ['Contradictory Hindi context','काल्पनिक संग्रहालय आज खुला है।','काल्पनिक संग्रहालय आज खुला नहीं है।'],
  ['Contradictory Telugu context','కల్పిత సంగ్రహాలయం ఈరోజు తెరిచి ఉంది.','కల్పిత సంగ్రహాలయం ఈరోజు తెరిచి లేదు.'],
  ['Unrelated same language','Fictional museum entry is free today.','Fictional railway maintenance begins next week.'],
].map(([category,left,right])=>({category,left,right,lexicalJaccard:jaccard(tokenize(left),tokenize(right))}));
fs.writeFileSync(process.argv[2],JSON.stringify({scope:'authored_diagnostic_pairs_not_ground_truth',hybridFormula:'0.5 * lexicalJaccard + 0.5 * semanticCosine; descriptive only, no admission threshold',pairs},null,2),{flag:'wx'});
