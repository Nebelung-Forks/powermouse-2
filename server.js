const fs=require('fs'),
	threads=require('worker_threads'),
	fetch=require('node-fetch'),
	express=require('express'),
	websocket=require('ws'),
	app=express(),
	path=require('path'),
	mime=require('mime'),
	util=require('util'),
	cookieParser=require('cookie-parser'),
	streamPipeline=util.promisify(require('stream').pipeline),
	https=require('https'),
	http=require('http'),
	bodyParser=require('body-parser'),
	htmlMinify=require('html-minifier'),
	compression=require('compression'),
	os=require('os'),
	crypto = require('crypto'),
	start=Date.now();
var config=JSON.parse(fs.readFileSync('config.json','utf-8')),
	port,
	args=process.argv.splice(2),
	ssl={},tt='',
	msgPage=page=fs.readFileSync(__dirname+'/public/error.html','utf8');
	httpsAgent = new https.Agent({
		rejectUnauthorized: false,
		keepAlive: true,
	}),
	httpAgent = new http.Agent({
		rejectUnauthorized: false,
		keepAlive: true,
	}),
	genMsg=((req,res,code,value)=>{
		var url=req.url,
			method=req.method;
		res.contentType('text/html');
		switch(code){
			case 696: // glorified 404
				res.status(404)
				return res.send(msgPage.replace('%TITLE%','Bad domain').replace('%REASON%', (value || `Cannot ${method} ${url}`) ));
				break
			case 697:
				res.status(500)
				return res.send(msgPage.replace('%TITLE%',value.code).replace('%REASON%', value.message ));
				break
			case 400:
				res.status(code)
				return res.send(msgPage.replace('%TITLE%',code).replace('%REASON%', (value || 'Bad request') ));
				break
			case 403:
				res.status(code)
				return res.send(msgPage.replace('%TITLE%',code).replace('%REASON%', (value || 'Access forbidden') ));
				break
			case 500:
				res.status(code)
				return res.send(msgPage.replace('%TITLE%',code).replace('%REASON%', (value || 'A server is unable to handle your request') ));
				break
			case 404:
			default:
				res.status(code);
				return res.send(msgPage.replace('%TITLE%',code).replace('%REASON%',`Cannot ${method} ${url}`));
				break
		}
	}),
	randomIP=(()=>{
		return (Math.floor(Math.random() * 255) + 1)+"."+(Math.floor(Math.random() * 255))+"."+(Math.floor(Math.random() * 255))+"."+(Math.floor(Math.random() * 255))
	});
	getDifference=((begin,finish)=>{
		var ud=new Date(finish-begin);
		var s=Math.round(ud.getSeconds());
		var m=Math.round(ud.getMinutes());
		var h=Math.round(ud.getUTCHours());
		return `${h} hours, ${m} minutes, ${s} seconds`
	}),
	addproto=((url)=>{
		if (!/^(?:f|ht)tps?\:\/\//.test(url))url = "https://" + url;
		return url;
	}),
	similar=((a,b)=>{
		var equivalency = 0;
		var minLength = (a.length > b.length) ? b.length : a.length;    
		var maxLength = (a.length < b.length) ? b.length : a.length;    
		for(var i=0;i<minLength;i++)if(a[i]==b[i])equivalency++;
		var weight = equivalency / maxLength;
		return (weight * 100);
	}),
	ready=(()=>{
		if(config.listenip=='0.0.0.0' || config.listenip=='127.0.0.1')config.listenip='localhost';
		var proto='http';
		if(config.ssl==true)proto='https';
		var msg=`Listening on ${proto}://${config.listenip}:${port}${tt}`;
		threads.parentPort.postMessage({type:'log', id: threads.threadId, value: msg});
	});

global.btoa=((str,encoding)=>{
	let enc='base64';
	if(typeof encoding!='undefined')enc=encoding;
	return Buffer.from(str,'utf8').toString(enc)
});

global.atob=((str,encoding)=>{
	let enc='base64';
	if(typeof encoding!='undefined')enc=encoding;
	return Buffer.from(str,enc).toString('utf8')
});

global.ipv='127.0.0.1'; // define ip before its set
global.tlds=/./g; // define tlds before set
global.tldList=[];

var data=threads.workerData;
global.sessions={} // object for just vibing
ipv = data.ipv;
tlds = data.tlds;
port = data.port;
tldList = data.tldList;

threads.parentPort.on('message',(data)=>{
	switch(data.type){
		case'update_session':
			sessions=data.sessions;
			break
		default:
			console.log(data);
			break
	}
});

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(compression());

http.globalAgent.maxSockets = Infinity;
https.globalAgent.maxSockets = Infinity;

if(!args || !args[0])ssl={key: fs.readFileSync('ssl/default.key','utf8'),cert:fs.readFileSync('ssl/default.crt','utf8')};
else switch(args[0].toLowerCase()){
	case'dev':
		tt=', DEV environment';
		ssl={key: fs.readFileSync('ssl/localhost.key','utf8'),cert:fs.readFileSync('ssl/localhost.crt','utf8')}
		break;
	default:
		ssl={key: fs.readFileSync('ssl/default.key','utf8'),cert:fs.readFileSync('ssl/default.crt','utf8')};
}
listen=config.listenip;
if(config.ssl==true)server=https.createServer(ssl,app).listen(port, config.listenip,ready);
else server=http.createServer(app).listen(port, config.listenip,ready);

var wss=new websocket.Server({
		server: server,
		// path: '/ws/'
	}),conns=0;

require('./ws.js')(wss,conns);

app.get('/pm-cgi/',(req,res)=>{
	return res.redirect('/');
});

app.get('/suggestions',(req,res)=>{ // autocomplete urls
	if(typeof req.query.input != 'string' || req.query.input == '')return genMsg(req,res,400,'Invalid domain input/type');
	var suggestions=[],input=req.query.input,index=0,tldCheck='',sortedList={},matched=input.match(/\..{2,3}(?:\.?.{2,3})?/gim);
	
	res.status(200);res.contentType('application/json');
	
	if(matched===null || matched==='')return res.send(JSON.stringify(['com','net','org','io','dev'])); else tldCheck=matched[0].substr(1);
	tldList.forEach((e,i)=>sortedList[similar(tldCheck,e)]=e);
	var bruvList=Object.entries(sortedList).sort(((a,b)=>{
			return a[0] - b[0];
	})).reverse();
	bruvList.forEach((e,i)=>{
		if(index>5)return;
		index++;
		suggestions.push(e[1]);
	});
	return res.send(JSON.stringify(suggestions));
});

app.get('/linkGen',(req,res,next)=>{
	var file=fs.readFileSync(path.join(__dirname, 'public/linkGen.html'));
	res.status(200);
	res.contentType('text/html');
	return res.send(file);
});

var urlData=JSON.parse(fs.readFileSync('urlData.json','utf8')),
	writeURLs=(()=>{
		var perhaps=JSON.parse(fs.readFileSync('urlData.json','utf8'));
		if(urlData == perhaps)return false; // the url data hasnt changed
		// if the above hasnt done a thing then code continues
		fs.writeFileSync('urlData.json',JSON.stringify(urlData,null,'\t'),'utf-8');
		// data success
	}),
	reloadURLs=(()=>{
		// we read file stuff now
		var perhaps=JSON.parse(fs.readFileSync('urlData.json','utf8'));
		if(urlData != perhaps)urlData=perhaps;
	}),
	urlExpire=10800000;
	// 3000 = 3 seconds, 10000 = 10 seconds, 60000 = 1 minute, 180000 = 3 minutes, 10800000 = 3 hours

app.post('/alias',(req,res,next)=>{
	var url = req.body.url.trim().toLowerCase().replace(/[^a-z0-9.:\/]/gi,''), // replace bad characters
		alias = req.body.alias.trim().toLowerCase().replace(/[^a-z0-9.:\/]/gi,''), // replace more bad characters!
		reqUrl=new URL('https://'+req.get('host')+req.originalUrl),
		sideNote=''; // additional user message for later if needed
	try{
		url=new URL(url).origin
	}catch(err){
		res.status(400);res.contentType('text/html');
		return res.send(msgPage.replace('%TITLE%',err.code).replace('%REASON%',err.message));
	}
	
	url=addproto(url); // this is done on the client too for checking but is needed here
	reloadURLs(); // reload url list
	
	// Alias errors
	
	if(alias == '')sideNote=`A random alias had to be generated due to an alias not being specified`;
	if(urlData.some(e=> e.alias.startsWith(alias) || alias.startsWith(e.alias) ) )sideNote=`A random alias had to be generated due to conflicts with other aliases`;
	if(alias.length < 4)sideNote=`The alias specified was shorter than 4 characters so a random one was generated`;
	
	// URL errors
	if(config.directIPs==false && url.match(/(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/gi)){
		res.status(400);res.contentType('text/html');
		return res.send(page.replace('%TITLE%','Bad URL').replace('%REASON%','Aliases pointing to an IP address are not permitted'));
	}else if(typeof url != 'string'){
		res.status(400);res.contentType('text/html');
		return res.send(page.replace('%TITLE%','Bad URL').replace('%REASON%','The URL specified is not a valid string'));
	}else if(!url.match(tlds)){
		res.status(400);res.contentType('text/html');
		return res.send(page.replace('%TITLE%','Bad URL').replace('%REASON%','The URL specified was not a valid URL'));
	}
	
	if(alias == '' || alias.length <= 4 || urlData.some(e=> e.alias.startsWith(alias) || alias.startsWith(e.alias) ) ){
		while(true){
			alias = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8); // random alias
			if( urlData.some(e=>e.value == alias) )continue; // if the new alias has bee found in the url data, try again
			break;
		}
	}
	urlData.push({
		time: Date.now(),
		value: addproto(url),
		alias: alias
	});
	writeURLs();
	res.status(200);
	res.contentType('text/html');
	
	if(sideNote != '')sideNote=`<div class='lbottom'><span id='logMsg'>`+sideNote+`</span></div>`;
	return res.send(msgPage.replace('%TITLE%','Success').replace('%REASON%',`
	<a href="./${reqUrl.origin}/alias/${alias}"><span>${reqUrl.origin}/alias/${alias}</span></a> now points to <a href="./${addproto(url)}"><span>${addproto(url)}</span></a>
	${sideNote}
	`));
});

app.use((req,res,next)=>{
	if( !req.url.startsWith('/prox') ||  (req.method=='POST' && !req.body.url) || (req.method=='GET' && !req.query.url) )return next();
	var url;
	if(req.method=='GET')url=req.query.url
	else if(req.method=='POST')url=req.body.url;
	try{url=new URL(addproto(url))}
	catch{return next()} // dont parse bad urls
	res.redirect('/'+url.href);
});

app.use((req,res,next)=>{
	// hacky implementation of session stuff
	// this will add request.session ( a proxy thing acting as an object so it can see whats being added to push to the centeral script )
	
	var sid = req.cookies['connect.sid'],
		reqUrl=new URL('https://'+req.get('host')+req.originalUrl),
		cookie = { maxAge: 900000, httpOnly: true, domain: reqUrl.host.match(/\..{2,3}(?:\.?.{2,3}).*?$/gim), secure: true, sameSite: 'Lax' };
	
	// res.setHeader('Content-Security-Policy',`default-src 'self' *.${reqUrl.hostname}`);
	
	if(sid == undefined || sid.length <= 7){
		while(true){
			sid=crypto.randomBytes(32).toString('hex');
			if(sessions[sid] != null)continue;
			break;
		}
	}
	
	res.cookie('connect.sid', sid , cookie);
	
	res.cookie('pm-server', os.hostname().substr(0,4).toLowerCase() , cookie);
	
	if(sessions[sid] == null)sessions[sid]={}
	
	sessions[sid].__lastAccess = Date.now();
	sessions[sid].sid = sid;
	sessions[sid].cookie = cookie;
	
	req.session=new Proxy(sessions[sid], {
		set: (target, prop, value)=>{
			Reflect.set(target, prop, value);
			threads.parentPort.postMessage({type:'store_set', sid: target.sid, session: target });
		}
	});
	
	sessions[sid];
	
	return next();
});

app.use(async (req,res,next)=>{
	if(req.query.ws != undefined)return next(); // noo websocket script did not handle 
	var reqUrl=new URL('https://'+req.get('host')+req.originalUrl),
		url,
		headers={},
		response,
		ct='notset',
		sendData,
		fetchStuff={
			method: req.method,
			redirect: 'follow',
			agent: (_parsedURL)=>{
				if(_parsedURL.protocol == 'http:')return httpAgent;
				else return httpsAgent;
			},
		};
	
	if(reqUrl.pathname.startsWith('/pm-cgi/')||reqUrl.pathname=='/favicon.ico')return next();
	
	if(reqUrl.pathname=='/'){
		res.contentType('text/html');
		res.status(200);
		return res.send(fs.readFileSync(__dirname+'/public/index.html','utf8').replace("<span time='%PLACEHOLDER%' id='uptime'>%PLACEHOLDER%</span>",`<span time='${start}' id='uptime'>${getDifference(start,Date.now())}</span>`));
	}
	
	if(reqUrl.pathname=='/https://discordapp.com/api/v6/auth/login')return res.status(400).contentType('application/json; charset=utf-8').send(JSON.stringify({ email: 'Use the QR code scanner or token login' }));
	
	var tooManyOrigins=new RegExp(`${reqUrl.origin.replace(/\//g,'\\/').replace(/\./gi,'\\.')}\/`,'gi');
	if(req.url.substr(1).match(tooManyOrigins))return res.redirect(307,req.url.replace(tooManyOrigins,''));
	
	var tooManyOrigins=new RegExp(`//${reqUrl.host.replace(/\\./g,'\\.')}`,'gi');
	if(req.url.substr(1).match(tooManyOrigins))return res.redirect(307,req.url.replace(tooManyOrigins,''));
	
	reloadURLs();
	
	var aliasMode=urlData.some(e=>req.url.match(new RegExp(`^/alias/${e.alias}`,'gi')));
	var shor='placeholder', newURL='placeholder', aliasSet='placeholder';
	if( aliasMode ){ // if a shortened url link matches in the url stuff
		
		urlData.forEach((e,i)=>{
			var regoink=new RegExp(`^/alias/${e.alias}`,'gi');
			if(req.url.match(regoink)){
				shor=e.value; // set shortened to the value found within the url data stuff
				aliasSet = e.alias;
				newURL=req.url.replace(regoink,e.value);
				url=new URL(newURL);
				
			}
		});
		
	}else try{
		url=new URL(req.url.substr(1));
		if(!url.hostname.match(/.*?\....?/gi))throw new error('FUC');
	}catch(err){
		// req.session.ref is only set when the content-type is text/html and is not an iframe or object
		if(req.session.ref != undefined && req.session.ref.length>=1){
			var ref=new URL(req.session.ref),newURL='/'+ref.origin+req.url;
			
			if(newURL == undefined)return genMsg(req,res,404); // not poggers!
			
			return res.redirect(307,newURL); //	/cdn/ => https://domain.tld + /cdn/bruh.js
		}else{
			return genMsg(req,res,404);
		}
	}
	
	if(config.directIPs==false && url.hostname.match(/(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/gi))return genMsg(req,res,403,'Direct IP access is not permitted');
	
	if(!url.hostname.match(tlds))return genMsg(req,res,696);
	
	if(!aliasMode && req.url!='/'+url.href)return res.redirect(307,'/'+url.href);
	
	var proto=url.protocol.substr(0,url.protocol.length-1);
	
	if(req.method=='POST')fetchStuff['body']=JSON.stringify(req.body);
	Object.entries(req.headers).forEach((e,i,a)=>{
		var name=e[0].toLowerCase();
		var value=e[1];
		if(value.includes(url.host) || name.startsWith('Content-security-policy') || name.startsWith('x-') || name.startsWith('host') || name.startsWith('cf-') || name.startsWith('cdn-loop') )return;
		headers[name]=value;
	});
	
	var cookieStr='';
	Object.entries(req.cookies).forEach((e,i)=>{
		cookieStr+=`${e[0]}=${e[1]};`;
	});
	headers['cookie']=cookieStr;
	fetchStuff['headers']=headers;
	
	response=await fetch(url,fetchStuff).catch(err=>{
		switch(err.code){
			case'HPE_HEADER_OVERFLOW':
				Object.entries(req.cookies).forEach((e,i)=>{ // clear all cookies
					res.clearCookie(e[0]);
				});
				return res.redirect(req.url);
				break
			default:
				return genMsg(req,res,697,err);
				break
		}
		return genMsg(req,res,697,err);
	});	
	
	if(response !=undefined && response.redirected == true){ // redirect has happened at least once
		return res.redirect(307, '/'+response.url);
	}
	
	if(typeof response.buffer != 'function')return; // error should have already been handled at this point so just return
	
	sendData=await response.buffer();
	
	response.headers.forEach((e,i,a)=>{
		if(i=='content-type')ct=e; //safely set content-type
	});
	
	if(ct=='notset')ct=mime.getType(url.href.match(/\.(\w{2,4})/gi));
	
	if(ct==null || typeof ct=='undefined')ct='text/html'; // set to text/html as last ditch effort
	if(ct.startsWith('text/html') && response.status == 200 && typeof req.query['pm-origin'] == 'undefined')req.session.ref=url.href;
	
	res.contentType(ct);
	res.status(response.status);
	
	if(ct.includes('application/x-shockwave-flash') || ct.includes('font'))return res.send(sendData); // get straight to the font
	
	if(ct.startsWith('image'))res.set('Cache-Control','max-age=31536000'); // big cache for images
	
	if(ct.startsWith('text/') || ct.startsWith('application/') ){
		var tmp=sendData.toString('utf8'),
			regUrlOri=reqUrl.origin.replace('.','\\.').replace('/','\\/'), // safe way to have url origin in regex
			urlOri=url.origin.replace('.','\\.').replace('/','\\/'), // safe way to have url origin in regex
			str='';
		sendData=await tmp;
		sendData.split('\n').forEach(e=>str+=e+'\n');
		if(ct.startsWith('text/css'))sendData=await htmlMinify.minify('<style>'+sendData+'</style>',{minifyCSS: true, }).replace(/(?:^<style>|<\/style>$)/gi,''); // cool trick to get htmlMinify to minify a css file and have it display correctly
		if(ct.includes('javascript'))sendData=await str
		.replace(/this\.xhr\.open\("GET",a\)/gi,`this.xhr.open("GET",location.origin+"/"+a)`)
		;
		if(ct.startsWith('text/html')){
			sendData=await str
			.replace(/(?<!base )((?:target|href|src|srcset|data|action)\s*?=\s*?(?:"|'))\/\//gi,'$1https://')
			.replace(/(?<!base )((?:target|href|src|srcset|data|action)\s*?=\s*?(?:"|'))((?!data:|javascript:)\/[\s\S]*?)((?:"|'))/gi,'$1'+url.origin+'$2$3')
			.replace(/(?<!base )((?:target|href|src|srcset|data|action)\s*?=\s*?(?:"|'))((?!data:|javascript:)[\s\S]*?)((?:"|'))/gi,'$1/$2$3')
			.replace(new RegExp(`("|')(${urlOri}.*?)("|')`,'gi'),'$1/$2$3')
			.replace(/(xmlns(:[a-z]+)?=")\//gi, "$1")
			.replace(/(<!DOCTYPE[^>]+")\//i, "$1")
			.replace(url.host,`${reqUrl.host}/${url.host}`)
			.replace(new RegExp(`/(https://)${reqUrl.host}/`,'gi'),'/$1')
			.replace(/ ?(integrity|nonce)=".*?" ?/gi,'') // integrity and nonce cant be used 
			.replace(/('|")(wss:\/\/.*?)('|")/gi,'$1'+`wss://${reqUrl.host}/?ws=`+"$2$3")
			.replace(/document\.location/gi,'pmUrl') // pm url should be defined in a script somewhere
			.replace(/window\.location/gi,'pmUrl') // same as above
			.replace(/<title.*?>.*?<\/ ?title>/gi,'<title>‮</title>')
			.replace(/("|').[^"']*\.ico(?:\?.*?)?("|')/gi,'$1/favicon.ico$2')
			.replace(/ ?onmousedown="return rwt\(this,.*?"/gi,'')
			.replace(/("|')_(?:blank|top|parent)\1/gi,'$1_self$1')
			.replace(/(<(?:iframe|object)\s*src=("|'))((?:(?!\?)[\s\S])*?)(?:\2)/gi,'$1$3?pm-origin='+btoa(url.host)+'$2') // this regex is for strings without the ? in it
			.replace(/(<(?:iframe|object)\s*src=("|'))((?:(?!&pm-origin=)[\s\S])*?)(?:\2)/gi,'$1$3&pm-origin='+btoa(url.host)+'$2') // this regex for the strings without the &pm-origin= inside of it
			.replace(new RegExp(`${regUrlOri}\/\.\/`,'gi'),`./`)
			.replace(new RegExp(`(?:${reqUrl.origin}|${url.origin})/data:`,'gi'),'data:') // fix data urls last
			.replace(/(<script(?:.*?)>(?:(?!<\/script>)[\s\S])*<\/script>)/i,'<script>var pmUrl=new URL("'+url.href+'");</script>$1')
			.replace(/<\/body>/gi,'<script src="/pm-cgi/inject.js"></script></body>')
			;
			if(url.hostname != 'www.youtube.com'){ // run this on not youtube links
				sendData=await sendData
				.replace(new RegExp(ipv,'gi'),randomIP())
				;
			}
			if(!aliasMode){
				sendData=sendData
				.replace(/<\/body>/gi,'<script src="/pm-cgi/windowURL.js"></script></body>')
				;
			}else if(aliasMode){ // short for aliasMode == true
				sendData=sendData
				.replace(new RegExp(`("|')\/${shor}(.*?)("|')`,'gi'),'$1/alias/'+aliasSet+'$2$3')
				;
			}
			if(str.includes('cf-browser-verification cf-im-under-attack')){ // on cloudflare checks, inform the user we cant proxy this page 
				sendData=sendData
				.replace(/<\/body>/gi,'  <script type="text/javascript" src="/pm-cgi/cloudflare.js"></script>\n</body>')
				.replace(/<\/head>/gi,'<link rel="stylesheet" href="/pm-cgi/cloudflare.css">\n</head>')
				;
			}
			
			if(config.workers && typeof req.query.debug == 'string' && req.query.debug == 'true'){
				sendData=sendData
				.replace(/<\/body>/gi,`
<!-- [POWERMOUSE STATS]
Worker: ${threads.threadId}
Port: ${port}
Host: ${os.hostname()}
-->
</body>`)
				;
			}
			switch(url.host){
				case'discord.com':
					sendData=await sendData // hacky discord support
					.replace(`API_ENDPOINT: '//discord.com/api'`,`API_ENDPOINT: '/https://discordapp.com/api'`) // api for discord.com is odd but discordapp.com works
					.replace(`REMOTE_AUTH_ENDPOINT: '//remote-auth-gateway.discord.gg'`,`REMOTE_AUTH_ENDPOINT: '//${reqUrl.host}/?ws=wss://remote-auth-gateway.discord.gg'`)
					.replace(`WEBAPP_ENDPOINT: '//discord.com'`,`WEBAPP_ENDPOINT: '//${reqUrl.host}/https://discord.com'`)
					.replace(`CDN_HOST: 'cdn.discordapp.com'`,`CDN_HOST: '${reqUrl.host}/https://cdn.discordapp.com'`)
					.replace(`ASSET_ENDPOINT: '/https://discord.com'`,`ASSET_ENDPOINT: '${reqUrl.origin}/https://discord.com'`)
					.replace(`WIDGET_ENDPOINT: '//discord.com/widget'`,`WIDGET_ENDPOINT: '//${reqUrl.host}/https://discord.com/widget'`)
					.replace(`NETWORKING_ENDPOINT: '//router.discordapp.net'`,`NETWORKING_ENDPOINT: '//${reqUrl.host}/https://router.discordapp.net'`)
					.replace(`MIGRATION_DESTINATION_ORIGIN: 'https://discord.com'`,`MIGRATION_DESTINATION_ORIGIN: '${reqUrl.origin}/https://discord.com'`)
					.replace(`MIGRATION_SOURCE_ORIGIN: 'https://discordapp.com'`,`MIGRATION_SOURCE_ORIGIN: '${reqUrl.origin}/https://discordapp.com'`)
					.replace(/<\/body>/gi,`<script type='text/javascript' src='/pm-cgi/discord.js'></script>`)
					;
					break;
				default:break;
			}
			try{
				sendData=htmlMinify.minify(sendData,{minifyCSS: true, minifyJS: true});
			}catch(err){
			
			}
		}
	}
	res.send(sendData);
});

app.use('/', express.static(path.join(__dirname, 'public'))); // static stuff