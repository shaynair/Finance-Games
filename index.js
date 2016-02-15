var express = require('express');
var session = require('express-session');
var compression = require('compression');
var pg = require('pg');
var bcrypt = require('bcrypt-nodejs');
var request = require('request');
var bodyParser = require('body-parser');
var socketio = require('socket.io');
var moment = require('moment');
var xignite = "FCAC0E1A3DB14E33993F2F10C1A281BA";

var app = express();

	app.set('port', process.env.PORT || 5000);
	app.use(express.static(__dirname + '/public'));

	// views is directory for all template files
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	app.use(session({ secret: 'finance-games', resave: false, saveUninitialized: true, cookie: { httpOnly: false }}));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(compression());

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
			+ 'password text not null, points int not null default 0)')
			.on('end', client.end.bind(client));
  client.query('CREATE TABLE IF NOT EXISTS done_modules(id SERIAL PRIMARY KEY, '
			+ 'user_id int not null, module int not null, '
			+ 'slide int not null default 0)')
			.on('end', client.end.bind(client));
  done();
  // var query = client.query("stuff = $1", ['$1 here']);
  // query.on('row', function(row, result) {
	  // row here; e.g. row.name <-- or use result.addRow(row)
  // })
  // query.on('end', function(result) { <-- result.rowCount at end, or result.rows
});

moment().format();

function createClient() {
	var client = new pg.Client(conString);
	client.connect();
	
	return client;
}


	function register(user, email, pass, sess, response) {
		var client = createClient();
		client.query("SELECT * FROM users WHERE name LIKE $1 OR email LIKE $2", [user, email], function(error, result) {
			if (error != null || result.rowCount > 0) {
				response.end('registerErrorExists');
				console.log("Error exist register: " + result.rowCount + ", " + error);
				client.end();
			} else {
				var q = client.query("INSERT INTO users (name, email, password) VALUES($1, $2, $3) RETURNING id", [user, email, bcrypt.hashSync(pass)]);
				q.on("row", function(row, res) {
					res.addRow(row);
				});
				q.on("end", function(res) {
					if (res.rowCount != 1) {
						response.end('registerError');
						console.log("Error register: " + res.rowCount);
						client.end();
					} else {
						sess.uid = res.rows[0].id;
						sess.uname = user;
						sess.points = 0;
						sess.save();
						response.end('registerSuccess');
						client.end();
					}
				});
			}
		});
	}
	
	function login(user, pass, sess, response) {
		var client = createClient();
		var q = client.query("SELECT * FROM users WHERE name LIKE $1", [user]);
		q.on("row", function(row, result) {
			result.addRow(row);
		});
		q.on("end", function(result) {
			if (result.rowCount != 1) {
				response.end('loginErrorNone');
				client.end();
				console.log("Error login: " + result.rowCount);
			} else {
				bcrypt.compare(pass, result.rows[0].password, function(err, res) {
					if (res == true) {
						sess.uid = result.rows[0].id;
						sess.uname = result.rows[0].name;
						sess.points = result.rows[0].points;
						sess.save();
						response.end('loginSuccess');
						client.end();
					} else {
						response.end('loginErrorPass');
						client.end();
					}
				});
			}
		});
	}
	
	function doneModule(uid, type, slide, change, sess, response) {
		var client = createClient();
		client.query("SELECT * FROM done_modules WHERE user_id = $1 AND module = $2 AND slide = $3", [uid, type, slide], function(error, result) {
			if (error != null || result.rowCount > 0) {
				response.end('none');
				client.end();
			} else {
				client.query("INSERT INTO done_modules (user_id, module, slide) VALUES($1, $2, $3)", [uid, type, slide], function(err, res) {
					if (err != null) {
						response.end('error');
						console.log("Error update: " + err);
						client.end();
					} else {
						client.query("UPDATE users SET points = $1 WHERE id = $2", [sess.points + parseInt(change), uid], function(err, res) {
							if (err != null) {
								response.end('error');
								console.log("Error update: " + err);
								client.end();
							} else {
								sess.points += parseInt(change);
								sess.save();
								response.end('' + sess.points);
								client.end();
							}
						});
					}
				});
			}
		});
	}



app.get('/', function(request, response) {
	if (request.session && request.session.uid) {
		response.render('pages/main');
	} else {
		response.render('pages/index');
	}
});
app.get('/invest', function(request, response) {
	if (request.session && request.session.uid) {
		response.render('pages/invest');
	} else {
		response.redirect('/');
	}
});
app.get('/budget', function(request, response) {
	if (request.session && request.session.uid) {
		response.render('pages/budget');
	} else {
		response.redirect('/');
	}
});
app.post('/change',function(req,res){
	doneModule(req.session.uid, req.body.type, req.body.slide, req.body.change, req.session, res);
});
app.get('/store',function(req,res){
	if (req.session.uid) {
		res.render('pages/store');
	} else {
		res.redirect('/');
	}
});
app.post('/points',function(req,res){
	res.end('' + req.session.points);
});
app.post('/login',function(req,res){
	login(req.body.name, req.body.pass, req.session, res);
});
app.post('/register',function(req,res){
	register(req.body.name, req.body.email, req.body.pass, req.session, res);
});
app.get('/logout',function(req,res){
	req.session.destroy(function(err){
		if(err){
			console.log(err);
		} else {
			res.redirect('/');
		}
	});
});

var server = require('http').createServer(app).listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

var stocks = [];

