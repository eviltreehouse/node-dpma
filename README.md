## node-dpma

Sort of like [node-bindings](https://github.com/TooTallNate/node-bindings), but hunts more aggressively amongst many local `.node` files to find the right one. Useful for when you don't want to rely on tools like `node-gyp` or `prebuild` for distributed applications (e.g. you instead want to bundle the pre-builds yourself vs. making them available online.)

Since it has no module dependencies it can be included as just a .js file in a project and is safe for tools like `webpack`: it drives all its search functionality based on the directory that contains the `require.main' module. For added flexibility, you can pass absolute paths into the search paths array as well so modules can literally be loaded from _anywhere_!

### Example
```js
// node-bindings style:
// const binding = require('bindings')('my-native.node');

// node-dpma style:
const binding = require('node-dpma')(
	'my-native',           // base-module name
	[ './build/Release' ]  // search paths
);
```

### Debugging Issues
```js
process.env.DPMA_DEBUG=1;

// Now you'll get console output from `node-dpma` :)
// ...