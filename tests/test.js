QUnit.test('Schema Test', function(assert) {
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
	assert.ok(db.testTable.definition.columns.id, 'testTable column `id` is defined.');
	// get PK column for 'testTable'
	var pk = db.columns.get({table:'testTable', pk:true})[0];
	assert.ok(pk !== undefined, 'Found primary key colum for `testTable` using meta tables.');
	
	db.dropTable('testTable');
	assert.ok(!db.testTable, 'testTable is dropped correctly');
	db.dropTable('testTable');
	assert.ok(true, 'dropping table twice does no harm (please check debug console, should have a warning)');
});

QUnit.test('CRUD Test', function(assert) {
	var records, db = new WebDB('crud');
	db.createTable('testTable');
	assert.ok(db.testTable.length === 0, 'new table `testTable` is empty');
	db.testTable.set({id: 1, version: null});
	records = db.testTable.get();
	assert.ok(records.length === 1, 'After inserting one record, testTable length === 1');
	assert.ok(records[0].id === 1 && records[0].version === null, 'Record has correct data');
	db.testTable.set({id:2, version:0}); // simulate update of persistent record
	records = db.testTable.get();
	assert.ok(records.length === 2, 'After inserting another record, testTable length === 2');
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
	var db = new WebDB('criteria');
	var weapons = db.createTable('weapons', {
		'id': {type: Number, pk:true}, 
		'version': {type:Number, version:true},
		'name': {type:String, length:32, unique:true}
	}); 
	assert.ok(weapons, 'Table `weapons` created ok');

	var characters = db.createTable('characters', {
		'id': {type: Number, pk:true}, 
		'version': {type:Number, version:true},
		'firstName': {type:String, length:32, index:true},
		'lastName': {type:String, length:32, index:true},
		'description': String, // shortcut for {type:String}
		'weaponOfChoice': {type:Number, fk:'weapons'},
	});
	assert.ok(characters, 'Table `characters` created ok');

	weapons.set([
		{id:1, name:'Revolver'},
		{id:2, name:'Shotgun'},
		{id:3, name:'Mini revolver'},
		{id:4, name:'Teeth'}
	]);
	assert.ok(weapons.length === 4, 'Table `weapons` populated ok');

	characters.set([
		{id:1,  firstName:'Lucky',    lastName:'Luke',   weaponOfChoice:1, description:'Shoots faster than his shadow'},
		{id:2,  firstName:'Joe',      lastName:'Dalton', weaponOfChoice:1, description:'Leader of the Dalton brothers gang'},
		{id:3,  firstName:'Jack',     lastName:'Dalton', weaponOfChoice:1, description:'Member of the Dalton brothers gang'},
		{id:4,  firstName:'William',  lastName:'Dalton', weaponOfChoice:1, description:'Member of the Dalton brothers gang'},
		{id:5,  firstName:'Averell',  lastName:'Dalton', weaponOfChoice:1, description:'Member of the Dalton brothers gang'},
		{id:6,  firstName:'Billy',    lastName:'The Kid',weaponOfChoice:1, description:'Youngest outlaw of the west'},
		{id:7,  firstName:'Buffalo',  lastName:'Bill',   weaponOfChoice:2, description:''},
		{id:8,  firstName:'Calamity', lastName:'Jane',   weaponOfChoice:2, description:''},
		{id:9,  firstName:'Pat',      lastName:'Poker',  weaponOfChoice:3, description:''},
		{id:10, firstName:'Jesse',    lastName:'James',  weaponOfChoice:1, description:''},
		{id:11, firstName:'Jolly',    lastName:'Jumper', weaponOfChoice:4, description:'The smartest horse in the world'},
		{id:12, firstName:'Rantaplan',lastName:'?',      weaponOfChoice:4, description:'The dumbest dog in the universe'},
	]);
	assert.ok(characters.length === 12, 'Table `characters` populated ok');
	var luckyLuke = characters.get(1);
	assert.ok(luckyLuke[0].firstName === 'Lucky', 'Got Lucky Luke successfully');
	
	var daltons = characters.get({lastName: 'Dalton'});
	assert.ok(daltons.length === 4, 'Got Dalton brothers successfully');
	var william = characters.get({firstName: 'William', lastName:'Dalton'})[0];
	assert.ok(william.id === 4, 'Got William Dalton successfully');
	
	var shotgun = characters.get({weaponOfChoice: 2});
	assert.ok(shotgun.length === 2, 'Got 2 characters that prefer the shotgun');
	
	var shotgun = characters.get({weaponOfChoice: 2});
	assert.ok(shotgun.length === 2, 'Got 2 characters that prefer the shotgun');
	
	var startsWithJ = characters.get({firstName:{$gte:'J', $lt:'K'}});
	var msg = '';
	for (var i=0, c; c=startsWithJ[i]; i++) {
		if (i>0 && i<startsWithJ.length-1) {msg += ', ';}
		if (i == startsWithJ.length-1) {msg += ' and ';}
		msg += c.firstName + ' ' + c.lastName;
	}
	assert.ok(startsWithJ.length === 4, 'Got 4 characters with a first name starting with \'J\': ' + msg);
});

