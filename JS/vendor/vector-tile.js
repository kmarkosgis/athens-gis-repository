// Vendored local copy - Mapbox Vector Tile (MVT) decoder.
// Combines @mapbox/point-geometry@1.1.0 and @mapbox/vector-tile@3.0.0 (both ISC
// licensed, https://github.com/mapbox/vector-tile-js and
// https://github.com/mapbox/point-geometry) into one plain browser global, since
// neither package publishes a browser/UMD build (source-only ES modules). Rewritten
// from `export`/`import` into a single IIFE exposing `window.VectorTile`, the same
// way JS/leaflet-easyprint.js is a vendored local copy "to keep behavior consistent
// across hosts". Logic is unchanged from upstream - only the module wrapper differs.
// Requires window.Pbf (loaded separately, see index.html) to already be defined -
// VectorTile/VectorTileLayer/VectorTileFeature just consume the PBF reader instance
// passed into them, they don't construct one.
(function (global) {
  'use strict';

  // ---- @mapbox/point-geometry ----------------------------------------------------
  function Point(x, y) {
    this.x = x;
    this.y = y;
  }

  Point.prototype = {
    clone() { return new Point(this.x, this.y); },
    add(p) { return this.clone()._add(p); },
    sub(p) { return this.clone()._sub(p); },
    multByPoint(p) { return this.clone()._multByPoint(p); },
    divByPoint(p) { return this.clone()._divByPoint(p); },
    mult(k) { return this.clone()._mult(k); },
    div(k) { return this.clone()._div(k); },
    rotate(a) { return this.clone()._rotate(a); },
    rotateAround(a, p) { return this.clone()._rotateAround(a, p); },
    matMult(m) { return this.clone()._matMult(m); },
    unit() { return this.clone()._unit(); },
    perp() { return this.clone()._perp(); },
    round() { return this.clone()._round(); },
    mag() {
      return Math.sqrt(this.x * this.x + this.y * this.y);
    },
    equals(other) {
      return this.x === other.x && this.y === other.y;
    },
    dist(p) {
      return Math.sqrt(this.distSqr(p));
    },
    distSqr(p) {
      const dx = p.x - this.x, dy = p.y - this.y;
      return dx * dx + dy * dy;
    },
    angle() {
      return Math.atan2(this.y, this.x);
    },
    angleTo(b) {
      return Math.atan2(this.y - b.y, this.x - b.x);
    },
    angleWith(b) {
      return this.angleWithSep(b.x, b.y);
    },
    angleWithSep(x, y) {
      return Math.atan2(this.x * y - this.y * x, this.x * x + this.y * y);
    },
    _matMult(m) {
      const x = m[0] * this.x + m[1] * this.y,
        y = m[2] * this.x + m[3] * this.y;
      this.x = x; this.y = y;
      return this;
    },
    _add(p) { this.x += p.x; this.y += p.y; return this; },
    _sub(p) { this.x -= p.x; this.y -= p.y; return this; },
    _mult(k) { this.x *= k; this.y *= k; return this; },
    _div(k) { this.x /= k; this.y /= k; return this; },
    _multByPoint(p) { this.x *= p.x; this.y *= p.y; return this; },
    _divByPoint(p) { this.x /= p.x; this.y /= p.y; return this; },
    _unit() { this._div(this.mag()); return this; },
    _perp() { const y = this.y; this.y = this.x; this.x = -y; return this; },
    _rotate(angle) {
      const cos = Math.cos(angle), sin = Math.sin(angle),
        x = cos * this.x - sin * this.y,
        y = sin * this.x + cos * this.y;
      this.x = x; this.y = y;
      return this;
    },
    _rotateAround(angle, p) {
      const cos = Math.cos(angle), sin = Math.sin(angle),
        x = p.x + cos * (this.x - p.x) - sin * (this.y - p.y),
        y = p.y + sin * (this.x - p.x) + cos * (this.y - p.y);
      this.x = x; this.y = y;
      return this;
    },
    _round() { this.x = Math.round(this.x); this.y = Math.round(this.y); return this; },
    constructor: Point
  };

  // ---- @mapbox/vector-tile ---------------------------------------------------------

  class VectorTileFeature {
    constructor(pbf, end, extent, keys, values) {
      this.properties = Object.create(null);
      this.extent = extent;
      this.type = 0;
      this.id = undefined;

      this._pbf = pbf;
      this._geometry = -1;
      this._keys = keys;
      this._values = values;

      while (pbf.pos < end) {
        const tag = pbf.readVarint();
        if (tag === 8) this.id = pbf.readVarint();
        else if (tag === 18) {
          const tagsEnd = pbf.readVarint() + pbf.pos;
          while (pbf.pos < tagsEnd) {
            const key = keys[pbf.readVarint()];
            const value = values[pbf.readVarint()];
            this.properties[key] = value;
          }
        } else if (tag === 24) this.type = pbf.readVarint();
        else if (tag === 34) {
          this._geometry = pbf.pos;
          pbf.skip(tag);
        } else pbf.skip(tag);
      }
    }

    loadGeometry() {
      if (this._geometry < 0) throw new Error('feature has no geometry');
      const pbf = this._pbf;
      pbf.pos = this._geometry;

      const end = pbf.readVarint() + pbf.pos;
      const lines = [];
      let line;
      let cmd = 1, length = 0, x = 0, y = 0;

      while (pbf.pos < end) {
        if (length <= 0) {
          const cmdLen = pbf.readVarint();
          cmd = cmdLen & 0x7;
          length = cmdLen >> 3;
          if (length === 0) continue;
        }
        length--;
        if (cmd === 1) {
          x += pbf.readSVarint();
          y += pbf.readSVarint();
          if (line) lines.push(line);
          line = [new Point(x, y)];
        } else if (cmd === 2) {
          x += pbf.readSVarint();
          y += pbf.readSVarint();
          if (line) line.push(new Point(x, y));
        } else if (cmd === 7) {
          if (line) line.push(line[0].clone());
        } else {
          throw new Error('unknown command ' + cmd);
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    bbox() {
      if (this._geometry < 0) throw new Error('feature has no geometry');
      const pbf = this._pbf;
      pbf.pos = this._geometry;

      const end = pbf.readVarint() + pbf.pos;
      let cmd = 1, length = 0, x = 0, y = 0,
        x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;

      while (pbf.pos < end) {
        if (length <= 0) {
          const cmdLen = pbf.readVarint();
          cmd = cmdLen & 0x7;
          length = cmdLen >> 3;
          if (length === 0) continue;
        }
        length--;
        if (cmd === 1 || cmd === 2) {
          x += pbf.readSVarint();
          y += pbf.readSVarint();
          if (x < x1) x1 = x;
          if (x > x2) x2 = x;
          if (y < y1) y1 = y;
          if (y > y2) y2 = y;
        } else if (cmd !== 7) {
          throw new Error('unknown command ' + cmd);
        }
      }
      return [x1, y1, x2, y2];
    }

    toGeoJSON(x, y, z) {
      const size = this.extent * Math.pow(2, z),
        x0 = this.extent * x,
        y0 = this.extent * y,
        vtCoords = this.loadGeometry();

      function projectPoint(p) {
        return [
          (p.x + x0) * 360 / size - 180,
          360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
        ];
      }
      function projectLine(line) {
        return line.map(projectPoint);
      }

      let geometry;
      if (this.type === 1) {
        const points = [];
        for (const line of vtCoords) points.push(line[0]);
        const coordinates = projectLine(points);
        geometry = points.length === 1
          ? { type: 'Point', coordinates: coordinates[0] }
          : { type: 'MultiPoint', coordinates };
      } else if (this.type === 2) {
        const coordinates = vtCoords.map(projectLine);
        geometry = coordinates.length === 1
          ? { type: 'LineString', coordinates: coordinates[0] }
          : { type: 'MultiLineString', coordinates };
      } else if (this.type === 3) {
        const polygons = classifyRings(vtCoords);
        const coordinates = [];
        for (const polygon of polygons) coordinates.push(polygon.map(projectLine));
        geometry = coordinates.length === 1
          ? { type: 'Polygon', coordinates: coordinates[0] }
          : { type: 'MultiPolygon', coordinates };
      } else {
        throw new Error('unknown feature type');
      }

      const result = { type: 'Feature', geometry, properties: this.properties };
      if (this.id != null) result.id = this.id;
      return result;
    }
  }
  VectorTileFeature.types = ['Unknown', 'Point', 'LineString', 'Polygon'];

  function classifyRings(rings) {
    const len = rings.length;
    if (len <= 1) return [rings];

    const polygons = [];
    let polygon, ccw;

    for (let i = 0; i < len; i++) {
      const area = signedArea(rings[i]);
      if (area === 0) continue;
      if (ccw === undefined) ccw = area < 0;
      if (ccw === area < 0) {
        if (polygon) polygons.push(polygon);
        polygon = [rings[i]];
      } else if (polygon) {
        polygon.push(rings[i]);
      }
    }
    if (polygon) polygons.push(polygon);
    return polygons;
  }

  function signedArea(ring) {
    let sum = 0;
    for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
      p1 = ring[i];
      p2 = ring[j];
      sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
  }

  class VectorTileLayer {
    constructor(pbf, end) {
      this.version = 1;
      this.name = '';
      this.extent = 4096;
      this.length = 0;

      this._pbf = pbf;
      this._keys = [];
      this._values = [];
      this._features = [];

      if (end === undefined) end = pbf.length;
      while (pbf.pos < end) {
        const tag = pbf.readVarint();
        if (tag === 10) this.name = pbf.readString();
        else if (tag === 18) {
          this._features.push(pbf.pos);
          pbf.skip(tag);
        } else if (tag === 26) this._keys.push(pbf.readString());
        else if (tag === 34) this._values.push(readValueMessage(pbf));
        else if (tag === 40) this.extent = pbf.readVarint();
        else if (tag === 120) this.version = pbf.readVarint();
        else pbf.skip(tag);
      }
      this.length = this._features.length;
    }

    feature(i) {
      if (i < 0 || i >= this._features.length) throw new Error('feature index out of bounds');
      this._pbf.pos = this._features[i];
      const end = this._pbf.readVarint() + this._pbf.pos;
      return new VectorTileFeature(this._pbf, end, this.extent, this._keys, this._values);
    }
  }

  function readValueMessage(pbf) {
    let value = null;
    const end = pbf.readVarint() + pbf.pos;
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      value =
        tag === 10 ? pbf.readString() :
        tag === 21 ? pbf.readFloat() :
        tag === 25 ? pbf.readDouble() :
        tag === 32 ? pbf.readVarint(true) :
        tag === 40 ? pbf.readVarint() :
        tag === 48 ? pbf.readSVarint() :
        tag === 56 ? pbf.readBoolean() :
        (pbf.skip(tag), null);
    }
    if (value == null) throw new Error('unknown feature value');
    return value;
  }

  class VectorTile {
    constructor(pbf, end) {
      if (end === undefined) end = pbf.length;
      const layers = Object.create(null);
      while (pbf.pos < end) {
        const tag = pbf.readVarint();
        if (tag === 26) {
          const layer = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
          if (layer.length) layers[layer.name] = layer;
        } else pbf.skip(tag);
      }
      this.layers = layers;
    }
  }

  global.VectorTile = VectorTile;
  global.VectorTile.VectorTileLayer = VectorTileLayer;
  global.VectorTile.VectorTileFeature = VectorTileFeature;
})(window);
