var express = require('express'),
	async = require('async'),
	_ = require('underscore'),
	everyauth = require('everyauth'),
	app = express(),
	Sequelize = require('sequelize'),
	sequelize = new Sequelize("persistence-test", "", "", {
		logging: false,
		dialect: 'sqlite'
	}),
	User = sequelize.import(__dirname + '/models/user'),
	UserAuth = sequelize.import(__dirname + '/models/userauth'),
	Persistence = require('../index');
	
var persistentStore = {
	getTokens: function (userId, callback) {
		UserAuth.findAll({ user_id: userId}).done(function (err, tokens) {
			tokens.forEach(function (token) {
				var buff = new Buffer(token.token, "base64");
				token.token = buff.toString();
			});
			callback(err, tokens);
		});
	},
	getUser: function (userId, callback) {
		User.find(userId).done(callback);
	},
	createToken: function (values, callback) {
		values.user_id = values.userId;

		var buff = new Buffer(values.token);
		values.token = buff.toString('base64');

		UserAuth.create(values).done(callback);
	},
	destroyToken: function (auth, callback) {
		auth.destroy().done(callback);
	}
};

var persistence = new Persistence({
	key: 'auth_remember',
	store: persistentStore
});

everyauth.everymodule.findUserById(function(id, callback) {
	User.find(parseInt(id, 10)).done(callback);
});

everyauth.password
	.loginWith('email')
	.getLoginPath('/FAKE')
	.postLoginPath('/auth')
	.authenticate(function(email) {
		var promise = this.Promise();
		
		User.find({ email: email }).success(function(user) {
			promise.fulfill(user);
		});
		
		return promise;
	})
	.respondToLoginSucceed(function (res, user) {
		persistence.setNewToken(res, user, null, function () {
			res.send(200);
		});
	})
	.respondToLoginFail(function () { })
	.getRegisterPath('/FAKE')
	.postRegisterPath('/FAKE')
	.extractExtraRegistrationParams( function () { })
	.validateRegistration(function() { })
	.registerUser(function () {	})
	.respondToRegistrationFail(function () { })
	.registerSuccessRedirect('/FAKE');


everyauth.everymodule.handleLogout(function (req, res) {
	req.logout();

	persistence.clearCookie(res);
	res.send(200);	
});


app.configure(function(){
	app.use(express.bodyParser());
	app.use(express.cookieParser('trolololo'));
	app.use(express.session({ key: 'expressesss' }));
	app.use(persistence);
	app.use(everyauth.middleware());
});

app.get('/loginRequired', function (req, res) {
	res.send(req.user ? 200 : 401);
});

app.listen(3006, function(){
	console.log("REST API Server listening on port %d",3006);
});

var request = require('request'),
	buster = require('buster');

buster.spec.expose();
buster.testRunner.timeout = 3000;

