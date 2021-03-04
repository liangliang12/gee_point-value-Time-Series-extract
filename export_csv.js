function bufferPoints(radius, bounds) {
  return function(pt) {
    pt = ee.Feature(pt);
    return bounds ? pt.buffer(radius).bounds() : pt.buffer(radius);
  };
}

function bufferPoints(radius, bounds) {
  return function(pt) {
    pt = ee.Feature(pt);
    return bounds ? pt.buffer(radius).bounds() : pt.buffer(radius);
  };
}

function zonalStats(ic, fc, params) {
  // Initialize internal params dictionary.
  var _params = {
    reducer: ee.Reducer.mean(),
    scale: null,
    crs: null,
    bands: null,
    bandsRename: null,
    imgProps: null,
    imgPropsRename: null,
    datetimeName: 'datetime',
    datetimeFormat: 'YYYY-MM-dd HH:MM:ss'
  };

  // Replace initialized params with provided params.
  if (params) {
    for (var param in params) {
      _params[param] = params[param] || _params[param];
    }
  }

  // Set default parameters based on an image representative.
  var imgRep = ic.first();
  var nonSystemImgProps = ee.Feature(null)
    .copyProperties(imgRep).propertyNames();
  if (!_params.bands) _params.bands = imgRep.bandNames();
  if (!_params.bandsRename) _params.bandsRename = _params.bands;
  if (!_params.imgProps) _params.imgProps = nonSystemImgProps;
  if (!_params.imgPropsRename) _params.imgPropsRename = _params.imgProps;

  // Map the reduceRegions function over the image collection.
  var results = ic.map(function(img) {
    // Select bands (optionally rename), set a datetime & timestamp property.
    img = ee.Image(img.select(_params.bands, _params.bandsRename))
      .set(_params.datetimeName, img.date().format(_params.datetimeFormat))
      .set('timestamp', img.get('system:time_start'));

    // Define final image property dictionary to set in output features.
    var propsFrom = ee.List(_params.imgProps)
      .cat(ee.List([_params.datetimeName, 'timestamp']));
    var propsTo = ee.List(_params.imgPropsRename)
      .cat(ee.List([_params.datetimeName, 'timestamp']));
    var imgProps = img.toDictionary(propsFrom).rename(propsFrom, propsTo);

    // Subset points that intersect the given image.
    var fcSub = fc.filterBounds(img.geometry());

    // Reduce the image by regions.
    return img.reduceRegions({
      collection: fcSub,
      reducer: _params.reducer,
      scale: _params.scale,
      crs: _params.crs
    })
    // Add metadata to each feature.
    .map(function(f) {
      return f.set(imgProps);
    });
  }).flatten().filter(ee.Filter.notNull(_params.bandsRename));

  return results;
}


var pts = ee.FeatureCollection('users/yourUsername/yourAsset');


var pts = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-118.6010, 37.0777]), {plot_id: 1}),
  ee.Feature(ee.Geometry.Point([-118.5896, 37.0778]), {plot_id: 2}),
  ee.Feature(ee.Geometry.Point([-118.5842, 37.0805]), {plot_id: 3}),
  ee.Feature(ee.Geometry.Point([-118.5994, 37.0936]), {plot_id: 4}),
  ee.Feature(ee.Geometry.Point([-118.5861, 37.0567]), {plot_id: 5})
]);
//ptsptsTopo
var ptsTopo = pts.map(bufferPoints(45, false));
// Import the MERIT global elevation dataset.
var elev = ee.Image('MERIT/DEM/v1_0_3');

// Calculate slope from the DEM.
var slope = ee.Terrain.slope(elev);

// Concatenate elevation and slope as two bands of an image.
var topo = ee.Image.cat(elev, slope)
  // Computed images do not have a 'system:time_start' property; add one based
  // on when the data were collected.
  .set('system:time_start', ee.Date('2000-01-01').millis());

// Wrap the single image in an ImageCollection for use in the zonalStats function.
var topoCol = ee.ImageCollection([topo]);

// Define parameters for the zonalStats function.
var params = {
  bands: [0, 1],
  bandsRename: ['elevation', 'slope']
};

// Extract zonal statistics per point per image.
var ptsTopoStats = zonalStats(topoCol, ptsTopo, params);
print(ptsTopoStats);

var ptsModis = pts.map(bufferPoints(50, true));


var modisCol = ee.ImageCollection('MODIS/006/MOD09A1')
  .filterDate('2015-01-01', '2020-01-01')
  .filter(ee.Filter.calendarRange(183, 245, 'DAY_OF_YEAR'));
  
  
