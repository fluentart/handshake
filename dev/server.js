var express = require('express')
  , http = require('http')
  , path = require('path')
  , reload = require('reload')
 
var serveStatic = require('serve-static')
var favicon = require('serve-favicon');

var app = express()
 
var publicDir = path.join(__dirname, 'public')
 

app.get('/', function (req, res) {
  res.send('Hello Woasdrld!asdsad')
})

app.use(serveStatic(__dirname + '/public', {'index': ['default.html', 'default.htm']}))

var server = http.createServer(app)
 
//reload code here 
reload(server, app)
 
server.listen(3000, function(){
  console.log("Web server listening on port " + app.get('port'));
});