# Leveling Jump — Sistema de Gestión de Inventario y Catálogo

Sistema transaccional desarrollado bajo metodología **SCRUM** para la empresa comercializadora de model kits, figuras y artículos de colección **Leveling Jump**. Diseñado para centralizar el catálogo de productos, gestionar la recepción de lotes de importación y garantizar la disponibilidad de stock en tiempo real en ferias presenciales y canales digitales.

---

## 🚀 Stack Tecnológico

* **Frontend:** React 18, Vite, CSS modular responsive.
* **Backend:** Node.js, Express.js (Arquitectura REST).
* **Base de Datos:** PostgreSQL en la nube (Supabase).
* **ORM:** Prisma ORM (Tipado estricto, migraciones DDL automáticas).
* **Control de Versiones & Gestión:** GitHub (Git Flow) y Jira Software.

---

## 📁 Estructura del Repositorio

```text
leveling-jump-system/
├── frontend/             # Single Page Application en React (Vite)
│   ├── src/
│   │   ├── components/   # Catálogo público, gestión de productos, recepción de lotes
│   │   └── services/     # Clientes API REST (Fetch / Axios)
│   └── package.json
├── prisma/               # Modelado y migraciones de Base de Datos
│   ├── schema.prisma     # Modelos relacionales declarativos
│   └── migrations/       # Scripts DDL PostgreSQL ejecutados en Supabase
├── src/                  # Servidor Backend REST (Express.js)
│   ├── controllers/      # Controladores transaccionales (auth, productos, lotes, reservas, ventas, cotizaciones, intereses)
│   ├── middlewares/      # Autenticación JWT (RBAC), Rate Limiting y cabeceras de seguridad HTTP
│   ├── routes/           # Rutas API protegidas por rol y validación de entradas
│   └── index.js          # Punto de entrada del servidor con CORS seguro y límite de payload
├── .env.example          # Plantilla segura de variables de entorno
└── README.md             # Documentación oficial del proyecto
```

---

## 🛡️ Seguridad y Arquitectura Transaccional (AppSec)

* **Control de Acceso y Autenticación (RBAC & BFLA/BOLA):** Validación JWT (`HS256`) con comprobación de cuenta activa en tiempo real, protección por rol (`SUPERADMIN`, `ADMIN`, `CLIENTE`) en rutas de catálogo y lotes, verificación de propiedad de recursos en cotizaciones y reservas, y validación de tokens OAuth 2.0 de Google en servidor.
* **Criptografía y Protección contra Fuerza Bruta:** Generación de códigos OTP con CSPRNG (`crypto.randomInt`), comparación en tiempo constante (`crypto.timingSafeEqual`), hashing de contraseñas con `bcryptjs` y *Rate Limiting* por IP en rutas de autenticación.
* **Prevención de Inyecciones y Endurecimiento HTTP:** Consultas parametrizadas vía Prisma ORM, validación regex estricta en códigos de rastreo/cotización, escape HTML anti-XSS en generación de proformas A4 (`printProforma.js`), cabeceras de seguridad HTTP (`HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`), política CORS por lista blanca y límite de payload JSON (`500kb`).
* **Control de Concurrencia e Inventario Unitario:** Transacciones ACID (`prisma.$transaction`), bloqueo optimista (*Optimistic Locking*) en ventas y entregas, recepción multi-producto por lote y claves de idempotencia únicas en pagos parciales.

---

## 🧭 Mapa de Módulos de la Aplicación Web