// Define parameters for the zonalStats function.
var params = {
  reducer: ee.Reducer.median(),
  scale: 500,
  crs: 'EPSG:5070',
  bands: ['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b06'],
  bandsRename: ['modis_red', 'modis_nir', 'modis_swir'],
  datetimeName: 'date',
  datetimeFormat: 'YYYY-MM-dd'
};

// Extract zonal statistics per point per image.
var ptsModisStats = zonalStats(modisCol, ptsModis, params);
print(ptsModisStats.limit(50));

function fmask(img) {
  var cloudShadowBitMask = 1 << 3;
  var cloudsBitMask = 1 << 5;
  var qa = img.select('pixel_qa');
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
    .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return img.updateMask(mask);
}


// Selects and renames bands of interest for Landsat OLI.
function renameOli(img) {
  return img.select(
    ['B2', 'B3', 'B4', 'B5', 'B6', 'B7'],
    ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2']);
}

// Selects and renames bands of interest for TM/ETM+.
function renameEtm(img) {
  return img.select(
    ['B1', 'B2', 'B3', 'B4', 'B5', 'B7'],
    ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2']);
}


// Prepares (cloud masks and renames) OLI images.
function prepOli(img) {
  img = fmask(img);
  img = renameOli(img);
  return img;
}

// Prepares (cloud masks and renames) TM/ETM+ images.
function prepEtm(img) {
  img = fmask(img);
  img = renameEtm(img);
  return img;
}


var ptsLandsat = pts.map(bufferPoints(15, true));

var oliCol = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
  .filterBounds(ptsLandsat)
  .map(prepOli);

var etmCol = ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
  .filterBounds(ptsLandsat)
  .map(prepEtm);

var tmCol = ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
  .filterBounds(ptsLandsat)
  .map(prepEtm);
  
var landsatCol = oliCol.merge(etmCol).merge(tmCol);


// Define parameters for the zonalStats function.
var params = {
  reducer: ee.Reducer.mean(),
  scale: 30,
  crs: 'EPSG:5070',
  bands: ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2'],
  bandsRename: ['ls_blue', 'ls_green', 'ls_red', 'ls_nir', 'ls_swir1', 'ls_swir2'],
  imgProps: ['LANDSAT_ID', 'SATELLITE'],
  imgPropsRename: ['img_id', 'satellite'],
  datetimeName: 'date',
  datetimeFormat: 'YYYY-MM-dd'
};

// Extract zonal statistics per point per image.
var ptsLandsatStats = zonalStats(landsatCol, ptsLandsat, params);
print(ptsLandsatStats.limit(50));

Export.table.toAsset({
  collection: ptsLandsatStats,
  description: 'your_summary_table_name_here',
  assetId: 'path_to_your_summary_table_name_here'
});

Export.table.toDrive({
  collection: ptsLandsatStats,
  folder: 'your_gdrive_folder_name_here',
  description: 'your_summary_table_name_here',
  fileFormat: 'CSV'
});

// Define a Landsat image.
var img = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR').first();

// Print its properties.
print(img.propertyNames());

// Select the reflectance bands and unscale them.
var computedImg = img.select('B.*').divide(1e4);

// Print the unscaled image's properties.
print(computedImg.propertyNames());

// Select the reflectance bands and unscale them.
var computedImg = img.select('B.*').divide(1e4)
  .copyProperties(img, img.propertyNames());

// Print the unscaled image's properties.
print(computedImg.propertyNames());


// Add polygon geometry.
var geometry =
    ee.Geometry.Polygon(
        [[[-118.6019835717645, 37.079867782687884],
          [-118.6019835717645, 37.07838698844939],
          [-118.60036351751951, 37.07838698844939],
          [-118.60036351751951, 37.079867782687884]]], null, false);

// Import the MERIT global elevation dataset.
var elev = ee.Image('MERIT/DEM/v1_0_3');
print('Projection, crs, and crs_transform:', elev.projection());
print('Scale in meters:', elev.projection().nominalScale());

var result = elev.select(0).reduceRegion({
  reducer: ee.Reducer.count(),
  geometry: geometry,
  scale: 90,
  crs: 'EPSG:5070'
});

print('n pixels', result.get('dem'));

Map.addLayer(elev.reproject({crs: 'EPSG:5070', scale: 90}),
  {min: 2500, max: 3000, palette: ['blue', 'white', 'red']});
Map.addLayer(geometry, {color: 'white'});
Map.centerObject(geometry, 18);

