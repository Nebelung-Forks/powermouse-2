const LOG_EVERYTHING = false;

let WebSocket=require('ws'),
	util=require('util'),
	fs=require('fs'),
	main=require('./server.js'),
	app=main.app,
	wss=new WebSocket.Server({
		server: main.server
		//'port': 7080
	});

let log = function() {
    if(LOG_EVERYTHING) {
        console.log(...arguments);
    }
};

let conns = 0;

wss.on('connection', function(cli, req) {
    let ID = String(++ conns).padStart(6, 0);

    // Parse the URL Flags in the shittiest way possible
    // since apparently nodejs doesn't have Object.from
    // for some reason
    let urlflags = { }, _urlflags = req.url
        .split('?').slice(1).join('?')
        .split('&').map(a => {
            let x = a.split('=');
            return [ x[0], x.slice(1).join('=') ]
        });
    for(let i = 0; i < _urlflags.length; ++ i) {
        urlflags[_urlflags[i][0]] = _urlflags[i][1];
    }
    log(`CLI${ID} URLFLAG `, urlflags);

    if(!('ws' in urlflags)) {
        log(`CLI${ID} BAD REQ`)
        cli.send('Missing URL Flag `ws`!');
        cli.close(1008);
    }

    let svr = new WebSocket(urlflags.ws);

    svr.on('error', function(err) {
        log(`SVR${ID} ERR`);
        cli.close(1011); // SERVER ERROR
    });

    cli.on('error', function() {
        log(`CLI${ID} ERR`)
        svr.close(1001); // CLOSE_GOING_AWAY
    });

    svr.on('message', function(msg) {
        log(`SVR${ID} MSG ${msg}`);
        cli.send(msg);
    });

    cli.on('message', function(msg) {
        log(`CLI${ID} MSG ${msg}`);
        try{
			svr.send(msg);
		}catch(err){
			fs.appendFileSync('err.log',`${util.format(err)}\n`);
		}
    });

    svr.on('close', function(e) {
        log(`SVR${ID} CLOSE`);
        cli.close(e);
    });

    cli.on('close', function(e) {
        log(`CLI${ID} CLOSE`);
        try{
			svr.close(e);
		}catch(err){
			fs.appendFileSync('err.log',`${util.format(err)}\n`);
		}
    });
});