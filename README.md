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
│   ├── controllers/      # Controladores de productos y lotes
│   ├── routes/           # Rutas API (/api/productos, /api/lotes)
│   └── index.js          # Punto de entrada del servidor
├── .env.example          # Plantilla segura de variables de entorno
└── README.md             # Documentación oficial del proyecto
```

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