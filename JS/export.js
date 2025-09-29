// Initialize EasyPrint printer safely once map is ready
(function(){
  function initPrinter(){
    if(!window.AthensGIS || !window.AthensGIS.map || !L.easyPrint) {
      return setTimeout(initPrinter, 150);
    }
    if(window.AthensGIS._easyPrinter) return; // already created
    try {
      window.AthensGIS._easyPrinter = L.easyPrint({
        tileLayer: null,              // detect current layers
        sizeModes: ['CurrentSize'],
        exportOnly: true,
        hidden: true,
        filename: 'map_export'
      }).addTo(window.AthensGIS.map);
    } catch(e){
      console.warn('EasyPrint init failed', e);
    }
  }
  initPrinter();
})();

// Single export button handler with watermark
(function(){
  var btn = document.getElementById('exportBtn');
  if(!btn) return;
  btn.addEventListener('click', function(){
    var map = (window.AthensGIS && window.AthensGIS.map) ? window.AthensGIS.map : null;
    if(!map){ console.warn('Map not ready'); return; }
    var printer = window.AthensGIS && window.AthensGIS._easyPrinter;
    if(!printer){
      console.warn('Printer not ready yet, retrying shortly...');
      return setTimeout(()=> btn.click(), 250);
    }

    try { printer.printMap('CurrentSize', 'map_export'); } catch(e){ console.error('printMap error', e); }

    var start = performance.now();
    var timeoutMs = 5000;
    (function waitForImg(){
      var img = document.querySelector('.leaflet-print img, .leaflet-print > img');
      if(img && img.naturalWidth){
        try {
          var canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // === Watermark Text (Top-Right) ===
          var padding = Math.round(canvas.width * 0.015); // responsive padding
          var fontSize = Math.max(14, Math.round(canvas.width * 0.018)); // scale with width
          ctx.font = '600 ' + fontSize + 'px "Newsreader", Arial, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          var text = 'ATHENS GIS REPOSITORY';

          // Shadow for contrast
          ctx.shadowColor = 'rgba(0,0,0,0.35)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;

          // Semi-transparent backdrop for readability (measure text width)
          var metrics = ctx.measureText(text);
          var textHeight = fontSize * 1.2;
          var boxWidth = metrics.width + padding * 1.2;
          var boxX = canvas.width - boxWidth - padding * 0.2;
          var boxY = padding * 0.6;
          ctx.fillStyle = 'rgba(252,251,246,0.75)';
          ctx.fillRect(boxX, boxY, boxWidth, textHeight);

            // Draw text
          ctx.fillStyle = '#2c3e50';
          ctx.fillText(text, canvas.width - padding * 0.6, boxY + (textHeight - fontSize) / 2);

          // Reset shadow for future canvas ops (safety)
          ctx.shadowColor = 'transparent';

          var link = document.createElement('a');
          link.download = 'map_export.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        } catch(err){ console.error('Canvas export failed', err); }
        return;
      }
      if(performance.now() - start < timeoutMs){
        return setTimeout(waitForImg, 150);
      }
      console.warn('Export image not produced in time');
    })();
  });
})();
