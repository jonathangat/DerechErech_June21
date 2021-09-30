// Leaflet-Extended-Div-Icon, by tonekk. 2014, MIT License
// https://github.com/tonekk/Leaflet-Extended-Div-Icon
(function (e) {
  e.ExtendedDivIcon = e.DivIcon.extend({
    createIcon: function (t) {
      var n = e.DivIcon.prototype.createIcon.call(this, t);
      if (this.options.id) {
        n.id = this.options.id;
      }
      if (this.options.style) {
        for (var r in this.options.style) {
          n.style[r] = this.options.style[r];
        }
      }
      return n;
    },
  });
  e.extendedDivIcon = function (t) {
    return new e.ExtendedDivIcon(t);
  };
})(window.L);

//set up map
var map = L.map("map").setView([31.950124877508276, 34.80287893972995], 10);
let legend = L.control({ position: "bottomleft" });

// Adding a basemap (Carto Voyager)
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a> | אפיון ופיתוח: יונתן גת',
    maxZoom: 19,
  }
).addTo(map);

// add watermark
L.Control.Watermark = L.Control.extend({
  onAdd: function (map) {
    var img = L.DomUtil.create("img");

    img.src = "./img/AyalonHighwaysNew.svg";
    img.style.width = "200px";

    return img;
  },

  onRemove: function (map) {},
});

L.control.watermark = function (opts) {
  return new L.Control.Watermark(opts);
};

L.control.watermark({ position: "bottomright" }).addTo(map);

// wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", async () => {
  // add title
  let titleElement = L.control({ position: "topright" });
  titleElement.onAdd = function () {
    let div = L.DomUtil.create("div", "maintitle");
    div.innerHTML = `<div class='title'>דרך ערך: ניתוח מוצא ויעד, יוני 2021</div>`;
    return div;
  };
  titleElement.addTo(map);

  // add an empty taz layer
  let tazLayer = L.featureGroup();

  // add a jurisdiction layer
  let jurisLayer = L.featureGroup();

  let fetchJuris = fetch(
    "https://jonathang.carto.com/api/v2/sql?format=GeoJSON&q=SELECT muni_name, the_geom FROM muni_layer"
  );

  let parsedJuris = await fetchJuris.then((response) => response.json());

  let jurisStyle = {
    weight: 1,
    opacity: 0.2,
    color: "black",
    fillOpacity: 0,
  };

  let jurisGeoJson = L.geoJson(parsedJuris, { style: jurisStyle }).addTo(
    jurisLayer
  );

  jurisGeoJson.addTo(map);

  // generalise function to enter password and populate region dropdown
  async function populate_regions() {
    // define query variables
    let url = "https://jonathang.carto.com/api/v2/sql?";
    let urlJSON = url + "q=";
    let sqlGetRegions =
      "SELECT DISTINCT region FROM taz_app ORDER BY region ASC&api_key=";
    let pwd = document.getElementById("pass").value;

    // fetch
    let request = fetch(urlJSON + sqlGetRegions + pwd);
    let requeset_status = await request.then((response) => response.ok);

    // is the password correct?
    if (requeset_status) {
      // disable controls
      document.getElementById("pass").disabled = true;
      document.getElementById("pass_btn").disabled = true;

      // populate dropdown
      request
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          let html = "<option>הכל</option>";
          data.rows.forEach(function (element) {
            html += "<option>" + element.region + "</option>";
          });
          document.getElementById("taz_sel").innerHTML = html;
        });

      // show dropdown
      document.getElementById("controls").style.display = "block";
    } else {
      alert("הוקשה סיסמה שגויה. נא להזין שנית");
    }
  }

  // where clause function
  function where_clause() {
    // get region value
    let region = document.getElementById("taz_sel").value;
    // return where clause string
    if (region != "הכל") {
      return ` WHERE region = '${region}'`;
    } else {
      return "";
    }
  }

  // variable selection function
  function select_variables() {
    // set column names to retrieve
    let columns = [
      "taz_id",
      "taz_name_str",
      "taz_type",
      "zonetypena",
      "region",
    ];

    //get values from controls
    let peak_sel = document.getElementById("peak_sel").value;
    let ij_sel = document.getElementById("ij_sel").value;

    // select variable name and push it to the columns array
    if (peak_sel == "שעות שיא בוקר" && ij_sel == "מוצא") {
      columns.push("morning_i AS value");
    } else if (peak_sel == "אחר" && ij_sel == "מוצא") {
      columns.push("no_peak_i AS value");
    } else if (peak_sel == "שעות שיא ערב" && ij_sel == "מוצא") {
      columns.push("evening_i AS value");
    } else if (peak_sel == "שעות שיא בוקר" && ij_sel == "יעד") {
      columns.push("morning_j AS value");
    } else if (peak_sel == "אחר" && ij_sel == "יעד") {
      columns.push("no_peak_j AS value");
    } else if (peak_sel == "שעות שיא ערב" && ij_sel == "יעד") {
      columns.push("evening_j AS value");
    }

    // push geometry column
    columns.push("the_geom");

    // cast column array to string
    let columns_string = columns.toString();

    // build a select statement
    let select_statement = `SELECT ${columns_string} FROM taz_app`;

    // return string
    return select_statement;
  }

  // generate map function
  async function generate_map() {
    // clear previous queries
    tazLayer.clearLayers();
    jurisLayer.clearLayers();

    // define query variables
    let url = "https://jonathang.carto.com/api/v2/sql?";
    let urlGeoJSON = url + "format=GeoJSON&q=";
    let select_clause_str = select_variables();
    let where_clause_str = where_clause();
    let api_key_str = `&api_key=${document.getElementById("pass").value}`;

    // create a query string
    let query_str =
      urlGeoJSON + select_clause_str + where_clause_str + api_key_str;

    // create classybrew object
    // source: http://tannerjt.github.io/classybrew-www/examples/basic/
    // thanks to the classybrew team!
    let brew = new classyBrew();

    // create an empty array
    let values = [];

    // fetch request
    let request = fetch(query_str);

    // parse request to geojson object
    let parsed_geojson = await request.then((response) => response.json());

    // populate the values array
    for (var i = 0; i < parsed_geojson.features.length; i++) {
      if (parsed_geojson.features[i].properties["value"] == null) continue;
      values.push(parsed_geojson.features[i].properties["value"]);
    }

    // pass array to our classybrew series
    brew.setSeries(values);

    // define number of classes
    brew.setNumClasses(5);

    // set color ramp code
    brew.setColorCode("Reds");

    // classify by passing in statistical method
    // i.e. equal_interval, jenks, quantile
    brew.classify("jenks");

    // style function to return
    // fill color based on brew.getColorInRange() method
    function style(feature) {
      return {
        weight: 1,
        opacity: 1,
        color: "gray",
        dashArray: "3",
        fillOpacity: 0.5,
        fillColor: brew.getColorInRange(feature.properties.value),
      };
    }

    // interaction - mouse hover
    // https://leafletjs.com/examples/choropleth/
    function highlightFeature(e) {
      var layer = e.target;

      layer.setStyle({
        weight: 3,
        color: "#666",
        dashArray: "",
        fillOpacity: 0.7,
      });

      if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
      }
    }

    function resetHighlight(e) {
      geojson.resetStyle(e.target);
    }

    function clickFeature(e) {
      // fly to feature
      map.fitBounds(e.target.getBounds());
    }

    function onEachFeature(feature, layer) {
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        // click: clickFeature,
      });

      // build popup content
      let popupContent = `<div class="popupcontent">`;
      if (feature.properties.taz_name_str) {
        popupContent += `<span class="popupHeader">${feature.properties.taz_name_str}</span><br style="display: block;margin: 2px 0;" />`;
      }
      if (feature.properties.taz_id) {
        popupContent += `<b>אזור תנועה: </b>${feature.properties.taz_id}<br />`;
      }
      if (feature.properties.taz_type) {
        popupContent += `<b>שימוש קרקע:</b> ${feature.properties.taz_type}<br />`;
      }
      if (feature.properties.zonetypena) {
        popupContent += `<b>טבעת:</b> ${feature.properties.zonetypena}<br />`;
      }
      if (feature.properties.value) {
        popupContent += `<b>נסיעות:</b> ${feature.properties.value}<br />`;
      }

      popupContent += `</div>`;
      layer.bindPopup(popupContent);
    }

    // add geojson to map
    // calling the style method on each feature

    let geojson = L.geoJson(parsed_geojson, {
      style: style,
      onEachFeature: onEachFeature,
    }).addTo(tazLayer);

    // fly to bounds
    map.flyToBounds(tazLayer.getBounds());

    // add layer to map
    tazLayer.addTo(map);

    // add legend

    let breaks = brew.getBreaks();

    legend.onAdd = function (map) {
      // create a legend div
      let div = L.DomUtil.create("div", "info legend");

      // add title
      div.innerHTML = "<strong>נסיעות</strong><br />";

      // loop through our density intervals and generate a label with a colored square for each interval
      for (var i = 0; i < breaks.length - 1; i++) {
        div.innerHTML +=
          '<i style="background:' +
          brew.getColorInRange(breaks[i] + 1) +
          '"></i> ' +
          breaks[i] +
          (breaks[i + 1] ? "&ndash;" + breaks[i + 1] + "<br>" : "+");
      }

      return div;
    };

    legend.addTo(map);
  }

  // add password textbox
  let password_div = L.control({ position: "topright" });
  password_div.onAdd = function () {
    let div = L.DomUtil.create("div", "password_div");
    div.innerHTML = `סיסמה: <input type="password" id="pass" onkeydown = "if (event.keyCode == 13)
    document.getElementById('pass_btn').click()">  <button type="button" id="pass_btn" class="psw_btn">אישור</button> `;
    return div;
  };
  password_div.addTo(map);

  // add an empty taz dropdown menu
  let taz_dropdown = L.control({ position: "topleft" });
  taz_dropdown.onAdd = function () {
    let div = L.DomUtil.create("div", "taz_dropdown");
    div.innerHTML =
      '<div id="controls">בחר אזור:<br /><select id="taz_sel"></select><br /><br />בחר זמן:<br /><select id="peak_sel"><option>שעות שיא בוקר</option><option>שעות שיא ערב</option><option>אחר</option></select><br /><br />בחר אגרגציה:<br /><select id="ij_sel"><option>מוצא</option><option>יעד</option></select><br /><br /><br /><button id="generate_btn" type="button">הפק מפה</button></div>';
    return div;
  };
  taz_dropdown.addTo(map); // now hide it
  document.getElementById("controls").style.display = "none";

  // add listeners
  document
    .getElementById("pass_btn")
    .addEventListener("click", populate_regions);

  document
    .getElementById("generate_btn")
    .addEventListener("click", generate_map);
});
