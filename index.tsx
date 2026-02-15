import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const APP_VERSION = '2.1.0'; 
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// إدارة كاش الموبايل بشكل قسري
if (isMobile) {
  const storedVersion = localStorage.getItem('app_version');
  
  if (storedVersion !== APP_VERSION) {
    console.log('🔄 Mobile Update Detected: Preparing for Fresh Data Sync...');
    
    // مسح الكاش المحلي للسماح بـ init() بجلب أحدث نسخة من السحابة
    localStorage.removeItem('mizan_db'); 
    sessionStorage.clear();
    
    // محاولة مسح IndexedDB (قواعد البيانات المحلية المتصفح)
    if ('indexedDB' in window) {
      indexedDB.databases().then(dbs => {
        dbs.forEach(db => {
          if (db.name) {
            console.log(`Deleting database: ${db.name}`);
            indexedDB.deleteDatabase(db.name);
          }
        });
      });
    }
    
    // مسح Cache API
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // تخزين النسخة الجديدة فوراً قبل إعادة التحميل
    localStorage.setItem('app_version', APP_VERSION);
    
    // إعادة التحميل القسري لمرة واحدة
    window.location.reload();
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);