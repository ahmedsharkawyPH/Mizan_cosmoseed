
import React from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

export function RouteErrorBoundary() {
  const error = useRouteError();
  console.error('Route Error:', error);

  // Check if it's a chunk load error (common when offline and lazy loading)
  const isChunkError = error instanceof Error && 
    (error.message.includes('Failed to fetch dynamically imported module') || 
     error.message.includes('Importing a module script failed'));

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 max-w-md shadow-xl">
        <div className="flex justify-center mb-6">
          {isChunkError ? (
            <div className="bg-amber-100 p-4 rounded-full">
              <WifiOff className="w-12 h-12 text-amber-600" />
            </div>
          ) : (
            <div className="bg-red-100 p-4 rounded-full">
              <AlertTriangle className="w-12 h-12 text-red-600" />
            </div>
          )}
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          {isChunkError ? 'عذراً، هذه الصفحة غير متوفرة حالياً' : 'حدث خطأ غير متوقع'}
        </h2>

        <p className="text-slate-600 mb-8 leading-relaxed">
          {isChunkError 
            ? 'يبدو أنك تحاول فتح هذه الشاشة لأول مرة وأنت غير متصل بالإنترنت. يرجى الاتصال بالإنترنت وفتح هذه الشاشة مرة واحدة ليتم حفظها للعمل أوفلاين لاحقاً.'
            : 'نعتذر عن هذا الخطأ. يرجى محاولة تحديث الصفحة أو العودة للرئيسية.'}
        </p>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-200"
          >
            <RefreshCw className="w-5 h-5" />
            إعادة المحاولة
          </button>
          
          <button 
            onClick={() => window.location.href = '/'}
            className="text-slate-500 hover:text-slate-700 font-medium py-2"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
      
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-slate-100 rounded-lg text-left text-xs font-mono max-w-2xl overflow-auto">
          <p className="font-bold text-red-600 mb-2">Debug Info:</p>
          <pre>{error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
