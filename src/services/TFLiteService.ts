import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';

let model: TensorflowModel | null = null;
let loadPromise: Promise<TensorflowModel> | null = null;

export const loadFaceModel = async (): Promise<TensorflowModel> => {
  if (model) return model;
  // Deduplicate concurrent load calls
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      // require() returns a numeric asset ID in SDK 52-54 that fast-tflite resolves natively
      const asset = require('../../assets/mobilefacenet.tflite');
      model = await loadTensorflowModel(asset);
      return model;
    } catch (e) {
      // Don't cache a rejected promise — let the next call retry instead of
      // permanently breaking recognition until the app restarts.
      loadPromise = null;
      throw e;
    }
  })();
  return loadPromise;
};

export const getModelInfo = async (): Promise<string> => {
  try {
    const m = await loadFaceModel();
    const inputs  = m.inputs.map(t  => `${t.name}:[${t.shape}](${t.dataType})`).join(' | ');
    const outputs = m.outputs.map(t => `${t.name}:[${t.shape}](${t.dataType})`).join(' | ');
    return `LOADED\nIn:  ${inputs}\nOut: ${outputs}`;
  } catch (e: any) {
    return `FAILED: ${e?.message ?? String(e)}`;
  }
};
