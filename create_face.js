const fb = require('fs');

fb.writeFileSync('src/utils/faceDetector.js', \
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

let _model = null;
let _isInitializing = false;

export async function initFaceDetector() {
  if (_model) return _model;
  
  if (_isInitializing) {
     return new Promise((resolve) => {
        let count = 0;
        let check = setInterval(() => {
           if (_model) { clearInterval(check); resolve(_model); }
           else if (count++ > 50) { clearInterval(check); resolve(null); }
        }, 200);
     });
  }

  _isInitializing = true;
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    const modelUrl = chrome.runtime.getURL('public/blazeface/model.json');
    _model = await blazeface.load({ modelUrl });
  } catch (err) {
    console.warn('[FaceDetector] Load fail:', err);
  } finally {
    _isInitializing = false;
  }
  return _model;
}

export async function hasPerson(videoElement) {
  const model = await initFaceDetector();
  if (!model) return false;
  
  try {
    const predictions = await model.estimateFaces(videoElement, false);
    return predictions && predictions.length > 0;
  } catch (err) {
    return false;
  }
}
\);
