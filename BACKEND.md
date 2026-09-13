# Servidor privado opcional

La aplicación funciona de forma local sin una clave. El servidor añade transcripción de audio y análisis estructurado, manteniendo la clave fuera del navegador.

## Puesta en marcha

Requiere Node.js 20 o posterior. En PowerShell, desde esta carpeta:

```powershell
$env:OPENAI_API_KEY = "tu-clave"
npm start
```

Luego abre `http://127.0.0.1:4173`. También puedes copiar `.env.example` como `.env`, reemplazar la clave de ejemplo y reiniciar el servidor. Para cambiar los modelos, define `OPENAI_TRANSCRIBE_MODEL` o `OPENAI_ANALYSIS_MODEL`; una variable del sistema tiene prioridad sobre `.env`.

## Rutas para la aplicación

- `GET /api/config`: indica si la IA está configurada y qué formatos de audio acepta.
- `POST /api/transcribe`: recibe el archivo de audio como cuerpo binario y el tipo real en `Content-Type` (por ejemplo, `audio/webm`).
- `POST /api/analyze`: recibe `{ "day": { ... } }` en JSON y devuelve `{ analysis, engine, model }`.

## Controles de privacidad y exactitud

- La clave se lee únicamente de `OPENAI_API_KEY` en el proceso del servidor.
- Las rutas de API llevan `Cache-Control: no-store`; el servidor no registra relatos ni cuerpos de solicitudes.
- La llamada a Responses usa `store: false` y Structured Outputs con un esquema estricto.
- Antes de devolver el resultado, el servidor elimina hechos cuya cita no aparece en los relatos y recalcula por código toda métrica derivada desde identificadores confirmados.
- No se agregan métricas sensibles como peso, presión, glucosa, temperatura, frecuencia cardiaca, energía, ánimo, estrés, síntomas o dolor.
- El audio solo se mantiene en memoria durante la solicitud y no se guarda en disco.
- El servidor escucha en `127.0.0.1` de forma predeterminada, valida el origen, limita tamaños y aplica límites de frecuencia.

La transcripción usa el endpoint oficial `v1/audio/transcriptions` y el análisis usa `v1/responses`: [documentación de GPT Transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe) y [referencia de Responses](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

Esta herramienta es una bitácora de bienestar general; no produce diagnósticos ni reemplaza atención profesional.
