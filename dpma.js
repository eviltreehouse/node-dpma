const path = require('path');
const fs = require('fs');

/**
 * Dpma (Dynamic Platform Module Awareness)
 * Load the .node file for `lib` specified, based on the current
 * execution environment. Optionally specify `lib_path` if the files
 * are expected to be elsewhere from this module's directory. If you
 * specify `module_id`, it will attempt to look up the module from the
 * context of an "app root" (e.g. its running in a webpack'd application
 * and thus must look externally for its statically-bundled files.)
 * @param {string} lib 
 * @param {string} [lib_path="."] 
 * @param {string} [module_id] 
 */
function Dpma(lib, lib_path, module_id) {
    if (! lib) throw new Error("No lib specified");
    if (! lib_path) lib_path = ".";
    
    var platform = mapPlatform(process.platform);
    var arch     = mapArch(process.arch);

    var module_name = [lib, platform, arch].join("-") + ".node";
    var agn_module_name = lib + ".node";

    var module_paths = [];
    module_paths.push( path.join(lib_path, module_name) );

    if (module_id) module_paths.push( path.join(".", 'node_modules', module_id, lib_path, module_name ) );

    // Add some platform/arch agnostic attempts to handle hand-built instances
    module_paths.push( path.join(lib_path, agn_module_name) );
    if (module_id) module_paths.push( path.join(".", 'node_modules', module_id, lib_path, agn_module_name ) );

    var tries = [].concat(module_paths);

    var mod = null;
    while (!mod && tries.length > 0) {
        var mp = tries.shift();
        var abs_path = path.resolve(mp);

        if (exists(abs_path)) {
            var mod = require(abs_path.replace(/\.node$/, ''));
        }
    }

    if (! mod) {
        throw new Error(lib + " not available for this platform/architecture [tried " + module_paths.join(", ") + "]"); 
    } else return mod;
}

/**
 * Resolve any aliases for our detected platform
 * @param {string} p 
 * @return {string}
 */
function mapPlatform(p) {
    return p;
}

/**
 * Resolve any aliases for our detected architecture
 * @param {string} a 
 * @return {string}
 */
function mapArch(a) {
    if (a == 'ia32') return 'x86';
    else return a;
}

/**
 * Do file-exists-access check
 * @param {string} f
 * @return {boolean}
 */
function exists(f) {
    var succ = false;
    try {
        fs.accessSync(f);
        succ = true;
    } catch(e) {}

    return succ ? true : false;
}

module.exports = Dpma;