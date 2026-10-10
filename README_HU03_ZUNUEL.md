# HU-03 - Frontend de Zunuel Valle Ames

Esta carpeta contiene la parte frontend correspondiente a HU-03: gestionar productos del catálogo.

## Incluye
- Registro de productos.
- Consulta/listado.
- Búsqueda por nombre.
- Filtro por categoría.
- Edición.
- Validación de campos obligatorios.
- Consumo de la API del equipo.

## API utilizada
`http://localhost:4000/api/productos`

GET `/api/productos`
POST `/api/productos`
PUT `/api/productos/:id`

## Ejecutar
Desde `frontend/`:

```bash
npm install
npm run dev
```

El backend del equipo debe estar levantado en el puerto 4000.

## Nota
No se modificó el backend del equipo. Esta carpeta está separada para integrarla en la rama `develop` mediante el flujo de Git del grupo.
