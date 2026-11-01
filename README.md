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

## Estado actual: rediseño de las tres vistas

- Interfaz en español con cabecera horizontal, sin menú lateral, y distribución adaptable.
- Escenario de referencia tipado: nodos A, B y C; vías R1, R2 y R3.
- React Flow: arrastre de nodos, zoom, desplazamiento, flechas y etiquetas.
- Selección de tramos desde el lienzo o mediante botones del inspector.
- Inspector contextual de nodos y vías; formularios con guardado en memoria.
- Editor: agregar nodos, conectar puntos de salida y entrada, crear vías desde formulario, mover nodos, cambiar balances/capacidad/costo y cerrar vías.
- Eliminación con confirmación; eliminar un nodo elimina también sus conexiones. Restablecer requiere confirmación.
- Dos escenarios independientes: base y cierre de R1. Selector superior y vista de comparación.
- Gráficos Recharts de flujo, utilización, costo y capacidad efectiva; nunca se inventan series de tiempo.
- Resultados invalidados al modificar el escenario. Al recargar se pierde la sesión; no se simula persistencia.

Los datos del contrato están en `frontend/src/features/network/referenceScenario.ts`. El lienzo transforma coordenadas únicamente para dar espacio a las etiquetas e invierte esa transformación al guardar posiciones. El fondo vectorial es decorativo y no tiene escala geográfica.

### Backend y demostración

El botón **Optimizar red** llama a `POST /api/v1/optimize` con fetch nativo. La URL predeterminada es `http://localhost:8000/api/v1`. Para cambiarla, copiar `frontend/.env.example` a `frontend/.env.local` y ajustar `VITE_API_URL`. Reiniciar Vite después de cambiar el entorno.

El backend debe permitir CORS desde el origen del frontend (normalmente `http://localhost:5173` o `http://127.0.0.1:5173`). No se han modificado el backend ni los contratos compartidos.

Se manejan resultados óptimos, infactibles, HTTP 422/500, errores de conexión y respuestas inconsistentes. La validación local de estructura no garantiza que exista un flujo factible.

**Cargar demostración** restablece ambas redes y carga ejemplos estáticos explícitamente etiquetados: base con costo 500, flujos R1=100/R2=100/R3=0; cierre de R1 infactible porque R3 solo permite 50 vehículos frente a una oferta de 100. Estos ejemplos no se presentan como respuestas del servidor.

Los porcentajes de costo se muestran solo entre resultados óptimos del mismo origen (demo o API) con nodos y balances iguales y costo base no nulo. La utilización media excluye vías con capacidad efectiva cero. No se infieren tiempos reales ni reducciones de congestión.

### Componentes

- `components/Header`, `Metrics`, `Inspector`, `Icon` y `MapBackdrop`: interfaz compartida.
- `features/network/NetworkCanvas` y `validation`: interacción y validación estructural.
- `features/scenarios/useWorkspace`: escenarios, selección, invalidación y llamadas cancelables.
- `features/scenarios/Comparison` y `features/results/Analysis`: comparación y gráficos.
- `services/api`: contrato REST; `types/results`: tipos de respuestas sin cambiar el contrato de red.

### Verificación manual

1. Abrir la aplicación y verificar los tres nodos y tres vías.
2. Seleccionar R1, R2 y R3 desde el lienzo y la lista; comprobar sus propiedades.
3. Arrastrar un nodo y comprobar que sus conexiones lo siguen.
4. Probar zoom, ajuste de vista y navegación con teclado por los botones.
5. Revisar la distribución en una ventana estrecha.

### Dependencias

React Flow y Recharts están instalados. No se añadió una librería de estado ni de peticiones. El cálculo real y la persistencia definitiva dependen del backend. La API mínima no proporciona historia temporal ni convergencia, por lo que no se representan como datos calculados.

La auditoría inicial deja avisos moderados en la cadena de ESLint (herramientas de desarrollo); `npm audit --omit=dev` no detectó vulnerabilidades. Revisar las actualizaciones compatibles antes de integrar; no ejecutar `npm audit fix --force` sin revisar los cambios.

