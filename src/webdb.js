log && log.info('Found optional dependency `picolog`. Logging is enabled.');

function WebDB(name, options){
	var DEFAULT_DB_OPTIONS = {
		synch: false, // set this to true to allow the db to be synched to a remote counterpart
		synchUrl: '/api/webdb/synch', // set this to the correct url on your server 
		synchAuto: true, // After first manual synch it will auto-synch, unless you set this to false
		synchThrottleMs: 120000, // minimum time between synchs, in ms (default 3 sec.)
		synchPollMs: 3600000, // minimum time between polling synchs, in ms (default 1 hour)
		synchTimeout: 5000, // max time the request may take to complete before it is cancelled, in ms.
		synchRetryCount: 1, // how many times to retry failed requests
		synchRetryWait: 2000 // time to wait before retrying, in ms.
	};

	// make sure name is assigned
	name = name || 'webdb';
	// try to get existing db and return it if found
	if (DBS[name]) {return DBS[name];}
	// Allow for new-less invocation
	if (! (this instanceof WebDB)) {return new WebDB(name, options);}
	// Make sure all required options are present
	options = merge({}, DEFAULT_DB_OPTIONS, options);
	// save a ref to this db so we can get it back later
	var db = DBS[name] = this; 


	// ===== API =====

	// name
	Object.defineProperty(db, 'name', {enumerable: false, value: name});

	// options
	Object.defineProperty(db, 'options', {enumerable: false, get: function(){return merge({}, options); /* makes clone */}});

	// synching
	Object.defineProperty(db, 'synching', {enumerable: false, get: function(){return synching;}});

	// lastSynched
	Object.defineProperty(db, 'lastSynched', {enumerable: false, get: function(){return lastSynched;}});

	// synched
	Object.defineProperty(db, 'synched', {enumerable: false, get: function(){
		if (db.lastSynched.getTime() === 0) {return false;}
		for (var table in tables) {if (table.synched === false) {return false;}}
		return true;
	}});

	// upToDate
	Object.defineProperty(db, 'upToDate', {enumerable: false, get: function(){
		return Date.now() < lastSynched.getTime() + options.synchPollMs;
	}});

	// synchError
	Object.defineProperty(db, 'synchError', {enumerable: false, get: function() {return synchError;}});

	// createTable
	Object.defineProperty(db, 'createTable', {
		enumerable: false,
		get: function() {return function (name, def) {
			if (tables[name]) {
				throw new Error('A table named `' + name + '` already exists. Use alterTable() to change it\'s definition, or dropTable() to remove it.');
			}
			createTable(name, def);
			return tables[name];
		};}
	});

	// dropTable
	Object.defineProperty(db, 'dropTable', {
		enumerable: false,
		get: function() {return function dropTable(name) {
			if (!tables[name]) {
				log && log.warn('Call to dropTable() is ignored.', new Error('No table named `' + name + '` exists.'));
				return;
			}
			delete db[name];
			delete tables[name];
			delete definitions[name];
		};}
	});
	
	Object.defineProperty(db, 'synch', {
		enumerable: false,
		get: function() {return function synch(force) {
			// if already synching, get in line
			if (synching) {return synching;}
			// if auto synch has not started yet, but is enabled, schedule periodic synchs
			if (!auto && options.synchAuto) {auto = setInterval(synch, options.synchThrottleMs);}
			// start with a clean slate
			synchError = false;
			// return the promise that does the actual work
			return synching = new Promise(function(resolve, reject) {
				// if not forced synch, and db is synched and up-to-date, resolve right away.
				if (!force && db.synched && db.upToDate) {resolve();}

				// synching is needed
				try {
					log && log.info('Synching WebDB `' + db.name + '`...');
//						db.trigger('synch:started');
					var synchRequest = new SynchRequest();
					synchRemote(synchRequest).then(
						function ok(synchResponse){
							var changed = processSynch(synchResponse);
							lastSynched = new Date();
							synching = false;
							if (changed) {
								log && log.debug('WebDB `' + db.name + '` changed. Triggering change...');
//								db.trigger('change');
							} 
							log && log.debug('WebDB `' + db.name + '` triggering success....');
//							db.trigger('synch:success');
							resolve();
							log && log.debug('WebDB `' + db.name + '` triggering done....');
//							db.trigger('synch:done');
							log && log.debug('WebDB `' + db.name + '` synch done.');
							log && log.debug('WebDB `' + db.name + '` synched succesfully.');
						}, 
						function fail(e){
							log && log.warn('WebDB `' + db.name + '` failed to synch with remote server.', e);
							synching = false;
							synchError = e;
//							db.trigger('synch:failed');
							reject(e);
//							db.trigger('synch:done');
						}
					).catch(function err(e){
						log && log.error('WebDB `' + db.name + '` failed to process synch response from remote server.', e);
						synching = false;
						synchError = e;
//						db.trigger('synch:failed');
						reject(e);
//						db.trigger('synch:done');
					});
				}
				catch(e) { 
					log && log.error('WebDB `' + db.name + '` had an error during synching.', e);
					synching = false;
					synchError = e;
//					db.trigger('synch:failed');
					reject(e);
//					db.trigger('synch:done');
				}
			});
		};}
	});


	// Table
	function Table(name, meta) {
		var me = this;

		// db
		Object.defineProperty(me, 'db', {value: db});

		// name
		Object.defineProperty(me, 'name', {value: name});

		// definition
		Object.defineProperty(me, 'definition', {enumerable:true, get: function(){return definitions[name];}});

		// length
		Object.defineProperty(me, 'length', {enumerable:true, get: function(){return items.keyCount();}});

		// synched
		Object.defineProperty(me, 'synched', {enumerable:true, get: function(){
			return (!me.created || // synch not supported, so consider it synched
					(! (me.created.length || me.updated.length || me.deleted.length)));
		}});
		
		// get
		Object.defineProperty(me, 'get', {
			get: function(){return function Table_get(criteria, callback){
				if (typeof criteria == 'function') {callback=criteria; criteria=null;}
				return callback ? new Promise(function(resolve){resolve(get(criteria));}) : get(criteria);
			};}
		});
		
		// set
		Object.defineProperty(me, 'set', {
			get: function(){return function Table_set(){
				var callback;
				if (typeof arguments[arguments.length-1] == 'function') {
					callback = arguments[--arguments.length];
				}
				return callback ? new Promise(function (resolve){resolve(set.apply(me, arguments));}) : set.apply(me, arguments);
			};}
		});

		// del
		Object.defineProperty(me, 'del', {
			get: function(){return function Table_del(){
				var callback;
				if (typeof arguments[arguments.length-1] == 'function') {
					callback = arguments[--arguments.length];
				}
				return callback ? new Promise(function (resolve){resolve(del.apply(me, arguments));}) : del.apply(me, arguments);
			};}
		});

		// only for regular tables, not for meta tables
		if (!meta) {
			// synch
			Object.defineProperty(me, 'createSynchRequest', {
				get: function(){return function createSynchRequest() {
					var req = {ids:[], versions:[], created:[], updated:[], deleted:[]};
					req.created.push.apply(req.created, me.created);
					req.updated.push.apply(req.updated, me.updated);
					req.deleted.push.apply(req.deleted, me.deleted);
					items.visit(function(node){
						req.ids.push(node.key);
						req.versions.push(node.data[0][me.definition.version]);
					});
					return req;
				};}
			});
	
			Object.defineProperty(me, 'processSynchResponse', {
				get: function(){return function processSynchResponse(res) {
					var changed;
					if (handleCreated(res)) {changed = true;}
					if (handleUpdated(res)) {changed = true;}
					if (handleDeleted(res)) {changed = true;}
					handlePurged(res);
					handleStale(res);
					handleFailed(res);
					return !!changed;
				};}
			});

			// synch properties
			Object.defineProperty(me, 'created', {get: function(){return created.concat();}});
			Object.defineProperty(me, 'updated', {get: function(){return updated.concat();}});
			Object.defineProperty(me, 'deleted', {get: function(){return deleted.concat();}});
			Object.defineProperty(me, 'stale', {get: function(){return stale.concat();}});
			Object.defineProperty(me, 'future', {get: function(){return future.concat();}});
			Object.defineProperty(me, 'failed', {get: function(){return failed.concat();}});
			Object.defineProperty(me, 'failure', {get: function() {return failure;}});
		}


		// ===== PER-TABLE PRIVATE VARIABLES =====

		var 
		// the records themselves. This represents the current dataset
		items = new Index({unique:true, id:id, equals:itemEquals}),
		// stores indexes to increase search speed
		indexes = createIndexes();

		// only for regular tables
		if (!meta) {
			var
			// records that have been created at this side since last synch
			created = [],
			// old version of records that have been updated at this side since last synch
			updated = [],
			// records that have been deleted at this side since last synch
			deleted = [],
			// records that had been updated at this side but also on the server side 
			// and went stale since last synch
			stale = [],
			// records that had been updated before and then were updated again while a 
			// synch was in progress and hence would be considered stale when synch completes
			// these will overwrite the server result as we may safely assume the user
			// will choose his own new edits vs his own old edits.
			future = [],
			// records that could not be saved to the server
			failed = [],
			// object containing details on the error that caused synch failure, 
			// or null if there was no failure during last synch
			failure = null;
			
			db.tables.set({name: name});
			for (var col in definitions[name].columns) {
				var def = {id:db.columns.length+1, name:col, table:name};
				def = merge(def, DEFAULT_COLUMN_DEF, definitions[name].columns[col]);
				db.columns.set(def);
			}
		}


		// ===== PER-TABLE PRIVATE FUNCTIONS =====
		// note the use of variable 'me' and other per-table private vars here

		var pkCol = meta ? 'name' : db.columns.get({table:name, pk:true})[0].name;
		
		function id(item) {return item[pkCol];}

		function itemEquals(a, b){
			// This function assumes the object has the id column in it
			a = typeof a == 'object' ? id(a) : a;
			b = typeof b == 'object' ? id(b) : b;
			return equals(a, b);
		}

		function createIndexes() {
			var col, res = {};
			for (col in me.definition.columns) {
				if (me.definition.columns[col].fk || me.definition.columns[col].unique || me.definition.columns[col].index) {
					res[col] = new Index({unique:me.definition.columns[col].unique});
				}
			}
			return res;
		}

		function get(criteria) {
			var i, j, key, pk, pks, fast={}, slow={}, idSet={}, results=[];
			if ((typeof criteria != 'object') && (Object(criteria) instanceof me.definition.columns[pkCol].type)) {
				pk = criteria;
				criteria = {};
				criteria[pkCol] = pk;
			}
			for (key in criteria) {
				if (pkCol === key) {pks = criteria[key];}
				else if (indexes[key]) {fast[key] = criteria[key];}
				else {slow[key] = criteria[key];}
			}
			var tableScan = true;
			if (typeof pks != 'undefined') {
				if (!Array.isArray(pks)) {pks = [pks];}
				for (i=0; i<pks.length; i++) {idSet[pks[i]] = 1;}
				tableScan = false;
			}
			for (key in fast) {
				if (!Array.isArray(fast[key])) {fast[key] = [fast[key]];}
				for (i=0; i<fast[key].length; i++) {
					pks = indexes[key].search(fast[key][i]);
					var newIdSet = {};
					for (j=0; j<pks.length; j++) {
						if (tableScan || idSet[pks[j]]) { // on first iteration, add all found results
							newIdSet[pks[j]] = 1;
						}
					}
					idSet = newIdSet;
					tableScan = false;
				}
			}
			if (tableScan) {
				items.visit(function(node){results.push.apply(results, node.data);});
			}
			else {
				for (pk in idSet) {
					var records = items.search(pk);
					if (records.length) {results.push(records[0]);}
				}
			}
			for (i=0; i<results.length; i++) {
				if (! (results[i] instanceof me.definition.entityType)) {
					results[i] = me.definition.factory(results[i]);
				}
			}
			return Object.keys(slow).length ? matches(results, slow) : results;
		}
		
		function set() {
			// set accepts single items, multiple items, arrays, multiple arrays 
			// and any combination of those. Use eachArg to normalize it. 
			// The callback is called for every individual item
			var results = eachArg(arguments, me, function(item) {
				var backup = handleSet(item);
				handleSetHistory(item, backup);
				return [item]; // always return arrays for simplicity
			});
			return results;
		}

		function handleSet(item) {
			var backup, idx;
			// add or replace item
			var existing = items.search(item);
			if (existing.length) {
				backup = existing[0];
				items.update(id(item), item);
				for (idx in indexes) {
					// indexed field changed?
					if (backup[idx] != item[idx]) {
						// yes, remove old value from index and insert new one
						indexes[idx].remove(backup[idx]);
						indexes[idx].insert(item[idx], id(item));
					}
				}
			}
			else {
				items.insert(id(item), item);
				// include item in indexes
				for (idx in indexes) {
					// insert field value in index
					indexes[idx].insert(item[idx], id(item));
				}
			}
			return backup;
		}

		function handleSetHistory(item, backup) {
			var idx;
			if (!meta && db.options.synch) {
				// item had been deleted previously?
				idx = indexOf(deleted, item);
				if (idx !== -1) {backup = deleted.splice(idx, 1);}

				// is this item already in the remote db?
				if (me.persistent(item)) {
					// YES, update it
					// item was updated before?
					idx = indexOf(updated, item);
					if (idx === -1) {updated.push(backup);}
					else {
						// it's already in updated list and we like to keep the original
						// and not some intermediate version, so don't overwrite it
						if (me.db.synching) {
							// the synch is already in progress... meaning when we get 
							// back the saved item our new version would appear stale... 
							// So put the new version of the item in the future list
							idx = indexOf(future, item);
							if (idx === -1) {future.push(item);}
							else {future.splice(idx, 1, item);}
						}
					}
				} 
				else {
					idx = indexOf(created, item);
					if (idx === -1) {created.push(item);}
					idx = indexOf(deleted, item);
					if (idx !== -1) {deleted.splice(idx, 1);}
				}
			}
			return backup;
		}

		function del() {
			var results = eachArg(arguments, me, function(item) {
				var backup = handleDel(id(item));
				backup = handleDelHistory(item, backup);
				return [backup || item];
			});
			// this.trigger('change');
			return results;
		}

		function handleDel(id) {
			var backup, 
				idx, 
				existing = items.search(id);
			if (existing.length) {
				backup = existing[0];
				items.remove(id);
				for (idx in indexes) {
					// remove value from index
					indexes[idx].remove(backup[idx]);
				}
			}
			return backup;
		}

		function handleDelHistory(item, backup) {
			var idx, createdIdx, removed;
			if (!meta && db.options.synch) {
				createdIdx = indexOf(created, item);
				// if item is in remote db, it is not in created list
				if (createdIdx === -1) {
					// if item was in updated list, remove it
					idx = indexOf(updated, item);
					if (idx !== -1) {
						removed = updated.splice(idx, 1)[0];
						backup = backup || removed;
					}
					// if item was in future list, remove it
					idx = indexOf(future, item);
					if (idx !== -1) {future.splice(idx, 1);}
					// if item was not in deleted list, add it (old version if we have it)
					idx = indexOf(deleted, item);
					if (idx === -1) {deleted.push(backup || item);}
				}
			}
			return backup;
		}

		function responseItem(response, record) {
			if (record === undefined) {return record;}
			var result = {}; 
			for (var i=0,col; col=response.columns[i]; i++) {
				result[col] = record[i];
			}
			// TODO custom entity types
			// E.G. result = new entityType(result);
			return result;
		}
		
		function handleCreated(response) {
			var changed, i, item;
			for (i=0; item=responseItem(response, response.created[i]); i++) {
				if (!handleSet(item)) {changed = true;}
			}
			log && response.created.length && log.debug('Processed ' + response.created.length + ' created items.');
			return !!changed;
		}

		function handleUpdated(response) {
			var changed, i, item, idx, key, fut, merged;
			for (i=0; item=responseItem(response, response.updated[i]); i++) {
				// if we have future items, try to merge the changes into the new version of the item
				idx = indexOf(future, item);
				if (idx !== -1) {
					// get future item and remove from list
					fut = future.splice(idx, 1)[0];
					// replace updated item with version from server
					idx = indexOf(updated, item);
					if (idx !== -1) {updated.splice(idx, 1, item);}
					else {updated.push(item);}
					// now merge changes from future item onto server item
					merged = merge({}, item); // makes clone
					for (key in fut) {
						if (key !== me.definition.version) {
							merged[key] = fut[key]; 
						}
					}
					// replace item with the merged version
					handleSet(merged);
				}
				else {
					// remove saved item from the updated items list
					idx = indexOf(updated, item);
					if (idx !== -1) {updated.splice(idx, 1);}
					else {changed = true;}
					// replace item with the saved version
					handleSet(item);
				}
			}
			log && response.updated.length && log.debug('Processed ' + response.updated.length + ' updated items.');
			return !!changed;
		}

		function handleDeleted(response){
			var i, id, idx, changed;
			for (i=0; id=response.deletedIds[i]; i++) {
				if (handleDel(id)) {changed = true;}
				idx = indexOf(deleted, id);
				if (idx !== -1) {deleted.splice(idx, 1);}
			}
			log && response.deletedIds.length && log.debug('Processed ' + response.deletedIds.length + ' deleted items.');
			return !!changed;
		}

		
		function handleStale(response) {
			var i, item, idx;
			for (i=0; item=responseItem(response, response.stale[i]); i++) {
				idx = indexOf(stale, item);
				if (idx === -1) {stale.push(item);}
				else {stale.splice(idx, 1, item);}
				clearHistory(item);
			}
			log && response.stale.length && log.debug('Processed ' + response.stale.length + ' stale items.');
		}

		function handleFailed(response) {
			var i, item, idx;
			for (i=0; item=responseItem(response, response.failed[i]); i++) {
				idx = indexOf(failed, item);
				if (idx === -1) {failed.push(item);}
				else {failed.splice(idx, 1, item);}
				clearHistory(item);
			}
			log && response.failed.length && log.debug('Processed ' + response.failed.length + ' failed items.');
		}

		function handlePurged(/*response*/) {
			// TODO handle purged items
		}

		function clearHistory(item) {
			var idx;
			idx = indexOf(created, item);
			if (idx !== -1) {created.splice(idx, 1);}
			idx = indexOf(updated, item);
			if (idx !== -1) {updated.splice(idx, 1);}
			idx = indexOf(deleted, item);
			if (idx !== -1) {deleted.splice(idx, 1);}
		}
	}
	// /Table

	Table.prototype.persistent = function persistent(item) {
		return item[this.definition.version] !== null && item[this.definition.version] !== undefined;
	};

	Table.prototype.toJSON = function toJSON() {
	};

	Table.fromJSON = function fromJSON(/* value */) {
	};

	function SynchRequest() {
		this.lastSynched = lastSynched;
		for (var i=0,table; table=tables[i]; i++) {
			this[table.name] = table.createSynchRequest();
		}
	}

	function processSynch(response) {
		var changed, names = Object.keys(response);
		for (var i=0,name; name=names[i]; i++) {
			var p = tables[name] && tables[name].processSynchResponse; 
			if (p && p(response[name])) {changed = true;}
		}
		return changed;
	}

	function synchRemote(synchRequest) {
		return new Promise(function(resolve, reject) {
			var retries = options.synchRetryCount;
			trySynch();
			return;

			function trySynch() {
				var xhr = new XMLHttpRequest(); 
				xhr.open('post', options.synchUrl, true);
				xhr.setRequestHeader('Content-Type', 'application/json');
				xhr.timeout = options.synchTimeout;
				xhr.addEventListener('readystatechange', ready); 
				xhr.addEventListener('error', error); 
				xhr.addEventListener('timeout', error); 
				xhr.send(JSON.stringify(synchRequest)); 
			}
			
			function ready() {
				if (this.readyState === 4) { 
					this.status === 200 ? 
						success.call(this) : 
						error.call(this);
				}
			}

			function success() {
				retries = 0;
				resolve(JSON.parse(this.responseText));
			}

			function error() {
				// status code 5xx ? possibly recoverable.
				switch(this.status) {
					case 500: // Internal server error
					case 502: // Bad Gateway
					case 503: // Service unavailable
					case 504: // Gateway Timeout
						if (retries > 0) {
							retry(); 
							break;
						}
						/* falls through */
					default: // unrecoverable? give up 
						log && log.error('WebDB `' + db.name + '`: Unable to synch with remote server.', this);
						retries = 0;
						reject(this);
				}
			}
			
			function retry() {
				retries--;
				setTimeout(function(){
					trySynch();
				}, options.synchRetryWait);
			}
		});
	}

	// Per-DB private variables
	// Note the use of `db`
	var 
	DEFAULT_TABLE_DEF = {
		columns: {
			id: {type:Number, pk:true}
		},
		entityType: Object, // The type of the items stored in this table
		// a factory function for creating the items based on the stored records
		factory: function(record){return new this.entityType(record);}
	},
	DEFAULT_COLUMN_DEF = {
		type: undefined,
		length: 0,
		notnull: false,
		pk: false,
		fk: undefined,
		unique: false,
		index: false
	},
	META_TABLES_DEF = {
		columns: {
			name: {type:String, length:32, pk:true}
		}
	},
	META_COLUMNS_DEF = {
		columns: {
			id: {type:Number, pk:true},
			name: {type:String, length:32, index:true},
			table: {type:String, length:32, notnull:true, fk:'tables'},
			type: Function,
			length: Number,
			notnull: Boolean,
			pk: Boolean,
			fk: {type:String, length:32},
			unique: Boolean,
			index: Boolean
		}
	},
	tables = {},
	definitions = {},
	synching = false,
	lastSynched = new Date(0),
	synchError = null,
	auto = false;


	// ===== INITIALIZATION =====

	createTable('tables', META_TABLES_DEF, true /* meta */);
	createTable('columns', META_COLUMNS_DEF, true /* meta */);
	// meta data about the meta tables...
	db.tables.set({name:'tables'}, {name:'columns'});
	for (var col in META_TABLES_DEF.columns) {db.columns.set(merge({id:db.columns.length+1, name:col, table:'tables'}, META_TABLES_DEF.columns[col]));}
	for (var col in META_COLUMNS_DEF.columns) {db.columns.set(merge({id:db.columns.length+1, name:col, table:'columns'}, META_COLUMNS_DEF.columns[col]));}
	return db;


	// ===== PER-DB PRIVATE FUNCTIONS =====

	function merge() {
		var i,j,args,arg,key,result=[].splice.call(arguments, 0, 1)[0] || {};
		for (i=0; args=arguments[i]; i++) {
			if (! Array.isArray(args)) {args = [args];}
			for (j=0; arg=args[j]; j++) {
				for (key in arg) {result[key] = arg[key];}
			}
		}
		return result;
	}

	function expandDef(def) {
		if (!def) {def = DEFAULT_TABLE_DEF;}
		if (!def.columns) {def = {columns: def};}
		var pk;
		for (var col in def.columns) {
			if (typeof def.columns[col] == 'function') {def.columns[col] = {type: def.columns[col]};}
			if (def.columns[col].pk) {
				if (pk) {throw new Error('Multiple primary key columns found in table definition: `' + def.pk + '` and `' + col + '`.');}
				pk = col;
			}
		}
		if (!pk) {throw new Error('No primary key column found in table definition.');}
		return def;
	}

	function createTable(name, def, meta) {
		definitions[name] = merge(definitions[name] || {}, DEFAULT_TABLE_DEF, expandDef(def));
		Object.defineProperty(db, name, {
			configurable: true, 
			enumerable: true,
			writable: false,
			value: tables[name] = new Table(name, meta)
		});
	}
	
	log && log.info('Created WebDB named `' + db.name + '`' + options.synch ? ', synched to ' + options.synchUrl : '.');
}

