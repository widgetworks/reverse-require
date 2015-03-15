var fs = require('fs');
var path = require('path');
var util = require('util');


module.exports = ReverseRequire;


/**
 * Default `moduleRoot` value for this project.
 * 
 * 
 * 
 * @type {[type]}
 * @static
 */
ReverseRequire.moduleRoot = null;


/**
 * Default set of modules to exclude from lookups.
 * 
 * @type {Array}
 * @static
 */
ReverseRequire.moduleExcludeList = [
	'grunt-cli',
	'grunt'
];


/**
 * Debug flag.
 * 
 * Set to true to log out paths that can't be found.
 * 
 * @type {Boolean}
 */
ReverseRequire.debug = false;


/**
 * Factory function exported as the interface.
 * 
 * Interface:
 * 
 * 		ReverseRequire([options]): reverseRequire;
 * 
 * @param {[type]} moduleRoot [description]
 * @param {[type]} options    [description]
 */
function ReverseRequire(moduleRoot, options){
	moduleRoot = moduleRoot || ReverseRequire.moduleRoot;
	if (!moduleRoot){
		throw new Error('(ReverseRequire) Invalid `moduleRoot` given. Expected string but received: '+moduleRoot + '. Global default can be set on `require("reverse-require").moduleRoot = "<default module root>";`');
	}
	
	options = options || {};
	options.moduleExcludeList = options.moduleExcludeList || ReverseRequire.moduleExcludeList;
	
	return getInstance(moduleRoot, options);
}


/**
 * Return a new `reverseRequire` method.
 * 
 * Interface:
 * 
 * 		reverseRequire(name: string [, moduleExcludesList: string[]]);
 * 	 		reverseFind(name: string [, moduleExcludesList: string[]]);
 * 	   		_getModulePaths([moduleExcludesList: string[]]);
 * 	     	_filterPaths(moduleExcludesList: string[]);
 * 	
 * 
 * @param  {[type]} moduleRoot [description]
 * @param  {[type]} options    [description]
 * @return {[type]}            [description]
 */
function getInstance(moduleRoot, options){
	
	// Cache of module paths for this instance.
	var resolvedModulePaths = null;
	
	reverseRequire.reverseFind = reverseFind;
	reverseRequire._getModulePaths = _getModulePaths;
	reverseRequire._filterPaths = _filterPaths;
	return reverseRequire;
	
	
	/**
	 * Convenience method to find and require the module in 
	 * reverse to the traditional require(...) lookup order.
	 *
	 * @param name
	 * @param moduleExcludesList - Optional. List of modules to exclude from search paths.
	 * @returns {*}
	 */
	function reverseRequire(name, moduleExcludesList){
		var filepath = reverseRequire.reverseFind(name, moduleExcludesList);
		return require(filepath);
	}


	/**
	 * Search for a Node module in the reverse order - from host project up to the current project.
	 * 
	 * NOTE: There might be some differences between how `reverseFind()` and 
	 * `reverseRequire()` work.
	 * 
	 * @param name
	 * @param moduleExcludesList - Optional. List of modules to exclude from search paths.
	 * @returns {*}
	 */
	function reverseFind(name, moduleExcludesList){
		var moduleList = _getModulePaths(moduleExcludesList);

		var filepath;
		moduleList.some(function(moduleRoot){
			filepath = path.join(moduleRoot, name);
			
			// Directory exists or can be required.
			if (fs.existsSync(filepath)){
				// Require a file by fully-qualified path.
				return true;
			} else {
				// Require a module by name.
				try {
					var result = require.resolve(filepath);
					if (result){
						// Valid file found - return immediately.
						return true;
					}
				} catch (err){
					//console.log('Cannot resolve: filepath=', filepath);
				}
			}
			
			filepath = null;
			return false;
		});
		
		if (ReverseRequire.debug){
			// TODO: Add a propert logger.
			console.warn('(ReverseRequire) reverseFind: cannot find package for "'+name+'" in moduleList=\n  ' + moduleList.join('\n  '));
		}

		return filepath;
	}


	/**
	 * Get all of the 'node_modules' directories between us and the root project.
	 * Try to resolve each plugin from the root up to us (the reverse of npm's resolution order).
	 * 
	 * The result will be cached if we're given the default list of module excludes.
	 * 
	 * @param moduleExcludesList - Optional. Defaults to `moduleExcludeList`.
	 * @returns {*}
	 * @private
	 */
	function _getModulePaths(moduleExcludesList){
		// Test against null because `[]` is falsy.
		if (moduleExcludesList == null){
			moduleExcludesList = options.moduleExcludeList;
		}
		
		// Starting at this module get the package search paths up to the root module.
		var paths;
		if (resolvedModulePaths && moduleExcludesList == options.moduleExcludeList){
			// Return the default module cache.
			paths = resolvedModulePaths;
		} else if (moduleExcludesList == options.moduleExcludeList) {
			// Only cache this path list for the default set of excludes (because
			// it will be used most often).
			paths = resolvedModulePaths = _filterPaths(moduleExcludesList);
		} else {
			// Perform the lookup but don't cache the result.
			paths = _filterPaths(moduleExcludesList);
		}
		
		return paths;
	}


	/**
	 * Return the module search paths, excluding any
	 * modules that appear in `moduleExcludesList`.
	 * 
	 * @private
	 */
	function _filterPaths(moduleExcludesList){
		var paths = [];
		var curModule = require.cache[moduleRoot];
		
		// Ignore paths that contain these packages. Add additional packages to the list.
		var template = 'node_modules'+path.sep+'%s'+path.sep;
		var ignore = moduleExcludesList
			.map(function(name){
				return util.format(template, name);
			});
		
		var isValidPath = function(curPath){
			return ignore.every(function(ignorePath){
				return curPath.indexOf(ignorePath) == -1;
			});
		};
		
		// Collect the set of paths excluding duplicates and matches with the packages listed in the `ignore` list.
		var cache = {};
		var curPath;
		while (curModule){
			curPath = curModule.paths[0];
			if (!cache[curPath] && isValidPath(curPath)){
				paths.push(curPath);
				cache[curPath] = true;
			}
			curModule = curModule.parent;
		}
		
		// Reverse the list to search from least to most specific.
		paths.reverse();
		
		return paths;
	}
}