QUnit.test('Bulk Data Test', function(assert) {
	var db = new WebDB('bulk'),
		bulk = db.createTable('bulk'),
		i, start, stop, elapsed, items;
	start = window.performance ? window.performance.now() : Date.now();
	for (i=0; i<2000; i++) {
		bulk.set({id:i, name:'record'+i});
	}
	stop = window.performance ? window.performance.now() : Date.now();
	elapsed = stop - start;
	assert.ok(bulk.get().length === 2000, 'Inserted 2,000 single records in ' + elapsed + 'ms.');

	start = window.performance ? window.performance.now() : Date.now();
	for (i=0; i<2000; i++) {
		items = bulk.get(i);
		if (items.length != 1) {assert.ok(false, 'wrong data returned for key ' + i + ': ' + items);}
	}
	stop = window.performance ? window.performance.now() : Date.now();
	elapsed = stop - start;
	assert.ok(true, 'Retrieved 2,000 single records in ' + elapsed + 'ms.');
	
	start = window.performance ? window.performance.now() : Date.now();
	items = bulk.get();
	stop = window.performance ? window.performance.now() : Date.now();
	elapsed = stop - start;
	assert.ok(items.length === 2000, 'Retrieved 2,000 records in bulk in ' + elapsed + 'ms.');

	start = window.performance ? window.performance.now() : Date.now();
	bulk.del(items);
	stop = window.performance ? window.performance.now() : Date.now();
	elapsed = stop - start;
	assert.ok(bulk.get().length === 0, 'Cleared bulk table of 2,000 items in ' + elapsed + 'ms.');
});

QUnit.test('Synchronization Test', function(assert) {
	var db = WebDB('synched', {synch:true, synchUrl:'/api/webdb/synch'});
	db.createTable('roles', {
		id: {type:Number, pk:true},
		version: {type:Number, version:true},
		name: {type:String, unique:true},
		description: String
	});
	db.createTable('brands', {
		id: {type:Number, pk:true},
		version: {type:Number, version:true},
		name: {type:String, unique:true},
		createdOn: {type:Date, index:true},
		updatedOn: {type:Date, index:true}
	});
	assert.ok(!db.synched, 'Db looks unsynched.');

	var done = assert.async();
	db.synch().then(function ok(){
		log.info('Synch succeeded!');
		assert.ok(db.synched, 'Db looks synched again.');
		var pk = db.columns.get({table:'roles', pk:true})
		assert.ok(pk, 'Primary key for `brands` found using meta tables.');
		var allRoles = db.roles.get();
		assert.ok(allRoles.length === 9, 'Got 9 roles after synch');
		var guestRole = db.roles.get({name:'Guest'})[0];
		var userRole = db.roles.get({name:'User'})[0];
		assert.ok(guestRole, 'Found `Guest` role');
		assert.ok(userRole, 'Found `User` role');
		assert.ok(guestRole.id === 1, '`Guest` role has id 1');
		assert.ok(userRole.id === 2, '`User` role has id 2');
		done();
	}).catch(function fail(e){
		log.error('Synch failed.', e);
		assert.ok(false, 'Synch failed.');
		done();
	});

//	db.brands.set({id:1, version:null, name: 'My Brand', createdOn:new Date(), updatedOn:null});

});
