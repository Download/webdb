# WebDB <sup><sub>v0.5.0</sub></sup>
**If the client can't get to the database, we bring the database to the client.**
[project website](https://download.github.io/webdb)

## WebDB
Traditional web apps get everything they show from the server and send any user input to the server. 
As the user browses through the site, the same data is fetched over and over. And if the user
goes offline, the app stops functioning.

What if we could download the server database to the client and perform queries against it there?

### Smart subset
I know what you are thinking. There is way too much data to download the entire database right?

But think about this some more. Facebook has hundreds of milions of active users, who collectively 
post billions of status updates, photos, videos and chat messages each day. But most of that data
is irrelevant to any single user. For most users, only those people they are friends with and the 
posts made by those friends, are relevant.

What if we could define a subset of our total server data, based on characteristics of the user
(such as who their friends are) and actively keep a local copy of that subset synched right there 
on the user's machine? We would be able to offer offline functionality. We would potentially get
*extremely* fast response times due to no network latency. Life would be better.

This is what WebDB tries to accomplish. It allows you to define a database schema on the client 
side (corresponding to the subset of data that is relevant to this client) and keep it synched
with the server automagically.

It consists of a client-side component (that you are looking at right now) which can be used 
stand-alone or together with a server side component that connects it to the full-blown server
database and handles synch messages.

## Get WebDB
WebDB can be used directly from CDN, through a regular download, or installed with NPM.

### CDN
This is the easiest way to use WebDB:
```xml
<script src="https://cdn.rawgit.com/download/webdb/0.5.0/dist/webdb.min.js"></script>
```

### Download
If you'd rather host the file on your own server, or use the debug version:
* [webdb.min.js](https://cdn.rawgit.com/download/webdb/0.5.0/dist/webdb.min.js) (~4kB gzipped+minified, ~12kB minified)
* [webdb.umd.js](https://cdn.rawgit.com/download/webdb/0.5.0/dist/webdb.umd.js) (~30kB commented)
* [webdb.min.js.map](https://cdn.rawgit.com/download/webdb/0.5.0/dist/webdb.min.js.map) (~17kB debug info)

### NPM
```sh
npm install webdb
```

## Include WebDB on your page
WebDB supports the Universal Module Definition and can be used directly from a script tag,
through an AMD script loader such as RequireJS, or through a CommonJS loader.

### Script tag
Plain and simple:
```xml
<script src="//cdn.rawgit.com/download/webdb/0.5.0/dist/webdb.min.js"></script>
```

### AMD loader
```js
define(['webdb'], function(WebDB){
	// WebDB is available here
});
```

If you want to load the script from CDN, configure like so:
```js
require.config({
	paths: {
		'webdb': '//cdn.rawgit.com/download/webdb/0.5.0/dist/webdb.min',
	}
});
```

### CJS loader
```js
var WebDB = require('webdb');
// WebDB is available here
```

## Use WebDB
Once loaded, you can start using WebDB. In general, you will:
* Create a new WebDB
* Create a new schema
* Synch the DB manually
* Run queries against the DB
* Create/Read/Update/Delete items in the DB
* Enjoy your data being auto-synched to the server as needed.

### Create a new WebDB
You can use WebDB completely stand-alone or synched to a server, which makes it that much more powerful.

To create a new WebDB, we invoke the `WebDB` constructor function, which has this signature:
```js
function WebDB(name, options)
```
The `name` is optional and is used to isolate different WebDBs from each other. Multiple invocations of this 
function using the same name will all return the same object. If not supplied, it defaults to `'webdb'`. 
The `options` object is optional and can be used to enable and control synching with a remote server.

#### Creating a stand-alone WebDB
```js
var db = new WebDB('lucky-luke'); // use a unique ID to isolate from other scripts
```

This creates a new, stand-alone WebDB named `lucky-luke`, using all the default options. This is a shorthand for:

```js
var db = new WebDB('lucky-luke', {}); // note the empty second object
```

Which has the same effect, but explicitly passes an empty options objects (so that all will use their defaults).

#### Synched to a server
```js
var db = new WebDB('lucky-luke', {synch:true, synchUrl:'/api/webdb/synch'}); 
```
As can be seen in the above example, to get our database synched to a server we need to set `synch` to `true` and 
provide a `synchUrl`. By default, auto-synch will be set to enabled and will start after the first call to `synch()`. 
This allows you to set up your schema and then call `synch` once after that is done to start the background synching 
process.

#### Database options
These are all the options that are available and the default values they get when not overridden.

```js
synch: false                  // set this to true to allow the db to be synched to a remote counterpart
synchUrl: '/api/webdb/synch'  // set this to the correct url on your server 
synchAuto: true               // After first manual synch it will auto-synch, unless you set this to false
synchThrottleMs: 60000        // minimum time between auto-synchs, in ms (default 1 minute)
synchPollMs: 3600000          // minimum time between polling synchs, in ms (default 1 hour)
synchTimeout: 5000            // max time the request may take to complete before it is cancelled, in ms.
synchRetryCount: 2            // how many times to retry failed requests
synchRetryWait: 5000          // time to wait before retrying, in ms.
```


### Create a new schema
To create our schema we use the method `createTable`, which has this signature:

```js
function createTable(entityType, name, def)
```
`entityType` is an optional constructor function used to instantiate entities from this table. 
`name` is required and is the name of the table and `def` contains the table definition, which 
basically is a collection of column definitions.

```js
var weapons = db.createTable('weapons', {
	'id': {type: Number, pk:true}, 
	'version': {type:Number, version:true},
	'name': {type:String, length:32, unique:true}
}); 
```
In this example we create a table 'weapons' with three columns. Each table needs at least one column, 
the primary key, marked with `pk:true` in the column definition. Each column needs at least a `type` 
attribute, set to the constructor function corresponding to the type. We use `String` and `Number` 
to represent the primitive types in the column definition, but in the actual data we use the actual
primitive types. In addition to the primary key, tables in synched databases (option `synch` is `true`)
also require a version column, marked with `version:true`. This version column is used for detecting 
stale objects in optimistic locking scenario's. 

`createTable` creates a convenient alias for us on the database objects so we don't actually have 
to keep a variable around ourselves. We can just use the new table through the new alias:

```js
db.weapons.set({id:1, version:null, name:'Sword'});
```

In this example, the records themselves will be returned as simple objects:

```js
var sword = weapons.get(1);
sword.prototype.constructor === Object; // true
```

By supplying a constructor function as the `entityType`, we can have WebDB return records as instances
of that constructor function:

```js
function Weapon(obj) {
	this.id = obj && obj.id !== undefined ? obj.id : null;
	this.version = obj && obj.version !== undefined ? obj.version : null;
	this.name = obj && obj.name !== undefined ? obj.name : null;
}
```
Constructor functions should accept an initializer object used to initialize the new instance's state.

Then, we can pass the constructor function when we create the table:
```js
var weapons = db.createTable(Weapon, 'weapons', {
	'id': {type: Number, pk:true}, 
	'version': {type:Number, version:true},
	'name': {type:String, length:32, unique:true}
}); 
```

Now, when we get records from this table, they will be returned as instances of the function we passed:

```js
var sword = weapons.get(1);
sword.prototype.constructor === Object; // false
sword.prototype.constructor === Weapon; // true
sword instanceof Weapon; // true
```

We can, but don't have to, pass instances of `Weapon` to `set` to insert them:
```js
weapons.set(new Weapon({id:2, version:null, name:'Axe'}));
weapons.set({id:3, version:null, name:'Spear'}); // WebDB calls new Weapon behind the scenes
var spear = weapons.get(3);
spear instanceof Weapon; // true
```
`set` will invoke the entity type constructor behind the scenes when we pass plain objects to it.

When we create columns that only have a `type`, we can use a shorthand notation. Instead of 
`mycolumn: {type: Number}` we can write just `mycolumn: Number`. We can create foreign keys 
to other tables by marking our column as `fk:foreignTableName`. Foreign key referential 
integrity is not checked (yet), but foreign keys automatically get a unique index. If a column
is not a foreign key but is unique, we can mark it with `unique:true`. If we suspect we will
be doing a lot of searching on a non-unique column, we can manually give it an index by marking
it with `index:true`. The example below illustrates some of these scenarios.

```js
var characters = db.createTable('characters', {
	'id': {type: Number, pk:true}, 
	'version': {type:Number, version:true},
	'firstName': {type:String, length:32, index:true},
	'lastName': {type:String, length:32, index:true},
	'description': String,  // shortcut for {type:String}
	'weaponOfChoice': {type:Number, fk:'weapons'}
});
```

### Synch the database
Synching is an asynchronous process that was designed to happen automatically in the background. 
It of-course requires a server that implements the WebDB synch protocol. Given such a server and 
assuming the database was created with the right options, we can start the synching process like so:
```js
db.synch();
```

As you can see, synching happens through the method `synch`, which has this signature:

```js
function synch(force)
```

After the first call to `synch`, auto-synching kicks in and it's not needed to call `synch`
again, unless you disabled auto-synching or want to force a synch to happen immediately 
(which can be done by passing `true` as the `force` parameter).

`synch` returns a `Promise`, which will resolve once the server response has been processed,
or be rejected if any errors occurred. Again, ususally you will not need to wait for a synch
(you won't even know one is happening), but every once in a while you do, such as on first 
load, when the database is still completely empty. Here is how you would go about that:

```js
db.synch().then(function ok(){
	// db is succesfully synched
	// do stuff with freshly loaded data here
}).catch(function fail(error){
	// Oh no! Something bad happened!
	console.error('Synch error.', error);
})
```

### Querying and mutating data
WebDB offers a minimalistic interface for querying and mutating data which is still very powerful.
It consists of just three functions and a `length` property:

```js
db.mytable.set(item)
db.mytable.get(criteria)
db.mytable.del(item)
db.mytable.length
```

#### Inserting and updating
Inserting and updating are done with the same function: `set`. Bulk-inserting data is easy, 
because `set` accepts multiple arguments, as well as arrays:

```js
weapons.set(
	{id:1, name:'Revolver'},
	{id:2, name:'Shotgun'},
	{id:3, name:'Mini revolver'},
	{id:4, name:'Teeth'}
);

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
```

#### Queries
Get a character by ID:
```js
var luckyLuke = characters.get(1);
```
The first parameter of `get` is a criteria object. If it's of a type compatible with the 
primary key column (eg `number`/`Number`, `string`/`String`, `MyCustomId` etc) then it 
will be interpreted as being a primary key.

You can also explicitly specify the primary key as search criteria:
```js
var luckyLuke = characters.get({id:1});
```

In the same way, you can specify other columns:
```js
var daltons = characters.get({lastName:'Dalton'});
```

When multiple columns are specified, they are interpreted as AND clauses:
```js
var william = characters.get({firstName:'William', lastName:'Dalton'});
```

Remember, for fast searches in larger datasets, you should limit your queries
to columns that have an index on them (either `pk`, `fk`, `unique` or `index` is set).

When no arguments are given, `get` will return *all* results:
```js
var all = characters.get();
```
This was designed to be fast, though it's still recommended to
cache the result in between multiple consecutive calls. 

#### Counting data
Get amount of records in table:
```js
var characterCount = characters.length; // 12;
```
*Note*: Remember, WebDB only knows about records present on the *client*.
If you need to know the total amount of records, including those only on the server, 
you need an Ajax call.

Get amount of records in resultset:
```js
var daltons = characters.get({lastName:'Dalton'}); 
var daltonCount = daltons.length; // 4;
```

#### Deleting data
Delete a single record:
```js
var rantaplan = characters.get({firstName:'Rantaplan'});
characters.del(rantaplan);
```

Delete multiple records:
```js
characters.del(characters.get({lastName:'Dalton'}));
```


## Under construction
WebDB is currently under heavy development and not ready for production just yet. 
Use at your own risk!

### Roadmap
These features are currently planned to be implemented in WebDB:
 * [Support local persistance](https://github.com/Download/webdb/issues/4)
 * [Support advanced queries](https://github.com/Download/webdb/issues/3)

## Copyright
Copyright 2015 by [Stijn de Witt](http://StijnDeWitt.com). Some rights reserved.

## License
Licensed under [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/).