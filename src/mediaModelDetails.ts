/** Model documentation describes tools, never evidence about a submitted file. */
export const mediaModelDetails:Record<string,{url:string;license:string;score:string;status:string}>= {
  'OwensLab/commfor-model-384':{url:'https://huggingface.co/OwensLab/commfor-model-384',license:'MIT',score:'Uncalibrated sigmoid output',status:'Experimental; small source-limited evaluation does not establish real-world accuracy'},
  'dima806/ai_vs_real_image_detection':{url:'https://huggingface.co/dima806/ai_vs_real_image_detection',license:'Apache-2.0',score:'Uncalibrated fake-class softmax',status:'Experimental; high genuine false-positive rate in local evaluation'},
  'Organika/sdxl-detector':{url:'https://huggingface.co/Organika/sdxl-detector',license:'CC-BY-NC-3.0',score:'Uncalibrated artificial-class softmax',status:'Experimental; limited training domain and failed local evaluation'},
  'sakshamkr1/deitfake-v2':{url:'https://huggingface.co/sakshamkr1/deitfake-v2',license:'Apache-2.0',score:'Uncalibrated fake-class softmax on face crops',status:'Experimental; face-swap accuracy is not established'},
  'clovaai/aasist':{url:'https://github.com/clovaai/aasist',license:'MIT',score:'Uncalibrated segment spoof softmax and bona-fide logit',status:'Experimental; high false-positive rate on sampled LJSpeech; no validated recording verdict'},
};
