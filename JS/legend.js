// Legend configuration: choose layers, field, and styles
window.legendConfigs = {
// Update the legend bar for a given layer name

  "Metro Stations 1, 2 & 3": {
    field: "metroline",
    title: "Metro Lines",
    classes: {
      "1": { color: "#008000",label:"1" },  //green
      "2": { color: "#ff0000",label:"2"  },  //red
      "3": { color: "#0000ff",label:"3" }   //blue
    }
  },
  "Metro Stations 4": {
    field: "STOP",
    title: "Metro Lines",
    classes: {
      "4": { color: "#ffff00", label: "4" } //yellow
    }
  },
  "Center Sector Green Spaces": {
    field: "gridcode",
    title: "Vegetation Type",
    classes: {
      "1": { color: "#90ee90", label: "Grass, shrubs, sparse vegetation" }, //light green
      "2": { color: "#008000", label: "Healthy trees, dense vegetation" }     //green
    }
  },
    "South Sector Green Spaces": {
    field: "gridcode",
    title: "Vegetation Type",
    classes: {
      "1": { color: "#90ee90", label: "Grass, shrubs, sparse vegetation" }, //light green
      "2": { color: "#008000", label: "Healthy trees, dense vegetation" }     //green
    }
  },
    "North Sector Green Spaces": {
    field: "gridcode",
    title: "Vegetation Type",
    classes: {
      "1": { color: "#90ee90", label: "Grass, shrubs, sparse vegetation" }, //light green
      "2": { color: "#008000", label: "Healthy trees, dense vegetation" }     //green
    }
  },
    "West Sector Green Spaces": {
    field: "gridcode",
    title: "Vegetation Type",
    classes: {
      "1": { color: "#90ee90", label: "Grass, shrubs, sparse vegetation" }, //light green
      "2": { color: "#008000", label: "Healthy trees, dense vegetation" }     //green
    }
  },
    "Piraeus Green Spaces": {
    field: "gridcode",
    title: "Vegetation Type",
    classes: {
      "1": { color: "#90ee90", label: "Grass, shrubs, sparse vegetation" }, //light green
      "2": { color: "#008000", label: "Healthy trees, dense vegetation" }     //green
    },
  },
     "Wind Farms": {
    field: "Status",
    title: "Wind Farm Status",
    classes: {
      "Installation Licence": { color: "#87cefa", label: "Installation Licence" }, // light blue
      "Operational Licence": { color: "#90ee90", label: "Operational Licence" },   // light green
      "Production Licence": { color: "#ffd700", label: "Production Licence" },     // gold/yellow
      "Under Evaluation": { color: "#fb6a4a", label: "Under Evaluation" }          // light red
    },
  },
       "Natura 2000": {
    field: "Type",
    title: "Natura 2000 Site Type",
    classes: {
      "Protected under the Habitats Directive": { color: "#87cefa", label: "Protected under the Habitats Directive" }, // light blue
      "Protected under the Birds Directive": { color: "#90ee90", label: "Protected under the Birds Directive" },   // light green
      "Protected under both Birds and Habitats Directives": { color: "#ffd700", label: "Protected under both Birds and Habitats Directives" },     // gold/yellow
    },
  },
  "Municipality of Athens Urban Plan (2012)": {
    field: "uses_en",
    title: "Athens Urban Plan (2012)",
    classes: {
      "A ZONE": { color: "#b3e0ff", label: "A zone" },
      "A3 ZONE": { color: "#c299cc", label: "A3 zone" },
      "AGRICULTURAL UNIVERSITY": { color: "#99cc99", label: "Agricultural university" },
      "AMATEUR P.A.O. (Panathinaikos Athletic Organization)": { color: "#ccc299", label: "Amateur p.a.o. (panathinaikos athletic organization)" },
      "ARCHAEOLOGICAL GROVE": { color: "#cc99b3", label: "Archaeological grove" },
      "ARCHAEOLOGICAL SITE": { color: "#9999cc", label: "Archaeological site" },
      "ARCHITECTURAL SITE ACADEMY PLAT. OFFICIAL GAZETTE 215A.A.P./11": { color: "#99ccb3", label: "Architectural site academy plat. official gazette 215a.a.p./11" },
      "B ZONE": { color: "#b3c6d6", label: "B zone" },
      "BIOPA (Business Park) - excluding industrial installations": { color: "#d4d6a1", label: "Biopa (business park) - excluding industrial installations" },
      "BIOPA (Business Park) FOR SANITATION": { color: "#a1d4d6", label: "Biopa (business park) for sanitation" },
      "BIPA (Industrial and Business Park)": { color: "#d6a1d4", label: "Bipa (industrial and business park)" },
      "BOTANICAL GARDEN": { color: "#a1d6a1", label: "Botanical garden" },
      "C ZONE": { color: "#d6b3c6", label: "C zone" },
      "COMMERCIAL CENTER": { color: "#b3d6b3", label: "Commercial center" },
      "COMMERCIAL TRIANGLE": { color: "#d6d6a1", label: "Commercial triangle" },
      "CRAFT INDUSTRY": { color: "#b3b3b3", label: "Craft industry" },
      "CULTURAL FUNCTIONS": { color: "#9999b3", label: "Cultural functions" },
      "D1 ZONE": { color: "#b3d6d6", label: "D1 zone" },
      "D2 ZONE": { color: "#d6d6b3", label: "D2 zone" },
      "E ZONE": { color: "#b3b3cc", label: "E zone" },
      "EDUCATION": { color: "#99cc99", label: "Education" },
      "EXCLUSIVE RESIDENCE": { color: "#d6c6b3", label: "Exclusive residence" },
      "EXCLUSIVE RESIDENCE - ZONE A": { color: "#c6b3d6", label: "Exclusive residence - zone a" },
      "EXCLUSIVE RESIDENCE - ZONE B": { color: "#b3d6cc", label: "Exclusive residence - zone b" },
      "FACING EURIPIDOU ST.": { color: "#d6ccb3", label: "Facing euripidou st." },
      "GENERAL RESIDENCE": { color: "#4682b4", label: "General residence" },
      "GENERAL RESIDENCE - special uses for preserved buildings facing Piraeus Street": { color: "#d6b3cc", label: "General residence - special uses for preserved buildings facing piraeus street" },
      "GENERAL RESIDENCE 1": { color: "#b3d6cc", label: "General residence 1" },
      "GENERAL RESIDENCE 2": { color: "#d6ccb3", label: "General residence 2" },
      "GENERAL RESIDENCE with restrictions OFFICIAL GAZETTE 911D/04": { color: "#b3b3cc", label: "General residence with restrictions official gazette 911d/04" },
      "GK (mild uses)": { color: "#b3e0ff", label: "Gk (mild uses)" },
      "GREEN BELT": { color: "#99cc99", label: "Green belt" },
      "HEALTHCARE": { color: "#cc9999", label: "Healthcare" },
      "HLPAP (Electric Railway Company)": { color: "#9999cc", label: "Hlpap (electric railway company)" },
      "INDUSTRIAL PARK with terms and restrictions": { color: "#c2cc99", label: "Industrial park with terms and restrictions" },
      "ISLAMIC TEMPLE": { color: "#cc99b3", label: "Islamic temple" },
      "KAN (Cultural Facility)": { color: "#99ccb3", label: "Kan (cultural facility)" },
      "KX (public use)": { color: "#c299cc", label: "Kx (public use)" },
      "LOCAL CENTER": { color: "#b3c6d6", label: "Local center" },
      "LOCAL CENTER 1": { color: "#d6b3cc", label: "Local center 1" },
      "LOCAL CENTER 2": { color: "#b3d6cc", label: "Local center 2" },
      "MASS TRANSPORT FACILITIES": { color: "#d6ccb3", label: "Mass transport facilities" },
      "MIXED USES": { color: "#b3b3cc", label: "Mixed uses" },
      "MUNICIPAL CENTER": { color: "#abc7de", label: "Municipal center" },
      "MUNICIPAL METROPOLITAN CENTER": { color: "#99cc99", label: "Municipal metropolitan center" },
      "NEIGHBORHOOD LOCAL CENTER": { color: "#cc9999", label: "Neighborhood local center" },
      "NURSERY": { color: "#9999cc", label: "Nursery" },
      "NURSERY SCHOOL": { color: "#c2cc99", label: "Nursery school" },
      "OFFICIAL GAZETTE 1049D’/95 & OFFICIAL GAZETTE 236A.A.P./2010": { color: "#cc99b3", label: "Official gazette 1049d’/95 & official gazette 236a.a.p./2010" },
      "OFFICIAL GAZETTE 154A.A.P./2009 (professional workshops excluded)": { color: "#99ccb3", label: "Official gazette 154a.a.p./2009 (professional workshops excluded)" },
      "OFFICIAL GAZETTE 161AAP_2013 DOUBLE REGENERATION": { color: "#c299cc", label: "Official gazette 161aap_2013 double regeneration" },
      "OFFICIAL GAZETTE 2248B/19": { color: "#b3c6d6", label: "Official gazette 2248b/19" },
      "on Areopagitou St. OFFICIAL GAZETTE 186D/1976 and 405D/1978": { color: "#d6b3cc", label: "On areopagitou st. official gazette 186d/1976 and 405d/1978" },
      "on D. Areop. OFFICIAL GAZETTE 35B/62-OFFICIAL GAZETTE 186D/76-OFFICIAL GAZETTE 405D/78": { color: "#b3d6cc", label: "On d. areop. official gazette 35b/62-official gazette 186d/76-official gazette 405d/78" },
      "OPEN SPACES": { color: "#d6ccb3", label: "Open spaces" },
      "OSE (Greek Railways)": { color: "#b3b3cc", label: "Ose (greek railways)" },
      "PANATHINAIKOS (stadium)": { color: "#b3e0ff", label: "Panathinaikos (stadium)" },
      "PAO ATHLETIC GROUND": { color: "#99cc99", label: "Pao athletic ground" },
      "PEDESTRIAN STREET": { color: "#cc9999", label: "Pedestrian street" },
      "POL. CENTER with restrictions": { color: "#9999cc", label: "Pol. center with restrictions" },
      "POL. CENTER with special uses": { color: "#c2cc99", label: "Pol. center with special uses" },
      "PRAS-CENTER - PIRAEUS": { color: "#cc99b3", label: "Pras-center - piraeus" },
      "PRAS (Urban Green)": { color: "#99ccb3", label: "Pras (urban green)" },
      "PUBLIC GREEN SPACE": { color: "#c299cc", label: "Public green space" },
      "PUBLIC SPACE": { color: "#b3c6d6", label: "Public space" },
      "REHABILITATION CENTER": { color: "#d6b3cc", label: "Rehabilitation center" },
      "RESIDENCE WITH EXCEPTIONS": { color: "#b3d6cc", label: "Residence with exceptions" },
      "SOCIAL SERVICES": { color: "#d6ccb3", label: "Social services" },
      "SOCIAL SERVICES - special uses for preserved buildings facing Piraeus Street": { color: "#b3b3cc", label: "Social services - special uses for preserved buildings facing piraeus street" },
      "SPECIAL K.P.&P.CH. (Special Use Areas)": { color: "#b3e0ff", label: "Special k.p.&p.ch. (special use areas)" },
      "SPECIAL USES": { color: "#99cc99", label: "Special uses" },
      "SPORTS": { color: "#cc9999", label: "Sports" },
      "STADIUMS": { color: "#9999cc", label: "Stadiums" },
      "TOURISM - RECREATION": { color: "#c2cc99", label: "Tourism - recreation" },
      "UNDERGROUND PARKING SPACE - PUBLIC GREEN": { color: "#cc99b3", label: "Underground parking space - public green" },
      "UNION CENTER": { color: "#99ccb3", label: "Union center" },
      "UNION CENTER - special uses for preserved buildings facing Piraeus Street": { color: "#c299cc", label: "Union center - special uses for preserved buildings facing piraeus street" },
      "URBAN CENTER": { color: "#b3c6d6", label: "Urban center" },
      "URBAN CENTER - special uses for preserved buildings facing Piraeus Street": { color: "#d6b3cc", label: "Urban center - special uses for preserved buildings facing piraeus street" },
      "URBAN GREEN SPACE - OPEN SPACES": { color: "#b3d6cc", label: "Urban green space - open spaces" },
      "URBAN GREEN SPACE - OPEN SPACES & YOUTH CENTER SPACE": { color: "#d6ccb3", label: "Urban green space - open spaces & youth center space" },
      "USES-OFFICIAL GAZETTE 706D/85": { color: "#b3b3cc", label: "Uses-official gazette 706d/85" },
      "VASILISSIS SOFIAS AVENUE": { color: "#b3e0ff", label: "Vasilissis sofias avenue" },
      "WELFARE": { color: "#99cc99", label: "Welfare" },
      "ZONE-II-A": { color: "#cc9999", label: "Zone-ii-a" },
      "ZONE-II-PL.EXARCH. (Exarchia Square)": { color: "#9999cc", label: "Zone-ii-pl.exarch. (exarchia square)" },
      "ZONE I": { color: "#c2cc99", label: "Zone i" },
      "ZONE II": { color: "#cc99b3", label: "Zone ii" }
    },
  },
    "Corine Land Cover (2018)": {
      field: "Code_18",
      title: "Corine Land Cover (2018)",
      classes: {
        "111": { color: "#e41a1c", label: "Συνεχής αστική οικοδόµηση" },           // deep red
        "112": { color: "#fb6a4a", label: "∆ιακεκοµµένη αστική οικοδόµηση" },       // light red
        "121": { color: "#fec44f", label: "Βιοµηχανικές ή εµπορικές ζώνες" },       // orange
        "122": { color: "#fd8d3c", label: "Οδικά και σιδηροδροµικά δίκτυα και γειτνιάζουσα γη" }, // orange-red
        "123": { color: "#6baed6", label: "Ζώνες λιµένων" },                       // blue
        "124": { color: "#ffffff", label: "Αεροδρόμια" },                          // white
        "131": { color: "#bdbdbd", label: "Χώροι εξόρυξης ορυκτών" },               // grey
        "132": { color: "#636363", label: "Χώροι απόρριψης απορριµµάτων" },         // dark grey
        "141": { color: "#a1d99b", label: "Περιοχές αστικού πρασίνου" },            // light green
        "142": { color: "#41ab5d", label: "Εγκαταστάσεις αθλητισµού και αναψυχής" },// medium green
        "211": { color: "#ffffb2", label: "Μη αρδεύσιµη-αρόσιµη γη" },              // pale yellow
        "212": { color: "#fecc5c", label: "Μόνιµα αρδευόµενη γη" },                 // light orange
        "221": { color: "#c2e699", label: "Αµπελώνες" },                            // light green
        "222": { color: "#78c679", label: "Οπωροφόρα δέντρα και φυτείες µε σαρκώδεις καρπούς" }, // green
        "223": { color: "#238443", label: "Ελαιώνες" },                             // dark green
        "231": { color: "#d9f0a3", label: "Λιβάδια" },                             // pale green
        "241": { color: "#addd8e", label: "Ετήσιες καλλιέργειες που συνδέονται µε µόνιµες καλλιέργειες" }, // green
        "242": { color: "#31a354", label: "Σύνθετα συστήµατα καλλιέργειας" },       // dark green
        "243": { color: "#006837", label: "Γη που καλύπτεται κυρίως από γεωργία µε σηµαντικές εκτάσεις φυσικής βλάστησης" }, // very dark green
        "311": { color: "#b8860b", label: "∆άσος πλατύφυλλων" },                    // brown
        "312": { color: "#a0522d", label: "∆άσος κωνοφόρων" },                      // brown
        "313": { color: "#8b4513", label: "Μικτό δάσος" },                          // brown
        "321": { color: "#fdae6b", label: "Φυσικοί βοσκότοποι" },                   // orange
        "323": { color: "#fd8d3c", label: "Σκληροφυλλική βλάστηση" },               // orange-red
        "324": { color: "#fdd0a2", label: "Μεταβατικές δασώδεις-θαµνώδεις εκτάσεις" }, // light orange
        "332": { color: "#cccccc", label: "Απογυµνωµένοι βράχοι" },                 // light grey
        "333": { color: "#969696", label: "Εκτάσεις µε αραιή βλάστηση" },           // grey
        "334": { color: "#525252", label: "Αποτεφρωµένες εκτάσεις" },               // dark grey
        "411": { color: "#c6dbef", label: "Βάλτοι στην ενδοχώρα" },                 // pale blue
        "421": { color: "#9ecae1", label: "Παραθαλάσσιοι βάλτοι" },                 // light blue
        "512": { color: "#6baed6", label: "Συλλογές υδάτων" },                      // blue
        "521": { color: "#4292c6", label: "Παράκτιες λιµνοθάλασσες" },              // blue
        "523": { color: "#08519c", label: "Θάλασσα" }                               // deep blue
      }
    },
    "Wildfires Attica 2015-2025": {
      field: "Year",
      title: "Wildfires Attica 2015-2025",
      classes: {
        "2015": { color: "#FFE6ED", label: "2015" }, // light green
        "2016": { color: "#FFB8CD", label: "2016" }, // green
        "2017": { color: "#FF8AAD", label: "2017" }, // dark green
        "2018": { color: "#FF5C8D", label: "2018" }, // pale yellow
        "2019": { color: "#FF2E6D", label: "2019" }, // light orange
        "2020": { color: "#FF004D", label: "2020" }, // orange-red
        "2021": { color: "#D1003F", label: "2021" }, // red
        "2022": { color: "#A30031", label: "2022" }, // deep red
        "2023": { color: "#800026", label: "2023" }, // very deep red
        "2024": { color: "#470015", label: "2024" }, // very deep red
        "2025": { color: "#1A0008", label: "2025" }  // very deep red
      }
    },
    "Banks": {
      field: "amenity",
      title: "Amenity Type",
      classes: {
        "bank": { color: "#ffff00", label: "Bank" } //yellow
      }
    },
    "Fuel Stations": {
      field: "amenity",
      title: "Amenity Type",
      classes: {
        "fuel": { color: "#ffa500", label: "Fuel Station" } //orange
      }
    },
    "Hospitals": {
      field: "amenity",
      title: "Amenity Type",
      classes: {
        "hospital": { color: "#ff0000", label: "Hospital" } //red
      }
    },
    "Pharmacies": {
      field: "amenity",
      title: "Amenity Type", 
      classes: {
        "pharmacy": { color: "#008000", label: "Pharmacy" } //green
      }
    },
    "Police Stations": {
      field: "amenity",
      title: "Amenity Type",
      classes: {
        "police": { color: "#0000ff", label: "Police Station" } //blue
      }
    },
    "Schools": {
      field: "amenity",
      title: "Amenity Type",
      classes: {
        "school": { color: "#FF5CFF", label: "School" } //purple
      }
    },
    "Universities": {
      field: "amenity",
      title: "Amenity Type",
      classes: {
        "university": { color: "#b3b3b3ff", label: "University" } //grey
      }
    }
  };

