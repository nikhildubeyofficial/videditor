import { extractAudio, cutVideo, getKeptSegments } from './ffmpeg';
import { transcribeAudio } from './transcription';

export async function processVideoTranscription(videoFile, language, onProgress) {
  try {
    console.log('[VideoProcessor] Starting video transcription...');
    
    // Step 1: Extract audio (20% of progress)
    onProgress?.(0, 'Extracting audio...');
    const audioBlob = await extractAudio(videoFile, (progress) => {
      onProgress?.(progress * 0.2, 'Extracting audio...');
    });
    
    console.log('[VideoProcessor] Audio extracted, size:', audioBlob.size);
    
    // Step 2: Transcribe (80% of progress)
    onProgress?.(20, 'Transcribing audio...');
    const transcript = await transcribeAudio(audioBlob, language, (progress) => {
      onProgress?.(20 + progress * 0.8, 'Transcribing audio...');
    });
    
    console.log('[VideoProcessor] Transcription complete, words:', transcript?.length);
    
    onProgress?.(100, 'Transcription complete!');
    return transcript;
  } catch (error) {
    console.error('[VideoProcessor] Video processing failed:', error);
    throw error;
  }
}

export async function exportEditedVideo(videoFile, deletedSegments, duration, onProgress) {
  try {
    onProgress?.(0, 'Preparing export...');
    
    // Get segments to keep
    const keptSegments = getKeptSegments(duration, deletedSegments);
    
    if (keptSegments.length === 0) {
      throw new Error('No video content remaining after deletions');
    }
    
    // If no deletions, return original
    if (deletedSegments.length === 0) {
      onProgress?.(100, 'Export complete!');
      return videoFile;
    }
    
    // Cut video
    onProgress?.(10, 'Processing video...');
    const resultBlob = await cutVideo(videoFile, keptSegments, (progress) => {
      onProgress?.(10 + progress * 0.9, 'Processing video...');
    });
    
    onProgress?.(100, 'Export complete!');
    return resultBlob;
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

export function calculateTotalDuration(segments) {
  return segments.reduce((total, segment) => {
    return total + (segment.end - segment.start);
  }, 0);
}

export function isTimeInDeletedSegment(time, deletedSegments) {
  return deletedSegments.some(segment => 
    time >= segment.start && time <= segment.end
  );
}
