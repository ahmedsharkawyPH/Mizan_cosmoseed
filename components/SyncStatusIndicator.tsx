import React from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';

interface SyncStatusIndicatorProps {
  status?: 'Pending' | 'Synced' | 'Error';
  error?: string;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ status, error }) => {
  if (!status || status === 'Synced') {
    return (
      <div className="flex items-center text-green-500" title="تمت المزامنة">
        <Cloud className="w-4 h-4" />
      </div>
    );
  }

  if (status === 'Pending') {
    return (
      <div className="flex items-center text-yellow-500" title="في انتظار المزامنة">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (status === 'Error') {
    return (
      <div className="flex items-center text-red-500" title={`خطأ في المزامنة: ${error || 'غير معروف'}`}>
        <CloudOff className="w-4 h-4" />
      </div>
    );
  }

  return null;
};

