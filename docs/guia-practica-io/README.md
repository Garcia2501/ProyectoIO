# Documentación — Informe de Guía Práctica (SmartFlow)

Documentación del proyecto SmartFlow en formato **LaTeX**, adaptado al informe de
guía práctica de la UTA. Contiene la memoria de Investigación Operativa
(flujo de costo mínimo) y un manual de usuario.

## Estructura

```text
docs/guia-practica-io/
├── informe.tex        # Documento principal (adaptado del formato UTA)
├── referencias.bib    # Referencias bibliográficas
├── README.md          # Este archivo
└── imagenes/          # Logos y capturas
    ├── uta.png
    ├── fisei.png
    └── capturas/      # (crear) capturas de pantalla del sistema
```

## Compilación

Requiere una distribución LaTeX (por ejemplo, TeX Live o MiKTeX).

```powershell
cd docs/guia-practica-io
pdflatex informe.tex
bibtex informe
pdflatex informe.tex
pdflatex informe.tex
```

## Colaboración

Cada persona documenta la parte que le corresponde y envía los cambios mediante
una rama corta y un pull request:

| Persona | Secciones a cargo |
|---------|-------------------|
| Kevin (backend)  | Modelo de IO, optimizador, API y resultados |
| Manolo (GIS)     | Origen y estructura de los datos geográficos |
| Juan (frontend)  | Manual de usuario y capturas de la interfaz |

## Convenciones

- Escribir en español.
- Los valores numéricos de resultados deben contrastarse con la versión final
  del sistema antes de la entrega.
- Añadir capturas en `imagenes/capturas/` e incluirlas con
  `\includegraphics{imagenes/capturas/...}` (o la ruta relativa adecuada).
