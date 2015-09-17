QUnit.test('Schema Creation Test', function(assert) {
	assert.ok(typeof WebDB === 'function', 'WebDB is defined and is a function');
	var db = new WebDB('schema');
	assert.ok(db, 'DB created with WebDB() is defined');
	assert.ok(db.name, 'db has a name property');
	assert.ok(db.name === 'schema', 'db name property is correct');
	var oops = 'Ooops';
	db.name = oops;
	assert.ok(db.name !== oops, 'db name property cannot be set');
	var db2 = new WebDB('schema');
	assert.ok(db2, 'Calling WebDB again with same name succeeds');
	assert.ok(db2 === db, 'Subsequent calls to WebDB return the original object');
	assert.ok(db.createTable, 'db.createTable is defined');
	assert.ok(typeof db.createTable === 'function', 'db.createTable is a function');
	var table = db.createTable('testTable');
	assert.ok(table, 'Table created with db.createTable is defined');
	assert.ok(table.name, 'Created table has a name property');
	assert.ok(table.name === 'testTable', 'Table name property is correct');
	table.name = oops;
	assert.ok(table.name !== oops, 'Table name property cannot be set');
	assert.ok(db.testTable, 'db.testTable is defined');
	db.testTable = null;
	assert.ok(db.testTable, 'db.testTable cannot be set');
	try {
		var table2 = db.createTable('testTable');
		assert.ok(false, 'Creating multiple tables with the same name fails');
	}
	catch(e) {
		assert.ok(true, 'Creating multiple tables with the same name fails');
	}
	assert.ok(db.testTable.definition, 'db.testTable.definition is defined');
	db.testTable.definition = null;
	assert.ok(db.testTable.definition, 'db.testTable.definition cannot be set');
	assert.ok(db.testTable.definition.primaryKey === 'id', 'testTable PK is set to `id`');
	assert.ok(db.testTable.definition.columns.id, 'testTable column `id` is defined.');
	try {
		db.alterTable('testTable', {columns: {pk: {type: Number}}, primaryKey: 'pk'});
		assert.ok(true, 'alterTable() for testTable completes without exceptions');
		assert.ok(db.testTable.definition.primaryKey === 'pk', 'testTable PK is now set to `pk`');
		assert.ok(db.testTable.definition.columns.pk, 'testTable column `pk` is defined.');
		assert.ok(db.testTable.definition.columns.pk.type === Number, 'testTable column `pk` is of type Number.');
		assert.ok(db.testTable.definition.columns.id === undefined, 'testTable column `id` is NOT defined.');
	}
	catch(e) {
		assert.ok(false, 'alterTable() for testTable completes without exceptions');
	}
	db.dropTable('testTable');
	assert.ok(!db.testTable, 'testTable is dropped correctly');
	db.dropTable('testTable');
	assert.ok(true, 'dropping table twice does no harm (please check debug console, should have a warning)');
});

QUnit.test('CRUD Test', function(assert) {
	var records, db = new WebDB('crud');
	db.createTable('testTable');
	assert.ok(db.testTable.get().length === 0, 'new table `testTable` is empty');
	db.testTable.set({id: 1, version: null});
	records = db.testTable.get();
	assert.ok(records.length === 1, 'After inserting one record, testTable length === 1');
	assert.ok(records[0].id === 1 && records[0].version === null, 'Record has correct data');
	assert.ok(db.testTable.created.length === 1, 'testTable reflects that one record was created');
	db.testTable.set({id:2, version:0}); // simulate update of persistent record
	records = db.testTable.get();
	assert.ok(records.length === 2, 'After inserting another record, testTable length === 2');
	assert.ok(db.testTable.updated.length === 1, 'testTable reflects that persistent record was updated');
	db.testTable.set({id:3}); 
	records = db.testTable.get();
	assert.ok(records.length === 3, 'After inserting yet another record, testTable length === 3');
	assert.ok(records[2].id === 3, 'Record has correct data');
	db.testTable.del(records[0]);
	records = db.testTable.get();
	assert.ok(records.length === 2, 'After deleting a record, testTable length === 2');
	db.testTable.del(records);
	assert.ok(db.testTable.get().length === 0, 'After bulk-deleting 2 records, testTable length === 0');
});
QUnit.test('Criteria Test', function(assert) {
	var records, db = new WebDB('criteria');
	var cowboys = db.createTable('cowboys');
	cowboys.set({id: 1, size:160, firstName:'Joe',     lastName:'Dalton' });
	cowboys.set({id: 2, size:170, firstName:'Jack',    lastName:'Dalton' });
	cowboys.set({id: 3, size:180, firstName:'William', lastName:'Dalton' });
	cowboys.set({id: 4, size:190, firstName:'Averell', lastName:'Dalton' });
	cowboys.set({id: 5, size:180, firstName:'Lucky',   lastName:'Luke'   });
	cowboys.set({id: 6, size:170, firstName:'Billy',   lastName:'The Kid'});
	
	assert.ok(cowboys.get().length === 6, 'Table `cowboys` populated ok');
	var daltons = cowboys.get({lastName: 'Dalton'});
	assert.ok(daltons.length === 4, 'Got Dalton brothers successfully');
	var william = cowboys.get({firstName: 'William', lastName:'Dalton'})[0];
	assert.ok(william.id === 3, 'Got William Dalton successfully');
	var luckyHeight = cowboys.get({size:180});
	assert.ok(luckyHeight.length === 2, 'Got 2 cowboys with size 180');
	var averell = cowboys.get({id:4})[0];
	averell.firstName = 'Averell `the Great`';
	averell = cowboys.get({id:4})[0];
	assert.ok(averell.firstName === 'Averell `the Great`', 'Modifications to objects are reflected immediately');
});
