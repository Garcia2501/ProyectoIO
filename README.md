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

## Estado actual: laboratorio y experiencia urbana

- Interfaz en español con cabecera horizontal, sin menú lateral, y distribución adaptable.
- Escenario de referencia tipado: nodos A, B y C; vías R1, R2 y R3.
- React Flow: arrastre de nodos, zoom, desplazamiento, flechas y etiquetas.
- Selección de tramos desde el lienzo o mediante botones del inspector.
- Inspector contextual de nodos y vías; formularios con guardado en memoria.
- Editor: agregar nodos, conectar puntos de salida y entrada, crear vías desde formulario, mover nodos, cambiar balances/capacidad/costo y cerrar vías.
- Eliminación con confirmación; eliminar un nodo elimina también sus conexiones. Restablecer requiere confirmación.
- Dos escenarios independientes: base y cierre de R1. Selector superior y vista de comparación.
- Gráficos Recharts de flujo, utilización, costo y capacidad efectiva; nunca se inventan series de tiempo.
- Resultados invalidados al modificar el modelo. Mover nodos solo cambia coordenadas visuales y conserva el resultado. Al recargar se pierde la sesión; no se simula persistencia.
- Navegación superior con cinco destinos funcionales: Laboratorio, Comparar, Editar red, Simulación y Resultados. Las flechas y Home/End permiten recorrer los accesos.
- Estilo compartido en `premium.css`: vidrio claro, acentos menta/azul y paneles flotantes. Motion anima la entrada de vistas, el indicador de navegación y la expansión del inspector.
- Vista matemática y vista urbana comparten escenario, selección y resultado. El laboratorio conserva la representación SVG; Simulación incorpora una ciudad 3D generada desde la misma red, sin crear otro modelo de optimización.
- Vehículos animados según el flujo positivo devuelto por la API o la demostración identificada; cero vehículos si no existe resultado óptimo o la vía está cerrada. Cada tramo usa una muestra de hasta 12 símbolos, proporcional al flujo respecto al tramo de mayor flujo; no son vehículos físicos individuales.
- Reproducción, pausa, velocidades 0,5×/1×/2×, zoom, centrado, desplazamiento y selección por teclado en la ciudad. Velocidad de reproducción no equivale a velocidad vial.
- Movimiento reducido: vehículos estáticos y reproducción automática deshabilitada; se reducen las transiciones y se desactiva el resaltado animado de vías.
- Resultados muestra detalle por tramo y permite exportar escenario, resultado y origen (API/demo) en un archivo JSON local.

Los datos del contrato están en `frontend/src/features/network/referenceScenario.ts`. El lienzo transforma coordenadas únicamente para dar espacio a las etiquetas e invierte esa transformación al guardar posiciones. El fondo vectorial es decorativo y no tiene escala geográfica.

### Backend y demostración

La validación local exige dos nodos y admite una lista de vías vacía, dejando que el backend determine su factibilidad. Balance, capacidad y costo se aceptan solo como enteros representables exactamente por JavaScript; todavía deben respetar los límites definitivos que establezca el backend. No se fijan aquí límites arbitrarios del solver.

El cliente rechaza resultados con enteros fuera de precisión, capacidad distinta de la efectiva, vías fuera del orden solicitado, cuerpos JSON inválidos o una respuesta infactible con vías. Comprueba costo y conservación con aritmética entera exacta (`BigInt`) sin implementar otro optimizador. Cambiar de escenario cancela la petición pendiente y descarta su resultado tardío.

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
- `features/simulation/urbanGeometry` y `UrbanCanvas`: proyección SVG, ciudad decorativa y vehículos. Las animaciones se gestionan con CSS/Web Animations, sin renderizar React en cada cuadro.
- `features/results/ResultsView`: detalle de resultados y exportación JSON.

### Verificación manual

1. Abrir la aplicación y verificar los tres nodos y tres vías.
2. Seleccionar R1, R2 y R3 desde el lienzo y la lista; comprobar sus propiedades.
3. Arrastrar un nodo y comprobar que sus conexiones lo siguen.
4. Probar zoom, ajuste de vista y navegación con teclado por los botones.
5. Revisar la distribución en una ventana estrecha.

Antes de integrar el frontend a main: ejecutar build, lint y pruebas; repetir contra el backend corregido los casos base, cierre factible, cierre infactible, capacidad cero, errores 422 y límites numéricos. La revisión inicial de la API detectó correcciones pendientes en el PR del backend; no se considera aprobada la integración final hasta verificarlas.

### Dependencias

React Flow, Recharts y Motion para React están instalados, junto con Three.js 0.180, React Three Fiber 9 y Drei 10 (compatibles con React 19). No se añadió una librería de estado ni de peticiones. El cálculo real y la persistencia definitiva dependen del backend. La API mínima no proporciona historia temporal ni convergencia, por lo que no se representan como datos calculados.

La auditoría inicial deja avisos moderados en la cadena de ESLint (herramientas de desarrollo); `npm audit --omit=dev` no detectó vulnerabilidades. Revisar las actualizaciones compatibles antes de integrar; no ejecutar `npm audit fix --force` sin revisar los cambios.


## Centro de simulación 3D

Abrir **Simulación** en la navegación superior. Requiere un navegador con WebGL 2; si no se puede crear o se pierde el contexto gráfico, se conserva una representación SVG interactiva claramente identificada. La escena se carga de forma diferida: Three.js y sus componentes gráficos no se necesitan para abrir el laboratorio matemático.

