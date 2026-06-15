import os
import processing
from qgis.core import QgsVectorLayer

carpeta_entrada = "C:/Users/mipsp/Desktop/Modelacion_Pedregoso_E2/Zanjon_Seco/E2/T_1_a_100_2_horas/"
carpeta_salida = "C:/Users/mipsp/Desktop/Modelacion_Pedregoso_E2/Zanjon_Seco/E2/Raster_Caudal/"

if not os.path.exists(carpeta_salida):
    os.makedirs(carpeta_salida)

col_x = "longitude"
col_y = "latitude"
col_h = "flow_depth"
col_v = "flow_speed"
tamano_pixel = 30

archivos = [f for f in os.listdir(carpeta_entrada) if f.endswith('.txt')]

for archivo in archivos:
    ruta_txt = os.path.join(carpeta_entrada, archivo).replace("\\", "/")
    
    uri = f"file:///{ruta_txt}?delimiter=,&trimFields=Yes&xField={col_x}&yField={col_y}&crs=EPSG:4326"
    capa_puntos = QgsVectorLayer(uri, "puntos_temp", "delimitedtext")
    
    if not capa_puntos.isValid() or capa_puntos.featureCount() == 0:
        continue

    puntos_utm = processing.run("native:reprojectlayer", {
        'INPUT': capa_puntos,
        'TARGET_CRS': 'EPSG:32719',
        'OUTPUT': 'TEMPORARY_OUTPUT'
    })['OUTPUT']

    puntos_calc = processing.run("native:fieldcalculator", {
        'INPUT': puntos_utm,
        'FIELD_NAME': 'Caudal',
        'FIELD_TYPE': 0,
        'FIELD_LENGTH': 10,
        'FIELD_PRECISION': 3,
        'FORMULA': f'"{col_h}" * "{col_v}" * 30',
        'OUTPUT': 'TEMPORARY_OUTPUT'
    })['OUTPUT']

    ruta_salida = os.path.join(carpeta_salida, archivo.replace('.txt', '.tif')).replace("\\", "/")
    processing.run("gdal:rasterize", {
        'INPUT': puntos_calc,
        'FIELD': 'Caudal',
        'UNITS': 1,
        'WIDTH': tamano_pixel,
        'HEIGHT': tamano_pixel,
        'OUTPUT': ruta_salida
    })
