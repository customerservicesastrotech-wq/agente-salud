# Mi día · Bitácora de bienestar

Aplicación web progresiva para narrar y conservar el día en tres momentos: mañana, tarde y noche. Cada fase se guarda de inmediato; el contexto y los archivos finales se crean únicamente al pulsar **Consolidar mi día**.

## Experiencia incluida

- Pistas visuales breves en lugar de preguntas o formularios.
- Voz con `MediaRecorder` y transcripción segura desde el servidor cuando hay una clave configurada.
- Dictado del navegador como respaldo y entrada escrita siempre disponible.
- Borradores y fases en IndexedDB, incluso después de cerrar o recargar.
- Transcripción original separada de la versión corregida.
- Detección local de cifras con evidencia exacta, confirmación o descarte antes de exportar.
- Distinción entre fase de captura y periodo del evento; por ejemplo, el sueño contado en la mañana pertenece a la noche anterior.
- Consolidación en capas: hechos, cálculos reproducibles, patrones, hipótesis, contradicciones y datos no informados.
- Historial, tendencias, respaldo JSON, contexto TXT y Excel XLSX de 11 hojas.
- Sin audio persistente, sin clave en el navegador y sin caché de respuestas de `/api`.

## Ejecutar la aplicación

Requiere Node.js 20 o posterior.

```powershell
npm start
```

Luego abre `http://localhost:4173`.

Sin una clave de API, la app funciona en modo local: texto, almacenamiento, reglas verificables, consolidación y exportaciones. El micrófono puede usar el dictado integrado si el navegador lo ofrece.

## Activar voz y análisis avanzados

1. Copia `.env.example` a `.env`.
2. Agrega `OPENAI_API_KEY` en `.env`. La clave permanece en el servidor.
3. Opcionalmente cambia los modelos configurados.
4. Reinicia `npm start`.

Consulta [BACKEND.md](BACKEND.md) para la configuración, límites y contrato de los endpoints.

## Archivos

- `index.html`: interfaz, pistas visuales y diseño responsivo.
- `app.js`: fases, voz, IndexedDB, trazabilidad, consolidación, historial y exportaciones.
- `server.js`: servidor local, transcripción y análisis estructurado.
- `manifest.json` y `sw.js`: instalación PWA y funcionamiento local sin cachear información sensible.
- `.env.example`: variables de entorno de ejemplo; nunca contiene una clave real.

## Alcance

La aplicación organiza registros de bienestar. No diagnostica, no prescribe y no infiere escalas clínicas desde el relato. Un dato no mencionado queda vacío, nunca se convierte en cero. Conserva respaldos JSON periódicos porque borrar los datos del sitio también elimina IndexedDB.
