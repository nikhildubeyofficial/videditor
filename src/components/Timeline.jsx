import React from 'react';
import { useEditor } from '../context/EditorContext';
import { formatTime } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function Timeline() {
  const {
    videoDuration,
    currentTime,
    deletedSegments,
    setCurrentTime,
    setIsPlaying,
  } = useEditor();

  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * videoDuration;
    setCurrentTime(newTime);
    setIsPlaying(true);
  };

  const getSegmentStyle = (start, end) => {
    const left = (start / videoDuration) * 100;
    const width = ((end - start) / videoDuration) * 100;
    return { left: `${left}%`, width: `${width}%` };
  };

  const playheadPosition = (currentTime / videoDuration) * 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span>📊</span>
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Timeline bar */}
          <div
            onClick={handleTimelineClick}
            className="relative h-16 bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 rounded-lg cursor-pointer overflow-hidden border-2 border-muted group hover:border-primary transition-colors"
          >
            {/* Deleted segments */}
            {deletedSegments.map((segment, index) => (
              <div
                key={index}
                className="absolute top-0 h-full bg-destructive/60 backdrop-blur-sm opacity-80"
                style={getSegmentStyle(segment.start, segment.end)}
                title={`Deleted: ${formatTime(segment.start)} - ${formatTime(segment.end)}`}
              >
                <div className="h-full flex items-center justify-center text-xs text-destructive-foreground font-medium">
                  ✕
                </div>
              </div>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 h-full w-1 bg-primary shadow-lg transition-transform duration-75 z-10"
              style={{ left: `${playheadPosition}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-md" />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-md" />
            </div>

            {/* Time markers */}
            <div className="absolute bottom-1 left-2 text-xs text-foreground/70 font-mono bg-background/70 px-1 rounded">
              0:00
            </div>
            <div className="absolute bottom-1 right-2 text-xs text-foreground/70 font-mono bg-background/70 px-1 rounded">
              {formatTime(videoDuration)}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 rounded border" />
              <span>Kept Segments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-destructive/60 rounded border" />
              <span>Deleted Segments</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
