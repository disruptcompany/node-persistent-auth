var _ = require('underscore'),
	pwd = require('pwd'),
	async = require('async'),
	crypto = require('crypto');

module.exports = function(config) {
	config = _.defaults(config, {
		key: 'auth_remember',
		cookieOptions: {
			maxAge: 60*60*24*30*1000,
			domain: ""
		},
		injectUser: true,
		separator: ';',
		generateToken: function (callback) {
			crypto.pseudoRandomBytes(16, function (err, buff) {
				callback(err, buff.toString('base64'));
			});
		}
	});
	if (!config.store || !_.isObject(config.store)) throw new Error("You must provide a store to store and fetch persistence information");
	if (!_.isFunction(config.generateToken)) throw new Error("generateToken must be a function");
	var store = config.store;

	var app = function (req, res, next) {
		if (!req.session.auth && req.cookies && req.cookies[config.key]) {
			var cookie = getCookieInfo(req.cookies[config.key]),
				userId = cookie.userId,
				cookieToken = cookie.token;

			async.parallel({
				tokens: function (callback) {
					store.getTokens(userId, callback);
				},
				user: function (callback) {
					store.getUser(userId, callback);
				}
			}, function (err, result) {
				var auths = result.tokens,
					user = result.user,
					found = false,
					done = _.after(auths.length, function () {
						if (!found) {
							next();
						}
					});

				// It would be nice to break out of the loop once we have found a matching token, but that is not really possible due to the async nature of pwd				
				auths.forEach(function (auth) {
					pwd.hash(cookieToken, auth.salt, function (err, hash) {
						if (hash == auth.token) {
							found = true;
							if (config.injectUser === true) req.user = user;

							req.session.userId = user.id;
							req.session.auth = { userId: user.id, loggedIn: true};

							app.setNewToken(res, user, auth, function (err) {
								if (err) res.send(500, err);

								next();
							});
						}
						done();
					});
				});
			});
		} else if (config.injectUser === true && req.session.auth && !res.user) {
			store.getUser(req.session.auth.userId, function (err, user) {
				req.user = user;
				next();
			});
		} else {
			next();
		}
	};

	app.setNewToken = function (res, user, oldToken, _callback) {
		if (_callback === undefined) {
			_callback = oldToken;
			oldToken = undefined;
		}

		async.parallel({
			generateNewToken: function (callback) {
				config.generateToken(function (err, token) {
					pwd.hash(token, function (err, salt, hash) {
						callback(err, salt, hash, token);
					});
				});
			},
			removeOldToken: function (callback) {
				if (oldToken) {
					store.destroyToken(oldToken, callback);	
				} else {
					callback(null, null);
				}				
			}
		}, function (err, result) {
			if (err) console.trace(err);
			if (err) return _callback("Something went wrong while updating your cookie");

			var salt = result.generateNewToken[0],
				hash = result.generateNewToken[1],
				token = result.generateNewToken[2];

			res.cookie(config.key, user.id + config.separator + token, config.cookieOptions);
			store.createToken({ userId: user.id, salt: salt, token: hash, expire: new Date(Date.now() + config.cookieOptions.maxAge) }, function (err) {
				if (err) console.trace(err);
				if (err) return _callback("Something went wrong while updating your cookie");
				_callback(null);
			});
		});
	};

	app.clearCookie = function (res) {
		var options = config.cookieOptions;
		delete options.maxAge;
		options.expire = new Date(Date.now()-1);

		res.clearCookie(config.key, options);
		return res;
	};

	var getCookieInfo = function(cookie) {
		var parts = cookie.split(config.separator);

		return {
			userId: parts[0],
			token: parts[1]
		};
	};

	return app;
};