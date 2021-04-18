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
const parser = require('fast-xml-parser');
const { spawn } = require('child_process');


//------------------------------------------------------------------------------ Player
function start_http_player_process() {
  const player = spawn(
    process.env.VLC_PATH,
    [
      '--intf', 'http',
      '--http-host', process.env.VLC_HOST,
      '--http-port', process.env.VLC_PORT,
      '--http-password', process.env.VLC_PASSWORD
    ], {
      detached: false,
      shell: '/bin/bash'
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

function build_player_base_url() {
  return new URL(`http://${process.env.VLC_HOST}:${process.env.VLC_PORT}/requests/status.xml`);
}

function player_action_play(path) {
  const url = build_player_base_url();
  url.searchParams.append('command', 'in_play');
  url.searchParams.append('input', path);
  return url.href;
}

function player_action_stop() {
  const url = build_player_base_url();
  url.searchParams.append('command', 'pl_stop');
  return url.href;
}

function player_action_pause() {
  const url = build_player_base_url();
  url.searchParams.append('command', 'pl_pause');
  return url.href;
}

function player_action_set_volume(val) {
  const url = build_player_base_url();
  url.searchParams.append('command', 'volume');
  url.searchParams.append('val', val);
  return url.href;
}

function player_action_clear_pl() {
  const url = build_player_base_url();
  url.searchParams.append('command', 'pl_empty');
  return url.href;
}

function player_action_status() {
  return build_player_base_url().href;
}

function _player_parse_xml(data) {
  const options = {
    attributeNamePrefix : "@_",
    ignoreAttributes : false,
    ignoreNameSpace : false,
  };
  return parser.parse(data, options);
}

function player_parse_xml(xml_string) {
  // parse xml from player
  const data_raw = _player_parse_xml(xml_string);

  // build data
  const data = {
    currentplid: data_raw.root.currentplid,
    time: data_raw.root.time,
    volume: data_raw.root.volume,
    length: data_raw.root.length,
    random: data_raw.root.random,
    state: data_raw.root.state,
    loop: data_raw.root.loop,
    position: data_raw.root.position,
    repeat: data_raw.root.repeat,
    stats: data_raw.root.stats
  };

  // get meta data
  const top_meta_data = _.get(data_raw, ['root', 'information', 'category']);
  if (_.isArray(top_meta_data) === true) {
    const stream = {info: {}, meta: {}};
    let attr = null;

    for (let row of top_meta_data) {
      switch (row['@_name']) {
      case 'meta':
        for (attr of row.info) {
          if (_.has(attr, '@_name') && _.has(attr, '#text'))
            stream.info[attr['@_name']] = attr['#text'];
        }
        break;

      case 'Stream 0':
        for (attr of row.info) {
          if (_.has(attr, '@_name') && _.has(attr, '#text'))
            stream.meta[attr['@_name']] = attr['#text'];
        }
        break;

      default:
        break;
      }
    }
    // add meta data
    data.stream = stream;
  }
  return data; 
}

// create a player process
const player = start_http_player_process();


//------------------------------------------------------------------------------ Db
function db_query(req, func) {
  const ctx = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
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


//---- STATUS
v1.get('/', (req, res, next) => {
  axios.get(player_action_status(), {
    auth: {
      username: (process.env.VLC_USER || ''),
      password: process.env.VLC_PASSWORD,
    }
  }).then(player_res => {
    res.status(200).send(player_parse_xml(player_res.data));
    next();
  }).catch(player_error => {
    console.log(player_error);
    res.sendStatus(400);
    // handle error
    next(player_error);
  });
});


//---- VOLUME
v1.get('/volume', (req, res, next) => {
  axios.get(player_action_status(), {
    auth: {
      username: (process.env.VLC_USER || ''),
      password: process.env.VLC_PASSWORD,
    }
  }).then(player_res => {
    res.status(200).send({volume: player_parse_xml(player_res.data).volume});
    next();
  }).catch(player_error => {
    // handle error
    res.sendStatus(400);
    // console.log(error);
    next(player_error);
  });
});


//---- COMMAND
v1.post('/command', (req, res, next) => {
  const { action } = req.body;

  let func = null;
  let args = [];

  switch (action) {
  case 'stop':
    func = player_action_stop;
    break;

  case 'clear':
    func = player_action_clear_pl;
    break;

  case 'pause':
    func = player_action_pause;
    break;

  case 'volume':
    func = player_action_set_volume;
    let { val } = req.body;
    args = [val];
    break;

  default:
    break;
  }

  if (func === null) {
    res.sendStatus(400);
    next();
  } else {
    axios.get(func(...args), {
      auth: {
        username: (process.env.VLC_USER || ''),
        password: process.env.VLC_PASSWORD,
      }
    }).then(player_res => {
      res.status(200).send(player_parse_xml(player_res.data));
      next();
    }).catch(player_error => {
      // handle error
      res.sendStatus(400);
      // console.log(error);
      next(player_error);
    });
  }
});

//---- ITEMS
v1.get('/items', (req, res, next) => {
  // const { file } = req.body;

  db_query(
    'SELECT id, type, name, path, description, country FROM items',
    (error, results, fields) => {
      if (error) throw error;
      res.status(200).send(results);
      next();
    }
  );
});

v1.get('/items/:key', (req, res, next) => {
  db_query(
    `SELECT id, type, name, path, description, country FROM items WHERE id=${req.params.key} LIMIT 1`,
    (error, results, fields) => {
      if (error) throw error;
      res.status(200).send(results);
      next();
    }
  );
});

v1.post('/items', (req, res, next) => {
  const { name, path, type, description, country } = req.body;

  if (_.isNil(name) || _.isNil(path) || _.isNil(type)) {
    res.sendStatus(400);
    next();
  } else {
    db_query(
      `INSERT INTO items (id, type, name, path, description, country) VALUES (NULL, '${type}', '${name}', '${path}', '${description}', '${country}')`,
      (error, results, fields) => {
        if (error) throw error;

        db_query(
          `SELECT id, type, name, path, description, country FROM items WHERE id=${results.insertId} LIMIT 1`,
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

v1.patch('/items/:key', (req, res, next) => {
  const { name, path, type, description, country, play } = req.body;

  if (play === true) {
    // the user ask to play a specific item
    db_query(
      `SELECT id, type, name, path FROM items WHERE id=${req.params.key} LIMIT 1`,
      (err, result, f) => {
        if (err) throw error;

        const path = (_.head(result) || {}).path;

        if (_.isNil(path)) {
          res.sendStatus(400);
          next();
        } else {
          axios.get(player_action_play(path), {
            auth: {
              username: (process.env.VLC_USER || ''),
              password: process.env.VLC_PASSWORD,
            }
          }).then(player_res => {
            res.status(200).send(_.head(result) || {});
            next();
          }).catch(player_error => {
            // handle error
            res.sendStatus(400);
            // console.log(error);
            next(player_error);
          });
        }
      }
    );

  } else {

    if (_.isNil(name) || _.isNil(path) || _.isNil(type)) {
      res.sendStatus(400);
      next();
    } else {

      db_query(
        `UPDATE items SET type='${type}', name='${name}', path='${path}', description='${description}', country='${country}' WHERE id=${req.params.key} LIMIT 1`,
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

v1.delete('/items/:key', (req, res, next) => {
  db_query(
    `DELETE FROM test.items WHERE id=${req.params.key} LIMIT 1`,
    (error, results, fields) => {
      if (error) throw error;

      res.sendStatus(200);
      next();
    }
  );  
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

// curl -XGET 'http://127.0.0.1:8000/ass-service/v1/items'
// curl -XPOST 'http://127.0.0.1:8000/ass-service/v1/items' -H "Content-Type: application/json" -d '{"name": "fip", "path": "bla", "type": "stream"}'
// https://wiki.videolan.org/VLC_HTTP_requests/
// curl -XPATCH 'http://127.0.0.1:8000/ass-service/v1/items/1' -H "Content-Type: application/json" -d '{"play": true}'
