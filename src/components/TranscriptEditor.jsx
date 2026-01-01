import React, { useEffect, useRef, useState } from 'react';
import { Search, Loader2, Download, Trash2 } from 'lucide-react';
import { useEditor } from '../context/EditorContext';
import { processVideoTranscription } from '../lib/video-processor';
import { exportTranscriptAsSRT, exportTranscriptAsVTT, loadWhisper } from '../lib/transcription';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

export default function TranscriptEditor() {
  const {
    videoFile,
    transcript,
    currentTime,
    isTranscribing,
    transcriptionProgress,
    searchQuery,
    deletedSegments,
    language,
    setTranscript,
    setIsTranscribing,
    setTranscriptionProgress,
    setSearchQuery,
    setCurrentTime,
    setIsPlaying,
    deleteWord,
    setLanguage,
  } = useEditor();

  const [selectedWords, setSelectedWords] = useState(new Set());
  const transcriptRef = useRef(null);
  const progressRef = useRef(0);
  const [statusMessage, setStatusMessage] = useState('');
  const activeWordRef = useRef(null);

  // Auto-scroll to active word
  useEffect(() => {
    if (activeWordRef.current && transcriptRef.current) {
      const container = transcriptRef.current;
      const activeElement = activeWordRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const elementRect = activeElement.getBoundingClientRect();
      
      // Check if element is outside visible area
      if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime]);

  const startTranscription = React.useCallback(async () => {
    console.log('[TranscriptEditor] Starting transcription...');
    setIsTranscribing(true);
    setTranscriptionProgress(0);
    setStatusMessage('Loading transcription model...');
    
    try {
      // Step 1: Load the Whisper model first
      await loadWhisper('tiny', (progress) => {
        setTranscriptionProgress(progress);
        setStatusMessage('Loading transcription model...');
      });
      
      setStatusMessage('Starting transcription...');
      
      let result;
      
      const processVideo = async () => {
        let lastUpdate = 0;
        
        return await processVideoTranscription(
          videoFile,
          language,
          (progress, message) => {
            const now = Date.now();
            console.log('[TranscriptEditor] Progress:', progress, message);
            // Update if > 1% change or > 100ms elapsed or complete
            if (
              Math.abs(progress - progressRef.current) > 1 || 
              now - lastUpdate > 100 || 
              progress === 100 ||
              progress === 0
            ) {
              setTranscriptionProgress(progress);
              progressRef.current = progress;
              setStatusMessage(message || 'Processing...');
              lastUpdate = now;
            }
          },
          (partialTranscript) => {
            // Update transcript in real-time as words come in
            console.log('[TranscriptEditor] Partial transcript update:', partialTranscript.length, 'words');
            setTranscript(partialTranscript);
          }
        );
      };
      
      result = await processVideo();
      
      console.log('[TranscriptEditor] Transcription complete, result:', result);
      
      if (!result || result.length === 0) {
        throw new Error('Transcription returned no results');
      }
      
      setTranscript(result);
      setStatusMessage('Transcription complete!');
      setTranscriptionProgress(100);
      
      // Force UI update after a short delay
      setTimeout(() => {
        setIsTranscribing(false);
      }, 500);
      
    } catch (error) {
      console.error('[TranscriptEditor] Transcription error:', error);
      setStatusMessage('Transcription failed: ' + error.message);
      alert('Transcription failed: ' + error.message);
      setIsTranscribing(false);
    }
  }, [videoFile, language, setIsTranscribing, setTranscriptionProgress, setTranscript]);

  useEffect(() => {
    if (videoFile && transcript.length === 0 && !isTranscribing) {
      startTranscription();
    }
  }, [videoFile, transcript.length, isTranscribing, startTranscription]);

  const handleWordClick = (wordIndex, word) => {
    // Jump to timestamp
    setCurrentTime(word.start);
    setIsPlaying(true);
    
    // Toggle selection
    const newSelection = new Set(selectedWords);
    if (newSelection.has(wordIndex)) {
      newSelection.delete(wordIndex);
    } else {
      newSelection.add(wordIndex);
    }
    setSelectedWords(newSelection);
  };

  const handleDeleteSelected = () => {
    if (selectedWords.size === 0) return;
    
    // Delete each selected word
    Array.from(selectedWords).sort((a, b) => b - a).forEach(index => {
      deleteWord(index);
    });
    
    setSelectedWords(new Set());
  };

  const isWordDeleted = (word) => {
    return deletedSegments.some(seg => 
      word.start >= seg.start && word.end <= seg.end
    );
  };

  const isWordActive = (index) => {
    const word = transcript[index];
    if (!word) return false;
    // Check if current time is within the word's time range
    // Add small tolerance for better UX
    return currentTime >= word.start && currentTime <= word.end;
  };

  const downloadTranscript = (format) => {
    let content, filename, mimeType;
    
    if (format === 'srt') {
      content = exportTranscriptAsSRT(transcript);
      filename = 'transcript.srt';
      mimeType = 'text/srt';
    } else {
      content = exportTranscriptAsVTT(transcript);
      filename = 'transcript.vtt';
      mimeType = 'text/vtt';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTranscript = searchQuery
    ? transcript.map((word, index) => ({
        word,
        index,
        matches: word.word.toLowerCase().includes(searchQuery.toLowerCase())
      })).filter(item => item.matches)
    : transcript.map((word, index) => ({ word, index, matches: true }));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">📝</span>
            Transcript Editor
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-3 py-1.5 rounded-md border bg-background text-sm"
              disabled={isTranscribing || transcript.length > 0}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
            </select>
            
            {transcript.length > 0 && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadTranscript('srt')}
                  title="Download SRT"
                >
                  <Download className="w-4 h-4 mr-1" />
                  SRT
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadTranscript('vtt')}
                  title="Download VTT"
                >
                  <Download className="w-4 h-4 mr-1" />
                  VTT
                </Button>
              </div>
            )}
          </div>
        </div>

        {transcript.length > 0 && (
          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transcript..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {selectedWords.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                size="sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedWords.size})
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-6">
        {transcript.length === 0 && !isTranscribing ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="text-6xl">🎤</div>
            <p className="text-lg text-muted-foreground">
              Waiting to transcribe video...
            </p>
          </div>
        ) : transcript.length === 0 && isTranscribing ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="text-center space-y-2 w-full max-w-md">
              <p className="text-lg font-medium">{statusMessage}</p>
              <Progress value={transcriptionProgress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                {Math.round(transcriptionProgress)}%
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Transcript will appear as words are recognized...
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {isTranscribing && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Transcribing... {Math.round(transcriptionProgress)}%
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400 ml-auto">
                    You can start editing now!
                  </span>
                </div>
                <Progress value={transcriptionProgress} className="mt-2 h-1" />
              </div>
            )}
            
            <div 
              ref={transcriptRef}
              className="flex-1 overflow-y-auto space-y-1 px-2"
            >
              <p className="text-sm text-muted-foreground mb-4">
                Click words to jump to that moment • Select multiple words and delete to remove segments
              </p>
              
              <div className="leading-relaxed text-lg">
                {filteredTranscript.map(({ word, index }) => {
                  const isDeleted = isWordDeleted(word);
                  const isActive = isWordActive(index);
                  const isSelected = selectedWords.has(index);
                  const isLowConfidence = word.confidence < 0.7;
                  
                  return (
                    <span
                      key={index}
                      ref={isActive ? activeWordRef : null}
                      onClick={() => handleWordClick(index, word)}
                      className={`
                        word-clickable inline-block mx-0.5 my-0.5 transition-all duration-150 cursor-pointer
                        ${isActive ? 'bg-primary text-primary-foreground font-bold scale-110 px-1 rounded' : ''}
                        ${isDeleted ? 'line-through opacity-50 text-destructive' : ''}
                        ${isSelected ? 'bg-yellow-200 dark:bg-yellow-800 font-medium px-1 rounded' : ''}
                        ${isLowConfidence && !isActive && !isSelected ? 'text-orange-500 dark:text-orange-400' : ''}
                        ${searchQuery && word.word.toLowerCase().includes(searchQuery.toLowerCase()) ? 'bg-green-100 dark:bg-green-900 px-1 rounded' : ''}
                        ${!isActive && !isDeleted && !isSelected && !searchQuery ? 'hover:bg-accent hover:px-1 hover:rounded' : ''}
                      `}
                      title={`${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s (confidence: ${(word.confidence * 100).toFixed(0)}%)`}
                    >
                      {word.word}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
