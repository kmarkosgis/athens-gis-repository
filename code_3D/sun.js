// Sun panel: the sun's position for any date and time in Athens, shown as numbers,
// a small dial and as the map's lighting - building walls facing the sun are lit,
// the terrain shading follows it, and the sky/ground warm up at sunrise/sunset and
// darken at night. Opens on the current time (and follows the clock until the user
// changes something); Play runs the time forward or backward, across days.
//
// The date/time fields are always Athens local time (config.sun.timeZone), whatever
// the viewer's own time zone. MapLibre has no cast shadows, so this is lighting only.
(function () {
  var ns = window.Athens3D = window.Athens3D || {};
  var cfg = ns.config;
  var scfg = cfg.sun;

  function $(id) { return document.getElementById(id); }
  var panel = $('sun-panel');
  if (!panel) return;

  var LNG = scfg.location[0], LAT = scfg.location[1];

  // ---------- Sun position ----------
  // Standard low-precision solar formulas (Astronomy Answers, aa.quae.nl - the same
  // ones SunCalc uses): good to well under a degree, plenty for lighting.
  var sunCalc = (function () {
    var rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009;
    var e = rad * 23.4397; // obliquity of the Earth

    function toJulian(ms) { return ms / dayMs - 0.5 + J1970; }
    function fromJulian(j) { return (j + 0.5 - J1970) * dayMs; }
    function toDays(ms) { return toJulian(ms) - J2000; }

    function declination(l) { return Math.asin(Math.sin(e) * Math.sin(l)); }
    function rightAscension(l) { return Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)); }
    function meanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d); }
    function eclipticLongitude(M) {
      var C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
      return M + C + rad * 102.9372 + Math.PI;
    }

    // { azimuth: degrees clockwise from north, altitude: degrees above the horizon }
    function position(ms, lat, lng) {
      var lw = rad * -lng, phi = rad * lat, d = toDays(ms);
      var L = eclipticLongitude(meanAnomaly(d));
      var dec = declination(L), ra = rightAscension(L);
      var H = rad * (280.16 + 360.9856235 * d) - lw - ra;
      var az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
      var alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
      return { azimuth: (az / rad + 180) % 360, altitude: alt / rad };
    }

    // Sunrise/sunset (ms) of the day around `ms` (pass that day's local noon).
    function times(ms, lat, lng) {
      var lw = rad * -lng, phi = rad * lat, d = toDays(ms);
      var n = Math.round(d - J0 - lw / (2 * Math.PI));
      var ds = J0 + lw / (2 * Math.PI) + n;
      var M = meanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L);
      var noon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
      var cosW = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
      if (cosW < -1 || cosW > 1) return null; // midnight sun / polar night - not at Athens
      var w = Math.acos(cosW);
      var a = J0 + (w + lw) / (2 * Math.PI) + n;
      var set = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
      var rise = noon - (set - noon);
      return { sunrise: fromJulian(rise), sunset: fromJulian(set) };
    }

    return { position: position, times: times };
  })();

  // ---------- Athens local time ----------
  var dtf = null;
  try {
    dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: scfg.timeZone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    });
  } catch (err) { /* very old browser: fixed UTC+2 below */ }

  // Wall-clock parts in Athens for an instant.
  function wall(ms) {
    if (!dtf) {
      var d = new Date(ms + 2 * 3600e3);
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
               hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds() };
    }
    var o = {};
    dtf.formatToParts(new Date(ms)).forEach(function (p) {
      if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10);
    });
    if (o.hour === 24) o.hour = 0; // older Chrome writes midnight as 24
    return o;
  }
  function utcOffset(ms) {
    var p = wall(ms);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  }
  // Athens wall-clock time -> instant. Out-of-range parts roll over (minute 60 = next
  // hour, day 0 = last day of the previous month), which is what lets the number
  // fields' arrows step past midnight or the end of a month.
  function fromWall(y, mo, d, h, mi) {
    var guess = Date.UTC(y, mo - 1, d, h, mi);
    if (y >= 0 && y < 100) { var g = new Date(guess); g.setUTCFullYear(y); guess = g.getTime(); }
    return guess - utcOffset(guess - utcOffset(guess));
  }
  function daysInMonth(y, mo) { return new Date(Date.UTC(y, mo, 0)).getUTCDate(); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ms) { var p = wall(ms); return pad2(p.hour) + ':' + pad2(p.minute); }

  var COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function compassName(az) { return COMPASS[Math.round(az / 22.5) % 16]; }

  // ---------- Elements ----------
  var f = { day: $('sun-day'), month: $('sun-month'), year: $('sun-year'), hour: $('sun-hour'), minute: $('sun-minute') };
  var enabledBox = $('sun-enabled');
  var speedSel = $('sun-speed');
  var btnBack = $('sun-back'), btnPause = $('sun-pause'), btnFwd = $('sun-fwd');
  var out = { az: $('sun-az'), alt: $('sun-alt'), rise: $('sun-rise'), set: $('sun-set'), tz: $('sun-tz') };
  var dial = $('sun-dial');

  var state = {
    ms: Date.now(),
    live: true,                 // follow the clock until the user picks a time
    dir: 0,                     // -1 backward, 0 paused, 1 forward
    speed: scfg.defaultSpeed,   // simulated minutes per real second
    enabled: true
  };

  function speedLabel(min) {
    if (min >= 1440) return (min / 1440) + ' day/s';
    if (min >= 60) return (min / 60) + ' h/s';
    return min + ' min/s';
  }
  scfg.speeds.forEach(function (m) {
    var o = document.createElement('option');
    o.value = String(m);
    o.textContent = speedLabel(m);
    if (m === state.speed) o.selected = true;
    speedSel.appendChild(o);
  });

  // ---------- Dial ----------
  // Looking down from above: the ring is the horizon, the centre straight overhead
  // (inner rings at 30 and 60 degrees), with the day's sun path and the sun on it.
  // It turns with the map's bearing, so its N always matches the map's north.
  var SVGNS = 'http://www.w3.org/2000/svg';
  var R = 44;
  function svg(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  var dialRot = svg('g', {}, dial);
  svg('circle', { r: R, 'class': 'dial-horizon' }, dialRot);
  svg('circle', { r: R * 2 / 3, 'class': 'dial-ring' }, dialRot);
  svg('circle', { r: R / 3, 'class': 'dial-ring' }, dialRot);
  svg('path', { d: 'M0 -' + R + 'V' + R + 'M-' + R + ' 0H' + R, 'class': 'dial-ring' }, dialRot);
  var dialPath = svg('path', { 'class': 'dial-path', d: '' }, dialRot);
  var dialRay = svg('line', { x1: 0, y1: 0, x2: 0, y2: 0, 'class': 'dial-ray' }, dialRot);
  var dialLabels = [['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(function (l) {
    var t = svg('text', { 'class': 'dial-label' + (l[0] === 'N' ? ' dial-north' : ''), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, dialRot);
    t.textContent = l[0];
    t._az = l[1];
    return t;
  });
  var dialSun = svg('circle', { r: 5.5, 'class': 'dial-sun' }, dialRot);

  function dialXY(az, alt) {
    var r = R * (90 - Math.max(0, Math.min(90, alt))) / 90;
    var a = az * Math.PI / 180;
    return [r * Math.sin(a), -r * Math.cos(a)];
  }

  function rotateDial() {
    var b = ns.map ? ns.map.getBearing() : 0;
    dialRot.setAttribute('transform', 'rotate(' + (-b).toFixed(1) + ')');
    // Keep the letters upright while the dial turns.
    dialLabels.forEach(function (t) {
      var x = 52 * Math.sin(t._az * Math.PI / 180), y = -52 * Math.cos(t._az * Math.PI / 180);
      t.setAttribute('x', x.toFixed(1));
      t.setAttribute('y', y.toFixed(1));
      t.setAttribute('transform', 'rotate(' + b.toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
    });
  }

  var pathDay = null;
  function updateDayPath(p) {
    var key = p.year + '-' + p.month + '-' + p.day;
    if (key === pathDay) return;
    pathDay = key;
    var start = fromWall(p.year, p.month, p.day, 0, 0);
    var d = '', pen = false;
    for (var m = 0; m <= 1440; m += 10) {
      var s = sunCalc.position(start + m * 60000, LAT, LNG);
      if (s.altitude < 0) { pen = false; continue; }
      var xy = dialXY(s.azimuth, s.altitude);
      d += (pen ? 'L' : 'M') + xy[0].toFixed(1) + ' ' + xy[1].toFixed(1);
      pen = true;
    }
    dialPath.setAttribute('d', d);
  }

  // ---------- Map lighting ----------
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function mix(c1, c2, t) {
    var a = hex(c1), b = hex(c2);
    return '#' + [0, 1, 2].map(function (i) {
      var v = Math.round(lerp(a[i], b[i], clamp01(t)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }

  var TINT_SOURCE = 'sun-tint', TINT_LAYER = 'sun-tint';
  var mapReady = false;

  function setupMap() {
    var map = ns.map;
    if (mapReady || !map || !map.isStyleLoaded()) return;
    mapReady = true;
    // A world-sized fill under the buildings and labels: dims the ground at night
    // and warms it a little at sunrise/sunset. Lies on the terrain like the basemap.
    if (!map.getSource(TINT_SOURCE)) {
      map.addSource(TINT_SOURCE, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon',
          coordinates: [[[-179.9, -85], [179.9, -85], [179.9, 85], [-179.9, 85], [-179.9, -85]]] } }
      });
      var layers = map.getStyle().layers || [], before;
      if (ns.layers && map.getLayer(ns.layers.buildings)) before = ns.layers.buildings;
      else for (var i = 0; i < layers.length; i++) if (layers[i].type === 'symbol') { before = layers[i].id; break; }
      map.addLayer({ id: TINT_LAYER, type: 'fill', source: TINT_SOURCE,
        paint: { 'fill-color': '#0a1730', 'fill-opacity': 0, 'fill-antialias': false } }, before);
    }
    map.on('rotate', rotateDial);
    map.on('move', function () { placeSkySun(); });
    window.addEventListener('resize', function () { placeSkySun(); });
    rotateDial();
    update();
    // Shadows cast by the buildings and the terrain (code_3D/shadows.js).
    if (ns.shadows) ns.shadows.start();
  }

  var shadowOn = false, shade3d = false;

  // ---------- The sun in the sky ----------
  // A sun disc drawn where the sun really is as seen by the map camera: a point
  // 100 km from the camera in the sun's direction, projected to the screen. When
  // that's off the map (the default tilt mostly looks at the ground) a small sun
  // waits at the map's edge, on the side where the sun is.
  var skySun = document.createElement('div');
  skySun.id = 'sky-sun';
  skySun.setAttribute('aria-hidden', 'true');
  skySun.innerHTML = '<span class="sky-sun-disc"></span>';
  document.body.appendChild(skySun);

  function placeSkySun(pos) {
    var map = ns.map;
    pos = pos || sunCalc.position(state.ms, LAT, LNG);
    if (!map || !state.enabled || pos.altitude < -0.8) { skySun.style.display = 'none'; return; }
    var tr = map.transform, cam, m;
    try { cam = tr.getCameraPosition(); m = tr.customLayerMatrix(); } catch (e) { skySun.style.display = 'none'; return; }
    var c = maplibregl.MercatorCoordinate.fromLngLat(cam.lngLat, 0);
    var mpu = c.meterInMercatorCoordinateUnits();
    var az = pos.azimuth * Math.PI / 180, alt = pos.altitude * Math.PI / 180, D = 100000 * mpu;
    // Mercator: x east, y south; z in Mercator units above the centre's ground.
    var x = c.x + Math.sin(az) * Math.cos(alt) * D;
    var y = c.y - Math.cos(az) * Math.cos(alt) * D;
    var z = (cam.altitude - (tr.elevation || 0)) * mpu + Math.sin(alt) * D;
    var cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    var cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    var cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    var nx = cx / cw, ny = cy / cw;
    if (cw < 0) { nx = -nx; ny = -ny; }          // behind the camera: point the other way
    var rect = map.getCanvas().getBoundingClientRect();
    var sx = rect.left + (nx + 1) / 2 * rect.width, sy = rect.top + (1 - ny) / 2 * rect.height;

    // The visible map area, clear of the header and footer.
    // The visible map area, clear of the header, the footer and the toolbar.
    var header = document.querySelector('header'), footer = document.getElementById('footer'), toolbar = document.getElementById('toolbar');
    var top = Math.max(rect.top, header ? header.getBoundingClientRect().bottom : 0) + 22;
    var bottom = Math.min(rect.bottom, footer ? footer.getBoundingClientRect().top : innerHeight,
                          toolbar ? toolbar.getBoundingClientRect().top : innerHeight) - 22;
    var left = rect.left + 22, right = rect.right - 22;
    var onScreen = cw > 0 && sx >= left && sx <= right && sy >= top && sy <= bottom;
    if (!onScreen) {
      // Along the line from the map centre toward the sun, stop at the edge.
      var mx0 = (left + right) / 2, my0 = (top + bottom) / 2, dx = sx - mx0, dy = sy - my0;
      if (!dx && !dy) dy = -1;
      var k = Math.min(dx ? (dx > 0 ? right - mx0 : left - mx0) / dx : Infinity,
                       dy ? (dy > 0 ? bottom - my0 : top - my0) / dy : Infinity);
      sx = mx0 + dx * k; sy = my0 + dy * k;
    }
    var gold = (1 - smooth(4, 18, pos.altitude)) * smooth(-6, 0, pos.altitude);
    skySun.style.display = '';
    skySun.style.transform = 'translate(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px)';
    skySun.classList.toggle('edge', !onScreen);
    skySun.style.setProperty('--sun-core', mix('#fff6c8', '#ffd2a0', gold));
    skySun.style.setProperty('--sun-glow', mix('#ffd34d', '#ff9a4d', gold));
    skySun.title = onScreen ? '' : 'The sun is this way';
  }

  // The tint is invisible most of the day (and with the lighting off): hidden then, so
  // the map doesn't keep re-cutting its tiles on every move for nothing.
  function tintVisible(map, on) {
    if (!map.getLayer(TINT_LAYER)) return;
    var v = on ? 'visible' : 'none';
    if (map.getLayoutProperty(TINT_LAYER, 'visibility') !== v) map.setLayoutProperty(TINT_LAYER, 'visibility', v);
  }

  function setPaint(map, layer, props) {
    if (!map.getLayer(layer)) return;
    for (var k in props) map.setPaintProperty(layer, k, props[k]);
  }

  var lastLit = null;
  function lightMap(pos) {
    var map = ns.map;
    if (!mapReady || !map) return;
    // While playing, the sun moves a hair per frame: every restyle (light, sky,
    // hillshade) repaints the map, so skip them for a change nobody can see.
    if (state.dir && lastLit && lastLit.enabled === state.enabled &&
        Math.abs(lastLit.alt - pos.altitude) < 0.1 && Math.abs(lastLit.az - pos.azimuth) < 0.1) return;
    lastLit = { enabled: state.enabled, alt: pos.altitude, az: pos.azimuth };
    var hs = ns.layers && ns.layers.hillshade;
    try {
      if (!state.enabled) {
        map.setLight({ anchor: 'viewport', position: [1.15, 210, 30], color: '#ffffff', intensity: 0.5 });
        setPaint(map, hs, Object.assign({ 'hillshade-illumination-anchor': 'viewport', 'hillshade-illumination-direction': 335 }, cfg.terrain.hillshadePaint));
        setPaint(map, TINT_LAYER, { 'fill-opacity': 0 });
        tintVisible(map, false);
        map.setSky(Object.assign({}, cfg.sky));
        return;
      }
      var alt = pos.altitude, az = pos.azimuth;
      var day = smooth(-8, 4, alt);                          // 1 by day, 0 at night
      var night = 1 - day;
      var gold = (1 - smooth(4, 18, alt)) * smooth(-6, 0, alt); // sunrise/sunset glow
      var low = 1 - smooth(10, 60, alt);                     // stronger relief when low

      // Sun-to-shade tones on the buildings: walls facing the sun near the buildings'
      // own light colour, roofs a little below that, walls facing away a soft mid grey
      // (MapLibre shades a wall turned fully away at (1 - intensity) of its colour).
      // At night a dim, cool light from high up stands in for the moon/street glow.
      map.setLight({
        anchor: 'map',
        // Roofs get light in proportion to the sun's height, which turns them dark
        // when it's low - so the light is never lowered past 52 degrees from straight
        // above: walls still show sun and shade, roofs stay light.
        position: [1.15, az, lerp(35, Math.min(90 - Math.max(alt, 3), 52), day)],
        color: mix(mix('#ffffff', '#ffe2c6', gold), '#8193c9', night),
        intensity: 0.3 + day * (0.2 + 0.08 * gold)
      });
      setPaint(map, hs, {
        'hillshade-illumination-anchor': 'map',
        'hillshade-illumination-direction': Math.round(az) % 360,
        'hillshade-exaggeration': lerp(0.18, 0.3 + 0.3 * low, day),
        'hillshade-shadow-color': mix('#5b6678', '#1c2436', night),
        'hillshade-highlight-color': mix(mix('#ffffff', '#ffe0bd', gold), '#9aa6c4', night),
        'hillshade-accent-color': mix('#8a94a6', '#3a445a', night)
      });
      var tintOpacity = 0.1 * gold * day + 0.42 * night;
      setPaint(map, TINT_LAYER, {
        'fill-color': mix('#ff9a4d', '#0a1730', smooth(0, 0.6, night)),
        'fill-opacity': tintOpacity
      });
      tintVisible(map, tintOpacity > 0.004);
      map.setSky({
        'sky-color': mix(mix(cfg.sky['sky-color'], '#e8c6a6', gold), '#0d1628', night),
        'horizon-color': mix(mix(cfg.sky['horizon-color'], '#f8cf9f', gold), '#2b3654', night),
        'fog-color': mix(mix(cfg.sky['fog-color'], '#f6dcc0', gold), '#1b2438', night),
        'sky-horizon-blend': cfg.sky['sky-horizon-blend'],
        'horizon-fog-blend': cfg.sky['horizon-fog-blend'],
        'fog-ground-blend': cfg.sky['fog-ground-blend']
      });
    } catch (err) {
      console.warn('[3D] Sun lighting failed', err);
    }
  }

  // ---------- Fields ----------
  function setField(input, v, force) {
    if (!force && document.activeElement === input) return; // don't fight the user's typing
    var s = (input === f.hour || input === f.minute) ? pad2(v) : String(v);
    if (input.value !== s) input.value = s;
  }
  function writeFields(force) {
    var p = wall(state.ms);
    setField(f.day, p.day, force);
    setField(f.month, p.month, force);
    setField(f.year, p.year, force);
    setField(f.hour, p.hour, force);
    setField(f.minute, p.minute, force);
    // One past the month's end, so the arrow can roll on into the next month.
    f.day.max = String(daysInMonth(p.year, p.month) + 1);
    var off = Math.round(utcOffset(state.ms) / 36e5);
    out.tz.textContent = 'Athens time (UTC' + (off >= 0 ? '+' : '') + off + ')' + (state.live ? ' · now' : '');
  }

  function onFieldInput() {
    var y = parseInt(f.year.value, 10), mo = parseInt(f.month.value, 10), d = parseInt(f.day.value, 10);
    var h = parseInt(f.hour.value, 10), mi = parseInt(f.minute.value, 10);
    if ([y, mo, d, h, mi].some(isNaN) || y < 1000 || y > 9999) return; // still typing
    state.ms = fromWall(y, mo, d, h, mi);
    state.live = false;
    var p = wall(state.ms);
    // Rewrite even the field being typed in when the value rolled over
    // (minute 60 -> next hour, or a time skipped by the summer-time change).
    var rolled = p.year !== y || p.month !== mo || p.day !== d || p.hour !== h || p.minute !== mi;
    update(rolled);
  }
  [f.day, f.month, f.year, f.hour, f.minute].forEach(function (input) {
    input.addEventListener('input', onFieldInput);
    input.addEventListener('change', function () { onFieldInput(); writeFields(true); });
  });

  // ---------- Update everything ----------
  function update(forceFields) {
    var pos = sunCalc.position(state.ms, LAT, LNG);
    var p = wall(state.ms);
    writeFields(!!forceFields);

    var up = pos.altitude > -0.833;
    out.az.textContent = pos.azimuth.toFixed(1) + '° ' + compassName(pos.azimuth);
    out.alt.textContent = pos.altitude.toFixed(1) + '°';
    out.alt.title = up ? 'Above the horizon' : 'Below the horizon';
    var t = sunCalc.times(fromWall(p.year, p.month, p.day, 12, 0), LAT, LNG);
    out.rise.textContent = t ? hhmm(t.sunrise) : '–';
    out.set.textContent = t ? hhmm(t.sunset) : '–';

    updateDayPath(p);
    var xy = dialXY(pos.azimuth, pos.altitude);
    dialSun.setAttribute('cx', xy[0].toFixed(1));
    dialSun.setAttribute('cy', xy[1].toFixed(1));
    dialSun.classList.toggle('below', !up);
    dialRay.setAttribute('x2', xy[0].toFixed(1));
    dialRay.setAttribute('y2', xy[1].toFixed(1));
    panel.classList.toggle('sun-night', pos.altitude < -6);

    lightMap(pos);
    document.dispatchEvent(new CustomEvent('athens3d:sun', { detail: { ms: state.ms } }));
    if (mapReady) placeSkySun(pos);
    if (mapReady && ns.shadows) {
      // Shadows fade in after sunrise and soften in the warm, dim light near sunset.
      var gold = (1 - smooth(4, 18, pos.altitude)) * smooth(-6, 0, pos.altitude);
      ns.shadows.setSun(pos, smooth(0.5, 5, pos.altitude) * (1 - 0.3 * gold));
    }
  }

  // For other tools (code_3D/route-shade.js): the time shown, the sun at any time,
  // and the day around a time - all for Athens. 'athens3d:sun' fires on every change.
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  ns.sun = {
    time: function () { return state.ms; },
    setTime: function (ms) { state.ms = ms; state.live = false; update(true); },
    position: function (ms) { return sunCalc.position(ms == null ? state.ms : ms, LAT, LNG); },
    // { sunrise, sunset } (ms) of the Athens day ms falls on.
    day: function (ms) { var p = wall(ms); return sunCalc.times(fromWall(p.year, p.month, p.day, 12, 0), LAT, LNG); },
    hhmm: hhmm,
    dateLabel: function (ms) { var p = wall(ms); return p.day + ' ' + MONTHS[p.month - 1] + ' ' + p.year; }
  };

  // ---------- Play / pause ----------
  var raf = null, lastFrame = 0, lastDraw = 0;
  function setDir(dir) {
    state.dir = dir;
    if (dir) state.live = false;
    btnBack.setAttribute('aria-pressed', String(dir === -1));
    btnPause.setAttribute('aria-pressed', String(dir === 0));
    btnFwd.setAttribute('aria-pressed', String(dir === 1));
    if (dir && !raf) { lastFrame = performance.now(); raf = requestAnimationFrame(frame); }
    // Shadows go to a cheaper, lower-resolution model while playing, full detail on pause.
    if (ns.shadows && ns.shadows.setPlaying) ns.shadows.setPlaying(!!dir);
    update();
  }
  function frame(now) {
    raf = null;
    if (!state.dir) return;
    // Capped so a backgrounded tab doesn't jump ahead when it comes back (but loose
    // enough that a slow device's long frames don't slow the simulation down).
    var dt = Math.min(1, (now - lastFrame) / 1000);
    lastFrame = now;
    state.ms += state.dir * state.speed * 60000 * dt;
    if (now - lastDraw > 70) { lastDraw = now; update(); } // ~14 updates/s is smooth enough
    raf = requestAnimationFrame(frame);
  }
  btnBack.addEventListener('click', function () { setDir(-1); });
  btnPause.addEventListener('click', function () { setDir(0); });
  btnFwd.addEventListener('click', function () { setDir(1); });
  speedSel.addEventListener('change', function () { state.speed = parseFloat(speedSel.value) || scfg.defaultSpeed; });

  $('sun-now').addEventListener('click', function () {
    state.ms = Date.now();
    state.live = !state.dir;
    update(true);
  });

  var shadowBox = $('sun-shadows');
  var shade3dBox = $('sun-shade3d');
  // Shadows need the sun lighting, and the wall shade needs the shadows: with the one
  // above it off, a switch shows off and can't be used (its own choice is remembered
  // and comes back when the one above is switched on again).
  // They are also only drawn close in (cfg.shadows.minZoom): zoomed out, the switches
  // show off and unavailable, with the reason as a tooltip.
  function closeEnough() { return !!ns.map && ns.map.getZoom() >= cfg.shadows.minZoom; }
  var shadowTitle = shadowBox ? shadowBox.parentNode.title : '', shade3dTitle = shade3dBox ? shade3dBox.parentNode.title : '';
  var ZOOM_HINT = 'Zoom in to see shadows';
  function syncShadows() {
    var near = closeEnough();
    var shadowsOn = state.enabled && shadowOn && near, wallsOn = shadowsOn && shade3d;
    if (shadowBox) {
      shadowBox.checked = shadowsOn;
      shadowBox.disabled = !state.enabled || !near;
      shadowBox.parentNode.title = state.enabled && !near ? ZOOM_HINT : shadowTitle;
    }
    if (shade3dBox) {
      shade3dBox.checked = wallsOn;
      shade3dBox.disabled = !shadowsOn;
      shade3dBox.parentNode.title = state.enabled && !near ? ZOOM_HINT : shade3dTitle;
    }
    if (!ns.shadows) return;
    ns.shadows.setEnabled(shadowsOn);
    ns.shadows.set3D(wallsOn);
  }
  if (shadowBox) shadowBox.addEventListener('change', function () {
    shadowOn = shadowBox.checked;
    syncShadows();
    update();
  });
  if (shade3dBox) shade3dBox.addEventListener('change', function () {
    shade3d = shade3dBox.checked;
    syncShadows();
  });

  enabledBox.addEventListener('change', function () {
    state.enabled = enabledBox.checked;
    panel.classList.toggle('sun-off', !state.enabled);
    syncShadows();
    update();
  });
  syncShadows();   // starts with the shadows (and the wall shade) off
  // Crossing the zoom limit switches them off / back on (only the crossing matters).
  var wasNear = closeEnough();
  if (ns.map) ns.map.on('zoom', function () {
    var near = closeEnough();
    if (near === wasNear) return;
    wasNear = near;
    syncShadows();
    if (near) update();
  });

  // Follow the clock while showing "now".
  setInterval(function () {
    if (state.live && !state.dir) { state.ms = Date.now(); update(); }
  }, 20000);

  // ---------- Fold / unfold ----------
  var fab = $('sun-fab');
  var mqPhone = window.matchMedia('(max-width: 900px)');
  function setFolded(folded) {
    panel.classList.toggle('folded', folded);
    fab.setAttribute('aria-expanded', String(!folded));
    fab.setAttribute('aria-label', folded ? 'Open the sun panel' : 'Sun panel');
    place();
  }
  fab.addEventListener('click', function () { setFolded(false); });
  $('sun-fold').addEventListener('click', function () { setFolded(true); fab.focus(); });

  // ---------- Placement ----------
  // Vertically centred on the left edge, but kept clear of what's above it (header,
  // zoom/compass buttons) and below it (toolbar, footer badges); if the gap is too
  // short, the box scrolls inside it instead of covering them.
  function overlapsX(r, left, right) { return r.width && r.right > left && r.left < right; }
  function place() {
    var vh = window.innerHeight;
    var pr = panel.getBoundingClientRect();
    var left = pr.left, right = pr.left + Math.max(pr.width, 44);
    var top = 0, bottom = vh;
    ['header', '#custom-zoom-controls'].forEach(function (sel) {
      var n = document.querySelector(sel);
      if (!n) return;
      var r = n.getBoundingClientRect();
      if (overlapsX(r, left, right) && r.bottom < vh / 2) top = Math.max(top, r.bottom);
    });
    ['#toolbar', '#footer .footer-credits', '#footer'].forEach(function (sel) {
      var n = document.querySelector(sel);
      if (!n) return;
      var r = n.getBoundingClientRect();
      if (overlapsX(r, left, right) && r.top > vh / 2) bottom = Math.min(bottom, r.top);
    });
    top += 10; bottom -= 10;
    var room = Math.max(60, bottom - top);
    panel.style.maxHeight = room + 'px';
    var h = Math.min(panel.scrollHeight, room);
    var y = Math.max(top, Math.min(bottom - h, (vh - h) / 2));
    panel.style.top = Math.round(y) + 'px';
  }
  window.addEventListener('resize', place);
  if (window.ResizeObserver) new ResizeObserver(place).observe(panel);

  // ---------- Start ----------
  setFolded(mqPhone.matches); // phones start folded, so the map stays clear
  rotateDial();
  setDir(0);
  update(true);
  document.addEventListener('athens3d:buildings', setupMap);
  document.addEventListener('athens3d:ready', setupMap);   // in case start-up failed early
  document.addEventListener('DOMContentLoaded', place);
  window.addEventListener('load', place);

  // For the export or later features.
  ns.sun.isEnabled = function () { return state.enabled; };
})();
