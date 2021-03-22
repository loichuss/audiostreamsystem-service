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


var he = require('he');

var options = {
    attributeNamePrefix : "@_",
    attrNodeName: "attr", //default is 'false'
    textNodeName : "#text",
    ignoreAttributes : true,
    ignoreNameSpace : false,
    allowBooleanAttributes : false,
    parseNodeValue : true,
    parseAttributeValue : false,
    trimValues: true,
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    parseTrueNumberOnly: false,
    arrayMode: false, //"strict"
    attrValueProcessor: (val, attrName) => he.decode(val, {isAttributeValue: true}),//default is a=>a
    tagValueProcessor : (val, tagName) => he.decode(val), //default is a=>a
    stopNodes: ["parse-me-as-string"]
};


var jsonObj =parser.parse(`<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<root>
<fullscreen>0</fullscreen>
<audiodelay>0</audiodelay>
<apiversion>3</apiversion>
<currentplid>5</currentplid>
<time>122</time>
<volume>172</volume>
<length>0</length>
<random>false</random>
<audiofilters>
  <filter_0></filter_0></audiofilters>
<rate>1</rate>
<videoeffects>
  <hue>0</hue>
  <saturation>1</saturation>
  <contrast>1</contrast>
  <brightness>1</brightness>
  <gamma>1</gamma></videoeffects>
<state>playing</state>
<loop>false</loop>
<version>2.2.8 Weatherwax</version>
<position>0</position>
<repeat>false</repeat>
<subtitledelay>0</subtitledelay>
<equalizer></equalizer><information>
    <category name="meta">
    <info name='filename'>https://n04a-eu.rcs.revma.com/ypqt40u0x1zuv</info><info name='title'>Radio Nowy Swiat</info><info name='now_playing'>Led Zeppelin - Good Times Bad Times (Live)</info>    </category>
  <category name='Stream 0'><info name='Bitrate'>128 kb/s</info><info name='Type'>Audio</info><info name='Channels'>Stereo</info><info name='Sample rate'>44100 Hz</info><info name='Codec'>MPEG Audio layer 1/2 (mpga)</info></category>  </information>
  <stats>
  <lostabuffers>0</lostabuffers>
<readpackets>6739</readpackets>
<lostpictures>0</lostpictures>
<demuxreadbytes>1966916</demuxreadbytes>
<demuxbitrate>0.015999654307961</demuxbitrate>
<playedabuffers>4705</playedabuffers>
<demuxcorrupted>0</demuxcorrupted>
<sendbitrate>0</sendbitrate>
<sentbytes>0</sentbytes>
<displayedpictures>0</displayedpictures>
<demuxreadpackets>0</demuxreadpackets>
<sentpackets>0</sentpackets>
<inputbitrate>0.016001624986529</inputbitrate>
<demuxdiscontinuity>0</demuxdiscontinuity>
<averagedemuxbitrate>0</averagedemuxbitrate>
<decodedvideo>0</decodedvideo>
<averageinputbitrate>0</averageinputbitrate>
<readbytes>1967592</readbytes>
<decodedaudio>4705</decodedaudio>
  </stats>
</root>`, options);

console.log(jsonObj);
console.log(jsonObj.root.information.category[0].info);

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

function build_player_base_url() {
  return new URL(`http://${process.env.VLC_HOST}:${process.env.VLC_PORT}/requests/status.xml`);
}

function player_action_play(path) {
  const url = build_player_base_url();
  url.searchParams.append('command', 'in_play');
  url.searchParams.append('input', path);
  
  return url.href;
}

function player_action_status() {
  return build_player_base_url().href;
}

// create a player process
// const player = get_http_player_process();


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

v1.patch('/items/:key', (req, res, next) => {
  const { name, path, type, play } = req.body;

  if (play === true) {
    // the user ask to play a specific item
    db_query(
      `SELECT id, type, name, path FROM items WHERE id=${req.params.key} LIMIT 1`,
      (err, result, f) => {
        if (err) throw error;

        const path = (_.head(result) || {}).path;

        if (_.isNil(path)) {
          res.status(400);
          next();
        } else {
          axios.get(player_action_play(path), {
            auth: {
              username: (process.env.VLC_USER || ''),
              password: process.env.VLC_PASSWORD,
            }
          }).then(player_res => {
            //console.log(res);
            res.status(200).send(_.head(result) || {});
            next();
          }).catch(player_error => {
            res.status(400);
            next();
            // handle error
            // console.log(error);
          }).then(() => {
            // always executed
          });
        }
      }
    );

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
