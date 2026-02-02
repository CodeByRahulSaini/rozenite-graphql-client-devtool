import { Trash2, Play, Square } from 'lucide-react';
import { Button } from './Button';

interface ToolbarProps {
  isRecording: boolean;
  onToggleRecording: () => void;
}

export function Toolbar({ isRecording, onToggleRecording }: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-200">
          GraphQL Devtool
        </span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleRecording}
          className="h-8"
        >
          {isRecording ? (
            <>
              <Square className="h-3 w-3 mr-1" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-3 w-3 mr-1" />
              Record
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
