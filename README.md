# Air Paint — prototipo colaborativo

Aplicación web para Google Chrome: cada participante usa su propia webcam para controlar un pincel con el dedo índice y todos dibujan sobre el mismo lienzo mediante Socket.IO.

## Ejecutar localmente
1. Instala Node.js 18 o superior.
2. En esta carpeta ejecuta `npm install`.
3. Ejecuta `npm start`.
4. Abre `http://localhost:3000` en Google Chrome.
5. Pulsa **Activar cámara** y concede permiso.

## Gestos
- Índice levantado, medio recogido: dibujar.
- Índice + medio levantados: mover el cursor sin dibujar.

## Varios usuarios
Para usuarios en computadores diferentes, despliega este proyecto en un servicio Node.js con HTTPS. Todos deben abrir la misma URL. El servidor conserva el lienzo en memoria mientras esté encendido.

## Qué se comparte
La webcam se procesa localmente con MediaPipe. El servidor recibe únicamente segmentos de dibujo normalizados (coordenadas, color y grosor), no video.
