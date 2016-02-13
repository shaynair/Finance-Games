var express = require('express');
var socket = require('socket.io');
var bodyParser = require('body-parser');
var cookieSession = require('cookie-session');
var compression = require('compression');

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

var io = socket.listen(server);
// TODO