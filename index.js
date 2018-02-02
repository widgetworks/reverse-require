var fs = require('fs');
var path = require('path');
var util = require('util');


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


// Self-bootstrap reverse require.
// 
// Bit of an Inception setup here...
// 
// Before returning the ReverseRequire instance,
// use it to see if there is another version
// further down the tree. If so, load that
// version and return it.
// 
// This avoids having multiple different
// versions running in the same application.
// 
// We're using ReverseRequire to 
// reverse-require itself!
module.exports = (function () {
    var result = ReverseRequire;
    try {
        var rr = ReverseRequire(__filename);
        var tempResult = rr('reverse-require');
        
        // It's possible to get a reference to our
        // own in-progress `exports` object.
        // 
        // Only assign the new instance this if it
        // is not our `exports` object!
        if (tempResult != module.exports) {
            result = tempResult;
        }
    } catch (e) {
        // Log an error?
        console.log('!!!e=', e);
        console.log('!!!e.stack=', e.stack);
    }
    
    return result;
}());


/**
 * Factory function exported as the interface.
 *
 * Interface:
 *
 *        ReverseRequire([options]): reverseRequire;
 *
 * @param {[type]} moduleRoot [description]
 * @param {[type]} options    [description]
 */
function ReverseRequire(moduleRoot, options) {
    // Get the global `moduleRoot`.
    if (!moduleRoot) {
        // Try to work out what the moduleRoot should
        // be based on the process.cwd() and module load tree.
        if (!ReverseRequire.moduleRoot) {
            ReverseRequire.moduleRoot = _guessModuleRoot();
        }
        
        moduleRoot = ReverseRequire.moduleRoot;
    }
    
    if (!moduleRoot) {
        throw new Error('(ReverseRequire) Invalid `moduleRoot` given. Expected string but received: ' + moduleRoot + '. Global default can be set on `require("reverse-require").moduleRoot = "<default module root>";`');
    }
    
    options = options || {};
    options.moduleExcludeList = options.moduleExcludeList || ReverseRequire.moduleExcludeList;
    
    return getInstance(moduleRoot, options);
}


/**
 * Guess the module root based on the module that required us
 *
 * @return {[type]} [description]
 */
function _guessModuleRoot() {
    var curModule = require.cache[__filename];
    
    // Return the filename of the project that required us.
    var moduleRoot = curModule.parent.filename;
    return moduleRoot;
}


/**
 * Return a new `reverseRequire` method.
 *
 * Interface:
 *
 *        reverseRequire(name: string [, moduleExcludesList: string[]]);
 *            reverseFind(name: string [, moduleExcludesList: string[]]);
 *            _getModulePaths([moduleExcludesList: string[]]);
 *            _filterPaths(moduleExcludesList: string[]);
 *
 *
 * @param  {[type]} moduleRoot [description]
 * @param  {[type]} options    [description]
 * @return {[type]}            [description]
 */
function getInstance(moduleRoot, options) {
    
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
    function reverseRequire(name, moduleExcludesList) {
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
    function reverseFind(name, moduleExcludesList) {
        var moduleList = _getModulePaths(moduleExcludesList);
        
        var filepath;
        moduleList.some(function (moduleRoot) {
            filepath = path.join(moduleRoot, name);
            
            // Directory exists or can be required.
            if (fs.existsSync(filepath)) {
                if (ReverseRequire.debug) {
                    console.log(`Resolved "${name}" to "${filepath}"`);
                }
                
                // Require a file by fully-qualified path.
                return true;
            } else {
                // Require a module by name.
                try {
                    var result = require.resolve(filepath);
                    if (result) {
                        
                        if (ReverseRequire.debug) {
                            console.log(`Resolved "${name}" to "${result}"`);
                        }
                        
                        // Valid file found - return immediately.
                        return true;
                    }
                } catch (err) {
                    //console.log('Cannot resolve: filepath=', filepath);
                }
            }
            
            filepath = null;
            return false;
        });
        
        if (!filepath && ReverseRequire.debug) {
            // TODO: Add a propert logger.
            console.warn('(ReverseRequire) reverseFind: cannot find package for "' + name + '" in moduleList=\n  ' + moduleList.join('\n  '));
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
    function _getModulePaths(moduleExcludesList) {
        // Test against null because `[]` is falsy.
        if (moduleExcludesList == null) {
            moduleExcludesList = options.moduleExcludeList;
        }
        
        // Starting at this module get the package search paths up to the root module.
        var paths;
        if (resolvedModulePaths && moduleExcludesList == options.moduleExcludeList) {
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
     *
     * @param  {string}  path   [description]
     * @param  {string[]}  ignore [description]
     * @return {Boolean}        [description]
     */
    function _isValidPath(path, ignore) {
        if (path == null) {
            throw new Error('(ReverseRequire) isValidPath: path is null');
        }
        
        return ignore.every(function (ignorePath) {
            return path.indexOf(ignorePath) == -1;
        });
    }
    
    
    /**
     * Return the module search paths, excluding any
     * modules that appear in `moduleExcludesList`.
     *
     * @private
     */
    function _filterPaths(moduleExcludesList) {
        var curModule = require.cache[moduleRoot];
        
        // Ignore paths that contain these packages. Add additional packages to the list.
        var template = 'node_modules' + path.sep + '%s' + path.sep;
        var ignore = moduleExcludesList
            .map(function (name) {
                return util.format(template, name);
            });
        
        // Collect the set of paths excluding duplicates and matches with the packages listed in the `ignore` list.
        var cache = {};
        var curPath;
        var pathsList = [];
        while (curModule) {
            curPath = curModule.paths[0];
            if (!cache[curPath] && _isValidPath(curPath, ignore)) {
                pathsList.push(curModule.paths);
                cache[curPath] = true;
            }
            curModule = curModule.parent;
        }
        
        // Reverse the list to search from least to most specific.
        pathsList.reverse();
        
        var paths = _collectPaths(pathsList);
        return paths;
    }
    
    
    /**
     * Filter down the list of list of paths
     *
     * This makes things more node-like in that we
     * continue to search up the parent directories
     * even further.
     *
     * @return {string[]} Return the deduplicated list of search paths
     */
    function _collectPaths(pathLists) {
        // given a list of lists
        // merge each list item by item
        var maxLength = 0;
        var counter = 0;
        
        pathLists.forEach(function (paths) {
            if (paths.length > maxLength) {
                maxLength = paths.length;
            }
        });
        
        var rawPaths = [];
        while (counter < maxLength) {
            for (var i = 0; i < pathLists.length; i++) {
                if (counter < pathLists[i].length) {
                    rawPaths.push(pathLists[i][counter]);
                }
            }
            
            // at the end increment once.
            counter++;
        }
        
        // then dedupe
        var m = {};
        rawPaths.forEach(function (path) {
            m[path] = true;
        });
        
        var finalPaths = Object.keys(m);
        return finalPaths;
    }
}

