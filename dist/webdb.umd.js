(function (u, m, d) {
	if (typeof define === 'function' && define.amd) {define('webdb', ["memorystorage"], function(a0){return (d(a0));});}
	else if (typeof exports === 'object') {module.exports = d(require("memorystorage"));}
	else {u[m] = d(u['MemoryStorage']);}
}(this, 'WebDB', function(MemoryStorage) {'use strict';

var DEFAULT_TABLE_DEF = {
	columns: {
		id: {type: Number},
		version: {type: Number}
	},
	primaryKey: 'id',
	version: 'version',
	foreignKeys: {},
	uniqueKeys: {},
	constraints: {},
	indexes: {},
	entityType: Object
};

var DBS = {};

function WebDB(name, options){
	// private variables
	var tables = {},
		definitions = {},
		synching = false;

	// private function
	function applyDefinition(name, def) {
		definitions[name] = DEFAULT_TABLE_DEF;
		if (def) {
			for (var key in def) {
				definitions[name][key] = def[key];
			}
		}
	}
	
	// make sure name is assigned
	name = name || 'default';
	// try to get existing db and return it if found
	if (DBS[name]) {return DBS[name];}
	// Allow for new-less invocation
	if (! (this instanceof WebDB)) {return new WebDB(name, options);}
	// create a new db and save a ref to it so we can get it back later
	var db = DBS[name] = this;
	Object.defineProperty(db, 'name', {value: name});
	Object.defineProperty(db, 'synching', {value: synching});
	Object.defineProperty(db, 'createTable', {
		enumerable: false,
		get: function() {return function createTable(name, def) {
			if (tables[name]) {
				throw new Error('A table named `' + name + '` already exists. Use alterTable() to change it\'s definition, or dropTable() to remove it.');
			}
			var table = tables[name] = new Table(name, def);
			applyDefinition(name, def);
			Object.defineProperty(table, 'db', {value: db});
			Object.defineProperty(table, 'definition', {value: definitions[name]});
			Object.defineProperty(db, name, {
				configurable: true, 
				enumerable: true,
				writable: false,
				value: tables[name]
			});
			return table;
		};}
	});
	Object.defineProperty(db, 'alterTable', {
		enumerable: false,
		get: function() {return function alterTable(name, def) {
			if (!tables[name]) {
				throw new Error('No table named `' + name + '` exists. Use createTable() to create it.');
			}
			applyDefinition(name, def);
			return tables[name];
		};}
	});
	Object.defineProperty(db, 'dropTable', {
		enumerable: false,
		get: function() {return function dropTable(name) {
			if (!tables[name]) {
				if (window.console && console.warn) {console.warn('Call to dropTable() is ignored.', new Error('No table named `' + name + '` exists.'));}
			}
			delete db[name];
			delete tables[name];
			delete definitions[name];
		};}
	});
	return db;
}

var Table = WebDB.Table = function Table(name, def) {
	// Allow for new-less invocation
	if (! (this instanceof Table)) {return new Table(name, def);}
	Object.defineProperty(this, 'name', {
		value: name
	});
		// the records themselves. This represents the current dataset
	var items = [],
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
		// object containing details on the error that caused there to be failed 
		// records, or null if there was no failure during last synch
		failure = null;

	// Now let's expose the API

	// getters for metadata
	Object.defineProperty(this, 'created', {get: function(){return created.concat();}});
	Object.defineProperty(this, 'updated', {get: function(){return updated.concat();}});
	Object.defineProperty(this, 'deleted', {get: function(){return deleted.concat();}});
	Object.defineProperty(this, 'stale', {get: function(){return stale.concat();}});
	Object.defineProperty(this, 'future', {get: function(){return future.concat();}});
	Object.defineProperty(this, 'failed', {get: function(){return failed.concat();}});
	Object.defineProperty(this, 'failure', {value: failure});

	// get, set & del
	Object.defineProperty(this, 'get', {
		get: function(){return function Table_get(criteria){
			return matches(items, criteria);
		};}
	});
	Object.defineProperty(this, 'set', {
		get: function(){return function Table_set(){
			// set accepts single items, multiple items, arrays, multiple arrays 
			// and any combination of those. Use eachArg to normalize it. 
			// The callback is called for every individual item
			var results = eachArg(arguments, this, function(item) {
				var backup = null, idx;
				
				// add or replace item
				idx = indexOf(items, item);
				if (idx === -1) {items.push(item);} 
				else {backup = items.splice(idx, 1, item)[0];}

				// item had been deleted previously?
				idx = indexOf(deleted, item);
				if (idx !== -1) {backup = deleted.splice(idx, 1);}

				// is this item already in the remote db?
				if (this.persistent(item)) {
					// YES, update it
					// item was updated before?
					idx = indexOf(updated, item);
					if (idx === -1) {updated.push(backup);}
					else {
						// it's already in updated list and we like to keep the original
						// and not some intermediate version, so don't overwrite it
						if (this.db.synching) {
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
				return [item]; // always return arrays for simplicity
			});
			// TODO change events... rethink this maybe
//			this.trigger('change');
			return results;
		};}
	});
	Object.defineProperty(this, 'del', {
		get: function(){return function Table_del(){
			var results = eachArg(arguments, this, function(item) {
				var backup, idx = indexOf(items, item);
				if (idx !== -1) {backup = items.splice(idx, 1)[0];}
				var createdIdx = indexOf(created, item);
				// if item is in remote db, it is not in created list
				if (createdIdx === -1) {
					// if item was in updated list, remove it
					idx = indexOf(updated, item);
					if (idx !== -1) {
						var removed = updated.splice(idx, 1);
						backup = backup || removed;
					}
					// if item was in future list, remove it
					idx = indexOf(future, item);
					if (idx !== -1) {future.splice(idx, 1);}
					// if item was not in deleted list, add it (old version if we have it)
					idx = indexOf(deleted, item);
					if (idx === -1) {deleted.push(backup || item);}
				}
				return [backup || item];
			});
			// this.trigger('change');
			return results;
		};}
	});
};

Table.prototype.persistent = function persistent(item) {
	return item[this.definition.version] !== null && item[this.definition.version] !== undefined;
};

Table.prototype.toJSON = function toJSON() {
};

Table.fromJSON = function fromJSON(/* value */) {
};

function eachArg(args, obj, fn) {
	if ('length' in args) {
		var results = [];
		for (var i=0,item; item=args[i]; i++) {
			results.push.apply(results, eachArg(item, obj, fn));
		}
		return results;
	}
	return fn.call(obj, args);
}

function equals(one, other, comparator) {
	return (one == other ||
			(comparator && comparator(one, other) === 0) ||
			one && one.equals && one.equals(other) ||
			other && other.equals && other.equals(one) ||
			(typeof one === 'object' && one && one.valueOf() == other) ||
			(typeof other === 'object' && other && other.valueOf() == one));
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
	var results = Array.prototype.concat.call(items || []);
	if (criteria) {
		for (var i=results.length-1; i>=0; i--) {
			for (var key in criteria) {
				if (criteria.hasOwnProperty(key)) {
					if ((Array.isArray && Array.isArray(criteria[key])) || (criteria[key] instanceof Array)) {
						if (indexOf(criteria[key], items[i][key]) === -1) {
							results.splice(i,1);
							break;
						}
					}
					else if (! equals(items[i][key], criteria[key])) {
						results.splice(i,1);
						break;
					}
				}
			}
		}
	}
	return results;
}



return WebDB;
}));
