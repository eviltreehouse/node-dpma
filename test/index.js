'use strict';
'use strict';
const Dpma = require('../dpma');
const screamErrors = (...arr) => console.error(arr.join(" ").toUpperCase());

try {
	const binding = Dpma(
		'hid', 
		['./badpath', './nx'],
		{
			'root': '.',
			'debug': false,
			'error_logger': screamErrors
		}
	);

	console.log(binding.devices());
} catch(e) {
	console.error(`[!] Tried loading hid-${process.platform}-${process.arch}.node w/ no success.`);
	Dpma.lastErrors().forEach(err => console.error('\t- ' + err));
	// console.error(Dpma.lastErrors());
	process.exit(1);
}