### 👤 Vista de Comprador / Cliente
* **🛍️ Catálogo Comercial & 🛒 Carrito Flotante Unificado:** Exploración libre de productos con stock en tiempo real. Cada producto disponible cuenta con el botón **`🛒 Agregar al Carrito`** (y **`🔔 Avisarme (Waitlist)`** cuando está agotado). Desde el carrito, el cliente autenticado elige entre **Apartar con Adelanto (Reserva 20% / 30% / 50%)** o **Emitir Cotización Formal (Proforma válida por 7 días)**.
* **📍 Rastrear Pedido (Historial de Cuenta):** Panel que lista todos los pedidos asociados a la cuenta del cliente con barra de progreso de 4 etapas (*1. Pedido Registrado -> 2. En Preparación -> 3. Listo / En Ruta -> 4. Entregado*), modalidad de entrega, **Courier / Medio de Transporte** y **Código de Envío / Guía** con botón de copiado rápido.
* **🔖 Mis Reservas:** Desglose financiero de cada reserva (Total, Adelanto Abonado, Saldo Pendiente) y coordinación directa al WhatsApp configurado de la tienda.
* **📋 Mis Cotizaciones:** Historial de proformas con filtros por código, fecha de emisión y estado, **validación de stock en tiempo real** (`🟢 VIGENTE`, `⚠️ VARIACIÓN DE STOCK` con recálculo de total, `🚫 IMPOSIBLE COTIZAR - SIN STOCK`), confirmación, eliminación e **impresión limpia en hoja A4 PDF**.

### 🛡️ Paneles Exclusivos de Staff (`ADMIN` y `SUPERADMIN`)
* **📦 Catálogo & Tienda:** Gestión de Productos (validación de precio $\ge$ costo), Catálogo Comercial y **⚙️ Configuración de Tienda** (actualización en tiempo real del número de WhatsApp de atención y ventas).
* **📥 Almacén & Lotes:** **Recepción Multi-Producto de Lotes** (múltiples productos en un mismo embarque con generación de series unitarias) y **🔔 Lista de Espera y Demanda** (alerta verde automática cuando ingresa stock de un producto agotado).
* **🔖 Ventas & Reservas:** **Punto de Venta Multicanal (POS)** para Ferias, TikTok Live, Facebook y Web; **Control de Reservas, Abonos y Entregas** (con máquina de estados inmutable hacia adelante y exigencia de `Saldo = S/ 0.00` antes de marcar como `ENTREGADA`); e **Historial de Cotizaciones**.
* **👑 Administración (`SUPERADMIN`):** Gestión de Staff, búsqueda de usuarios y asignación de roles/permisos.

---

## ⚙️ Guía de Ejecución Local

### 1. Requisitos Previos
* Node.js v18+ y npm instalados.
* Acceso a la base de datos PostgreSQL de Supabase.

## 🌐 Despliegue en la Nube (Producción Oficial)

* **Aplicación Web (Frontend en Vercel):** [https://leveling-jump-system-vh7i.vercel.app/](https://leveling-jump-system-vh7i.vercel.app/)
* **API REST Backend (Render):** [https://leveling-jump-system.onrender.com/](https://leveling-jump-system.onrender.com/)
* **Base de Datos:** PostgreSQL en Supabase Cloud.

---

### 2. Configuración de Variables de Entorno (Opcional para desarrollo local)
Copia el archivo `.env.example` y renómbralo a `.env`:
```bash
cp .env.example .env
```
Configura tus credenciales de `DATABASE_URL` y `DIRECT_URL`.

### 3. Iniciar el Backend (Modo Local)
```bash
npm install
npm run dev
```

### 4. Iniciar el Frontend (Modo Local)
En otra terminal:
```bash
cd frontend
npm install
npm run dev
```

---

## 👥 Equipo de Proyecto (Scrum Team)

* **Brian** — Product Owner (Definición funcional y criterios de aceptación)
* **Renato** — Scrum Master (Gestión ágil y documentación de ceremonias)
* **Cesar Sanchez** — Desarrollador Backend & Database Modeler (Modelos relacionales, migraciones Prisma, integración)
* **Adriano** — Desarrollador Backend (APIs REST, controladores y lógica de negocio)
* **Zuriel** — Desarrollador Frontend / UI (Vistas React, formularios y catálogo interactivo)

---
*Curso: Proyecto Tecnológico — ISIL (Periodo 2026-2)*