var buster = require('buster'),
	Persistence = require('../index');

buster.spec.expose();
buster.testRunner.timeout = 3000;

describe("Configuration", function (){
	it("should throw an error if store is not defined", function () {
		var test = function () {
			Persistence({
				store: 'totally not an object'
			});
		};

		expect(test).toThrow();
	});

	it("should thrown an error if generateToken is not a function", function () {
		var test = function () {
			Persistence({
				generateToken: 'totally not a function'
			});	
		};

		expect(test).toThrow();
	});
});