# De estos archivos a un APK instalable en tu celular

## Qué tienes en tus manos
6 archivos que deben vivir juntos en UNA sola carpeta:
`index.html`, `app.js`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`

Es una app web completa e independiente: ya no depende de Claude.ai para nada.
Guarda tus datos directamente en tu teléfono (usando el almacenamiento del
navegador) y funciona sin internet una vez instalada.

## Lo único que se pierde frente a la versión de Claude.ai
El botón de "pedir consejo a Claude" en vivo no está aquí, porque esa función
solo existe dentro del entorno de Claude.ai (no se puede llamar gratis desde una
app fuera de ahí sin una API key de pago). Todo lo demás — capturar datos,
gráficas de tendencia, detección de patrones, resumen y exportar — funciona
igual. Para el análisis profundo, sigues usando tu Project de Claude: pegas ahí
el texto de la pestaña Exportar cuando quieras.

## Fase 1 — Publicar la app gratis en internet
Un APK necesita que tu app "viva" en una dirección web real para poder
empaquetarla. La forma gratuita y más simple es GitHub Pages:

1. Crea una cuenta gratuita en https://github.com si no tienes una.
2. Crea un repositorio nuevo (público), por ejemplo `agente-salud`.
3. Sube los 6 archivos a ese repositorio (botón "Add file" → "Upload files").
4. Ve a Settings → Pages, en "Source" elige la rama `main` y guarda.
5. En un par de minutos tendrás una URL como:
   `https://tu-usuario.github.io/agente-salud/`
   Ábrela y confirma que la app carga bien.

## Fase 2 — Convertir esa URL en un APK real
Tienes dos caminos, ambos gratis:

### Opción A — La más simple (recomendada)
1. Ve a https://www.pwabuilder.com
2. Pega tu URL de GitHub Pages y presiona "Start".
3. Cuando termine el análisis, ve a la pestaña "Android" y genera el paquete.
4. Descarga el archivo `.apk` que te entrega.

### Opción B — Con Claude Code (si prefieres hacerlo por terminal)
Abre Claude Code en la carpeta que quieras usar para esto y pégale este mensaje,
reemplazando la URL por la tuya:

> Quiero empaquetar una PWA como APK de Android para uso personal (no para
> Play Store), usando Bubblewrap (la herramienta oficial de Google). La URL de
> mi PWA ya publicada es: https://tu-usuario.github.io/agente-salud/
> Instala lo necesario (Node.js ya lo tengo, necesito Bubblewrap CLI y el JDK/
> Android SDK que pida), inicializa el proyecto con `bubblewrap init` apuntando
> a esa URL, y genera un APK firmado localmente que pueda instalar en mi
> teléfono Android. Ve explicándome cada paso antes de ejecutarlo.

Claude Code te guiará instalando lo que falte y generando el `.apk` en tu
propia máquina. Esta opción toma más tiempo la primera vez (puede descargar
varios GB de herramientas de Android), pero no depende de ningún sitio externo.

## Fase 3 — Instalar el APK en tu celular
1. Pasa el archivo `.apk` a tu teléfono (por cable, Google Drive, o lo que uses).
2. Al abrirlo, Android te pedirá permitir "instalar apps de orígenes
   desconocidos" — actívalo solo para esa instalación.
3. Instala. Te va a quedar un ícono en tu pantalla de inicio como cualquier app.
4. Es posible que Android o Play Protect te muestre una advertencia por no venir
   de la Play Store — es normal para apps instaladas así, tú decides si confías
   en el archivo (lo generaste tú mismo, así que está bien continuar).

## Nota sobre tus datos
Como esta versión guarda todo en el almacenamiento del navegador de tu
teléfono, si desinstalas la app o borras datos del navegador, pierdes el
historial guardado ahí. Por eso vale la pena exportar de vez en cuando hacia tu
Project de Claude, que queda como respaldo de tu historial completo.
