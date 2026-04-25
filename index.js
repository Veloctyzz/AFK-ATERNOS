const mineflayer = require('mineflayer')
const fs = require('fs');
const { setStatus, setControls } = require('./keep_alive');

let rawdata = fs.readFileSync('config.json');
let data = JSON.parse(rawdata);
var lasttime = -1;
var moving = 0;
var connected = 0;
var actions = ['forward', 'back', 'left', 'right'];
var lastaction;
var pi = 3.14159;
var moveinterval = 2;
var maxrandom = 5;
var host = data["ip"];
var port = data["port"] ? parseInt(data["port"], 10) : 25565;
var username = data["name"];

var reconnectDelayMs = 5000;
var reconnectCount = 0;
var reconnectTimer = null;
var currentBot = null;
var running = false;

setStatus({
    serverHost: host,
    serverPort: port,
    username: username,
    lastEvent: 'idle',
    running: false
});

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

function startBot() {
    if (currentBot) return;
    running = true;
    console.log('Connecting to ' + host + ':' + port + ' as ' + username + '...');
    setStatus({ connected: false, running: true, lastEvent: 'connecting' });

    const bot = mineflayer.createBot({
        host: host,
        port: port,
        username: username
    });
    currentBot = bot;

    connected = 0;
    lasttime = -1;
    moving = 0;

    bot.on('login', function () {
        console.log("Logged In");
        setStatus({ lastEvent: 'logged_in' });
    });

    bot.on('time', function () {
        if (connected < 1) return;
        if (lasttime < 0) {
            lasttime = bot.time.age;
        } else {
            var randomadd = Math.random() * maxrandom * 20;
            var interval = moveinterval * 20 + randomadd;
            if (bot.time.age - lasttime > interval) {
                if (moving == 1) {
                    bot.setControlState(lastaction, false);
                    moving = 0;
                    lasttime = bot.time.age;
                } else {
                    var yaw = Math.random() * pi - (0.5 * pi);
                    var pitch = Math.random() * pi - (0.5 * pi);
                    bot.look(yaw, pitch, false);
                    lastaction = actions[Math.floor(Math.random() * actions.length)];
                    bot.setControlState(lastaction, true);
                    moving = 1;
                    lasttime = bot.time.age;
                    bot.activateItem();
                }
            }
        }
    });

    bot.on('spawn', function () {
        connected = 1;
        console.log('Bot spawned in the world');
        setStatus({ connected: true, lastEvent: 'spawned' });
    });

    bot.on('error', function (err) {
        var msg = err && err.message ? err.message : String(err);
        console.log('Bot error:', msg);
        setStatus({ lastEvent: 'error: ' + msg });
    });

    bot.on('end', function (reason) {
        console.log('Bot disconnected:', reason);
        connected = 0;
        currentBot = null;
        setStatus({ connected: false, lastEvent: 'disconnected' });
        if (running) scheduleReconnect();
    });

    bot.on('kicked', function (reason) {
        console.log('Bot kicked:', reason);
        setStatus({ lastEvent: 'kicked' });
    });
}

function scheduleReconnect() {
    if (reconnectTimer || !running) return;
    console.log('Reconnecting in ' + (reconnectDelayMs / 1000) + 's...');
    setStatus({ lastEvent: 'reconnect_pending' });
    reconnectTimer = setTimeout(function () {
        reconnectTimer = null;
        if (!running) return;
        reconnectCount += 1;
        setStatus({ reconnects: reconnectCount });
        try {
            startBot();
        } catch (err) {
            console.log('Failed to start bot:', err && err.message ? err.message : err);
            scheduleReconnect();
        }
    }, reconnectDelayMs);
}

function stopBot() {
    running = false;
    clearReconnectTimer();
    setStatus({ running: false, connected: false, lastEvent: 'stopped' });
    if (currentBot) {
        try { currentBot.quit('manual stop'); } catch (e) {}
        try { currentBot.end(); } catch (e) {}
        currentBot = null;
    }
    console.log('Bot stopped (manual).');
}

function rejoinBot() {
    console.log('Manual rejoin requested.');
    setStatus({ lastEvent: 'rejoin_requested' });
    clearReconnectTimer();
    if (currentBot) {
        try { currentBot.quit('manual rejoin'); } catch (e) {}
        try { currentBot.end(); } catch (e) {}
        currentBot = null;
    }
    running = true;
    setTimeout(function () {
        if (!currentBot) {
            try { startBot(); } catch (e) {
                console.log('Rejoin failed:', e && e.message ? e.message : e);
                scheduleReconnect();
            }
        }
    }, 500);
}

setControls({
    onStart: function () {
        if (running && currentBot) return;
        running = true;
        clearReconnectTimer();
        try { startBot(); } catch (e) {
            console.log('Start failed:', e && e.message ? e.message : e);
            scheduleReconnect();
        }
    },
    onStop: stopBot,
    onRejoin: rejoinBot
});

process.on('uncaughtException', function (err) {
    console.log('Uncaught exception:', err && err.message ? err.message : err);
    if (running) scheduleReconnect();
});

console.log('AFK bot ready. Use the web panel to Start/Stop/Rejoin.');
