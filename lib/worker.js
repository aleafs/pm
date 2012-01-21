/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var STATUS	= require('./define.js').CHILD.STATUS;
var MSGTYPE	= require('./define.js').MESSAGE.TYPE;

var Worker	= {};
var myself	= {
	'scores'	: 5,		/**<	避免大量请求瞬间涌入 */
	'status'	: STATUS.PEDDING,
};

/* {{{ function Worker.ready() */
Worker.ready	= function () {

	myself.status	= STATUS.RUNNING;
	myself.scores	= 0;

	setInterval(function () {
		var msg	= myself;
		msg.memory	= process.memoryUsage();
		process.send({
			'type'	: MSGTYPE.HEART,
			'value'	: msg,
		});
	}, 1000);
}
/* }}} */

exports.create	= function () {
	return Worker;
}