// ===== 'GLOBAL' PRIVATE VARIABLES =====
var DBS = {};


// ===== 'GLOBAL' PRIVATE FUNCTIONS =====
function eachArg(args, obj, fn) {
	if (('length' in args) && args.length && args[args.length-1]) {
		var results = [];
		for (var i=0,item; item=args[i]; i++) {
			results.push.apply(results, eachArg(item, obj, fn));
		}
		return results;
	}
	return fn.call(obj, args);
}

function equals(one, other) {
	return (one === other ||
			one.equals && one.equals(other) ||
			other.equals && other.equals(one) ||
			(typeof one === 'object' && one.valueOf() == other) ||
			(typeof other === 'object' && other.valueOf() == one) ||
			(typeof one === 'object' && typeof other === 'object' && one.valueOf() == other.valueOf()));
}

// returns index of given element in given list, using given comparator
function indexOf(list, element, comparator) {
	for (var i=0,item; item=list[i]; i++) {
		if (equals(item, element, comparator)) {
			return i;
		}
	}
	return -1;
}

function matches(items, criteria) {
	var i, item, key, match, len=0, results = new Array(items.length);
	for (i=0,item; item=items[i]; i++) {
		match = true;
		for (key in criteria) {
			if ((Array.isArray && Array.isArray(criteria[key])) || (criteria[key] instanceof Array)) {
				if (indexOf(criteria[key], item[key]) === -1) {
					match = false;
					break;
				}
			}
			else if (! equals(items[i][key], criteria[key])) {
				match = false;
				break;
			}
		}
		if (match) {results[len++] = item;}
	}
	results.length = len;
	return results;
}

