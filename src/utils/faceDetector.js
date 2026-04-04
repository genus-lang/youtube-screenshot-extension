import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

let _model = null;
let _isInit = false;

export async function initFaceDetector() {
  if (_model) return _model;
  
  if (_isInit) {
    for (let i = 0; i < 50; i++) {
       if (_model) return _model;
       await new Promise(r => setTimeout(r, 100));
    }
    return null;
  }
  
  _isInit = true;
  try {
    const url = chrome.runtime.getURL('public/blazeface/model.json');
    _model = await blazeface.load({ modelUrl: url });
    console.log('[FaceDetector] Model loaded');
  } catch (e) {
    console.warn('[FaceDetector] Error loading model', e);
  }
  _isInit = false;
  return _model;
}

export async function hasPerson(video) {
  const model = await initFaceDetector();
  if (!model) return false;
  try {
    const results = await model.estimateFaces(video, false);
    return results && results.length > 0;
  } catch (e) {
    return false;
  }
}
