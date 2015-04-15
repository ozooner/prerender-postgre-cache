var pg = require('pg');
var zlib = require('zlib');
var connString = process.env.POSTGRES_URI;

var client = new pg.Client(connString);
client.connect(function(err) {
  if(err) {
    return console.error('Could not connect to postgres', err);
  }
});

var postgre_cache = {
    create_table: function createTableIfNotExists(){
      var create = "CREATE TABLE if not exists pages(\
         page character varying(255) PRIMARY KEY NOT NULL,\
         data BYTEA NOT NULL,\
         updated timestamp without time zone DEFAULT now() NOT NULL\
      );";
      client.query(create, function(err, result){
          if(err) throw err;
      });
    },
    upsert: function upsert(page, data, cb){ 
      function insert(page, data, cb){
        var sql = "INSERT INTO pages(page, data, updated) VALUES($1, $2, $3)";
        client.query(sql, [page, data, new Date()], cb);
      }
      function update(page, data, cb){
        var sql = "UPDATE pages set data = $1, updated = $2 where page = $3";
        client.query(sql, [data, new Date(), page], cb);
      }
      var buf = new Buffer(JSON.stringify(data), 'utf8');
      zlib.gzip(buf, function (err, compressed) {
        if(err) throw err;
        client.query('SELECT count(*) from pages where page = $1', [page], function(err, result){
            if(err) throw err;
            var count = parseInt(result.rows[0].count);
            if(!count){
              insert(page, compressed, cb);
            }
            else{
              update(page, compressed, cb);
            }
        });
      });
    },
    get: function get(page, cb){
      var sql = "SELECT data from pages where page = $1";
      client.query(sql, [page], function (err, result) {
        if(err) cb(err, result);
        if(result.rowCount){
          var buffer = result.rows[0].data;
          zlib.gunzip(buffer, function(err, result){
              result = JSON.parse(result.toString('utf-8'));
              cb(err, result);
          });
        }
        else{
          //no rows found
          cb(false, false);
        }
      });
    }
};

postgre_cache.create_table();
module.exports = {
    beforePhantomRequest: function (req, res, next) {
        if (req.method !== 'GET') {
            return next();
        }
        postgre_cache.get(req.prerender.url, function(err, result){
            // Page found - return to prerender and 200
            if (!err && result) {
                res.send(200, result);
            } else {
                next();
            }
        });
    },

    afterPhantomRequest: function (req, res, next) {
        if(!req.prerender.documentHTML) {
              return next();
        }
        //remove script tags
        var matches = req.prerender.documentHTML.toString().match(/<script(?:.*?)>(?:[\S\s]*?)<\/script>/gi);
        for (var i = 0; matches && i < matches.length; i++) {
            if(matches[i].indexOf('application/ld+json') === -1) {
                req.prerender.documentHTML = req.prerender.documentHTML.toString().replace(matches[i], '');
            }
        }
        //replace inline audio
        matches = req.prerender.documentHTML.toString().match(/<audio(?:.*?)>(?:[\S\s]*?)<\/audio>/gi);
        for (i = 0; matches && i < matches.length; i++) {
            req.prerender.documentHTML = req.prerender.documentHTML.toString().replace(matches[i], '');
        }
        //replace inline fonts
        matches = req.prerender.documentHTML.toString().match(/@font-face{(?:.*?)}/gi);
        for (i = 0; matches && i < matches.length; i++) {
            req.prerender.documentHTML = req.prerender.documentHTML.toString().replace(matches[i], '');
        }
        //replace inline images with 1px transparent gif
        matches = req.prerender.documentHTML.toString().match(/url\(data:image\/png;base64(?:.*?)\);/gi);
        for (i = 0; matches && i < matches.length; i++) {
            req.prerender.documentHTML = req.prerender.documentHTML.toString().replace(matches[i], 'url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7);');
        }

        if (req.prerender.statusCode === 200) {
            postgre_cache.upsert(req.prerender.url, req.prerender.documentHTML, function (err, result){
                console.log('Updated: '+req.prerender.url);
            });
        }
        next();
    }
};
