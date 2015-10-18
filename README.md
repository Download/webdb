# WebDB <sup><sub>v0.4.0</sub></sup>
**If the client can't get to the database, we bring the database to the client.**
[project website](https://download.github.io/webdb)

## Get WebDB
WebDB, as it's name suggests, offers a database right there in the web browser. 
It can be used directly from CDN, through a regular download, or installed with NPM.

### CDN
This is the easiest way to use WebDB:
```xml
<script src="https://cdn.rawgit.com/download/webdb/0.4.0/dist/webdb.min.js"></script>
```

### Download
If you'd rather host the file on your own server, or use the debug version:
* [webdb.min.js](https://cdn.rawgit.com/download/webdb/0.4.0/dist/webdb.min.js) (~4kB gzipped+minified, ~12kB minified)
* [webdb.umd.js](https://cdn.rawgit.com/download/webdb/0.4.0/dist/webdb.umd.js) (~30kB commented)
* [webdb.min.js.map](https://cdn.rawgit.com/download/webdb/0.4.0/dist/webdb.min.js.map) (~17kB debug info)

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
<script src="//cdn.rawgit.com/download/webdb/0.4.0/dist/webdb.min.js"></script>
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
		'webdb': '//cdn.rawgit.com/download/webdb/0.4.0/dist/webdb.min',
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
* Populate/load data into the DB
* Run queries against the DB
* Create/Read/Update/Delete data
* Save data from the DB to e.g. localStorage

### Create a new WebDB
```js
var db = new WebDB('lucky-luke'); // use a unique ID to isolate from other scripts
```

### Create a new schema
```js
var weapons = db.createTable('weapons', {
	'id': {type: Number, pk:true}, 
	'version': {type:Number, version:true},
	'name': {type:String, length:32, unique:true}
}); 

var characters = db.createTable('characters', {
	'id': {type: Number, pk:true}, 
	'version': {type:Number, version:true},
	'firstName': {type:String, length:32, index:true},
	'lastName': {type:String, length:32, index:true},
	'description': String, // shortcut for {type:String}
	'weaponOfChoice': {type:Number, fk:'weapons'}},
});
```
If no table definition is given, the table gets two columns, `id` and `version`, 
both of type `Number`. Any other properties will not be indexed.

If a definition is given, any columns that are:
* A Primary Key (marked with `pk`)
* A Foreign Key (marked with `fk`)
* Marked with `unique`
* Marked with `index`
will automatically get an index and be quick to search through.

### Populate/load data into the DB
*TODO*: currently bulk-loading data into the db is not yet supported. Just use `db.[table].set([object, object]);` statements.
```js
weapons.set([
	{id:1, name:'Revolver'},
	{id:2, name:'Shotgun'},
	{id:3, name:'Mini revolver'},
	{id:4, name:'Teeth'}
]);

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

### Run queries against the DB
Get a character by ID:
```js
var luckyLuke = characters.get(1);
```
The first parameter of `get` is a criteria object. If it's not an object and it's
of a type compatible with the primary key column (eg `number`/`Number`, `string`/`String`, etc) 
then it will be interpreted as being a primary key.

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

When no arguments are given, `get` will return *all* results:
```js
var all = characters.get();
```
Try to avoid this as it may become slow on larger datasets.

### Create/Read/Update/Delete data
We saw above how we can use `set` to write data and `get` to read it.
All we need now is a way to remove data and a way to figure out how much data is there.

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

Delete a single record:
```js
var rantaplan = characters.get({firstName:'Rantaplan'});
characters.del(rantaplan);
```

Delete multiple records:
```js
characters.del(characters.get({lastName:'Dalton'}));
```



## Why WebDB?
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

## Under construction
WebDB is currently under heavy development and not ready for production just yet. 
Use at your own risk!

### Roadmap
These features are currently planned to be implemented in WebDB:
 * [Support synching to remote server](https://github.com/Download/webdb/issues/1)
 * [Support custom entity types](https://github.com/Download/webdb/issues/2)
 * [Support local persistance](https://github.com/Download/webdb/issues/4)
 * [Support advanced queries](https://github.com/Download/webdb/issues/3)

## Copyright
Copyright 2015 by [Stijn de Witt](http://StijnDeWitt.com). Some rights reserved.

## License
Licensed under [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/).