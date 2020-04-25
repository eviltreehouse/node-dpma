'use strict';
const path = require('path');
const fs = require('fs');

let DPMA_DEBUG = false;
const debug = () => Boolean(DPMA_DEBUG);

/** @typedef {{
    root?: boolean,
    debug?: boolean,
    info_logger?: function(...string):void,
    error_logger?: function(...string):void
}} DpmaOptions
*/

/** @type {DpmaOptions} */
const DEFAULT_OPTS = {
    'root': getProjectRoot(),
    'debug': parseInt(process.env['DPMA_DEBUG']) > 0,
    'info_logger': console.log,
    'error_logger': console.error
};


const MAGICKS = {
    'darwin': Buffer.from([0xCF, 0xFA, 0xED, 0xFE]),
    'linux': Buffer.from([0x7F, 0x45, 0x4C, 0x46]),
    'win32': {
        'header': Buffer.from([0x4D, 0x5A]),
        'peh': Buffer.from([0x50, 0x45, 0x0, 0x0]),
    },
}

const last_req_errors = [];


/**
 * Dpma (Dynamic Platform Module Awareness)
 * Load the .node file for `lib` specified, based on the current
 * execution environment. Optionally specify `sub_paths` if the modules
 * are potentially in other locations (non-absolutes will be resolved
 * to the `__dirname` of the "main" module.). Populate `opts` with
 * a few additional tunables if required: (`root, debug, infoLogger,
 * errorLogger`)
 * @param {string} lib
 * @param {string[]} [sub_paths]
 * @param {DpmaOptions} [opts]
 * @return {Object}
 */
function Dpma(lib, sub_paths, opts) {
    last_req_errors.length = 0;

    opts = Object.assign({}, DEFAULT_OPTS, opts || {});
    if (! lib) throw new Error('No lib specified');
    if (! sub_paths || ! Array.isArray(sub_paths)) sub_paths = ["."];
    DPMA_DEBUG = opts.debug;
    const root_path = opts.root;

    const platform = mapPlatform(process.platform);
    const arch     = mapArch(process.arch);

    let module_name = [lib, platform, arch].join("-") + ".node";

    /** @type {string[]} */
    let module_paths = [];
    for (let sub_path of sub_paths) {
        if (path.isAbsolute(sub_path)) module_paths.push( path.resolve(sub_path, module_name) );
        else module_paths.push( path.resolve(root_path, sub_path, module_name ));
    }

    const tries = [].concat(module_paths);

    if (debug()) {
        opts.info_logger('DPMA root', root_path);
        opts.info_logger('searches', tries);
    }

    let mod = null;
    while (tries.length > 0) {
        const mp = tries.shift();

        const module_exists = exists(mp);

        if (module_exists && isValidNodeExtension(mp, opts)) {
            if (debug()) opts.info_logger('DPMA --', mp, 'exists/looks usable: requiring.');
            try {
                mod = eval(`require('${mp.replace(/\.node$/, '')}')`);
            } catch(e) {
                if (debug()) opts.error_logger(`DPMA --- FAILED on require of ${mp} ->`, e.message);
                last_req_errors.push(`${mp}: Error on require: ${e.message}`);
            }

            if (mod && debug()) opts.info_logger('DPMA --- loaded OK ->', typeof mod);
        } else {
            if (module_exists) {
                last_req_errors.push(`${mp}: Does not appear to be a valid native extension [failed magick check(s)].`);
                if (debug()) opts.error_logger('DPMA --', mp, 'does not appear to be a valid native extension [failed magick check(s)].');
            } else if (debug()) opts.info_logger('DPMA --', mp, 'does not exist.');
        }

        if (mod) break;
    }

    if (! mod) {
        throw new Error(`${lib} not available for this platform/architecture (${platform}/${arch})`);
    } else return mod;
}

/**
 * @return {string[]}
 */
Dpma.lastErrors = () => [...last_req_errors];


/**
 * Resolve any aliases for our detected platform
 * @param {string} p
 * @return {string}
 */
function mapPlatform(p) {
    // no-op.
    return p;
}

/**
 * Resolve any aliases for our detected architecture
 * @param {string} a
 * @return {string}
 */
function mapArch(a) {
    /** @note 'x86' is technically obsolete now */
    if (a == 'ia32') return 'x86';
    else return a;
}

/**
 * Do file-exists-access check
 * @param {string} f
 * @return {boolean}
 */
function exists(f) {
    let succ = false;
    try {
        fs.accessSync(f);
        succ = true;
    } catch(e) { /* ignore */ }

    return succ;
}

/**
 * Determine if a file appears to be a valid native extension
 *  -   Darwin: 0xDF 0xFA 0xED 0xFE
 *  -   Win32: 0x4D 0x5A ("MZ") ... 0x50 0x45 0x0 0x0 ("PE\0\0") (in top 516b of file.)
 *  -   Linux: 0x7F 0x45 0x4C 0x46 ("ELF")
 * @param {string} f
 * @param {DpmaOptions} opts
 * @return {boolean}
 */
function isValidNodeExtension(f, opts) {
    let valid = false;
    let b = null;

    switch (mapPlatform(process.platform)) {
        case 'darwin':
            b = headerRead(f, 4);
            if (b) valid = b.equals(MAGICKS.darwin);
            break;

        case 'linux':
            b = headerRead(f, 4);
            if (b) valid = b.equals(MAGICKS.linux);
            break;

        case 'win32':
            b = headerRead(f, 516);
            if (b) valid = b.subarray(0, 2).equals(MAGICKS.win32.header) &&
                b.includes(MAGICKS.win32.peh);
            break;

        default:
            // unsupported
            break;
    }

    if (debug()) {
        opts.info_logger('DPMA -- is', f, 'valid extension?', (valid ? "Y" : "N"));
        opts.info_logger();
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

/**
 * Find the "root" of the application so we know where to base
 * our sub-paths on.
 * @return {string}
 */
function getProjectRoot() {
    // return <electronInstance>.app.getAppPath();

    // this seems to return the appropriate result on darwin.
    // /!\ need to confirm on win32
    return path.dirname(require.main.filename);
}

module.exports = Dpma;