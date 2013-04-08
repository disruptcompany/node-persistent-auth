[![Build Status](https://secure.travis-ci.org/innofluence/node-persistent-auth.png)](http://travis-ci.org/innofluence/node-persistent-auth)

# Node persistent auth

Provides persistent login through cookies, following best practices described in [Charles Miller's article](http://fishbowl.pastiche.org/2004/01/19/persistent_login_cookie_best_practice/)

This library is inteded to be used together with Express.js, and optionally also with everyauth

The library should be instantiated with a store that is used to save the cookie information. The store must provide the following methods:

	var persistentStore = {
		/ *
		  * Get an array of all the tokens associated with a user id. 
		  * /
		getTokens: function (userId, callback) {},
		/ *
		  *	Get a user associated with a user id.
		  * /
		getUser: function (userId, callback) {},
		/ *
		  *	Save a token with the given values. Values are, userId, salt, token and expire.
		  * /
		createToken: function (values, callback) {},
		/ *
		  * Remove the given token from the database
		  * /
		destroyToken: function (token, callback) {}
	};

The callbacks given to the store follow the regular express callback style, so their signature is `callback(err, arg)`.

### Installation

	npm install persistent-auth

### Instantiation
The instantiation fo the Persistence object is shown below. The values shown are the default values, except for store, which does not have a default value.

	var persistence = new Persistence({
		key: 'auth_remember' // the name of the cookie,
		store: persistentStore, // A persistent cookie store, as described above
		cookieOptions: { // The options given to res.cookie
			maxAge: 60*60*24*30*1000,
			domain: ""
		},
		separator: ';', // The symbol that should be used to separate userid and token in the cookie
		injectUser: true, // Should we inject req.user once the user is authed? 
		generateToken: function (callback) { // A function to create a random token string.
			crypto.pseudoRandomBytes(16, function (err, buff) {
				// NOTE - we do not need token values to be unique or unpredictable, as long as they are sufficiently long, thus using pseudoRandom works fine
				callback(err, buff.toString('hex'));
			});
		}
	});

	app.use(persistence);

Doing this will check if a cookie with the name given in `key` is present in the request, and if it is and session.auth is undefined the library will try to look up a matching cookie in the store, and set session.auth and req.user if it does.

To clear the cookie once a user logs out you should call `persistence.clearCookie`. If you are using everyauth, you can do the following:

	everyauth.everymodule.handleLogout(function (req, res) {
		persistence.clearCookie(res);
		res.send(200);
	});

To set a new cookie when a user logs in you call `persistence.setNewToken`. If you are using everyauth, this could be done in your redirectPath

	app.all('/auth/response', function (req, res) {
		var respond = function () {
			res.json(200, message);
		};

		if (req.session.rememberMe === true)  {
			persistence.setNewToken(res, user, respond);
		} else {
			respond();
		}
	});

As you can see from the above example, rememberMe is saved on the user session. This is because everyauth does some internal redirects, so it is not possible to pass the parameters along.