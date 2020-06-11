const fs=require('fs'),
	util=require('util'),
	rl=require('serverline');

try{
	require('./ws.js')
}catch(err){
	require('./ws.js');
	fs.appendFileSync('err.log',`${util.format(err)}\n`);
	err='';
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