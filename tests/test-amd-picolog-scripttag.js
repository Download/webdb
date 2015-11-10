require.config({
	baseUrl: '../dist',
	paths: {
		'webdb': './webdb.umd',
	}
});
define(['webdb'], function(WebDB){
	QUnit.test("AMD Module Compliance Test", function( assert ) {
		assert.ok(WebDB !== undefined, 'WebDB is defined');
		assert.ok(typeof WebDB === 'function', 'WebDB is a function');
		assert.ok(window.WebDB === undefined, 'global WebDB is NOT defined');
	});
});

