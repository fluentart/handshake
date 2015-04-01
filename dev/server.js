var config = {
	production : true,	//enable for compression etc
	email : true,		//enable for email send/recieve
	port: 3000,
	//domain: "bitlab.io",
	//domain: "127.0.0.1",
	sitename: "HandShake"
}

if (process.env.NODE_ENV == "production") {   
	config.production = true;
	console.log("\nSTARTING LAUNCHLAB in PRODUCTION mode. Enabled caching and emails.\n\n"); }
	else { 
	console.log("\nSTARTING LAUNCHLAB in DEVELOPMENT mode. Use for production:\n\tsudo NODE_ENV=production nodemon server\n\n"); }



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

// MAILBOT
var mailbot = require('./lib/mailbot')
mailbot.debug = true;	
mailbot.domain = config.domain
if (config.email) {
	if (config.production == true) {
		console.log("email server: started")
		mailbot.server.listen(25, mailbot.domain);	
	} else {
		console.log("email server: not started")
	}
}

// DATABASE
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
app.set('view cache', config.production);
if (config.production == true) {
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

			console.log("new unique signup");
			db.users.save( newuser, function (err, savedResp) {
				console.log("saved")
				console.log(savedResp._id);
				//var ObjectId = mongojs.ObjectId;

				req.session.email = req.body.email;
				req.session.secpass = encryptedhex;			
				console.log(config.email);
				if (config.email == true) {	
					console.log("MAIL ENABLED, DOING VERIFICATION");
					var email = {}
					email.from = "noreply@"+config.domain;
					email.fromname = config.sitename;
					email.rcpt = req.body.email;
					email.rcptname = "";
					email.subject = "Please verify your email address";

					if (config.port == 80) {
						email.body = "Please click on the link below to verify your email.\n http://"+config.domain+"/verify/"+savedResp._id+"\n\n\n";
					} else {
						email.body = "Please click on the link below to verify your email.\n http://"+config.domain+":"+config.port+"/verify/"+savedResp._id+"\n\n\n";
					}
					
					mailbot.sendemail(email, function (data) 
					{
						console.log("EMAIL SENT")
					});
					res.send("verifyemail");
				} else {
					console.log("MAIL DISABLED, SKIPPING VERIFICATION");
					res.send("done")	
				}


			} );

	      }
     	
		if (resp.length > 0) {
			console.log("email exists! double signup?")
			res.send("exists")
		}
	})
	//  	
})

// EMAIL VERIFICATION

app.get('/verify/:id', function (req,res) {
	var ObjectId = mongojs.ObjectId;
	if (req.params.id.length == 24) {
		db.users.findOne( {"_id": ObjectId(req.params.id)}, function (err, resver) {
			if (resver) {
				resver.verified = true;
				db.users.update({"_id": ObjectId(req.params.id)}, resver);
				console.log("VERIFIED");
				req.session.email = resver.email;
				req.session.secpass = resver.secpass;	
				res.render('verify', {});				
			} else {
				console.log("VERIFICATION FAILED");
				res.render('error', {});
			}
		})
	} else {
		console.log("CODE TOO SHORT");
		res.render('error', {});
	}
	
});

///////////////////////////////////////////////////
// SIGNIN

app.get('/signin', function (req, res) {
  	res.render('signin', {})
});


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

app.get('/recover', function (req, res) {
	res.render("recover", {});
})

app.post('/recover', function (req, res) {
	console.log("USER RECOVER");
	db.users.findOne( {email: req.body.email}, function (err, resp) {
		console.log(resp);
		if (resp == null) {			
			res.send("notfound");
		} else {
			//SEND EMAIL
			if (config.email == true) {	
				
				var email = {}
				email.from = "noreply@"+config.domain;
				email.fromname = config.sitename;
				email.rcpt = req.body.email;
				email.rcptname = "";
				email.subject = "Account recovery";

				if (config.port == 80) {
					email.body = "Please click on the link below to set a new password.\n http://"+config.domain+"/newpass/"+resp._id+"\n\n\n";
				} else {
					email.body = "Please click on the link below to set a new password.\n http://"+config.domain+":"+config.port+"/newpass/"+resp._id+"\n\n\n";
				}
				
				mailbot.sendemail(email, function (data) 
				{
					console.log("EMAIL SENT")
					res.send("success");
				});

			} else {
				res.send("emaildisabled")	
			}
			//END EMAIL
		}
		
	})

	//
})

app.get('/newpass/:id', function (req, res) {
	console.log("NEWPASS FORM");
	var ObjectId = mongojs.ObjectId;
	if (req.params.id.length == 24) {
		db.users.findOne( {"_id": ObjectId(req.params.id)}, function (err, resver) {
			if (resver == null) {
				res.render("error", {});
			} else {
				console.log(resver);
				res.render("newpass", {});	
			}
			
		});
	} else {
		res.render("error", {});
	}
	
})

app.post('/newpass/:id', function (req, res) {
	console.log("SET NEW PASSWORD");
	var ObjectId = mongojs.ObjectId;
	if (req.params.id.length == 24) {
		db.users.findOne( {"_id": ObjectId(req.params.id)}, function (err, resver) {
			if (resver == null) {
				res.send("error");
			} else {
				var encrypted = scrypt.crypto_scrypt(scrypt.encode_utf8(resver.email), scrypt.encode_utf8(req.body.pass), 128, 8, 1, 32);
				var encryptedhex = scrypt.to_hex(encrypted);
				resver.secpass = encryptedhex;
				db.users.update( {"_id": ObjectId(req.params.id)}, resver, function (err, resp) {
					req.session.email = resver.email;
					req.session.secpass = encryptedhex;					
					res.send("success");		
				})
				
			}
			
		});
	} else {
		res.render("error", {});
	}
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

		if (resp) {
			if (resp.length == 0) {
				console.log("user not found");
				res.render('home', {})
			}
			if (resp.length > 0) {
				console.log("user found!")

				if (resp[0].verified) {
					res.render('app_home', { email: req.session.email })
				} else {
					if (config.email == true) {	
						console.log("MAIL ENABLED, ENFORCING VERIFICATION");
						res.render('notverified', { email: req.session.email })
					} else {
						console.log("MAIL DISABLED, SKIPPING VERIFICATION");
						res.render('app_home', { email: req.session.email })
					}
					
				}
				
			}
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

app.post('/search', function (req, res) {
	console.log(req.body);
	db.users.find( req.body, function (err, resp) {
		for (var u in resp) {
			delete resp[u].secpass
		}
		var searchresult = {}
		searchresult.status = "success";
		searchresult.data = resp;
		console.log(searchresult);
		res.json(searchresult);
	})
})

///////////////////////////////////////////////////////////

var server = http.createServer(app)
 

 
server.listen(config.port, function(){
  console.log("Web server   : started on port " + config.port);
});