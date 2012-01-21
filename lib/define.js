/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

exports.CHILD	= {
	/**
	 * @子进程状态
	 */
	'STATUS'	: {
		'PEDDING'	: 0,			/**<	正在初始化，还无法处理请求	*/
		'RUNNING'	: 10,			/**<	正常工作	*/
		'STOPING'	: 20,			/**<	准备退出，不再接受请求 */
	},
};

exports.MESSAGE	= {
	/**
	 * @消息类型
	 * @奇数表示master -> worker，反之亦然
	 */
	'TYPE'	: {
		'RELOAD'	: 2,			/**<	重新加载缓存, api (msg)=> master (signal)=> worker */
		'REQ_FD'	: 11,
		'HEART'		: 20,
	},
};
