const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const host = '0.0.0.0';

const startedAt = new Date();
const status = {
    connected: false,
    running: false,
    serverHost: null,
    serverPort: null,
    username: null,
    lastEvent: 'starting',
    lastEventAt: new Date().toISOString(),
    reconnects: 0
};

const controls = {
    onStart: () => {},
    onStop: () => {},
    onRejoin: () => {}
};

function setStatus(patch) {
    Object.assign(status, patch, { lastEventAt: new Date().toISOString() });
}

function setControls(c) {
    Object.assign(controls, c);
}

app.use(express.json());

app.get('/status', (req, res) => {
    res.json({
        ...status,
        uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
        startedAt: startedAt.toISOString()
    });
});

app.post('/control/start', (req, res) => {
    controls.onStart();
    res.json({ ok: true, action: 'start' });
});

app.post('/control/stop', (req, res) => {
    controls.onStop();
    res.json({ ok: true, action: 'stop' });
});

app.post('/control/rejoin', (req, res) => {
    controls.onRejoin();
    res.json({ ok: true, action: 'rejoin' });
});

app.get('/', (req, res) => {
    const uptime = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    const uptimeStr = `${h}h ${m}m ${s}s`;
    const dotColor = status.connected ? '#22c55e' : (status.running ? '#f59e0b' : '#ef4444');
    const stateText = status.connected ? 'Connected' : (status.running ? 'Connecting...' : 'Stopped');

    res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AFK Bot Status</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(circle at top, #1f2937, #0f172a 60%);
    color: #e5e7eb; display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .card {
    background: rgba(17, 24, 39, 0.85); border: 1px solid #374151;
    border-radius: 16px; padding: 28px 32px; max-width: 460px; width: 100%;
    box-shadow: 0 10px 40px rgba(0,0,0,0.4);
  }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .sub { color: #9ca3af; font-size: 13px; margin-bottom: 20px; }
  .state { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 600; margin-bottom: 18px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: ${dotColor}; box-shadow: 0 0 12px ${dotColor}; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #1f2937; font-size: 14px; }
  .row:first-of-type { border-top: none; }
  .key { color: #9ca3af; }
  .val { color: #f3f4f6; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; text-align: right; word-break: break-all; }
  .actions { display: flex; gap: 8px; margin-top: 18px; }
  .btn {
    flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid #374151;
    background: #111827; color: #e5e7eb; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: transform .05s, background .15s, border-color .15s;
  }
  .btn:hover { background: #1f2937; }
  .btn:active { transform: translateY(1px); }
  .btn.start { border-color: #16a34a; color: #4ade80; }
  .btn.stop { border-color: #dc2626; color: #f87171; }
  .btn.rejoin { border-color: #2563eb; color: #60a5fa; }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .footer { margin-top: 14px; font-size: 12px; color: #6b7280; text-align: center; }
  #toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #111827; border: 1px solid #374151; padding: 8px 14px; border-radius: 8px;
    font-size: 13px; opacity: 0; transition: opacity .2s; pointer-events: none; }
  #toast.show { opacity: 1; }
</style>
</head>
<body>
  <div class="card">
    <h1>AFK Bot</h1>
    <div class="sub">Live status</div>
    <div class="state"><span class="dot"></span><span id="state-text">${stateText}</span></div>
    <div class="row"><span class="key">Server</span><span class="val" id="r-server">${status.serverHost ?? '-'}:${status.serverPort ?? '-'}</span></div>
    <div class="row"><span class="key">Username</span><span class="val" id="r-user">${status.username ?? '-'}</span></div>
    <div class="row"><span class="key">Last event</span><span class="val" id="r-event">${status.lastEvent}</span></div>
    <div class="row"><span class="key">Last event at</span><span class="val" id="r-eventat">${status.lastEventAt}</span></div>
    <div class="row"><span class="key">Reconnects</span><span class="val" id="r-rec">${status.reconnects}</span></div>
    <div class="row"><span class="key">Uptime</span><span class="val" id="r-up">${uptimeStr}</span></div>
    <div class="actions">
      <button class="btn start" id="btn-start">Start</button>
      <button class="btn stop" id="btn-stop">Stop</button>
      <button class="btn rejoin" id="btn-rejoin">Rejoin</button>
    </div>
    <div class="footer">JSON: <code>/status</code></div>
  </div>
  <div id="toast"></div>
<script>
function fmtUptime(sec){var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h+'h '+m+'m '+s+'s';}
function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},1500);}
async function refresh(){
  try{
    var r=await fetch('/status',{cache:'no-store'});var d=await r.json();
    document.getElementById('r-server').textContent=(d.serverHost||'-')+':'+(d.serverPort||'-');
    document.getElementById('r-user').textContent=d.username||'-';
    document.getElementById('r-event').textContent=d.lastEvent;
    document.getElementById('r-eventat').textContent=d.lastEventAt;
    document.getElementById('r-rec').textContent=d.reconnects;
    document.getElementById('r-up').textContent=fmtUptime(d.uptimeSeconds);
    var dot=document.querySelector('.dot');var txt=document.getElementById('state-text');
    var color=d.connected?'#22c55e':(d.running?'#f59e0b':'#ef4444');
    var label=d.connected?'Connected':(d.running?'Connecting...':'Stopped');
    dot.style.background=color;dot.style.boxShadow='0 0 12px '+color;txt.textContent=label;
    document.getElementById('btn-start').disabled=d.running;
    document.getElementById('btn-stop').disabled=!d.running;
  }catch(e){}
}
async function ctl(action,label){
  try{await fetch('/control/'+action,{method:'POST'});toast(label);refresh();}catch(e){toast('Error');}
}
document.getElementById('btn-start').addEventListener('click',function(){ctl('start','Starting...');});
document.getElementById('btn-stop').addEventListener('click',function(){ctl('stop','Stopping...');});
document.getElementById('btn-rejoin').addEventListener('click',function(){ctl('rejoin','Rejoining...');});
setInterval(refresh,3000);refresh();
</script>
</body>
</html>`);
});

app.listen(port, host, () => console.log(`Afk bot status page on http://${host}:${port}`));

module.exports = { app, setStatus, setControls, status };
