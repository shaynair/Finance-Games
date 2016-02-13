var express = require('express');
var socket = require('socket.io');
var bodyParser = require('body-parser');
var cookieSession = require('cookie-session');
var compression = require('compression');
var pg = require('pg');

var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());


app.use(cookieSession({
    keys: ['userId', 'userName']
}));

app.use(compression());

app.get('/', function(request, response) {
  response.render('pages/index');
});

var server = app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

// Database
var conString = "postgres://olgrznlsdbflou:KLu80c0o1xCFo1lCGkvb21z92F@ec2-54-221-201-165.compute-1.amazonaws.com:5432/df28uqsh9kgu5e";

//this initializes a connection pool
//it will keep idle connections open for a (configurable) 30 seconds
//and set a limit of 20 (also configurable)
pg.connect(conString, function(err, client, done) {
  if(err) {
    return console.error('error fetching client from pool', err);
  }
  done();
  // var query = client.query("stuff = $1", ['$1 here']);
  // query.on('row', function(row, result) {
	  // row here; e.g. row.name <-- or use result.addRow(row)
  // })
  // query.on('end', function(result) { <-- result.rowCount at end, or result.rows
  /*client.query('SELECT $1::int AS number', ['1'], function(err, result) {
    //call `done()` to release the client back to the pool
    done();

    if(err) {
      return console.error('error running query', err);
    }
    console.log(result.rows[0].number);
    //output: 1
  });*/
});

var io = socket.listen(server);
// TODO

