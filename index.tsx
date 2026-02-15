import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const APP_VERSION = '2.0.0'; 
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// إدارة كاش الموبايل بشكل قسري
if (isMobile) {
  const storedVersion = localStorage.getItem('app_version');
  
  if (storedVersion !== APP_VERSION) {
    console.log('🔄 Mobile Update Detected: Clearing cache and storage...');
    
    // مسح Local Storage و Session Storage
    localStorage.clear();
    sessionStorage.clear();
    
    // محاولة مسح IndexedDB (قواعد البيانات المحلية)
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
    
    // مسح Cache API الخاص بـ Service Workers
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // تخزين النسخة الجديدة
    localStorage.setItem('app_version', APP_VERSION);
    
    // إعادة التحميل القسري من السيرفر
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