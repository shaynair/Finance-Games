var express = require('express');
var socketio = require('socket.io');
var cookieSession = require('cookie-session');
var compression = require('compression');
var pg = require('pg');
var bcrypt = require('bcrypt-nodejs');
var request = require('request');
var xignite = {_token: "FCAC0E1A3DB14E33993F2F10C1A281BA"};

var app = express();

app.set('port', process.env.PORT || 5000);

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


app.use(cookieSession({
    keys: ['userId', 'userName']
}));

app.use(compression());

app.get('/', function(request, response) {
  response.render('pages/index');
});

var server = require('http').createServer(app).listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

// Database
var conString = 'postgres://olgrznlsdbflou:KLu80c0o1xCFo1lCGkvb21z92F@ec2-54-221-201-165.compute-1.amazonaws.com:5432/df28uqsh9kgu5e?ssl=true';

//this initializes a connection pool
//it will keep idle connections open for a (configurable) 30 seconds
//and set a limit of 20 (also configurable)
pg.connect(conString, function(err, client, done) {
  if(err) {
    return console.error('error fetching client from pool', err);
  }
  client.query('CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, '
			+ 'name text not null, email text not null, '
			+ 'password text not null, points int not null default 0, '
			+ 'CONSTRAINT u_constraint UNIQUE (name), CONSTRAINT e_constraint UNIQUE (email))')
			.on('end', client.end.bind(client));
  done();
  // var query = client.query("stuff = $1", ['$1 here']);
  // query.on('row', function(row, result) {
	  // row here; e.g. row.name <-- or use result.addRow(row)
  // })
  // query.on('end', function(result) { <-- result.rowCount at end, or result.rows
});


//request('http://www.xignite.com/xAnalysts.json/ListResearchFields', {form: xignite}, function (error, response, body) {
//  if (!error && response.statusCode == 200) {
//    
//  }
//});

function createClient() {
	var client = new pg.Client(conString);
	client.connect();
	client.on('drain', client.end.bind(client));
	return client;
}

socketio.listen(server).sockets.on('connection', function(socket){
	
	socket.on('register', function(user, email, pass) {
		var client = createClient();
		client.query("SELECT * FROM users WHERE user = $1 OR email = $2", [user, email], function(error, result) {
			if (error != null || result.rowCount > 0) {
				socket.emit('registerErrorExists');
				console.log("Error exist register: " + result.rowCount + ", " + error);
			} else {
				var q = client.query("INSERT INTO users (name, email, password) VALUES($1, $2, $3) RETURNING id", [user, email, bcrypt.hashSync(pass)]);
				q.on("row", function(row, result) {
					result.addRow(row);
				});
				q.on("end", function(err, res) {
					if (err != null || res.rowCount != 1) {
						socket.emit('registerError');
						console.log("Error register: " + res.rowCount + ", " + err);
					} else {
						socket.emit('registerSuccess', res.rows[0].id, res.rows[0].name);
					}
				});
			}
		});
	});
	
	socket.on('login', function(user, pass) {
		var client = createClient();
		var q = client.query("SELECT * FROM users WHERE user = $1", [user]);
		q.on("row", function(row, result) {
			result.addRow(row);
		});
		q.on("end", function(error, result) {
			if (error != null || result.rowCount != 1) {
				socket.emit('loginErrorNone');
				console.log("Error login: " + result.rowCount + ", " + error);
			} else {
				bcrypt.compare(pass, result.rows[0].pass, function(err, res) {
					if (res === true) {
						socket.emit('loginSuccess', result.rows[0].id, result.rows[0].name);
					} else {
						socket.emit('loginErrorPass');
					}
				});
			}
		});
	});
	
	socket.on('disconnect', function() {
		// Free resources
	});
});

