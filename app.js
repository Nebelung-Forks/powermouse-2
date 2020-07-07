const fs=require('fs'),
	threads=require('worker_threads'),
	express = require('express'),
	util=require('util'),
	rl=require('serverline'),
	config=JSON.parse(fs.readFileSync('config.json','utf8') ),
	fetch=require('node-fetch');
var errors=0, // set this to 0 every 2 seconds
	workers={
		broadcast: ((data)=>{
			workers.instances.forEach((e,i)=>{
				e.postMessage(data);
			});
		}),
		instances: [],
		sessions: {}
	};

if(config.workers){
	console.log('Using experimental workers feature..');
	
	setInterval(()=>{
		Object.entries(workers.sessions).forEach((e,i)=>{
			var session=e[1];
			var key=e[0];
			
			var expires = session['__lastAccess'] + config.sessionTimeout, // the time this session should go away
				timeLeft = expires - Date.now(),
				expired = timeLeft <= 0;
			
			if(expired){
				delete workers.sessions[key]; // delete object thingo
				workers.broadcast({ type: 'update_session', sessions: workers.sessions }); // send updated worker sessions
			}
		});
	},5000); // 5 second interval
}

try{
	require('./urlManager.js');
	
	(async()=>{
		var ipvRes=await fetch('http://bot.whatismyipaddress.com/'),
			ipv=await ipvRes.text(),
			tlds=/./g,
			tldList=[],
			tldsRes=await fetch('https://publicsuffix.org/list/effective_tld_names.dat'),
			tldsBody=await tldsRes.text(),
			tldsProc=await tldsBody.split('\n');
		
		tldsProc.forEach((e,i,a)=>{
			if(!e.match(/(?:\*|\/\/|\s|\.)/gi) && e.length>=1){
				tldList.push(e);
				tlds+=`${e.replace('.','\\.')}|`;
			}
		});
		
		tlds=new RegExp(`\\.(?:${tlds.substr(0,tlds.length-1)})$`,'gi');

		console.log('Fetched domain TLDS (',tldsProc.length,')');

		var makeWorker=((i)=>{
			if(config.maxWorkerErrors < errors )return console.log('Error count at',config.maxWorkerErrors,', refusing to create more workers..');
			const index=i+1;
			var pogPort=process.env.PORT||config.port;
			if(config.workers == true)pogPort=pogPort+i;
			var worker = new threads.Worker('./server.js', {
				workerData: { port: pogPort, ipv: ipv, tlds: tlds, tldList: tldList }
			});
			
			workers.instances.push(worker);
			
			worker.on('message', (data)=>{
				switch(data.type){
					case'log':
						console.log(`Worker ${index}: ${data.value}`)
						
						break
					case'store_set':
						workers.sessions[data.sid] = data.session;
						
						workers.broadcast({ type: 'update_session', sessions: workers.sessions });
						
						break
					case'store_get':
						workers.sessions[data.sid].__lastAccess = Date.now();
						
						worker.postMessage({ to: 'store_get', session: workers.sessions[data.sid] })
						
						break
					case'store_del':
						delete workers.sessions[data.sid]
						
						break
				}
			});
			worker.on('error', (err)=>{
				console.log(`Worker ${index} ERR:`);
				console.log(err);
				errors++;
				makeWorker(i); // make a new identical worker
			});
			worker.on('exit', (code) => {
				if(code!=0)console.log('Worker stopped with exit code ',code);
			});
		});
		
		if(config.workers)for(var i=0;i<config.workerCount;i++)makeWorker(i);
		else makeWorker(0);
	})();
}catch(err){
	console.log(err);
	fs.appendFileSync('err.log',`${util.format(err)}\n`);
}

rl.init();
rl.setPrompt('> ');
rl.on('line', function(line) {
	var args=line.split(' '),
		mts=line.substr(args[0].length+1,128);
	switch(args[0]){
		case'run': // debugging
			try{console.log(util.format(eval(mts)))}
			catch(err){console.log(util.format(err))};
			break
		case'stop':case'exit':
			process.exit(0);
			break
		default:
			if(!args[0])return; // if slap enter key
			console.log(`app: ${args[0]}: command not found`);
			break
	}
});
rl.on('SIGINT',(rl)=>process.exit(0)); // ctrl+c quick exit