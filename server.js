var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var api = require('./routers/api.js'),
	map = require('./routers/map.js'),
	user = require('./routers/user.js'),
	cp = require('./routers/cp.js'),
	grp = require('./routers/grp.js'),
	roles = require('./routers/roles.js'),
	func = require('./routers/func.js'),
	sys = require('./routers/sys.js'),
	control = require('./routers/control.js'),
	device = require('./routers/device.js');
	log = require('./routers/log.js'),
	profile = require('./routers/profile.js'),
	zone = require('./routers/zone.js');
var config = require('./config');
var async   = require('async'),
	request = require('request');
// Authentication module.
var auth = require('http-auth');
var morgan = require('morgan');
var cors = require('cors');
var mqttSubClient = require('./modules/mqttSubClient.js');
var basic = auth.basic({
	realm: "Node JS API",
    file: "./keys.htpasswd" // gevorg:gpass, Sarah:testpass ...
});
// Jason add for line-bot notify on 2018.04.24 -- start
var path = require('path');
var linebot = require('linebot');
var JsonFileTools =  require('./modules/jsonFileTools.js');
var userPath = './public/data/friend.json';

if (config.channelId !=='' && config.channelSecret !=='' && config.channelAccessToken !=='') {
	var bot = linebot({
		channelId: config.channelId,
		channelSecret: config.channelSecret,
		channelAccessToken: config.channelAccessToken
	});

	const linebotParser = bot.parser();

	bot.on('message', function(event) {
		// 把收到訊息的 event 印出來
		console.log(event);
		var msg = new Date() + event.message.text;
		event.reply(msg).then(function (data) {
			// success
			console.log('event reply : ' + JSON.stringify(data));
		}).catch(function (error) {
			// error
			console.log('event reply : ' + JSON.stringify(error));
		});
		event.source.profile().then(function (profile) {
			console.log('uaer profile : ' + JSON.stringify(profile));
		}).catch(function (error) {
			// error
			console.log('uaer profile error : ' + JSON.stringify(error));
		});
	});

	bot.on('follow',   function (event) {
	  //紀錄好友資料
	  console.log('line follow  : ' + event.source.userId);
	  addFriend(event.source.userId);
	});

	bot.on('unfollow', function (event) {
	  //刪除好友紀錄
	  console.log('line unfollow  : ' + event.source.userId);
	  removeFriend(event.source.userId)
	 });

	bot.on('join',     function (event) {
	  //紀錄加入者資料資料
	  addFriend(event.source.userId);
	  console.log('line join : ' + event.source.userId);
	 });

	 function getUser() {
		try {
			  var user = JsonFileTools.getJsonFromFile(userPath);
		  }
		  catch (e) {
			  var user = {};
		  }

		if (user.friend === undefined) {
		  user.friend = [];
		}
		return user;
	  }

	 function saveUser(user) {
		JsonFileTools.saveJsonToFile(userPath,user);
	  }

	  function addFriend(id) {
		var user = getUser();
		var index = user.friend.indexOf(id);
		if (index === -1) {
			user.friend.push(id);
		}
		saveUser(user);
	  }

	  function removeFriend(id) {
		var user = getUser();
		var index = user.friend.indexOf(id);
		if (index > -1) {
			user.friend.splice(index, 1);
		}
		saveUser(user);
	  }
	  app.post('/webhook', linebotParser);
}
// Jason add for line-bot notify on 2018.04.24 -- end

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan('dev')); // log every request to the console
app.use(cors());

if(config.auth == true) {
	app.use(auth.connect(basic));
}

app.all('/*', function(req, res, next) {
  // CORS headers
  res.header("Access-Control-Allow-Origin", "*"); // restrict it to the required domain
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  // Set custom headers for CORS
  res.header('Access-Control-Allow-Headers', 'Content-type,Accept,X-Access-Token,X-Key');
  next();
});

router.get('/', function(req, res) {
	res.json({ message: 'MQTT Broker and API!' });
});

app.use('/user'  + config.baseurl, user);//Login,logout,User
app.use('/api' + config.baseurl, api);
app.use('/admin' + config.baseurl, cp);//Company
app.use('/admin' + config.baseurl, grp);//Group
app.use('/admin' + config.baseurl, log);
app.use('/admin' + config.baseurl, roles);//Role : user limit
app.use('/admin' + config.baseurl, func);//function : WEB function enable or not
app.use('/sys' + config.baseurl, sys);
app.use('/control' + config.baseurl, control);
app.use('/device' + config.baseurl, map);//Device type map
app.use('/device' + config.baseurl, device);
app.use('/device' + config.baseurl, profile);
app.use('/device' + config.baseurl, zone);

api = require('./routers/api.js'),

app.use(function(req, res, next) {
	res.status(404);
	res.send({
		"success" : 0,
		"message" : 'Invalid URL'
	});
});

var server = app.listen(config.port, function () {
	console.log(server.address());
	var host = server.address().address;
	var port = server.address().port;

	console.log('Server listening at http://localhost:%s', port);
	console.log('api url : http://localhost:8000/api/:table');
});
