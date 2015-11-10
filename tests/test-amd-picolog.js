require.config({
	baseUrl: '../dist',
	paths: {
		'picolog': 'https://cdn.rawgit.com/download/picolog/0.4.0/dist/picolog.min',
		'webdb': './webdb.umd',
	},
	shim: {
		'webdb': ['picolog']
	}
});
define(['picolog', 'webdb'], function(log, WebDB){
	QUnit.test("AMD Module Compliance Test", function( assert ) {
		assert.ok(WebDB !== undefined, 'WebDB is defined');
		assert.ok(typeof WebDB === 'function', 'WebDB is a function');
		assert.ok(window.WebDB === undefined, 'global WebDB is NOT defined');
	});
});

