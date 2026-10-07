import { HandLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm';

const socket = io();
const canvas = document.querySelector('#paint');
const ctx = canvas.getContext('2d');
const video = document.querySelector('#webcam');
const startBtn = document.querySelector('#startCamera');
const clearBtn = document.querySelector('#clear');
const color = document.querySelector('#color');
const width = document.querySelector('#width');
const widthValue = document.querySelector('#widthValue');
const users = document.querySelector('#users');
const connection = document.querySelector('#connection');
const socketDot = document.querySelector('#socketDot');
const handStatus = document.querySelector('#handStatus');
const message = document.querySelector('#cameraMessage');
const cursor = document.querySelector('#cursor');

let history = [];
let handLandmarker = null;
let running = false;
let lastVideoTime = -1;
let lastPoint = null;
let smoothPoint = null;

function resizeCanvas(){
  const r=canvas.getBoundingClientRect(), dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(r.width*dpr); canvas.height=Math.round(r.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0); redraw();
}
function draw(s){
  const r=canvas.getBoundingClientRect();
  ctx.beginPath(); ctx.moveTo(s.x0*r.width,s.y0*r.height); ctx.lineTo(s.x1*r.width,s.y1*r.height);
  ctx.strokeStyle=s.color; ctx.lineWidth=s.width; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke();
}
function redraw(){ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight); history.forEach(draw)}
function addStroke(s,send=false){history.push(s);draw(s);if(send)socket.emit('stroke',s)}

socket.on('connect',()=>{connection.textContent='En línea';socketDot.classList.add('on')});
socket.on('disconnect',()=>{connection.textContent='Desconectado';socketDot.classList.remove('on')});
socket.on('users',n=>users.textContent=n);
socket.on('canvas-state',items=>{history=items;redraw()});
socket.on('stroke',s=>addStroke(s));
socket.on('clear-canvas',()=>{history=[];redraw()});
clearBtn.addEventListener('click',()=>{if(confirm('¿Borrar el lienzo compartido para todos?'))socket.emit('clear-canvas')});
width.addEventListener('input',()=>widthValue.textContent=width.value);
new ResizeObserver(resizeCanvas).observe(canvas.parentElement);

async function initHands(){
  if(handLandmarker)return;
  message.textContent='Cargando detector de manos…';
  const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
  handLandmarker=await HandLandmarker.createFromOptions(vision,{
    baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},
    runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55
  });
}

function fingerUp(lm,tip,pip){return lm[tip].y < lm[pip].y - .025}
function processHand(result){
  if(!result.landmarks?.length){handStatus.textContent='No veo una mano';lastPoint=null;smoothPoint=null;cursor.hidden=true;return}
  const lm=result.landmarks[0];
  const indexUp=fingerUp(lm,8,6), middleUp=fingerUp(lm,12,10);
  const x=1-lm[8].x, y=lm[8].y;
  smoothPoint=smoothPoint?{x:smoothPoint.x*.55+x*.45,y:smoothPoint.y*.55+y*.45}:{x,y};
  cursor.hidden=false;cursor.style.left=`${smoothPoint.x*100}%`;cursor.style.top=`${smoothPoint.y*100}%`;cursor.style.borderColor=color.value;
  const drawing=indexUp&&!middleUp;
  handStatus.textContent=drawing?'Dibujando ☝️':indexUp&&middleUp?'Cursor ✌️':'Mano detectada';
  if(drawing&&lastPoint){addStroke({x0:lastPoint.x,y0:lastPoint.y,x1:smoothPoint.x,y1:smoothPoint.y,color:color.value,width:Number(width.value)},true)}
  lastPoint=drawing?smoothPoint:null;
}

async function loop(){
  if(!running)return;
  if(video.readyState>=2&&video.currentTime!==lastVideoTime){
    lastVideoTime=video.currentTime;
    try{processHand(handLandmarker.detectForVideo(video,performance.now()))}catch(e){console.error(e)}
  }
  requestAnimationFrame(loop);
}

startBtn.addEventListener('click', async () => {
  try {
    startBtn.disabled = true;
    handStatus.textContent = 'Iniciando cámara…';
    message.textContent = 'Solicitando acceso a la cámara…';

    // Comprobaciones del navegador
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Este navegador no soporta acceso a cámara.');
    }

    // Si quedó algún stream anterior, detenerlo
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }

    // Abrir primero la cámara
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    console.log('Cámara obtenida correctamente:', stream);

    video.srcObject = stream;

    await new Promise(resolve => {
      video.onloadedmetadata = resolve;
    });

    await video.play();

    console.log(
      'Cámara activa:',
      stream.getVideoTracks()[0]?.label
    );

    handStatus.textContent = 'Cámara activa. Cargando detector…';
    message.textContent = 'Cámara iniciada correctamente.';

    // Inicializamos MediaPipe DESPUÉS de comprobar la cámara
    await initHands();

    running = true;
    lastVideoTime = -1;

    startBtn.textContent = 'Cámara activa';
    handStatus.textContent = 'Buscando mano…';

    message.textContent =
      'Tu video no se envía al servidor; solo se comparten los trazos.';

    loop();

  } catch (err) {

    console.error('ERROR DE CÁMARA:', err);
    console.error('Nombre:', err.name);
    console.error('Mensaje:', err.message);

    startBtn.disabled = false;
    startBtn.textContent = 'Reintentar cámara';

    handStatus.textContent = 'Error de cámara';

    if (err.name === 'NotAllowedError') {

      message.textContent =
        'Chrome no tiene permiso para usar la cámara. Permite el acceso y vuelve a intentarlo.';

    } else if (err.name === 'NotFoundError') {

      message.textContent =
        'No se encontró ninguna cámara conectada.';

    } else if (err.name === 'NotReadableError') {

      message.textContent =
        'La cámara está ocupada. Cierra otras aplicaciones que puedan estar utilizándola y pulsa Reintentar cámara.';

    } else if (err.name === 'OverconstrainedError') {

      message.textContent =
        'La cámara no admite la configuración solicitada.';

    } else {

      message.textContent =
        `Error: ${err.name || 'desconocido'} — ${err.message}`;
    }
  }
});