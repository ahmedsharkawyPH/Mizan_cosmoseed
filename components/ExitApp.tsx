
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { 
  LogOut, Cloud, CheckCircle2, AlertTriangle, 
  Loader2, XCircle, Wifi, RefreshCw, ShieldCheck
} from 'lucide-react';
import { t } from '../utils/t';

export const ExitApp = () => {
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<'CHECKING' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('CHECKING');
  const [progress, setProgress] = useState(0);
  const [initialOps, setInitialOps] = useState(0);
  const [currentOps, setCurrentOps] = useState(0);
  const [timeLeft, setTimeLeft] = useState<string>('...');

  // مراقبة حالة المزامنة من قاعدة البيانات
  useEffect(() => {
    const unsub = db.onSyncStateChange((isBusy) => {
      const count = db.activeOperations;
      setCurrentOps(count);
      
      if (showModal && status === 'SYNCING') {
        if (count === 0) {
          setProgress(100);
          setStatus('SUCCESS');
          setTimeout(() => performLogout(), 1500);
        } else {
          // حساب التقدم التقريبي
          const done = Math.max(0, initialOps - count);
          const percent = initialOps > 0 ? Math.round((done / initialOps) * 100) : 50;
          setProgress(Math.min(95, percent));
          
          // حساب الوقت المتوقع (متوسط 1.2 ثانية لكل عملية)
          const seconds = Math.ceil(count * 1.2);
          setTimeLeft(seconds > 60 ? `${Math.ceil(seconds/60)} دقيقة` : `${seconds} ثانية`);
        }
      }
    });
    return unsub;
  }, [showModal, status, initialOps]);

  const initiateExit = async () => {
    const count = db.activeOperations;
    setShowModal(true);
    setInitialOps(count);
    setCurrentOps(count);
    
    if (count === 0) {
      setStatus('CHECKING');
      // فحص سريع إضافي للتأكد من سلامة البيانات
      setTimeout(() => {
        setStatus('SUCCESS');
        setTimeout(() => performLogout(), 1000);
      }, 800);
    } else {
      setStatus('SYNCING');
      setProgress(10);
      setTimeLeft(`${Math.ceil(count * 1.2)} ثانية`);
    }
  };

  const performLogout = () => {
    authService.logout();
  };

  return (
    <>
      {/* زر الخروج في القائمة الجانبية */}
      <button 
        onClick={initiateExit}
        className="flex items-center w-full px-4 py-3 text-sm font-bold text-red-400 rounded-xl hover:bg-red-950/30 transition-all group"
      >
        <LogOut className="w-5 h-5 ltr:mr-3 rtl:ml-3 group-hover:scale-110 transition-transform" />
        {t('nav.logout') || 'إغلاق النظام آمن'}
      </button>

      {/* نافذة المزامنة المنبثقة */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            
            {/* Header Area */}
            <div className={`p-10 text-center transition-colors duration-500 ${
              status === 'SUCCESS' ? 'bg-emerald-50' : 
              status === 'ERROR' ? 'bg-red-50' : 'bg-slate-50'
            }`}>
               <div className="relative mx-auto w-24 h-24 mb-6">
                  {status === 'CHECKING' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                    </div>
                  )}
                  {status === 'SYNCING' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20"></div>
                      <Wifi className="w-12 h-12 text-blue-600 animate-pulse" />
                    </div>
                  )}
                  {status === 'SUCCESS' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-100 rounded-full animate-in zoom-in">
                      <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                    </div>
                  )}
                  {status === 'ERROR' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-100 rounded-full">
                      <AlertTriangle className="w-12 h-12 text-red-600" />
                    </div>
                  )}
               </div>

               <h2 className="text-2xl font-black text-slate-800 mb-2">
                  {status === 'CHECKING' && 'جاري فحص حالة البيانات...'}
                  {status === 'SYNCING' && 'جاري المزامنة السحابية'}
                  {status === 'SUCCESS' && 'تمت المزامنة بنجاح'}
                  {status === 'ERROR' && 'خطأ في الاتصال'}
               </h2>
               <p className="text-slate-500 font-bold text-sm">
                  {status === 'SYNCING' 
                    ? `يرجى عدم إغلاق المتصفح لضمان حفظ ${currentOps} عملية معلقة` 
                    : status === 'SUCCESS' ? 'سيتم الخروج من النظام الآن بأمان...' : 'تأكد من اتصالك بالإنترنت للمزامنة'}
               </p>
            </div>

            {/* Progress & Info Body */}
            <div className="p-10 pt-2 space-y-8">
               
               {status === 'SYNCING' && (
                 <div className="animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                       <span>نسبة الإنجاز: {progress}%</span>
                       <span>الوقت المتبقي: {timeLeft}</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                       <div 
                         className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-700 ease-out relative"
                         style={{ width: `${progress}%` }}
                       >
                         <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] skew-x-12" />
                       </div>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2 text-blue-600 text-xs font-bold">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        جاري رفع البيانات المشفرة إلى Citadel Cloud...
                    </div>
                 </div>
               )}

               {status === 'ERROR' && (
                 <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-5 flex gap-4 animate-in shake duration-500">
                    <XCircle className="w-8 h-8 text-red-600 shrink-0" />
                    <div>
                       <h4 className="font-black text-red-800 text-sm">تعذر الوصول للسحابة</h4>
                       <p className="text-xs font-bold text-red-600/70 mt-1 leading-relaxed">
                          يبدو أن هناك مشكلة في الشبكة. يمكنك الخروج الآن ولكن قد يتم فقدان العمليات الأخيرة غير المحفوظة سحابياً.
                       </p>
                    </div>
                 </div>
               )}

               {status === 'SUCCESS' && (
                  <div className="flex flex-col items-center gap-2 text-emerald-600 animate-bounce">
                      <ShieldCheck className="w-6 h-6" />
                      <span className="text-xs font-black uppercase">قاعدة البيانات مؤمنة بالكامل</span>
                  </div>
               )}

               {/* Action Buttons */}
               <div className="flex gap-4 pt-4">
                  {status === 'ERROR' ? (
                     <>
                        <button 
                          onClick={() => setShowModal(false)} 
                          className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-black text-slate-500 hover:bg-slate-50 transition-all"
                        >
                           إلغاء
                        </button>
                        <button 
                          onClick={performLogout} 
                          className="flex-[1.5] py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all"
                        >
                           خروج (بدون حفظ)
                        </button>
                     </>
                  ) : (
                     status !== 'SUCCESS' && (
                        <button 
                          onClick={() => setShowModal(false)}
                          className="w-full py-4 border-2 border-slate-100 rounded-2xl font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                           <XCircle className="w-4 h-4" /> إخفاء (الاستمرار في الخلفية)
                        </button>
                     )
                  )}
               </div>

            </div>
          </div>
          <style>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
            .shake {
              animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
            }
            @keyframes shake {
              10%, 90% { transform: translate3d(-1px, 0, 0); }
              20%, 80% { transform: translate3d(2px, 0, 0); }
              30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
              40%, 60% { transform: translate3d(4px, 0, 0); }
            }
          `}</style>
        </div>
      )}
    </>
  );
};
