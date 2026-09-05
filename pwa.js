(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
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
