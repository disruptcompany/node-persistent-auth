module.exports = function(sequelize, Type) {
  var UserAuth;

	UserAuth = sequelize.define('user_auth', {
		user_id: Type.INTEGER,
		salt: Type.STRING,
		token: Type.STRING,
		expire : Type.INTEGER
	}, {}, {
		charset: 'utf8',
		collate: 'utf8_unicode_ci'
	});

	return UserAuth;
};