require.config({
	baseUrl: '../dist',
	paths: {
		'picolog': '../node_modules/picolog/dist/picolog.min',
		'webdb': './webdb.umd',
	}
});
define(['picolog', 'webdb'], function(log, WebDB){
	QUnit.test("AMD Module Compliance Test", function( assert ) {
		assert.ok(WebDB !== undefined, 'WebDB is defined');
		assert.ok(typeof WebDB === 'function', 'WebDB is a function');
		assert.ok(window.WebDB === undefined, 'global WebDB is NOT defined');
	});
});

