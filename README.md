# Athens GIS 

Welcome to the **Athens GIS** — an open-access online repository and interactive map for exploring geospatial data related to Athens, Greece.

## 📍 About

This project provides:

- **Open GIS data**: Shapefiles converted to GeoJSON for easy use.
- **Interactive web map**: Explore multiple layers with different basemaps.
- **Downloadable files**: Download any layer directly from the map viewer.

Created by **Konstantinos Markos** as part of ongoing Athens GIS research and projects.

## 🌐 Live Viewer

You can view and interact with the map directly in your browser:  
➡️ [View Map](https://kmarkosgis.github.io/open-gis-data/) 

## 📂 Repository Structure

```
├── index.html       # Main web map
├── data/            # GeoJSON files (converted from shapefiles)
│   ├── AthensTrain.geojson
│   ├── AthensTram.geojson
│   └── ...
├── README.md        # This file
```

## 🚀 How to Use

1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/yourusername/athens-gis-viewer.git
   ```

2. **Open `index.html`** in a web browser to view the interactive map.

3. **Add new layers**:
   - Convert your shapefiles to GeoJSON (in ArcGIS Pro: `Features To JSON` → `Output to GeoJSON`).
   - Place the `.geojson` files inside the `data/` folder.
   - Update the `geojsonFiles` list in `index.html` accordingly.

4. **Use the dropdown** to switch between layers and download data.

## 🗺️ Technologies Used

- [Leaflet.js](https://leafletjs.com/) — Lightweight open-source mapping library.
- [ArcGIS Pro](https://www.esri.com/en-us/arcgis/products/arcgis-pro/) — For shapefile processing and conversion.
- OpenStreetMap & Esri basemaps.

## 📖 License

This repository is open-access.  
Feel free to use, modify, and share with proper credit.

## 👤 Author

**Konstantinos Markos**  
Athens GIS Projects

[LinkedIn](https://www.linkedin.com/in/konstantinos-markos/)

---

Enjoy exploring Athens!
