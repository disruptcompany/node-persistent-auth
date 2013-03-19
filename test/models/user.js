var _ = require('underscore');

module.exports = function(sequelize, Type) {
	User = sequelize.define('user', {
		email: Type.STRING
	});

	return User;
};