describe("Persistence", function () {
	var cookies;
	var j = {
		add: function (cookie) {
			this.remove(cookie.name);

			if (cookie.value) {
				cookies.push(cookie);	
			}			
		},
		get: function () {
			return cookies;
		},
		remove: function (name) {
			cookies = _.reject(cookies, function (cookie) {
				return cookie.name == name;
			});
		},
		clear: function () {
			cookies = [];
		}
	};
	request = request.defaults({jar: j});

	before(function (done) {
		j.clear();

		async.series([
			function dropTables(callback) {
				sequelize.sync({ force: true}).done(callback);
			},
			function createUser(callback) {
				User.create({
					id: 1,
					email: 'john@doe.co.uk'
				}).done(callback);
			}
		], done);
	});

	// This actually works without persistent cookies because of express sessions so we just make sure that we didn't break anything and that we recieve the right set-cookie header
	it("should recieve a cookie and become authenticated", function (done) {
		async.series([
			function before(callback) {
				request('http://localhost:3006/loginRequired', function (error, res) {
					expect(error).toBeNull();
					expect(res.statusCode).toEqual(401);

					callback();
				});
			},
			function auth(callback) {
				request.post('http://localhost:3006/auth', { form: { email: 'john@doe.co.uk' }}, function (error, res) {
					expect(error).toBeNull();
					expect(res.headers['set-cookie'][0]).toMatch('auth_remember=1');
					callback();
				});
			},
			function after(callback) {
				request('http://localhost:3006/loginRequired', function (error, res) {
					expect(error).toBeNull();
					expect(res.statusCode).toEqual(200);

					callback();
				});
			}
		], done);
	});

	it("should be able to log in without the express session cookie", function (done) {
		async.series([
			function before(callback) {
				request('http://localhost:3006/loginRequired', function (error, res) {
					expect(error).toBeNull();
					expect(res.statusCode).toEqual(401);

					callback();
				});
			},
			function auth(callback) {
				request.post('http://localhost:3006/auth', { form: { email: 'john@doe.co.uk' }}, function (error, res) {
					expect(error).toBeNull();
					expect(res.headers['set-cookie'][0]).toMatch('auth_remember=1');
					callback();
				});
			},
			function clearSession(callback) {
				j.remove('expressesss');
				callback();
			},
			function after(callback) {
				request('http://localhost:3006/loginRequired', function (error, res) {
					expect(error).toBeNull();
					expect(res.statusCode).toEqual(200);
					expect(res.headers['set-cookie'][0]).toMatch('auth_remember=1');

					callback();
				});
			}
		], done);
	});

	it("should only set a new cookie when a user uses the current to log in", function (done) {
		async.series([
			function before(callback) {
				request('http://localhost:3006/loginRequired', function (error, res) {
					expect(error).toBeNull();
					expect(res.statusCode).toEqual(401);

					callback();
				});
			},
			function auth(callback) {
				request.post('http://localhost:3006/auth', { form: { email: 'john@doe.co.uk' }}, function (error, res) {
					expect(error).toBeNull();
					expect(res.headers['set-cookie'][0]).toMatch('auth_remember=1');
					callback();
				});
			},
			function clearSession(callback) {
				j.remove('expressesss');
				callback();
			},
			function after(callback) {
				// We removed our session cookie, so we use the auth_remember cookie to login, and a new cookie is set
				request('http://localhost:3006/loginRequired', function (error, res) {
					expect(error).toBeNull();
					expect(res.statusCode).toEqual(200);
					expect(res.headers['set-cookie'][0]).toMatch('auth_remember=1');

					callback();
				});
			},
			function afterAgain(callback) {
				// We are already logged in now so no new cookie should be set
				request('http://localhost:3006/loginRequired', function (error, res) {
					expect(error).toBeNull();
					expect(res.statusCode).toEqual(200);
					expect(res.headers['set-cookie']).not.toBeDefined();

					callback();
				});
			}
		], done);
	});

	it("should clear the cookie when the user logs out", function (done) {
		async.series([
			function before(callback) {
				request('http://localhost:3006/loginRequired', function (error, res) {
					expect(error).toBeNull();
					expect(res.statusCode).toEqual(401);

					callback();
				});
			},
			function auth(callback) {
				request.post('http://localhost:3006/auth', { form: { email: 'john@doe.co.uk' }}, function (error, res) {
					expect(error).toBeNull();
					expect(res.headers['set-cookie'][0]).toMatch('auth_remember=1');
					callback();
				});
			},
			function logout(callback) {
				request('http://localhost:3006/logout', function (error, res) {
					expect(error).toBeNull();
					expect(res.statusCode).toEqual(200);
					expect(res.headers['set-cookie'][0]).toMatch('auth_remember=;');

					callback();
				});
			},
			function after(callback) {
				request('http://localhost:3006/loginRequired', function (error, res) {
					expect(error).toBeNull();
					expect(res.statusCode).toEqual(401);

					callback();
				});
			}
		], done);
	});
});