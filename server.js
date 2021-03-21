/*--------------------------------------------------------------------------------
  Import
  --------------------------------------------------------------------------------*/
require('dotenv').config();
const _ = require('lodash');
const http = require('http');
const axios = require('axios');
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

const player = get_http_player_process();


//------------------------------------------------------------------------------ Db
function db_query(req, func) {
  const ctx = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'test'
  });
  ctx.connect();
  ctx.query(req, func);
  ctx.end();
}

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

  db_query(
    'SELECT id, type, name, path FROM items',
    (error, results, fields) => {
      if (error) throw error;
      res.status(200).send(results);
      next();
    }
  );
});

v1.get('/items/:key', (req, res, next) => {
  db_query(
    `SELECT id, type, name, path FROM items WHERE id=${req.params.key} LIMIT 1`,
    (error, results, fields) => {
      if (error) throw error;
      res.status(200).send(results);
      next();
    }
  );
});

v1.post('/items', (req, res, next) => {
  const { name, path, type } = req.body;

  if (_.isNil(name) || _.isNil(path) || _.isNil(type)) {
    res.status(400);
    next();
  } else {
    db_query(
      `INSERT INTO test.items (id, type, name, path) VALUES (NULL, '${type}', '${name}', '${path}')`,
      (error, results, fields) => {
        if (error) throw error;

        db_query(
          `SELECT id, type, name, path FROM items WHERE id=${results.insertId} LIMIT 1`,
          (err, result, f) => {
            if (err) throw error;
            res.status(200).send(_.head(result) || {});
            next();
          }
        );
      }
    );
  }
});

function build_player_http_url() {
  const url = new URL(`http://${process.env.VLC_HOST}:${process.env.VLC_PORT}/`);
  url.searchParams.append('command', 'in_play');
  url.searchParams.append('input', 'https://n04a-eu.rcs.revma.com/ypqt40u0x1zuv');
  
  return url.href;
}

v1.patch('/items/:key', (req, res, next) => {
  const { name, path, type, play } = req.body;

  if (play === true) {
    db_query(
      `SELECT id, type, name, path FROM items WHERE id=${req.params.key} LIMIT 1`,
      (err, result, f) => {
        if (err) throw error;

        const path = (_.head(result) || {}).path;
        // axios.get(build_player_http_url(), {
        //   auth: {
        //     username: '',
        //     password: 'F2sR3NEVek57rr'
        //   }
        // })
        //   .then(function (response) {
        //     // handle success
        //     console.log(response);
        //   })
        //   .catch(function (error) {
        //     // handle error
        //     console.log(error);
        //   })
        //   .then(function () {
        //     // always executed
        //   });

      }
    );
    next();

  } else {

    if (_.isNil(name) || _.isNil(path) || _.isNil(type)) {
      res.status(400);
      next();
    } else {

      db_query(
        `UPDATE test.items SET type='${type}', name='${name}', path='${path}' WHERE id=${req.params.key} LIMIT 1`,
        (error, results, fields) => {
          if (error) throw error;

          db_query(
            `SELECT id, type, name, path FROM items WHERE id=${req.params.key} LIMIT 1`,
            (err, result, f) => {
              if (err) throw error;
              res.status(200).send(_.head(result) || {});
              next();
            }
          );
        }
      );
    }
  }
});


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

// curl -XGET 'http://127.0.0.1:8000/ass-service/v1/items'
// curl -XPOST 'http://127.0.0.1:8000/ass-service/v1/items' -H "Content-Type: application/json" -d '{"name": "fip", "path": "bla", "type": "stream"}'
// https://wiki.videolan.org/VLC_HTTP_requests/
// curl -XPATCH 'http://127.0.0.1:8000/ass-service/v1/items/1' -H "Content-Type: application/json" -d '{"play": true}'
