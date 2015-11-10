var win = this;

QUnit.test('Synchronization Test', function(assert) {
	function Role(obj) {
		this.id = obj && obj.id != undefined ? obj.id : null;
		this.version = obj && obj.version != undefined ? obj.version : null;
		this.name = obj && obj.name != undefined ? obj.name : null;
	}
	
	function Group(obj) {
		this.id = obj && obj.id != undefined ? obj.id : null;
		this.version = obj && obj.version != undefined ? obj.version : null;
		this.name = obj && obj.name != undefined ? obj.name : null;
	}
	
	function Account(obj) {
		this.id = obj && obj.id != undefined ? obj.id : null;
		this.version = obj && obj.version != undefined ? obj.version : null;
		this.name = obj && obj.name != undefined ? obj.name : null;
		this.credentials = obj && obj.credentials || [];
		this.groups = obj && obj.groups || [];
		this.roles = obj && obj.roles || [];
	}

	var db = WebDB('synched', {synch:true, synchUrl:'/api/webdb/synch'});
	db.createTable(Role, 'roles', {
		id: {type:Suid, pk:true},
		version: {type:Number, version:true},
		name: {type:String, unique:true},
	});
	db.createTable(Group, 'groups', {
		id: {type:Suid, pk:true},
		version: {type:Number, version:true},
		name: {type:String, unique:true},
	});
	db.createTable(Account, 'accounts', {
		id: {type:Suid, pk:true},
		version: {type:Number, version:true},
		name: {type:String, unique:true},
		roles: [Role],
		groups: [Group]
	});
	db.createTable('brands', {
		id: {type:Suid, pk:true},
		version: {type:Number, version:true},
		name: {type:String, unique:true},
		description: String,
		createdOn: {type:Date, index:true},
		updatedOn: {type:Date, index:true}
	});
	win.db = db;

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
		assert.ok(guestRole.id.equals(1), '`Guest` role has id 1');
		assert.ok(userRole.id.equals(2), '`User` role has id 2');
		var start = Date.now();
		db.synch().then(function ok(){
			var elapsed = Date.now() - start;
			log.info('Synch of already synched db succeeded in ' + elapsed + 'ms');
			// should happen fast, but browsers may take anywhere up to ~15ms to invoke callback on next tick
			// SEE https://www.nczonline.net/blog/2011/12/14/timer-resolution-in-browsers/
			assert.ok(elapsed < 20, 'Synching an already synched DB should be fast (took ' + elapsed + 'ms)');

			db.roles.set(new Role({id: Suid(10), name:'superman'}));
			var role = db.roles.get({name:'superman'})[0];
			assert.ok(role, 'Role `superman` inserted locally');
			assert.ok(db.roles.created.length === 1, 'One new role has been created locally');
			assert.ok(db.roles.synched === false, 'Roles table is now unsynched');
			assert.ok(db.synched === false, 'Database is now unsynched');
			
			start = Date.now();
			db.synch().then(function ok(){
				elapsed = Date.now() - start;
				log.info('Synch of unsynched db succeeded in ' + elapsed + 'ms');
				assert.ok(db.roles.denied.length === 1, 'Synching of one role has been denied');
				assert.ok(db.roles.denied[0] && db.roles.denied[0].name === 'superman', 'Denied role is `superman`');
				done();
			}).catch(function fail(e){
				log.error('Synch failed.', e);
				assert.ok(false, 'Synch failed.');
				done();
			});
		}).catch(function fail(e){
			log.error('Synch failed.', e);
			assert.ok(false, 'Synch failed.');
			done();
		});
	}).catch(function fail(e){
		log.error('Synch failed.', e);
		assert.ok(false, 'Synch failed.');
		done();
	});

//	db.brands.set({id:1, version:null, name: 'My Brand', createdOn:new Date(), updatedOn:null});

});
