(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').then(reg => {
        // Une mise à jour peut déjà être en attente (onglet resté ouvert longtemps).
        if (reg.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('tasbih:update-available', { detail: { worker: reg.waiting } }));
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            // "installed" + un controller déjà actif = vraie mise à jour, pas la 1re installation.
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('tasbih:update-available', { detail: { worker: newWorker } }));
            }
          });
        });
      }).catch(console.warn);

      // Recharge une seule fois quand le nouveau Service Worker prend le contrôle,
      // pour que l'utilisateur voie la nouvelle version après avoir cliqué "Recharger".
      let refreshingAfterUpdate = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshingAfterUpdate) return;
        refreshingAfterUpdate = true;
        window.location.reload();
      });
    });
  }

  const themeColors = {
    dark:'#121416', blue:'#DCEAF7', green:'#DDEDE3',
    purple:'#E9E0F2', pink:'#F7D9E3'
  };

  const syncThemeColor = () => {
    const theme = document.documentElement.getAttribute('data-theme') || 'blue';
    let meta = document.querySelector('meta[name="theme-color"]');
    if(!meta){
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = themeColors[theme] || themeColors.blue;
  };

  syncThemeColor();
  new MutationObserver(syncThemeColor).observe(document.documentElement, {
    attributes:true, attributeFilter:['data-theme']
  });
})();
