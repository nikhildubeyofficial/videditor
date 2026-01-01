import React, { useState, useEffect } from 'react';
import { Film, Moon, Sun, RotateCcw, HelpCircle } from 'lucide-react';
import { useEditor } from '../context/EditorContext';
import { Button } from './ui/button';

export default function Header() {
  const { reset } = useEditor();
  const [darkMode, setDarkMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset? This will clear all your work.')) {
      reset();
      window.location.reload();
    }
  };

  const shortcuts = [
    { key: 'Space', action: 'Play/Pause' },
    { key: '←/→', action: 'Seek backward/forward' },
    { key: 'Click word', action: 'Jump to timestamp' },
    { key: 'Click + Select', action: 'Select multiple words' },
    { key: 'Delete btn', action: 'Remove selected segments' },
    { key: '?', action: 'Show this help' },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Film className="w-8 h-8 text-primary" />
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                TextEdit Video
              </span>
            </div>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
              Beta
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHelp(!showHelp)}
              title="Keyboard Shortcuts"
            >
              <HelpCircle className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              title="Toggle Dark Mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              title="Reset Project"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowHelp(false)}
        >
          <div 
            className="bg-background rounded-lg border shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-primary" />
              Keyboard Shortcuts
            </h2>
            
            <div className="space-y-3">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <span className="text-sm text-muted-foreground">{shortcut.action}</span>
                  <kbd className="px-2 py-1 bg-background border rounded text-sm font-mono">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>

            <Button
              onClick={() => setShowHelp(false)}
              className="w-full mt-4"
            >
              Got it!
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
