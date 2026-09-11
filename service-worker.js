const CACHE_NAME = 'tasbih-plus-v59-all-reciter-audio';
const AUDIO_CACHE_NAME = 'tasbih-plus-quran-audio-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Trois éditions complètes du Coran. Elles sont téléchargées une seule fois
// pendant l'installation/mise à jour du PWA, puis servies depuis le cache.
const QURAN_OFFLINE = [
  'https://api.alquran.cloud/v1/quran/quran-uthmani',
  'https://api.alquran.cloud/v1/quran/en.transliteration',
  'https://api.alquran.cloud/v1/quran/fr.hamidullah'
];

self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Ne bloque pas toute l'installation si le réseau Quran est momentanément indisponible.
    await Promise.allSettled(QURAN_OFFLINE.map(async url=>{
      const response=await fetch(url,{cache:'no-store'});
      if(response && response.ok) await cache.put(url,response.clone());
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME && key !== AUDIO_CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(response => {
        if(!response) return response;
        // Les MP3 sont conservés dans un cache audio séparé afin que l'état
        // hors connexion et le nettoyage des caches restent cohérents.
        if(response.status===200 || response.type==='opaque'){
          const copy=response.clone();
          const isAudio=/\.mp3(?:$|[?#])/i.test(event.request.url) || event.request.destination==='audio';
          const targetCache=isAudio ? AUDIO_CACHE_NAME : CACHE_NAME;
          caches.open(targetCache).then(cache => cache.put(event.request, copy)).catch(()=>{});
        }
        return response;
      }).catch(() => {
        if(event.request.mode==='navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
