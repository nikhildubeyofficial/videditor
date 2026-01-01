import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;
let ffmpegLoaded = false;

// Initialize FFmpeg
async function loadFFmpeg() {
  if (ffmpeg && ffmpegLoaded) return ffmpeg;
  
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => {
      // Send log to main thread
      self.postMessage({ type: 'log', message });
    });
  }
  
  if (!ffmpegLoaded) {
    if (!self.crossOriginIsolated) {
        self.postMessage({ type: 'log', message: 'WARNING: Cross-Origin Isolation is not enabled. SharedArrayBuffer will not work.' });
    }

    try {
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      ffmpegLoaded = true;
      self.postMessage({ type: 'loaded' });
    } catch (error) {
      self.postMessage({ type: 'error', error: `Failed to load FFmpeg: ${error.message}` });
      ffmpeg = null;
      throw error;
    }
  }
  
  return ffmpeg;
}

// Helpers
async function fileExists(ffmpeg, filename) {
  try {
    const files = await ffmpeg.listDir('/');
    return files.some(file => file.name === filename);
  } catch {
    return false;
  }
}

async function safeDelete(ffmpeg, file) {
  try {
    if (await fileExists(ffmpeg, file)) {
      await ffmpeg.deleteFile(file);
    }
  } catch (error) {
    console.warn(`Could not delete ${file}:`, error.message);
  }
}

// Main message handler
self.onmessage = async (e) => {
  const { type, id, data } = e.data;
  
  try {
    const ffmpegInstance = await loadFFmpeg();
    
    switch (type) {
      case 'extractAudio':
        await handleExtractAudio(id, ffmpegInstance, data);
        break;
      case 'cutVideo':
        await handleCutVideo(id, ffmpegInstance, data);
        break;
      case 'load':
        self.postMessage({ type: 'complete', id, data: null });
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      id, 
      error: error.message 
    });
  }
};

async function handleExtractAudio(id, ffmpeg, { fileData }) {
  const logProgress = ({ progress }) => {
    self.postMessage({ type: 'progress', id, progress: progress * 100 });
  };
  
  ffmpeg.on('progress', logProgress);
  
  try {
    await safeDelete(ffmpeg, 'input.mp4');
    await safeDelete(ffmpeg, 'audio.wav');
    
    await ffmpeg.writeFile('input.mp4', new Uint8Array(fileData));
    
    const ret = await ffmpeg.exec([
      '-y', '-i', 'input.mp4', '-vn', 
      '-c:a', 'pcm_s16le', '-ar', '16000', '-ac', '1', 
      'audio.wav'
    ]);
    
    if (ret !== 0) {
      throw new Error(`FFmpeg extraction failed with code ${ret}`);
    }
    
    if (!(await fileExists(ffmpeg, 'audio.wav'))) {
      throw new Error('Output file audio.wav was not created');
    }
    
    const data = await ffmpeg.readFile('audio.wav');
    
    await safeDelete(ffmpeg, 'input.mp4');
    await safeDelete(ffmpeg, 'audio.wav');
    
    // Get the underlying ArrayBuffer
    const buffer = data.buffer instanceof ArrayBuffer ? data.buffer : data.buffer.buffer;
    
    self.postMessage({ 
      type: 'complete', 
      id, 
      data: buffer, 
      mimeType: 'audio/wav'
    }, [buffer]);
    
  } catch (error) {
    await safeDelete(ffmpeg, 'input.mp4');
    await safeDelete(ffmpeg, 'audio.wav');
    throw error;
  } finally {
    ffmpeg.off('progress', logProgress);
  }
}

async function handleCutVideo(id, ffmpeg, { fileData, segments }) {
  const logProgress = ({ progress }) => {
    self.postMessage({ type: 'progress', id, progress: progress * 100 });
  };
  
  ffmpeg.on('progress', logProgress);
  
  try {
    await safeDelete(ffmpeg, 'input.mp4');
    await safeDelete(ffmpeg, 'output.mp4');
    
    await ffmpeg.writeFile('input.mp4', new Uint8Array(fileData));
    
    const filterParts = [];
    const concatInputs = [];
    
    segments.forEach((segment, index) => {
      const { start, end } = segment;
      filterParts.push(`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${index}]`);
      filterParts.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${index}]`);
      concatInputs.push(`[v${index}][a${index}]`);
    });
    
    const filterComplex = [
      ...filterParts,
      `${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`
    ].join(';');
    
    const ret = await ffmpeg.exec([
      '-i', 'input.mp4',
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-c:a', 'aac',
      'output.mp4'
    ]);
    
    if (ret !== 0) {
      throw new Error(`FFmpeg cut failed with code ${ret}`);
    }
    
    if (!(await fileExists(ffmpeg, 'output.mp4'))) {
      throw new Error('Output file output.mp4 was not created');
    }
    
    const data = await ffmpeg.readFile('output.mp4');
    
    await safeDelete(ffmpeg, 'input.mp4');
    await safeDelete(ffmpeg, 'output.mp4');
    
    // Get the underlying ArrayBuffer
    const buffer = data.buffer instanceof ArrayBuffer ? data.buffer : data.buffer.buffer;
    
    self.postMessage({ 
      type: 'complete', 
      id, 
      data: buffer,
      mimeType: 'video/mp4'
    }, [buffer]);
    
  } catch (error) {
    await safeDelete(ffmpeg, 'input.mp4');
    await safeDelete(ffmpeg, 'output.mp4');
    throw error;
  } finally {
    ffmpeg.off('progress', logProgress);
  }
}
