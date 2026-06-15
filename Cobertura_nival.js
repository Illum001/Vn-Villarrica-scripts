var v_villarrica = ee.Geometry.Point([-71.9405, -39.4203]);
var area_estudio = v_villarrica.buffer(12000);
Map.centerObject(v_villarrica, 12);

var calcularNieveArea = function(img) {
  var ndsi = img.normalizedDifference(['B3', 'B11']);
  var green = img.select('B3');
  var mask = ndsi.gt(0.42).and(green.gt(2200)).rename('nieve');
  var area = mask.multiply(ee.Image.pixelArea()).divide(1000000);
  return area.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: area_estudio,
    scale: 10,
    maxPixels: 1e9
  }).get('nieve');
};

var anos = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
var nombresMeses = ['01_Ene', '02_Feb', '03_Mar', '04_Abr', '05_May', '06_Jun',
                    '07_Jul', '08_Ago', '09_Sep', '10_Oct', '11_Nov', '12_Dic'];
var listaGrafico = [];

anos.forEach(function(ano) {
  var datosMensuales = {};
  var listaAreas = [];

  for (var m = 1; m <= 12; m++) {
    var fecha = ee.Date.fromYMD(ano, m, 1);
    var col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
      .filterBounds(area_estudio)
      .filterDate(fecha, fecha.advance(1, 'month'))
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .sort('CLOUDY_PIXEL_PERCENTAGE');
    var bestImg = ee.Image(col.first());
    var area = ee.Number(ee.Algorithms.If(col.size().gt(0), calcularNieveArea(bestImg), 0));

    datosMensuales[nombresMeses[m-1]] = area;
    listaAreas.push(area);
    listaGrafico.push(ee.Feature(null, {
      'system:time_start': fecha.millis(),
      'area_km2': area
    }));
  }

  var eeLista = ee.List(listaAreas);
  var listaLimpia = eeLista.filter(ee.Filter.gt('item', 0));
  var tieneDatos = listaLimpia.size().gt(0);

  var maxVal = ee.Number(ee.Algorithms.If(tieneDatos, listaLimpia.reduce(ee.Reducer.max()), 0));
  var minVal = ee.Number(ee.Algorithms.If(tieneDatos, listaLimpia.reduce(ee.Reducer.min()), 0));
  var promedio = ee.Number(ee.Algorithms.If(tieneDatos, listaLimpia.reduce(ee.Reducer.mean()), 0));

  var procesarExtremo = function(tipo) {
    var valorObjetivo = (tipo === 'MAX') ? maxVal : minVal;
    var mesIdx = eeLista.indexOf(valorObjetivo).add(1);

    var colExtrema = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
      .filterBounds(area_estudio)
      .filter(ee.Filter.calendarRange(ano, ano, 'year'))
      .filter(ee.Filter.calendarRange(mesIdx, mesIdx, 'month'))
      .sort('CLOUDY_PIXEL_PERCENTAGE');
    var imgFinal = ee.Image(colExtrema.first());
    var color = (tipo === 'MAX') ? '0000FF' : 'FF0000';

    valorObjetivo.evaluate(function(val) {
      if (val > 0) {
        var mascara = imgFinal.normalizedDifference(['B3', 'B11']).gt(0.42)
                      .and(imgFinal.select('B3').gt(2200)).selfMask();
        Map.addLayer(mascara.clip(area_estudio), {palette: [color]}, tipo + ' ' + ano + ' (Mes ' + mesIdx.getInfo() + ')', false);
        Export.image.toDrive({
          image: imgFinal.select(['B4', 'B3', 'B2', 'B11']).clip(area_estudio),
          description: 'Villarrica_' + tipo + '_' + ano + '_Mes_' + mesIdx.getInfo(),
          scale: 10,
          region: area_estudio,
          fileFormat: 'GeoTIFF',
          crs: 'EPSG:32719'
        });
      }
    });
  };

  procesarExtremo('MAX');
  procesarExtremo('MIN');
});

var chart = ui.Chart.feature.byFeature({
  features: ee.FeatureCollection(listaGrafico),
  xProperty: 'system:time_start',
  yProperties: ['area_km2']
}).setOptions({
  title: 'Evolución Nival Villarrica 2015-2025',
  vAxis: {title: 'km²'},
  hAxis: {title: 'Fecha'},
  series: {0: {color: 'blue', lineWidth: 1, pointsVisible: true}}
});
print(chart);
