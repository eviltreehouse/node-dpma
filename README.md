## node-dpma

Sort of like https://github.com/TooTallNate/node-bindings, but consults files named by their arch/platform. Useful
for when you don't want to rely on node-gyp or prebuild for distributed applications (you instead want to bundle
the pre-builds yourself.)

### Example
```js
//Load C++ binding
// var binding = require('bindings')('my-native.node'); // using `bindings` lib
var binding = require('./node-dpma')('my-native', './build/Release', 'my-native-dpma'); // using dpma module
```
