# Leveling Jump — Frontend HU03, HU04 y HU01

Este paquete parte del frontend anterior de HU03 y agrega pantallas iniciales para las tareas frontend asignadas de HU04 y HU01.

## Incluye
- **HU03:** gestión de productos existente (registro, edición, búsqueda y filtro por categoría).
- **HU04-T07/T08:** formulario de recepción de lote, validación de cantidad obligatoria y fecha.
- **HU01-T04/T05/T06:** catálogo público, búsqueda por nombre/marca/serie, filtro por categoría y visualización de disponibilidad si la API entrega ese dato.
- Navegación entre las tres secciones.

## Ejecutar
Desde la carpeta `frontend`:
```bash
npm install
npm run dev
```
La API de productos está configurada en `http://localhost:4000/api/productos`.

## Pendiente de confirmar con backend
1. **Recepción:** `src/services/recepcionService.js` usa provisionalmente `POST http://localhost:4000/api/recepciones`. Adriano debe confirmar la ruta exacta y los nombres de campos que espera.
2. **Disponibilidad:** el catálogo muestra disponibilidad si la API devuelve `unidadesDisponibles`, `stockDisponible`, `disponibles` o `disponibilidad`. El backend debe confirmar el nombre final del campo. Si no llega, la interfaz muestra “Por confirmar”; no inventa stock.
3. **Recepción de lotes:** el formulario envía `productoId`, `cantidad`, `fechaRecepcion` y `observaciones`. Confirmar con César/Adriano si el modelo final usa estos nombres o un identificador de producto diferente.
4. El backend debe estar iniciado y habilitar CORS para el origen local del frontend.

## Importante
No incluye ni requiere credenciales de Supabase en el frontend. Las credenciales y las migraciones pertenecen al backend. No subir secretos a GitHub.