// Based on code by [Louis Chatriot](https://github.com/louischatriot)
// from his project [node-binary-search-tree](https://github.com/louischatriot/node-binary-search-tree)
// Licensed under MIT
var Index = WebDB.Index = (function(){
	// Default key comparison and data equality comparison functions
	function compare (a, b) {return a < b ? -1 : a > b ? 1 : 0;}
	function equals (a, b) {return a === b;}
	
	/**
	 * Creates a new Tree.
	 *
	 * @param {Object} Optional options object
	 * @param {Boolean}  options.unique Whether to enforce a 'unique' constraint on the key or not
	 * @param {Function} options.compare Optional key comparison function
	 * @param {Function} options.equals Optional data equality comparison function
	 * @param {Function} options.id Optional id extraction function
	 */
	function Tree(options) {
		this.root = new Node(this, options);
		this.unique = options && options.unique || false;
		this.compare = options && options.compare || compare;
		this.equals = options && options.equals || equals;
		this.id = options && options.id || undefined;
	}

	Tree.prototype.insert = function (key, value) {
		this.root = this.root.insert(key, value);
	};

	Tree.prototype.remove = function (key, value) {
		this.root = this.root.remove(key, value);
	};

	['update', 'keyCount', 'search', 'visit'].forEach(function(fn) {
		Tree.prototype[fn] = function () {return this.root[fn].apply(this.root, arguments);};
	});

	/**
	 * Creates a new Node.
	 *
	 * @param {Object} Optional options object. 
	 * @param {Node}     options.parent Initialize this Node's parent
	 * @param {Key}      options.key Initialize this Node's key
	 * @param {Value}    options.value Initialize this Node's value
	 */
	function Node(tree, options) {
		this.tree = tree;
		if (options && options.parent) {this.parent = options.parent;}
		if (options && options.hasOwnProperty('key')) { this.key = options.key; }
		this.data = options && options.hasOwnProperty('value') ? [options.value] : [];
	}

	/**
	 * Inserts a key/value pair in the tree. 
	 * Returns a pointer to the root node, which may have changed
	 * Throws an exception if the tree has a unique constraint and the key is already present.
	 */
	Node.prototype.insert = function Node_insert(key, value) {
		var insertPath = [], 
			current = this;
		// Empty tree, insert as root
		if (!this.hasOwnProperty('key')) {
			this.key = key;
			this.data.push(value);
			this.height = 1;
			return this;
		}
		// Find node to insert
		while (true) {
			// Same key: no change in the tree structure
			if (this.tree.compare(current.key, key) === 0) {
				if (this.tree.unique) {throw new Error('Can\'t insert key ' + key + ', it violates the unique constraint.');} 
				current.data.push(value);
				return this;
			}

			insertPath.push(current);

			if (this.tree.compare(key, current.key) < 0) {
				if (!current.left) {
					current.left = new current.constructor(current.tree, {parent:current, key:key, value:value});
					insertPath.push(current.left);
					break;
				} else {
					current = current.left;
				}
			} else {
				if (!current.right) {
					current.right = new current.constructor(current.tree, {parent:current, key:key, value:value});
					insertPath.push(current.right);
					break;
				} else {
					current = current.right;
				}
			}
		}
		return rebalanceAlongPath(this, insertPath);
	};

	/**
	 * Updates a key/value pair in the tree. 
	 * Throws an exception if the key is not already present.
	 */
	Node.prototype.update = function Node_update(key, value) {
		// Handle empty tree
		if (!this.hasOwnProperty('key')) {throw new Error('Can\'t update value [' + value + '] for key [' + key + ']. Key does not exist.');}
		// Find node to update
		var current = this;
		while (true) {
			// Same key: no change in the tree structure
			if (this.tree.compare(current.key, key) === 0) {
				var idx = -1;
				for (var i=0,val; val=current.data[i]; i++) {
					if (this.tree.equals(val, value)) {idx = i; break;}
				}
				if (idx == -1) {throw new Error('Can\'t update value [' + value + '] for key [' + key + ']. Value is not present.');}
				current.data.splice(idx, 1, value);
				return this;
			}

			if (this.tree.compare(key, current.key) < 0) {
				if (!current.left) {throw new Error('Can\'t update value [' + value + '] for key [' + key + ']. Key does not exist.');}
				current = current.left;
			} 
			else {
				if (!current.right) {throw new Error('Can\'t update value [' + value + '] for key [' + key + ']. Key is not present.');}
				current = current.right;
			}
		}
	};

	/**
	 * Remove a key or just a value and return the new root of the tree
	 * @param {Key} key
	 * @param {Value} value Optional. If not set, the whole key is deleted. If set, only this value is deleted
	 */
	Node.prototype.remove = function (key, value) {
		var newData = [], 
			replaceWith, 
			current = this, 
			path = [];
		if (!this.hasOwnProperty('key')) { return this; }   // Empty tree
		// Either no match is found and the function will return from within the loop
		// Or a match is found and path will contain the path from the root to the node to delete after the loop
		while (true) {
			if (this.tree.compare(key, current.key) === 0) { break; }
			path.push(current);
			if (this.tree.compare(key, current.key) < 0) {
				if (current.left) {current = current.left;} 
				else {return this;}   // Key not found, no modification
			} 
			else {
				// this.tree.compare(key, current.key) is > 0
				if (current.right) {current = current.right;} 
				else {return this;}   // Key not found, no modification
			}
		}
		// Delete only a value (no tree modification)
		if (current.data.length > 1 && value) {
			current.data.forEach(function (d) {
				if (!this.tree.equals(d, value)) { newData.push(d); }
			});
			current.data = newData;
			return this;
		}
		// Delete a whole node
		// Leaf
		if (!current.left && !current.right) {
			if (current === this) {   // This leaf is also the root
				delete current.key;
				current.data = [];
				delete current.height;
				return this;
			} 
			else {
				if (current.parent.left === current) {current.parent.left = null;} 
				else {current.parent.right = null;}
				return rebalanceAlongPath(this, path);
			}
		}
		// Node with only one child
		if (!current.left || !current.right) {
			replaceWith = current.left ? current.left : current.right;
			if (current === this) {   // This node is also the root
				replaceWith.parent = null;
				return replaceWith;   // height of replaceWith is necessarily 1 because the tree was balanced before deletion
			} 
			else {
				if (current.parent.left === current) {
					current.parent.left = replaceWith;
					replaceWith.parent = current.parent;
				} 
				else {
					current.parent.right = replaceWith;
					replaceWith.parent = current.parent;
				}
				return rebalanceAlongPath(this, path);
			}
		}
		// Node with two children
		// Use the in-order predecessor (no need to randomize since we actively rebalance)
		path.push(current);
		replaceWith = current.left;
		// Special case: the in-order predecessor is right below the node to delete
		if (!replaceWith.right) {
			current.key = replaceWith.key;
			current.data = replaceWith.data;
			current.left = replaceWith.left;
			if (replaceWith.left) { replaceWith.left.parent = current; }
			return rebalanceAlongPath(this, path);
		}
		// After this loop, replaceWith is the right-most leaf in the left subtree
		// and path the path from the root (inclusive) to replaceWith (exclusive)
		while (true) {
			if (replaceWith.right) {
				path.push(replaceWith);
				replaceWith = replaceWith.right;
			} 
			else {break;}
		}
		current.key = replaceWith.key;
		current.data = replaceWith.data;
		replaceWith.parent.right = replaceWith.left;
		if (replaceWith.left) { replaceWith.left.parent = replaceWith.parent; }
		return rebalanceAlongPath(this, path);
	};

	/**
	 * Get number of keys inserted
	 */
	Node.prototype.keyCount = function () {
		if (!this.hasOwnProperty('key')) { return 0; }
		var res = 1;
		if (this.left) { res += this.left.keyCount(); }
		if (this.right) { res += this.right.keyCount(); }
		return res;
	};

	/**
	 * Search for all data corresponding to the query
	 */
	Node.prototype.search = function(query) {
		if (!this.hasOwnProperty('key')) { return []; }
		var key;
		if (typeof query == 'object') {
			if (query.hasOwnProperty('$gt') || query.hasOwnProperty('$gte') || 
				query.hasOwnProperty('$lt') || query.hasOwnProperty('$lte')) {
				// bounds query
				return betweenBounds(this, query);
			}
			if (this.tree.id) {
				key = this.tree.id(query);
			}
		}
		else {key = query;}
		if (key === undefined) {return [];}
		if (this.tree.compare(this.key, key) === 0) { return this.data; }
		if (this.tree.compare(key, this.key) < 0) {
			if (this.left) {return this.left.search(key);} 
			else {return [];}
		} 
		else if (this.right) {return this.right.search(key);} 
		else {return [];}
	};

	/**
	 * Execute a function on every node of the tree, in key order
	 * @param {Function} fn Signature: node. Most useful will probably be node.key and node.data
	 */
	Node.prototype.visit = function (fn) {
		if (this.left) { this.left.visit(fn); }
		fn(this);
		if (this.right) { this.right.visit(fn); }
	};

	/**
	 * Return a function that tells whether a given key matches a lower bound
	 */
	function getLowerBoundMatcher(compare, query) {
		// No lower bound
		if (!query.hasOwnProperty('$gt') && !query.hasOwnProperty('$gte')) {
			return function(){return true;};
		}
		if (query.hasOwnProperty('$gt') && query.hasOwnProperty('$gte')) {
			if (compare(query.$gte, query.$gt) === 0) {
				return function (key) { return compare(key, query.$gt) > 0; };
			}
			if (compare(query.$gte, query.$gt) > 0) {
				return function (key) { return compare(key, query.$gte) >= 0; };
			} else {
				return function (key) { return compare(key, query.$gt) > 0; };
			}
		}
		if (query.hasOwnProperty('$gt')) {
			return function (key) { return compare(key, query.$gt) > 0; };
		} else {
			return function (key) { return compare(key, query.$gte) >= 0; };
		}
	}

	/**
	 * Return a function that tells whether a given key matches an upper bound
	 */
	function getUpperBoundMatcher(compare, query) {
		// No lower bound
		if (!query.hasOwnProperty('$lt') && !query.hasOwnProperty('$lte')) {
			return function () { return true; };
		}
		if (query.hasOwnProperty('$lt') && query.hasOwnProperty('$lte')) {
			if (compare(query.$lte, query.$lt) === 0) {
				return function (key) { return compare(key, query.$lt) < 0; };
			}
			if (compare(query.$lte, query.$lt) < 0) {
				return function (key) { return compare(key, query.$lte) <= 0; };
			} else {
				return function (key) { return compare(key, query.$lt) < 0; };
			}
		}
		if (query.hasOwnProperty('$lt')) {
			return function (key) { return compare(key, query.$lt) < 0; };
		} else {
			return function (key) { return compare(key, query.$lte) <= 0; };
		}
	}

	/**
	 * Get all data for a key between bounds
	 * Return it in key order
	 * @param {Node} Node to execute on
	 * @param {Object} query Mongo-style query where keys are $lt, $lte, $gt or $gte (other keys are not considered)
	 * @param {Functions} lbm/ubm matching functions calculated at the first recursive step
	 */
	function betweenBounds(node, query, lbm, ubm) {
		var res = [];
		if (!node.hasOwnProperty('key')) { return res; }   // Empty tree
		lbm = lbm || getLowerBoundMatcher(node.tree.compare, query);
		ubm = ubm || getUpperBoundMatcher(node.tree.compare, query);
		if (lbm(node.key) && node.left) { res.push.apply(res, betweenBounds(node.left, query, lbm, ubm)); }
		if (lbm(node.key) && ubm(node.key)) { res.push.apply(res, node.data); }
		if (ubm(node.key) && node.right) { res.push.apply(res, betweenBounds(node.right, query, lbm, ubm)); }
		return res;
	}

	/**
	 * Return the balance factor of the given node
	 */
	function balanceFactor(node) {
		return (node.left ? node.left.height : 0) - (node.right ? node.right.height : 0);
	}

	/**
	 * Performs a right rotation of the tree at the given node (if possible)
	 * Returns the root of the resulting tree
	 * The resulting tree's nodes' heights are also updated
	 */
	function rightRotation(node) {
		var q = node, 
			p = node.left, 
			b, ah, bh, ch;
		if (!p) { return q; }   // No change
		b = p.right;
		// Alter tree structure
		if (q.parent) {
			p.parent = q.parent;
			if (q.parent.left === q) { q.parent.left = p; } else { q.parent.right = p; }
		} else {
			p.parent = null;
		}
		p.right = q;
		q.parent = p;
		q.left = b;
		if (b) { b.parent = q; }
		// Update heights
		ah = p.left ? p.left.height : 0;
		bh = b ? b.height : 0;
		ch = q.right ? q.right.height : 0;
		q.height = Math.max(bh, ch) + 1;
		p.height = Math.max(ah, q.height) + 1;
		return p;
	}

	/**
	 * Perform a left rotation of the tree if possible
	 * and return the root of the resulting tree
	 * The resulting tree's nodes' heights are also updated
	 */
	function leftRotation(node) {
		var p = node, 
			q = node.right, 
			b, ah, bh, ch;
		if (!q) { return p; }   // No change
		b = q.left;
		// Alter tree structure
		if (p.parent) {
			q.parent = p.parent;
			if (p.parent.left === p) { p.parent.left = q; } else { p.parent.right = q; }
		} else {
			q.parent = null;
		}
		q.left = p;
		p.parent = q;
		p.right = b;
		if (b) { b.parent = p; }
		// Update heights
		ah = p.left ? p.left.height : 0;
		bh = b ? b.height : 0;
		ch = q.right ? q.right.height : 0;
		p.height = Math.max(ah, bh) + 1;
		q.height = Math.max(ch, p.height) + 1;
		return q;
	}

	/**
	 * Modify the tree if its right subtree is too small compared to the left
	 * Return the new root if any
	 */
	function rightTooSmall(node) {
		if (balanceFactor(node) <= 1) { return node; }   // Right is not too small, don't change
		if (balanceFactor(node.left) < 0) {leftRotation(node.left);}
		return rightRotation(node);
	}

	/**
	 * Modify the tree if its left subtree is too small compared to the right
	 * Return the new root if any
	 */
	function leftTooSmall(node) {
		if (balanceFactor(node) >= -1) { return node; }   // Left is not too small, don't change
		if (balanceFactor(node.right) > 0) {rightRotation(node.right);}
		return leftRotation(node);
	}

	/**
	 * Rebalance the tree along the given path. The path is given reversed (as he was calculated
	 * in the insert and delete functions).
	 * Returns the new root of the tree
	 * Of course, the first element of the path must be the root of the tree
	 */
	function rebalanceAlongPath(node, path) {
		var newRoot = node, 
			rotated, i;
		if (!node.hasOwnProperty('key')) { delete node.height; return node; }   // Empty tree
		// Rebalance the tree and update all heights
		for (i = path.length - 1; i >= 0; i -= 1) {
			path[i].height = 1 + Math.max(path[i].left ? path[i].left.height : 0, path[i].right ? path[i].right.height : 0);
			if (balanceFactor(path[i]) > 1) {
				rotated = rightTooSmall(path[i]);
				if (i === 0) { newRoot = rotated; }
			}
			if (balanceFactor(path[i]) < -1) {
				rotated = leftTooSmall(path[i]);
				if (i === 0) { newRoot = rotated; }
			}
		}
		return newRoot;
	}

	return Tree;
})();