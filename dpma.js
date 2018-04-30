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
 * @param {string} [global_ref_string] 
 * @return {Object}
 */
function Dpma(lib, lib_path, module_id, global_ref_string) {
    if (! lib) throw new Error("No lib specified");
    if (! lib_path) lib_path = ".";
    
    var platform = mapPlatform(process.platform);
    var arch     = mapArch(process.arch);
    
    var root_path = rootPath();

    var module_name = [lib, platform, arch].join("-") + ".node";
    var agn_module_name = lib + ".node";

    var module_paths = [];
    module_paths.push( path.join(lib_path, module_name) );

    if (module_id) module_paths.push( path.join(".", 'node_modules', module_id, lib_path, module_name ) );

    // Add some platform/arch agnostic attempts to handle hand-built instances
    module_paths.push( path.join(lib_path, agn_module_name) );
    if (module_id) module_paths.push( path.join(".", 'node_modules', module_id, lib_path, agn_module_name ) );

    var global_refs = parseGlobalRefs(global_ref_string);
    if (module_id && global_refs[module_id]) {
        // Our Dpma-enabled module is actually be used by a secondary module
        // use its module directories as well.
        var ref_path = ['node_modules'];
        for (var ref_module of global_refs[module_id]) {
            ref_path.push(ref_module);
            ref_path.push('node_modules'); 
        }

        ref_path.push(module_id, lib_path);

        module_paths.push( path.join.apply(path, [].concat(ref_path, module_name)) );
        module_paths.push( path.join.apply(path, [].concat(ref_path, agn_module_name )) );
    }

    var tries = [].concat(module_paths);

    if (debug()) {
        console.log('DPMA root', root_path);
        console.log('DPMA refs', JSON.stringify(global_refs));
        console.log(tries);
    }
    
    var mod = null;
    while (!mod && tries.length > 0) {
        var mp = tries.shift();
        var abs_path = path.join(root_path, mp);

        if (exists(abs_path)) {
            if (debug()) console.log(abs_path, 'exists loading.');
            var amp = abs_path.replace(/\.node$/, '');
            try {
                mod = eval("require(amp)");
            } catch(e) {
                if (debug()) console.error("failed to load ->", e.message);
            }
            if (mod && debug()) console.log('loaded ->', typeof mod);
        }
    }

    if (! mod) {
        throw new Error(lib + " not available for this platform/architecture [tried " + module_paths.join(", ") + "]"); 
    } else return mod;
}

/**
 * For 2nd->nth level references, you need to specify your module-usage chain
 * so we can figure out the pathing correctly. Will be pulled off of the DPMA_REFS
 * env variable unless another string is passed to replace it. Pass an empty-string
 * to disable checking the environment key DPMA_REFS.
 * @param {string} [in_ref_string] 
 * @return {Object.<string,string>}
 */
function parseGlobalRefs(in_ref_string) {
    if (in_ref_string == undefined) in_ref_string = process.env['DPMA_REFS'];
    if (! in_ref_string) return {};

    var refs = in_ref_string.split(/\;/);

    var global_refs = {};

    /**
     * <module_id>=<l1_module>,[l2_module],[l3_module];...
     */
    for (var ref of refs) {
        ref = ref.split(/\=/);
        if (ref.length != 2) continue;
        var module_id = ref[0];
        var ref_chain = ref[1].split(/\,/);

        global_refs[module_id] = ref_chain;
    }

    return global_refs;
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

/**
 * Finds the most rational root path available from which we deduce all
 * of our pathing.
 * @return {string}
 */
function rootPath() {
    if (process.env['DPMA_ROOT']) return process.env['DPMA_ROOT'];
    else if (process.cwd()) return process.cwd();

    // project_dir/node_modules/node-hid-dpma/node_modules/node-dpma <- back to project_dir
    else if (__dirname) return path.resolve(__dirname, '..', '..', '..', '..');
    else return '.'; // This probably isn't ideal..
}

function debug() {
    return parseInt(process.env['DPMA_DEBUG']) > 0;
}

/**
 * Init Dpma fetch but disable global refs (very specific usage cases.)
 * @param {string} lib 
 * @param {string} [lib_path] 
 * @param {string} [module_id] 
 * @return {Object}
 */
Dpma.NoGlobalRefs = function(lib, lib_path, module_id) {
    return Dpma(lib, lib_path, module_id, '');
};

module.exports = Dpma;