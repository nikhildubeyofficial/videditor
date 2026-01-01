import createModule from "@transcribe/shout";
import { FileTranscriber } from "@transcribe/transcriber";

let transcriber = null;
let isInitializing = false;

/**
 * Load Whisper model via Transcribe.js dynamically
 */
export async function loadWhisper(modelSize = 'tiny', onProgress) {
  // If already initialized, return
  if (transcriber) {
    console.log("[Transcription] Transcriber already loaded");
    return transcriber;
  }

  // If currently initializing, wait for it
  if (isInitializing) {
    console.log("[Transcription] Waiting for initialization...");
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return transcriber;
  }

  isInitializing = true;

  try {
    console.log("[Transcription] Initializing FileTranscriber...");
    
    // Create the transcriber instance with createModule from @transcribe/shout
    transcriber = new FileTranscriber({
      createModule, // Required: WASM module loader from @transcribe/shout
      model: `models/ggml-${modelSize}-q5_1.bin`,
      onProgress: (progress) => {
        console.log("[Transcription] Progress:", progress);
        if (onProgress) {
          if (typeof progress === 'number') {
            onProgress(progress * 50);
          } else if (progress.loaded && progress.total) {
            const percent = (progress.loaded / progress.total) * 100;
            onProgress(percent * 0.5);
          }
        }
      },
    });

    console.log("[Transcription] Calling init()...");
    await transcriber.init();
    
    console.log("[Transcription] Transcriber ready");
    isInitializing = false;
    
    if (onProgress) {
      onProgress(50);
    }
    
    return transcriber;
  } catch (error) {
    isInitializing = false;
    transcriber = null;
    console.error("[Transcription] Failed to initialize:", error);
    console.error("[Transcription] Error stack:", error.stack);
    throw new Error(`Failed to load transcription model: ${error.message}`);
  }
}

/**
 * Transcribe audio or video file
 */
export async function transcribeAudio(file, language = 'en', onProgress, onPartialTranscript) {
  console.log("[Transcription] Starting transcription...");
  
  if (!transcriber) {
    throw new Error("FileTranscriber not initialized. Call loadWhisper() first.");
  }

  try {
    const allWords = [];
    
    const result = await transcriber.transcribe(file, {
      lang: language, // Use 'lang' not 'language'
      token_timestamps: true, // Use snake_case
      onProgress: (p) => {
        console.log("[Transcription] Transcribe progress:", p);
        if (onProgress && typeof p === 'number') {
          onProgress(50 + p * 50);
        }
      },
      onSegment: (segment) => {
        console.log("[Transcription] Segment received:", segment);
        
        // Parse segment based on actual API structure
        if (segment.tokens && segment.tokens.length > 0) {
          const words = segment.tokens.map((token) => {
            // t0 and t1 are in centiseconds (1/100 of a second)
            const startTime = typeof token.t0 === 'number' ? token.t0 / 100 : 0;
            const endTime = typeof token.t1 === 'number' ? token.t1 / 100 : startTime + 0.5;
            
            return {
              word: (token.text || '').trim(),
              start: startTime,
              end: endTime,
              confidence: token.p || 0.9,
            };
          }).filter(w => w.word.length > 0);
          
          allWords.push(...words);
          
          if (onPartialTranscript && words.length > 0) {
            onPartialTranscript([...allWords]);
          }
        }
      },
    });

    console.log("[Transcription] Complete, result:", result);
    console.log("[Transcription] Result structure:", JSON.stringify(result, null, 2));
    
    let finalWords = [];
    
    // Check result.transcription array (actual API format)
    if (result.transcription && Array.isArray(result.transcription)) {
      result.transcription.forEach(segment => {
        if (segment.tokens && segment.tokens.length > 0) {
          const words = segment.tokens.map((token) => {
            // t0 and t1 are in centiseconds (1/100 of a second)
            const startTime = typeof token.t0 === 'number' ? token.t0 / 100 : 0;
            const endTime = typeof token.t1 === 'number' ? token.t1 / 100 : startTime + 0.5;
            
            return {
              word: (token.text || '').trim(),
              start: startTime,
              end: endTime,
              confidence: token.p || 0.9,
            };
          }).filter(w => w.word.length > 0);
          
          finalWords.push(...words);
        }
      });
    }
    
    // Fallback to allWords from onSegment
    if (finalWords.length === 0 && allWords.length > 0) {
      finalWords = allWords;
    }
    
    // Last resort: split text into words with estimated timestamps
    if (finalWords.length === 0 && result.transcription && result.transcription.length > 0) {
      const fullText = result.transcription.map(s => s.text).join(' ');
      const words = fullText.split(/\s+/).filter(w => w.trim());
      
      // Get duration from last segment
      const lastSegment = result.transcription[result.transcription.length - 1];
      const duration = lastSegment.t1 ? lastSegment.t1 / 100 : 60;
      const timePerWord = duration / words.length;
      
      finalWords = words.map((word, index) => ({
        word: word,
        start: index * timePerWord,
        end: (index + 1) * timePerWord,
        confidence: 0.9,
      }));
    }

    console.log("[Transcription] Returning", finalWords.length, "words");
    
    return {
      text: result.transcription ? result.transcription.map(s => s.text).join(' ') : '',
      words: finalWords,
    };
  } catch (error) {
    console.error("[Transcription] Transcription failed:", error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

export function exportTranscriptAsSRT(transcript) {
  let srt = '';
  transcript.forEach((word, index) => {
    srt += `${index + 1}\n`;
    srt += `${formatSRTTime(word.start)} --> ${formatSRTTime(word.end)}\n`;
    srt += `${word.word}\n\n`;
  });
  return srt;
}

export function exportTranscriptAsVTT(transcript) {
  let vtt = 'WEBVTT\n\n';
  transcript.forEach((word, index) => {
    vtt += `${index + 1}\n`;
    vtt += `${formatVTTTime(word.start)} --> ${formatVTTTime(word.end)}\n`;
    vtt += `${word.word}\n\n`;
  });
  return vtt;
}

function formatSRTTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')},${ms.toString().padStart(3,'0')}`;
}

function formatVTTTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`;
}
