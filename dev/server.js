var production = false;	

if (process.env.NODE_ENV == "production") {
	production = true;
	console.log("\nSTARTING LAUNCHLAB in PRODUCTION mode. Enabled caching and emails.\n\n")
} else {
	console.log("\nSTARTING LAUNCHLAB in DEVELOPMENT mode. Use for production:\n\tsudo NODE_ENV=production nodemon server\n\n")
}



var express = require('express')
  , http = require('http')
  , path = require('path')
  , reload = require('reload')
 
var serveStatic = require('serve-static')
var favicon = require('serve-favicon');
var bodyParser = require('body-parser')
var multer = require('multer'); 
var scrypt = require("./scrypt.js"); // modified https://github.com/tonyg/js-scrypt

var cookieParser = require('cookie-parser')
var session = require('cookie-session')
var compress = require('compression'); 
var swig  = require('swig');

//database
var mongojs = require("mongojs");
var databaseUrl = "handshake"; // "username:password@example.com/mydb"
var collections = ["users"]
var db = mongojs.connect(databaseUrl, collections);

var serveStatic = require('serve-static')
var favicon = require('serve-favicon');

var app = express()
 
var publicDir = path.join(__dirname, 'public')

app.use(session({
  keys: ['key1', 'key2'],
  secureProxy: false // if you do SSL outside of node
}))
 
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(multer()); // for parsing multipart/form-data

app.use(compress());

//app.use(serveStatic(__dirname + '/public', {'index': ['default.html', 'default.htm']}))
app.use(express.static('public'));
app.use(favicon(__dirname + '/public/favicon.ico'));



app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.set('view cache', production);
if (production == true) {
	swig.setDefaults({ cache: 'memory' });
} else {
	swig.setDefaults({ cache: false });
}



///////////////////////////////////////////////////////////
// SIGNUP

app.get('/signup', function (req, res) {
  res.render('signup', {})
})

app.post('/signup', function (req, res) {
	//console.log(req.body);
	console.log("NEW SIGNUP")
	
	//encrypt pass
	var encrypted = scrypt.crypto_scrypt(scrypt.encode_utf8(req.body.email), scrypt.encode_utf8(req.body.pass), 128, 8, 1, 32);
	var encryptedhex = scrypt.to_hex(encrypted)		
	
	var newuser = { email: req.body.email, secpass: encryptedhex, time: Date.now() };

	db.users.find( {email: req.body.email}, function (err, resp) {
		if (resp.length == 0) {
			console.log("email is new! go ahead");
			db.users.save( newuser );
			req.session.email = req.body.email;
			req.session.secpass = encryptedhex;			
			res.send("done")
		}
		if (resp.length > 0) {
			console.log("email exists! double signup?")
			res.send("exists")
		}
	})
	//  	
})

///////////////////////////////////////////////////
// SIGNIN

app.get('/signin', function (req, res) {
  	res.render('signin', {})
})


app.post('/signin', function (req, res) {
	console.log("USER SIGNIN")

	//encrypt pass
	var encrypted = scrypt.crypto_scrypt(scrypt.encode_utf8(req.body.email), scrypt.encode_utf8(req.body.pass), 128, 8, 1, 32);
	var encryptedhex = scrypt.to_hex(encrypted);	

	var signinuser = {email: req.body.email, secpass: encryptedhex};

	db.users.find( signinuser, function (err, resp) {
		if (resp.length == 0) {
			console.log("user not found");
			res.send("notfound")
		}
		if (resp.length > 0) {
			console.log("user found!")
			
			req.session.email = req.body.email;
			req.session.secpass = encryptedhex;
			//res.redirect("/"); 
			res.send("success")
		}
	})

})

///////////////////////////////////////////////////

app.get('/signout', function (req, res) {
  delete req.session.email;
  delete req.session.secpass;
  res.redirect('/');
});

//////////////////////////////////////////////////



app.get('/', function (req, res) {
  	console.log(req.session);


	var cookieuser = {email: req.session.email, secpass: req.session.secpass};

	db.users.find( cookieuser, function (err, resp) {
		if (resp.length == 0) {
			console.log("user not found");
			res.render('home', {})
		}
		if (resp.length > 0) {
			console.log("user found!")
			res.render('app_home', { email: req.session.email })
		}
	})

})

///////////////////////////////////////////////////////////

app.get('/form', function (req, res) {

	db.users.find( {email: req.session.email, secpass: req.session.secpass}, function (err, resp) {
		if (resp.length == 0) {
			res.redirect('/signin', {})
		}
		if (resp.length == 1) {
			console.log("user found!")
			console.log(resp[0])
			res.render('app_form', resp[0])

		}
	})

})

app.post('/form', function (req, res) {
	console.log("FORM UPDATE")
	console.log(req.body);
	db.users.findOne( {email: req.session.email, secpass: req.session.secpass}, function (err, resp) {
		if (resp) {
			resp.form = req.body;
			console.log(resp)
			db.users.update( {email: req.session.email, secpass: req.session.secpass}, resp, function (err, respo) {
				res.send("success");
				console.log(respo);
			});
		}
	})

})

///////////////////////////////////////////////////////////

app.get('/search', function (req, res) {

	db.users.find( {email: req.session.email, secpass: req.session.secpass}, function (err, resp) {
		if (resp.length == 0) {
			res.redirect('/signin', {})
		}
		if (resp.length > 0) {
			console.log("user found!")
			res.render('app_search', { email: req.session.email })
		}
	})

})

///////////////////////////////////////////////////////////

var server = http.createServer(app)
 

 
server.listen(3000, function(){
  console.log("Web server listening on port " + app.get('port'));
});