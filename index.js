var express = require('express');
var socket = require('socket.io');
var bodyParser = require('body-parser');
var cookieSession = require('cookie-session');
var compression = require('compression');
var pg = require('pg');
var bcrypt = require('bcrypt-nodejs');
var request = require('request');
var xignite = {_token: "FCAC0E1A3DB14E33993F2F10C1A281BA"};

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
var conString = process.env.DATABASE_URL + '?ssl=true';

//this initializes a connection pool
//it will keep idle connections open for a (configurable) 30 seconds
//and set a limit of 20 (also configurable)
pg.connect(conString, function(err, client, done) {
  if(err) {
    return console.error('error fetching client from pool', err);
  }
  client.query('CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, '
			+ 'name VARCHAR(40) not null, email text not null, '
			+ 'password text not null, points int not null default 0, '
			+ 'CONSTRAINT u_constraint UNIQUE (name), CONSTRAINT e_constraint UNIQUE (email))')
			.on('end', client.end.bind(client));
  done();
  // var client = new Client({user: 'brianc', database: 'test'});
  // client.connect();
  // client.on('drain', client.end.bind(client));
  // var query = client.query("stuff = $1", ['$1 here']);
  // query.on('row', function(row, result) {
	  // row here; e.g. row.name <-- or use result.addRow(row)
  // })
  // query.on('end', function(result) { <-- result.rowCount at end, or result.rows
});

//var hash = bcrypt.hash("x");
//bcrypt.compare("x", hash, function(err, res) {
    // res == true
//});

//request('http://www.xignite.com/xAnalysts.json/ListResearchFields', {form: xignite}, function (error, response, body) {
//  if (!error && response.statusCode == 200) {
//    
//  }
//});

var io = socket.listen(server);
io.on('connection', function(socket){
	
	socket.on('disconnect', function() {
		// Free resources
	});
});

