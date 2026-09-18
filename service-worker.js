const CACHE_NAME = 'tasbih-plus-v66-quran-sync';
const AUDIO_CACHE_NAME = 'tasbih-plus-quran-audio-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Trois éditions complètes du Coran (texte). Elles sont téléchargées une
// seule fois puis servies depuis le cache, y compris hors connexion.
const QURAN_OFFLINE = [
  'https://api.alquran.cloud/v1/quran/quran-uthmani',
  'https://api.alquran.cloud/v1/quran/en.transliteration',
  'https://api.alquran.cloud/v1/quran/fr.hamidullah'
];

// Ne (re)télécharge que ce qui manque encore dans le cache. Appelée à
// l'installation ET à chaque activation : si le réseau était instable au
// premier essai (une seule des 3 éditions ratée, par ex.), on retente
// automatiquement à la prochaine ouverture de l'app plutôt que de laisser
// le Coran indisponible hors connexion pour toujours.
async function cacheQuranOfflineEditions(cache){
  await Promise.allSettled(QURAN_OFFLINE.map(async url=>{
    const existing = await cache.match(url);
    if(existing) return;
    try{
      const response = await fetch(url,{cache:'no-store'});
      if(response && response.ok) await cache.put(url,response.clone());
    }catch(_){ /* toujours pas de réseau : on retentera à la prochaine activation */ }
  }));
}

self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Ne bloque pas toute l'installation si le réseau Quran est momentanément indisponible.
    await cacheQuranOfflineEditions(cache);
  })());
  // On n'appelle plus skipWaiting() automatiquement : une mise à jour installée
  // reste "en attente" tant que l'utilisateur n'a pas confirmé le rechargement
  // (bannière "Nouvelle version disponible"), pour éviter un mélange de vieux
  // JS et de nouveau cache pendant qu'un onglet est encore ouvert.
});

self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME && key !== AUDIO_CACHE_NAME).map(key => caches.delete(key)));
    const cache = await caches.open(CACHE_NAME);
    await cacheQuranOfflineEditions(cache);
  })());
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;

  const request = event.request;
  const isAudio = request.destination === 'audio' || /\.mp3(?:$|[?#])/i.test(request.url);
  const isRangeRequest = request.headers.has('range');

  // IMPORTANT MOBILE (Safari/iOS notamment): les lecteurs audio utilisent
  // souvent des requêtes HTTP Range. Une réponse complète provenant du Cache
  // Storage ne doit pas remplacer une réponse 206 Partial Content attendue.
  // Les requêtes Range audio vont donc directement au serveur d'origine.
  if(isAudio && isRangeRequest){
    event.respondWith(fetch(request));
    return;
  }

  // Pour l'audio en ligne, privilégier le réseau afin d'éviter qu'une ancienne
  // réponse opaque/incomplète bloque la lecture. En cas d'échec réseau, essayer
  // le cache audio (utile hors connexion sur les navigateurs compatibles).
  if(isAudio){
    event.respondWith((async()=>{
      try{
        const response = await fetch(request);
        if(response && (response.status === 200 || response.type === 'opaque')){
          const cache = await caches.open(AUDIO_CACHE_NAME);
          cache.put(request, response.clone()).catch(()=>{});
        }
        return response;
      }catch(err){
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const cached = await cache.match(request);
        if(cached) return cached;
        throw err;
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if(cached) return cached;
      return fetch(request).then(response => {
        if(response && response.status === 200){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(()=>{});
        }
        return response;
      }).catch(() => {
        if(request.mode==='navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
