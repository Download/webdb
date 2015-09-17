module.exports = function(grunt) {
	require('load-grunt-tasks')(grunt);

	var pkg = grunt.file.readJSON('package.json');
	grunt.initConfig({
		pkg: pkg,
		urequire: {
			_defaults: {
				bundle: {
					path: 'src',
					name: 'webdb'
				}
/*				dependencies: {
					imports: {
						'memorystorage': 'MemoryStorage'
					}
				},
*/
//				resources: ['inject-version'],
			},
			UMD: {
				template: 'UMDplain',
				dstPath: 'build/UMD'
			},
			dev: {
				template: 'combined',
				dstPath: 'build/myLibrary-dev.js'
			}
		},
		jshint: {
			options : {
				jshintrc : '.jshintrc'
			},
			all: [ '<%= pkg.main %>' ]
		},
		umd: {
			all: {
				options: {
					src: '<%= pkg.main %>',
					dest: '<%= pkg.dist.umd %>', 
					template: 'umd-lite.hbs', 
					objectToExport: '<%= pkg.exports[0] %>',
					amdModuleId: '<%= pkg.name %>',
					deps: {'default': ['memorystorage']}
				}
			}
		},
		uglify: {
			options:{
				banner : '/*! [<%= pkg.name %> <%= pkg.version %>](<%= pkg.homepage %>) <%= pkg.copyright %> License: [<%= pkg.license %>](<%= pkg.licenseUrl %>) */',
				mangle: {
					except: pkg.exports.concat(['u','m','d'])
				},
				sourceMap: true
			},
			admin: {
				files: {
					'<%= pkg.dist.min %>': ['<%= pkg.dist.umd %>']
				}
			}
		},
		jsdoc : {
			dist : {
				src: ['src/*.js', 'test/*.js'],
				options: {
					destination: 'doc',
					template : "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template",
					configure: "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template/jsdoc.conf.json"
				}
			}
		},
	});
	
	grunt.registerTask('default', [
		'jshint', 
		'umd', 
		'uglify', 
		'jsdoc'
//		,
//		'urequire'
	]);
}
