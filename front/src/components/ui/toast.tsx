'use client';

import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
  };

  const icons = {
    success: <CheckCircle className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
  };

  return (
    <div className="animate-in slide-in-from-right-5 fade-in fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg duration-300">
      <div className={colors[type]}>{icons[type]}</div>
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="ml-2">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