- Ciudad tridimensional esquemática: carreteras y curvas derivadas de los nodos y vías existentes, intersecciones, carriles, pasos peatonales, aceras, edificios, vegetación y luminarias. No es cartografía ni una reconstrucción física de una ciudad.
- Vehículos 3D variados, marcas y flechas sobre las vías con flujo positivo. Las instancias se reutilizan; no se crean objetos ni se actualiza estado React en cada frame de circulación. El reparto visual es proporcional al flujo por tramo y está limitado por calidad y longitud disponible. Los símbolos de distintos tramos no representan vehículos únicos que atraviesan toda la red.
- Reproducción, pausa/reanudación, reinicio, búsqueda mediante progreso y velocidades 0,5×/1×/2×/4×. El ciclo dura **120 segundos visuales** y se detiene al finalizar. No es tiempo de viaje ni duración calculada de un experimento físico.
- Cinco cámaras: isométrica, aérea, intersección, corredor y ciudad completa; zoom y cámara inicial. Corredor acompaña la vía seleccionada según el reloj visual. Arrastrar la cámara detiene el seguimiento automático hasta volver a elegir una perspectiva o enfocar. En movimiento reducido se desactiva el seguimiento y la reproducción automática; se pueden consultar imágenes fijas con el progreso.
- Inspector de vías con propiedades, flujo e impacto. La selección se conserva al cambiar entre laboratorio y simulación. Las diferencias solo se muestran entre soluciones óptimas del mismo origen y con los mismos balances; se comprueban origen/destino de la vía. No se atribuye causalidad a una modificación aislada cuando se comparan escenarios diferentes.
- **Cerrar vía y optimizar** actualiza `enabled` en memoria, invalida la solución anterior y envía exactamente la red modificada al endpoint existente. No se inventa una redistribución si FastAPI no responde. Una solución infactible mantiene la ciudad y deja de mostrar vehículos.
- Capa de utilización con leyenda textual y umbrales editables ordenados (60/80/95 % inicialmente). Verde, amarillo, naranja y rojo representan utilización de capacidad; gris representa cierre. Azul indica que aún no existe utilización calculada. No se etiquetan como niveles medidos de congestión.
- Comparación con dos ciudades, reloj compartido y sincronización de cámara al arrastrar o usar zoom. Incluye alternativas de vista matemática, tablas por carretera, costo absoluto y relativo, utilización media, vías saturadas y gráficos de capacidades y flujos.
- **Modo presentación** amplía la ciudad y activa el atardecer. Permite ocultar paneles y recorrer las cámaras; Escape sale. El foco de teclado permanece en la presentación. Los paneles pueden recuperarse en pantallas pequeñas.

### Demostración metropolitana opcional

En el panel de Simulación, **Explorar red metropolitana DEMO** carga dos escenarios de 36 nodos y 60 vías. Sustituye las redes de la sesión actual; los cambios siguen siendo temporales. **Cargar demostración** recupera los dos ejemplos A–B–C anteriores.

Son datos estáticos docentes, siempre identificados como DEMO, con oferta de 120, costo unitario 1 y capacidad de 100 por vía habilitada. El escenario alternativo cierra M3. Ambos ejemplos tienen costo 1200 y se comprueban automáticamente mediante conservación en cada nodo, límites de capacidad y validación del cliente REST. Cada recorrido entre origen y destino tiene diez arcos; las asignaciones de ejemplo son factibles y alcanzan ese costo mínimo. Esta plantilla no ejecuta un solver en el navegador ni estima mejoras de tráfico.

### Calidad y rendimiento

| Calidad | Máximo de edificios | Máximo de árboles | Presupuesto de vehículos | DPR máximo | Sombras |
| --- | ---: | ---: | ---: | ---: | --- |
| Baja | 65 | 45 | 48 | 1 | Desactivadas |
| Media | 145 | 95 | 120 | 1,3 | 1024 |
| Alta | 240 | 160 | 240 | 1,75 | 2048 |

Son límites; la reserva de espacio vial y el reparto por tramos pueden reducir los conteos efectivos. Las superficies de las vías se agrupan en geometrías compartidas manteniendo la selección por triángulo. Edificios, ventanas, árboles, vehículos, señalización e intersecciones utilizan instancias. Se reutilizan geometrías, materiales y matrices.

El panel registra FPS, llamadas de dibujo y cantidades efectivas durante la sesión, una vez por segundo. No se garantiza un rendimiento universal: depende de GPU, resolución, navegador y red. La comparación utiliza calidad baja en ambas ciudades para limitar el costo de dos contextos gráficos. El paquete 3D es mayor que los componentes de interfaz y se descarga solo al abrir una ciudad.

### Componentes 3D e integración pendiente

- `simulation3d/cityModel`: adaptador visual de Scenario/StoredResult, trayectorias, reserva vial y presupuestos.
- `CityScene`, `CityInfrastructure`, `RoadNetwork` y `CityVehicles`: escena, ciudad, selección e instancias.
- `SceneCamera`, `CameraBus` y `visualClock`: cámaras, sincronización y reloj independiente de React.
- `MegaSimulation`, `RoadInspector`, `PlaybackControls` y `CityViewport`: experiencia, formularios de consulta, controles y recuperación SVG.
- `metropolitanDemo`: ejemplos docentes aislados del cliente y del optimizador.
- `mega.css`: identidad visual y adaptación de las nuevas experiencias.

La API actual proporciona una solución estática por solicitud. No aporta historia temporal, tiempos de viaje, emisiones, ciclos semafóricos, geometría geográfica ni simulación física de tráfico; esas métricas y acciones no se muestran como resultados. La persistencia definitiva y la ejecución auténtica de OR-Tools siguen dependiendo del backend. No se han modificado sus archivos ni los contratos compartidos.
