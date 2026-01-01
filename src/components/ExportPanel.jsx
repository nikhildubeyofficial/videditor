import React, { useState } from 'react';
import { Download, Loader2, CheckCircle2, Play, HardDrive, Timer, FolderOpen, Info } from 'lucide-react';
import { useEditor } from '../context/EditorContext';
import { exportEditedVideo } from '../lib/video-processor';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

export default function ExportPanel() {
  const {
    videoFile,
    videoDuration,
    deletedSegments,
    isExporting,
    exportProgress,
    exportedVideoUrl,
    setIsExporting,
    setExportProgress,
    setExportedVideoUrl,
    setShowExportPanel,
  } = useEditor();

  const [exportSettings, setExportSettings] = useState({
    format: 'mp4',
    quality: 'medium',
    resolution: 'original',
  });

  const [statusMessage, setStatusMessage] = useState('');

  const presets = [
    { id: 'youtube', name: 'YouTube 1080p', desc: 'Optimized for streaming. H.264, High bitrate.', quality: 'high', resolution: '1080p' },
    { id: 'social', name: 'Social Vertical', desc: '9:16 for TikTok/Reels. Mobile optimized.', quality: 'medium', resolution: '720p' },
    { id: 'prores', name: 'ProRes 422', desc: 'Master quality. Large file size.', quality: 'high', resolution: 'original' },
  ];

  const [selectedPreset, setSelectedPreset] = useState('youtube');

  const handlePresetClick = (preset) => {
    setSelectedPreset(preset.id);
    setExportSettings({
      ...exportSettings,
      quality: preset.quality,
      resolution: preset.resolution,
    });
  };

  const handleExport = async () => {
    if (!videoFile) {
      alert('No video file loaded.');
      return;
    }

    setIsExporting(true);
    setStatusMessage('Preparing export...');
    
    try {
      const resultBlob = await exportEditedVideo(
        videoFile,
        deletedSegments,
        videoDuration,
        exportSettings,
        (progress, message) => {
          setExportProgress(progress);
          setStatusMessage(message);
        }
      );
      
      const url = URL.createObjectURL(resultBlob);
      setExportedVideoUrl(url);
      setStatusMessage('Export complete!');
    } catch (error) {
      console.error('Export error:', error);
      setStatusMessage('Export failed: ' + error.message);
      alert('Export failed: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportedVideoUrl) return;
    
    const a = document.createElement('a');
    a.href = exportedVideoUrl;
    a.download = `edited-video-${Date.now()}.mp4`;
    a.click();
    
    // Close the export panel after download
    setTimeout(() => {
      setShowExportPanel(false);
    }, 500);
  };

  const deletedDuration = deletedSegments.reduce((total, seg) => 
    total + (seg.end - seg.start), 0
  );

  const remainingDuration = videoDuration - deletedDuration;
  const estimatedSize = (remainingDuration * 2).toFixed(1); // Rough estimate: 2MB per minute

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#111318]">
      {/* Header */}
      <div className="p-4 border-b border-[#282e39]">
        <h3 className="text-white font-bold text-sm">Export Settings</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Presets */}
        <section>
          <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-3">Presets</h4>
          <div className="space-y-2">
            {presets.map((preset) => (
              <div
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                className={`group cursor-pointer rounded-lg p-3 transition-all ${
                  selectedPreset === preset.id
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'bg-[#1E232E] border-2 border-transparent hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold mb-1">{preset.name}</p>
                    <p className="text-gray-400 text-xs">{preset.desc}</p>
                  </div>
                  {selectedPreset === preset.id && (
                    <CheckCircle2 className="w-5 h-5 text-primary flex-none" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Format Selector */}
        <section>
          <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Format</label>
          <div className="inline-flex rounded-lg p-1 bg-[#1E232E]">
            {['mp4', 'webm'].map((format) => (
              <button
                key={format}
                onClick={() => setExportSettings({ ...exportSettings, format })}
                className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${
                  exportSettings.format === format
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        {/* Resolution & Quality */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Resolution</label>
            <select
              value={exportSettings.resolution}
              onChange={(e) => setExportSettings({ ...exportSettings, resolution: e.target.value })}
              className="w-full bg-[#1E232E] border border-[#282e39] text-white text-sm rounded-lg p-2.5"
              disabled={isExporting}
            >
              <option value="original">Original Resolution</option>
              <option value="1080p">1920 x 1080 (HD)</option>
              <option value="720p">1280 x 720 (HD)</option>
              <option value="480p">854 x 480 (SD)</option>
              <option value="360p">640 x 360 (Low)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Quality</label>
            <select
              value={exportSettings.quality}
              onChange={(e) => setExportSettings({ ...exportSettings, quality: e.target.value })}
              className="w-full bg-[#1E232E] border border-[#282e39] text-white text-sm rounded-lg p-2.5"
              disabled={isExporting}
            >
              <option value="high">High (~5-10 MB/min)</option>
              <option value="medium">Medium (~2-4 MB/min)</option>
              <option value="low">Low (~1-2 MB/min)</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-[#1E232E] border border-[#282e39]">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <HardDrive className="w-4 h-4" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Est. Size</span>
            </div>
            <p className="text-white text-lg font-mono font-semibold">{estimatedSize} MB</p>
          </div>
          <div className="p-3 rounded-lg bg-[#1E232E] border border-[#282e39]">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Timer className="w-4 h-4" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Duration</span>
            </div>
            <p className="text-white text-lg font-mono font-semibold">{formatDuration(remainingDuration)}</p>
          </div>
        </div>

        {/* Info Box */}
        {deletedSegments.length > 0 ? (
          <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20 flex gap-3 items-start">
            <Info className="w-4 h-4 text-blue-400 flex-none mt-0.5" />
            <p className="text-xs text-blue-200">
              {deletedSegments.length} segment{deletedSegments.length > 1 ? 's' : ''} will be removed, saving {Math.floor(deletedDuration)} seconds.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded bg-gray-500/10 border border-gray-500/20 flex gap-3 items-start">
            <Info className="w-4 h-4 text-gray-400 flex-none mt-0.5" />
            <p className="text-xs text-gray-300">
              No segments deleted. Export will convert the video with selected quality settings.
            </p>
          </div>
        )}

        {/* Export Progress */}
        {isExporting && (
          <div className="space-y-2 p-3 bg-[#1E232E] rounded-lg border border-[#282e39]">
            <div className="flex justify-between text-xs text-white mb-1">
              <span>{statusMessage}</span>
              <span>{Math.round(exportProgress)}%</span>
            </div>
            <Progress value={exportProgress} className="h-2" />
          </div>
        )}

        {/* Export Success */}
        {exportedVideoUrl && !isExporting && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-green-300 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium text-sm">Export Complete!</span>
            </div>
            <Button
              onClick={handleDownload}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Video
            </Button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-[#282e39] space-y-2">
        {!exportedVideoUrl && (
          <>
            <Button
              onClick={handleExport}
              disabled={isExporting || !videoFile}
              className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 shadow-lg shadow-blue-900/20"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  Export Video
                  <Download className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            <button
              onClick={() => setShowExportPanel(false)}
              className="w-full text-gray-400 hover:text-white font-medium py-2 text-sm transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