function requestStock(s, symbol) {
	var removed = false;
	request({url: 'https://www.xignite.com/xLogos.json/GetLogo', 
		qs: {IdentifierType: "Symbol", Identifier: symbol, _Token: xignite}}, 
	function (error, response, body) {
	  if (removed) {
		return;
	  }
	  if (!error && response.statusCode == 200) {
		var info = JSON.parse(body);
		if (info.Outcome === "Success") {
		  s.logo = info.URL;
		  if (info.Security && info.Security.Outcome === "Success") {
			s.industry = info.Security.CategoryOrIndustry;
		  }
		}
	  } else if (error && error.toString().startsWith("Error: connect")) {
		stocks.splice(stocks.indexOf(s), 1);
		removed = true;
		console.log("Removed " + s.name + " due to " + error);
	  } else {
		console.log(error + ", " + response + ", logo");
	  }
	});
	
	request({url: 'https://www.xignite.com/xEstimates.json/GetResearchReport', 
		qs: {IdentifierType: "Symbol", Identifier: symbol, EstimatesResearchReportType: "EarningsEstimates", _Token: xignite}}, 
	function (error, response, body) {
	  if (removed) {
		return;
	  }
	  if (!error && response.statusCode == 200) {
		var info = JSON.parse(body);
		if (info.Outcome === "Success") {
		  s.logo = info.URL;
		  info.ResearchReportLines.forEach(function(entry) {
			if (entry.Outcome && entry.Outcome === "Success" && (entry.Name == "Mean Estimate" || entry.Name == "Percent Growth" || entry.Name == "LTG Current Mean")) {
				if (entry.Name == "LTG Current Mean") {
					s.futureEstimate += parseFloat(entry.Values[0]);
				} else {
					s.currentEstimate += parseFloat(entry.Values[2]);
					s.futureEstimate += parseFloat(entry.Values[3]);
				}
			}
		  });
		}
	  } else if (error && error.toString().startsWith("Error: connect")) {
		stocks.splice(stocks.indexOf(s), 1);
		removed = true;
		console.log("Removed " + s.name + " due to " + error);
	  } else {
		console.log(error + ", " + response + ", research X");
	  }
	});
	
	request({url: 'https://www.xignite.com/xAnalysts.json/GetResearchReport', 
		qs: {IdentifierType: "Symbol", Identifier: symbol, AnalystsResearchReportType: "SummaryCurrentStatistics", _Token: xignite}}, 
	function (error, response, body) {
	  if (removed) {
		return;
	  }
	  if (!error && response.statusCode == 200) {
		var info = JSON.parse(body);
		if (info.Outcome === "Success") {
		  s.logo = info.URL;
		  info.ResearchReportLines.forEach(function(entry) {
			if (entry.Outcome && entry.Outcome === "Success" && entry.Name == "Standard Deviation") {
				s.currentDeviation += parseFloat(entry.Values[2]);
				s.futureDeviation += parseFloat(entry.Values[3]);
			}
		  });
		}
	  } else if (error && error.toString().startsWith("Error: connect")) {
		stocks.splice(stocks.indexOf(s), 1);
		removed = true;
		console.log("Removed " + s.name + " due to " + error);
	  } else {
		console.log(error + ", " + response + ", research A");
	  }
	});
	
	request({url: 'https://www.xignite.com/xGlobalHistorical.json/GetCashDividendTotal', 
		qs: {IdentifierType: "Symbol", Identifier: symbol, EndDate: moment().format('MM/DD/YYYY'),
			StartDate: moment().subtract(1, "years").format("MM/DD/YYYY"), _Token: xignite}}, 
	function (error, response, body) {
	  if (removed) {
		return;
	  }
	  if (!error && response.statusCode == 200) {
		var info = JSON.parse(body);
		if (info.Outcome === "Success") {
		  s.dividend += parseFloat(info.CashTotal);
		}
	  } else if (error && error.toString().startsWith("Error: connect")) {
		stocks.splice(stocks.indexOf(s), 1);
		removed = true;
		console.log("Removed " + s.name + " due to " + error);
	  } else {
		console.log(error.toString() + ", " + response + ", dividend");
	  }
	});
}

function requestExchange(mic) {
	request({url: 'https://www.xignite.com/xGlobalHistorical.json/ListSymbols', 
		qs: {Exchange: mic, StartSymbol: "A", EndSymbol: "ZZZZ", _Token: xignite}}, 
	function (error, response, body) {
	  if (!error && response.statusCode == 200) {
		var info = JSON.parse(body);
		if (info.Outcome === "Success") {
			console.log("loading " + info.SecurityDescriptions.length + " stock symbols");
		  info.SecurityDescriptions.forEach(function(entry) {
			  var s = {
				  symbol: entry.Symbol,
				  name: entry.Name,
				  logo: "",
				  industry: "",
				  meanRecommend: 0,
				  currentEstimate: 0,
				  futureEstimate: 0,
				  currentDeviation: 0,
				  futureDeviation: 0,
				  dividend: 0
			  };
			  stocks.push(s);
			  requestStock(s, entry.Symbol);
		  });
		}
	  } else {
		console.log(error + ", " + response.statusCode + ", requestExchange");
	  }
	});
}

// catalog stocks
/*request.post({url: 'https://www.xignite.com/xGlobalHistorical.json/ListExchanges', qs: {_Token: xignite}}, 
function (error, response, body) {
  if (!error && response.statusCode == 200) {
    var info = JSON.parse(body);
	if (info.Outcome !== "Success") {
	  console.log(info.Outcome + ", " + body);
	} else {
	console.log("loading " + info.ExchangesDescriptions.length + " exchanges");*/
	var arr = [/*'XCNQ', 'XTNX', 'XTSX', */'XTSE'];
	  arr.forEach(function(entry) {
		  requestExchange(entry);
	  });
/*	  
	}
  } else {
	console.log(error + ", " + response.statusCode);
  }
});*/

socketio.listen(server).on("connection", function(socket) {
	socket.on("getStocks", function() {
		socket.emit("stocks", stocks);
	});
});