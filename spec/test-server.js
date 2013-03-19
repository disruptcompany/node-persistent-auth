var express = require('express'),
	everyauth = require('everyauth'),
	app = express(),
	RedisStore = require('connect-redis')(express),
	sessionStore = new RedisStore(null),
	sequelize = require('innofluence-node-models').sequelize({
		database: 'innofluence',
		user: 'root',
		password: '',
		options: {
		omitNull: true,
			// logging: false,
			dialect: 'mysql',
			define: {
				timestamps: false,
				freezeTableName: true,
				underscored: true,
				syncOnAssociation: false
			},
			port: 3306,
		}
	}),
	Persistence = require('../index');

var persistentStore = {
	getTokens: function (userId, callback) {
		sequelize.UserAuthRemember.findAll({ user_id: userId}).done(callback);
	},
	getUser: function (userId, callback) {
		sequelize.User.find(userId).done(callback);
	},
	createToken: function (values, callback) {
		values.user_id = values.userId;

		sequelize.UserAuthRemember.create(values).done(callback);
	},
	remove: function (auth, callback) {
		auth.destroy().done(callback);
	}
};

var persistence = new Persistence({
	key: 'auth_remember',
	store: persistentStore
});

app.sessionStore = sessionStore;

everyauth.everymodule.findUserById(function(id, callback) {
	sequelize.User.find(parseInt(id, 10)).done(callback);
});

everyauth
		.password
			.loginWith('email')
		
			.getLoginPath('/FAKE')
			.postLoginPath('/auth')
			.authenticate(function() {
				var promise = this.Promise();
				
				sequelize.User.find(1).success(function(user) {
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


app.configure(function(){
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser('trolololo'));
	app.use(express.session({ key: 'expressesss' }));
	app.use(persistence);
	app.use(everyauth.middleware());
});


app.get('/loginRequired', function (req, res) {
	console.log(req.session);

	res.send(req.user ? 200 : 401);
});

app.get('/assignToken', function (req, res) {
	sequelize.User.find(149).done(function (err, user) {
		persistence.setNewToken(res, user, null, function () {
			res.send(200);
		});
	});	
});

var server = app.listen(3006, function(){
	console.log("REST API Server listening on port %d",3006);
});

var request = require('request'),
	buster = require('buster');

buster.spec.expose();
buster.timeout = 1000;

describe("Persistence", function () {
	var j = request.jar();
	request.defaults({jar: j});

	it("should not have any cookie initially", function (done) {
		request('http://localhost:3006/loginRequired', function (error, res, body) {
			console.log(res.headers['set-cookie']);
			expect(res.statusCode).toEqual(401);

			done();
		});
	});

	it("should recieve a set cookie header", function (done) {
		request.post('http://localhost:3006/auth', function (error, res, body) {
			expect(res.headers['set-cookie'][0].indexOf('auth_remember')).not.toEqual(-1);
			done();
		});
	});

	it("should store that cookie", function (done) {
		request('http://localhost:3006/loginRequired', function (error, res, body) {
			expect(res.statusCode).toEqual(200);

			done();
		});
	});

	it("should work without the express session", function (done) {
		var cook = request.cookie("expressesss= ; Path=/; HttpOnly");
		j.add(cook);
		request('http://localhost:3006/loginRequired', function (error, res, body) {
			expect(res.statusCode).toEqual(200);
			// expect(res.headers['set-cookie'][0].indexOf('auth_remember')).not.toEqual(-1);

			done();
		});
	});

	// it("should not work without both cookies", function (done) {
	// 	var cook = request.cookie("expressesss= ; PAth=/; HttpOnly");
	// 	var cook2 = request.cookie("auth_remember= ; PAth=/; HttpOnly");
	// 	j.add(cook);
	// 	j.add(cook2);

	// 	request('http://localhost:3006/loginRequired', function (error, res, body) {
	// 		expect(res.statusCode).toEqual(401);

	// 		done();
	// 	});
	// });
});