// Active legend set
var activeLegendLayers = window.activeLegendLayers || new Set();
window.activeLegendLayers = activeLegendLayers;

// Public unified updater (compat: updateLegendBar(layerName, 'remove'))
window.updateLegendBar = function(layerName, action){
  if(layerName){
    if(action==='remove') activeLegendLayers.delete(layerName);
    else if(window.legendConfigs[layerName]) activeLegendLayers.add(layerName);
  }
  var legendBar = document.getElementById('legend-bar');
  var legendList = document.getElementById('legend-list');
  if(!legendBar || !legendList) return;
  legendList.innerHTML='';
  if(activeLegendLayers.size===0){ legendBar.style.display='none'; return; }
  legendBar.style.display='block';

  // 1) Group active configs by common title (cfg.title or layer name)
  var titleOrder = []; // preserve insertion order of titles encountered
  var groups = {};     // title -> { order:[], items: Map-like object of uniqueKey -> {label,color} }
  activeLegendLayers.forEach(function(name){
    var cfg = window.legendConfigs[name];
    if(!cfg) return;
    var title = cfg.title || name;
    if(!groups[title]){ groups[title] = { order: [], items: {} }; titleOrder.push(title); }
    // 2) Merge classes; dedupe by label+color (stable order of first encounter)
    Object.entries(cfg.classes||{}).forEach(function([clsName, style]){
      var label = style.label || clsName;
      var color = style.color || '';
      var uniqKey = label + '|' + color; // avoid duplicates across layers
      if(!(uniqKey in groups[title].items)){
        groups[title].items[uniqKey] = { label: label, color: color };
        groups[title].order.push(uniqKey);
      }
    });
  });

  // 3) Render merged groups
  titleOrder.forEach(function(title){
    var g = groups[title];
    if(!g || g.order.length===0) return;
    var titleLi=document.createElement('li');
    titleLi.innerHTML='<strong>'+ title +'</strong>';
    titleLi.style.marginTop='8px';
    legendList.appendChild(titleLi);
    g.order.forEach(function(key){
      var item = g.items[key];
      var li=document.createElement('li');
      var colorBox=document.createElement('span');
      colorBox.className='legend-color';
      colorBox.style.background=item.color;
      li.appendChild(colorBox);
      li.appendChild(document.createTextNode(item.label));
      legendList.appendChild(li);
    });
  });
};