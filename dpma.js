'use strict';
const path = require('path');
const fs = require('fs');

/**
 * Dpma (Dynamic Platform Module Awareness)
 * Load the .node file for `lib` specified, based on the current
 * execution environment. Optionally specify `sub_paths` if the modules
 * are potentially in other locations (non-absolutes will be resolved 
 * to the `__dirname` of the "main" module.
 * @param {string} lib 
 * @param {string[]} [sub_paths] 
 * @return {Object}
 */
function Dpma(lib, sub_paths) {
    if (! lib) throw new Error('No lib specified');
    if (! sub_paths || ! Array.isArray(sub_paths)) sub_paths = ["."];
    let root_path = getProjectRoot();
    
    const platform = mapPlatform(process.platform);
    const arch     = mapArch(process.arch);
    
    let module_name = [lib, platform, arch].join("-") + ".node";

    /** @type {string[]} */
    let module_paths = [];
    for (let sub_path of sub_paths) {
        if (path.isAbsolute(sub_path)) module_paths.push( path.join(sub_path, module_name) );
        else module_paths.push( path.join(root_path, sub_path, module_name ));
    }

    var tries = [].concat(module_paths);

    if (debug()) {
        console.log('DPMA root', root_path);
        console.log('searches', tries);
    }
    
    var mod = null;
    while (tries.length > 0) {
        var mp = tries.shift();

        if (exists(mp) && isValidNodeExtension(mp)) {
            if (debug()) console.log('--', mp, 'exists/looks usable: requiring.');
            let amp = mp.replace(/\.node$/, '');
            try {
                mod = eval(`require('${amp}')`);
            } catch(e) {
                if (debug()) console.error('--- failed to require ->', e.message);
            }
            if (mod && debug()) console.log('--- loaded ok ->', typeof mod);
        } else {
            if (debug()) console.log('--', mp, 'does not exist [or is not a valid native extension.]');
        }

        if (mod) break;
    }

    if (! mod) {
        throw new Error(`${lib} not available for this platform/architecture`); 
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
 * Determine if a file appears to be a valid native extension
 *  -   Darwin: 0xDF 0xFA 0xED 0xFE
 *  -   Win32: 0x4D 0x5A ("MZ") ... 0x50 0x45 0x0 0x0 ("PE\0\0") (in top 516b of file.)
 *  -   Linux: 0x7F 0x45 0x4C 0x46 ("ELF")
 * @param {string} f 
 * @return {boolean}
 */
function isValidNodeExtension(f) {
    let valid = false;
    let magick = null;
    let b = null;

    switch (mapPlatform(process.platform)) {
        case 'darwin':
            magick = Buffer.from([0xCF, 0xFA, 0xED, 0xFE]);
            b = headerRead(f, 4);
            if (b) valid = b.includes(magick);
            break;

        case 'linux':
            magick = Buffer.from([0x7F, 0x45, 0x4C, 0x46]);
            b = headerRead(f, 4);
            if (b) valid = b.includes(magick);
            break;

        case 'ia32': 
            let peh = Buffer.from([0x50, 0x45, 0x0, 0x0]);
            b = headerRead(f, 516);
            if (b) valid = b[0] === 0x4D && b[1] === 0x5A && b.includes(peh);
            break;

        default:
            // unsupported
            break;
    }

    if (debug()) {
        console.log('-- is', f, 'valid extension?', (valid ? "Y" : "N"));
    }

    return valid;
}

/**
 * @param {string} f 
 * @param {number} siz
 * @return {Buffer|null}
 */
function headerRead(f, siz) {
    let ret = null;
    try {
        let fd = fs.openSync(f, 'r');
        let b = Buffer.alloc(siz, 0x0);
        fs.readSync(fd, b, 0, siz, 0);
        ret = b;
    } catch(e) {}

    return ret;
}

function debug() {
    return parseInt(process.env['DPMA_DEBUG']) > 0;
}

/**
 * @return {string}
 */
function getProjectRoot() {
    if (process.versions['electron']) {
        /** @todo */
        return require.main.require('electron').app.getAppPath();
    } else return path.dirname(require.main.filename);
}

module.exports = Dpma;