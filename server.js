/*--------------------------------------------------------------------------------
  Import
  --------------------------------------------------------------------------------*/
require('dotenv').config();
const _ = require('lodash');
const http = require('http');
const mysql = require('mysql');
const cli = require('commander');
const express = require('express');
const { spawn } = require('child_process');

//------------------------------------------------------------------------------ Player
function get_http_player_process() {
  const player = spawn(
    process.env.VLC_PATH,
    [
      '--intf', 'http',
      '--http-host', process.env.VLC_HOST,
      '--http-port', process.env.VLC_PORT,
      '--http-password', process.env.VLC_PASSWORD
    ], {
      detached: false,
      shell: '/bin/csh'
    }
  );
  // player.stdin.setEncoding('utf-8');
  player.stdout.on('data', (data) => {
    console.log(`VLC <stdout> ${data.toString()}`);
  });

  player.stderr.on('data', (data) => {
    console.log(`VLC <stderr> ${data.toString()}`);
  });

  player.on('close', (code) => {
    console.log(`VLC <close> ${code}`);
  });

  return player;
}

// const player = get_http_player_process();


//------------------------------------------------------------------------------ Mini App V1
const v1 = express.Router();
v1.use(express.urlencoded({extended: true}));
v1.use(express.json());
v1.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

v1.get('/items', (req, res, next) => {
  // const { file } = req.body;
  
  const ctx = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'test'
  });
  ctx.connect();
 
  ctx.query('SELECT id, type, name, path FROM items', (error, results, fields) => {
    if (error) throw error;

    res.status(200).send(results);
    next();
  });
 
  ctx.end();
});

v1.get('/items/:key', (req, res, next) => {
  const ctx = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'test'
  });
  ctx.connect();
 
  ctx.query(`SELECT id, type, name, path FROM items WHERE id=${req.params.key} LIMIT 1`, (error, results, fields) => {
    if (error) throw error;

    res.status(200).send(_.head(results) || {});
    next();
  });
 
  ctx.end();
});


// v1.post('/stop', (req, res, next) => {
//   // const { file } = req.body;

//   player.stdin.write('stop\n');
//   res.status(200).send({ done: 'ok' });
//   next();
// });

//------------------------------------------------------------------------------ App
const app = express();
app.use('/ass-service/v1', v1);

//------------------------------------------------------------------------------ Server
cli.option('--port <port>', 'Port') 
  .option('--workers <workers>', 'Nb of workers')
  .parse(process.argv);

const PORT = cli.port || 8000;

http.createServer(app).listen(PORT, () => {
  console.log(`Audio Streaming System Running on http://127.0.0.1:${PORT}`);
});


// setTimeout(() => {
//   player.stdin.write('add https://n04a-eu.rcs.revma.com/ypqt40u0x1zuv\n');
// }, 3000);


// setTimeout(() => {
//   player.stdin.write('stop\n');
// }, 5000);

