// Web Speech API based transcription
let recognition = null;

function initSpeechRecognition(language = 'en-US') {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    throw new Error('Speech recognition not supported in this browser');
  }
  
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = language;
  
  return recognition;
}

export async function transcribeAudio(audioBlob, language = 'en', onProgress) {
  try {
    console.log('[Transcription] Starting audio transcription with Web Speech API...');
    
    // Convert language code (en -> en-US)
    const speechLang = convertLanguageCode(language);
    
    // Create audio element to play the audio for speech recognition
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    // Get audio duration
    await new Promise((resolve) => {
      audio.addEventListener('loadedmetadata', resolve, { once: true });
    });
    
    const duration = audio.duration;
    console.log('[Transcription] Audio duration:', duration);
    
    return new Promise((resolve, reject) => {
      const transcript = [];
      let startTime = 0;
      
      try {
        const recognition = initSpeechRecognition(speechLang);
        
        recognition.onstart = () => {
          console.log('[Transcription] Speech recognition started');
          onProgress?.(10);
          audio.play();
        };
        
        recognition.onresult = (event) => {
          const currentTime = audio.currentTime;
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcriptText = result[0].transcript;
            const isFinal = result.isFinal;
            
            if (isFinal) {
              // Split into words and add timestamps
              const words = transcriptText.trim().split(/\s+/);
              const segmentDuration = currentTime - startTime;
              const timePerWord = segmentDuration / words.length;
              
              words.forEach((word, idx) => {
                transcript.push({
                  word: word,
                  start: startTime + (idx * timePerWord),
                  end: startTime + ((idx + 1) * timePerWord),
                  confidence: result[0].confidence || 0.9,
                });
              });
              
              startTime = currentTime;
              
              // Update progress based on audio playback
              const progress = 10 + (currentTime / duration) * 80;
              onProgress?.(progress);
            }
          }
        };
        
        recognition.onerror = (event) => {
          console.error('[Transcription] Speech recognition error:', event.error);
          audio.pause();
          URL.revokeObjectURL(audioUrl);
          
          if (event.error === 'no-speech') {
            reject(new Error('No speech detected in audio'));
          } else if (event.error === 'not-allowed') {
            reject(new Error('Microphone permission denied'));
          } else {
            reject(new Error(`Speech recognition error: ${event.error}`));
          }
        };
        
        recognition.onend = () => {
          console.log('[Transcription] Speech recognition ended');
          audio.pause();
          URL.revokeObjectURL(audioUrl);
          
          if (transcript.length === 0) {
            reject(new Error('No transcription results'));
          } else {
            console.log('[Transcription] Transcription complete, words:', transcript.length);
            onProgress?.(100);
            resolve(transcript);
          }
        };
        
        audio.onended = () => {
          console.log('[Transcription] Audio playback ended');
          recognition.stop();
        };
        
        audio.onerror = (error) => {
          console.error('[Transcription] Audio playback error:', error);
          recognition.stop();
          reject(new Error('Audio playback failed'));
        };
        
        // Start recognition
        recognition.start();
        
      } catch (error) {
        audio.pause();
        URL.revokeObjectURL(audioUrl);
        reject(error);
      }
    });
    
  } catch (error) {
    console.error('[Transcription] Failed:', error);
    throw error;
  }
}

function convertLanguageCode(code) {
  const languageMap = {
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
  };
  
  return languageMap[code] || 'en-US';
}

export async function loadWhisper(modelSize = 'small', onProgress) {
  // No-op for Web Speech API compatibility
  console.log('[Transcription] Using Web Speech API (no model loading needed)');
  return Promise.resolve();
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
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
}

function formatVTTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}
