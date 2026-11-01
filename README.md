# SmartFlow

Aplicación académica para modelar redes viales dirigidas y visualizar flujos de costo mínimo. Las simulaciones son ilustrativas: los costos son unidades abstractas por vehículo, no tiempos reales de viaje.

## Requisitos y ejecución

Node.js 22 LTS y npm. Con nvm instalado: `nvm install 22` y `nvm use 22`.

Desde la raíz:

```powershell
cd frontend
npm ci
npm run dev
```

Abrir la dirección que indique Vite (normalmente http://localhost:5173).

Comprueba `node --version` antes de instalar: debe comenzar con `v22.`. El archivo `frontend/.nvmrc` registra la versión mayor acordada. Instalar dependencias con otra versión puede producir un aviso `EBADENGINE`.

## Comprobaciones

Desde `frontend/`: `npm run build` genera `dist/`; `npm run lint` revisa el código. `npm run preview` sirve la compilación localmente.

`npm test` ejecuta las pruebas de componentes con Vitest y React Testing Library. `npm run test:watch` mantiene las pruebas en modo interactivo.

## Organización y colaboración

- `frontend/`: React 19, TypeScript 5, Vite y Tailwind CSS 4; responsabilidad de Persona 1.
- `backend/`: responsabilidad de Persona 2; todavía no está presente en esta rama.
- `shared/`: contrato y ejemplos coordinados entre ambas personas; no modificar unilateralmente.
- Rama de trabajo: `feature/frontend`. Integración mediante PR a `main`.

El backend acordado estará en `http://localhost:8000/api/v1`, con `GET /health` y `POST /optimize`. La documentación estará en `/docs`. El frontend no implementa el optimizador ni fabrica resultados.

## Plan de cinco días

1. Base del proyecto, pruebas, tema visual y grafo de referencia seleccionable.
2. Edición de nodos y vías, cierre de vías, validación y serialización.
3. Integración REST y manejo de resultados y errores.
4. Indicadores, gráficos y comparación de resultados guardados en memoria.
5. Animación ilustrativa, pruebas y revisión de accesibilidad.

Este README se actualizará conforme avance el proyecto.

## Estado actual: día 1

- Interfaz en español con menú lateral y distribución adaptable.
- Escenario de referencia tipado: nodos A, B y C; vías R1, R2 y R3.
- React Flow: arrastre de nodos, zoom, desplazamiento, flechas y etiquetas.
- Selección de tramos desde el lienzo o mediante botones del inspector.
- Inspector con dirección, costo y capacidad. Las posiciones cambian solo durante la sesión.
- No requiere backend para esta etapa. No hay resultados de optimización ni persistencia.

Los datos del contrato están en `frontend/src/features/network/referenceScenario.ts`. El lienzo aplica una escala visual horizontal para dar espacio a las etiquetas sin modificar esos datos.

### Verificación manual

1. Abrir la aplicación y verificar los tres nodos y tres vías.
2. Seleccionar R1, R2 y R3 desde el lienzo y la lista; comprobar sus propiedades.
3. Arrastrar un nodo y comprobar que sus conexiones lo siguen.
4. Probar zoom, ajuste de vista y navegación con teclado por los botones.
5. Revisar la distribución en una ventana estrecha.

### Dependencias

React Flow ya está instalado. Recharts se añadirá junto con los gráficos del día 4. La conexión REST y las validaciones del escenario se incorporarán en los días 2 y 3.

La auditoría inicial deja avisos moderados en la cadena de ESLint (herramientas de desarrollo); `npm audit --omit=dev` no detectó vulnerabilidades. Revisar las actualizaciones compatibles antes de integrar; no ejecutar `npm audit fix --force` sin revisar los cambios.

