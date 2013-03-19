var express = require('express'),
	everyauth = require('everyauth'),
	app = express();	

module.exports = function (sequelize) {
	var User = sequelize.import(__dirname + '/models/user'),
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

			// SQLite does not like weird characters in the tokens provided by the pwd module, so we save them as base64. If you are using mysql or another db service this should not be an issue
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
};