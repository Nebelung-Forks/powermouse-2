const fs=require('fs'),
	colors=require('colors'),
	fetch=require('node-fetch'),
	express=require('express'),
	app=express(),
	path=require('path'),
	mime=require('mime'),
	util=require('util'),
	cookieParser = require('cookie-parser'),
	streamPipeline = util.promisify(require('stream').pipeline),
	https=require('https'),
	http=require('http'),
	bodyParser=require('body-parser'),
	start=Date.now();
var config=JSON.parse(fs.readFileSync('config.json','utf-8')),
	session = require("express-session")({
		secret: "secret",
		resave: true,
		saveUninitialized: true
	}),
	caching=config.caching,
	args=process.argv.splice(2),
	port=process.env.PORT||config.port,
	re_proxied_xmlns = new RegExp('(xmlns(:[a-z]+)?=")\/', 'ig'),
	re_proxied_doctype = new RegExp('(<!DOCTYPE[^>]+")\/', 'i'),
	httpsAgent = new https.Agent({
		rejectUnauthorized: false,
	}),
	httpAgent = new http.Agent({
		rejectUnauthorized: false,
	}),
	genErr=((req,res,code,reason)=>{
		var url=req.url,
			method=req.method;
		
		switch(code){
			case 400:
				return res.status(code).contentType('text/html').send(fs.readFileSync(__dirname+'/public/'+code+'.html','utf8').replace('%REASON%',reason).replace(/%METHOD%/gi,method).replace(/%PATH%/gi,url));
				break
			case 403: 
				return res.status(code).contentType('text/html').send(fs.readFileSync(__dirname+'/public/'+code+'.html','utf8').replace('%REASON%',reason));
				break
			case 404:
			default:
				return res.status(code).contentType('text/html').send(fs.readFileSync(__dirname+'/public/'+code+'.html','utf8').replace(/%METHOD%/gi,method).replace(/%PATH%/gi,url));
				break
		}
	}),
	getDifference=((begin,finish)=>{
		var ud=new Date(finish-begin);
		var s=Math.round(ud.getSeconds());
		var m=Math.round(ud.getMinutes());
		var h=Math.round(ud.getUTCHours());
		return `${h} hours, ${m} minutes, ${s} seconds`
	}),
	addproto=((url)=>{
		if (!/^(?:f|ht)tps?\:\/\//.test(url))url = config.protocol+"://" + url;
		return url;
	}),
	rewrites=[['reddit.com','old.reddit.com'],['www.reddit.com','old.reddit.com'],['google.com','www.google.com']];

global.ipv='127.0.0.1';
(async()=>{ // funky async function
	var res=await fetch('http://bot.whatismyipaddress.com/');
	var body=await res.buffer();
	ipv=await body.toString('utf8');
})();
var ssl={},tt='';
if(args[0]=='dev')tt=', DEV environment';
if(args[0]=='dev')ssl={key: fs.readFileSync('ssl/localhost.key','utf8'),cert:fs.readFileSync('ssl/localhost.crt','utf8')}
else ssl={key: fs.readFileSync('ssl/key.pem','utf8'),cert:fs.readFileSync('ssl/cert.pem','utf8')};
if(config.ssl==true)server=https.createServer(ssl,app).listen(port, config.listenip, ()=>{
	console.log(`Listening on port ${port}${tt}`);
})
else server=http.createServer(app).listen(port, config.listenip, ()=>{
	console.log(`Listening on port ${port}${tt}`);
})

app.use(session);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));

app.get('/staticPM/',(req,res)=>{
	return res.redirect('/');
});

app.post('/prox',(req,res,next)=>{
	if(!req.body||!req.body.url)return next();
	var url;
	try{ url=new URL(addproto(req.body.url))
	}catch{ return next(); } // dont parse broken urls
	res.redirect('/'+url.href)
});

app.get('/prox',(req,res,next)=>{
	if(!req.query||!req.query.url)return next();
	var url;
	try{ url=new URL(addproto(req.query.url))
	}catch{ return next(); } // dont parse broken urls
	res.redirect('/'+url.href)
});

app.use(async (req,res,next)=>{
	var reqUrl=new URL(config.protocol+'://'+req.get('host')+req.originalUrl);
	var url,
		headers={},
		response,
		ct='notset',
		sendData,
		exit=false,
		fetchStuff={method:req.method};
	
	if(req.url.startsWith('/staticPM/')||req.url=='/favicon.ico')return next();
	
	if(req.url=='/'){
		res.contentType('text/html');
		res.status(200);
		return res.send(fs.readFileSync(__dirname+'/public/index.html','utf8').replace("<span time='%PLACEHOLDER%' id='uptime'>%PLACEHOLDER%</span>",`<span time='${start}' id='uptime'>${getDifference(start,Date.now())}</span>`));
	}
	var tooManyOrigins=new RegExp(`${reqUrl.origin.replace(/\//g,'\\/').replace(/\./gi,'\\.')}\/`,'gi');
	if(req.url.substr(1).match(tooManyOrigins))return res.redirect(307,req.url.replace(tooManyOrigins,''));
	try{
		url=new URL(req.url.substr(1));
		if(!url.hostname.match(/.*?\....?/gi))throw 'FUC';
		req.session.tempOrigin=url.origin;
	}catch(err){
		if(req.headers.referer){
			try{
				var ref=new URL(req.headers.referer.substr(reqUrl.origin.length+1)),
					requ=req.url.replace(/^\/https:\/\//gi,'/'),
					completeURL='/'+ref.origin+requ;
					req.session.tempOrigin=ref.origin;
				return res.redirect(307,completeURL);
			}catch(e){
				var yy=req.session.tempOrigin;
				if(typeof req.session.tempOrigin == 'undefined')return genErr(req,res,404);
				setTimeout(()=>{
					//req.session.destroy(); // clear after
				},1600);
				return res.redirect(307,'/'+yy+'/'+req.url.substr(1));
			}
		}else if(req.session.tempOrigin&&req.session.tempOrigin.length>=2){
			var yy=req.session.tempOrigin;
			if(typeof req.session.tempOrigin == 'undefined')return genErr(req,res,400,'Your client sent a bad request.');
			setTimeout(()=>{
				req.session.destroy(); // clear after
			},1600);
			return res.redirect(307,'/'+yy+'/'+req.url.substr(1));
		}else{
			try{
				if(!req.url.includes('http') && req.url.match(/.*?\..*?\//gi))url=new URL('https://'+req.url.substr(1))
				else return genErr(req,res,404);
			}catch(err){
				return genErr(req,res,404);
			}
		}
	}
	
	if(config.directIPs==false && url.hostname.match(/(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/gi))return genErr(req,res,403,'Direct IP access not permitted.');
	if(req.url!='/'+url.href)return res.redirect(307,'/'+url.href);
	
	var proto=url.protocol.substr(0,url.protocol.length-1);
	if(proto=='http')fetchStuff['agent']=httpAgent
	else if(proto=='https')fetchStuff['agent']=httpsAgent;
	
	rewrites.forEach((e,i,a)=>{
		if(!e[0]||!e[1])return;
		var find=e[0].replace(/^www\./gi,'') // remove www.
		var replace=e[1];
		if(url.host.startsWith(find)){
			res.redirect(307,'/'+addproto(replace)+url.pathname+url.search);
			exit=true;
		}
	});
	if(exit)return;
	
	if(req.method=='POST')fetchStuff['body']=JSON.stringify(req.body);
	Object.entries(req.headers).forEach((e,i,a)=>{
		var name=e[0].toLowerCase();
		var value=e[1];
		if(value.includes(url.host) || name.startsWith('Content-security-policy') || name.startsWith('x-') || name.startsWith('host') || name.startsWith('cf-') || name.startsWith('cdn-loop') )return;
		headers[name]=value;
	});

	if(url.host.includes('youtube.com')){
		headers['user-agent']='Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36';
	}
	fetchStuff['headers']=headers;
	response=await fetch(url,fetchStuff).catch(err=>{
		res.status(500).contentType('text/html').send(err.message);
		return false;
	});
	if(response==false)return;
	sendData=await response.buffer();
	
	response.headers.forEach((e,i,a)=>{
		if(i=='content-type')ct=e; //safely set content-type
	});
	
	if(ct=='notset')ct=mime.getType(url.href.match(/\.(\w{2,4})/gi));
	
	if(ct==null || typeof ct=='undefined')ct='text/html'; // set to text/html as last ditch effort
	
	//if(ct.match(/(?!.*;.*)application\/.*?font.*/gi))return res.redirect(url.href);
	
	res.contentType(ct);
	res.status(response.status);
	// res.set('Cache-Control','max-age=31536000')
	if(ct.startsWith('text/html') || ct.startsWith('application/')){
		var tmp=sendData.toString('utf8');
		var regUrlOri=reqUrl.origin.replace('.','\\.').replace('/','\\/'); // safe way to have url origin in regex
		var ddd='';
		sendData=await tmp;
		sendData=await sendData;
		sendData.split('\n').forEach(e=>ddd+=e+'\n');
		sendData=await ddd
		.replace(new RegExp(ipv.replace(/\./gi,'\\.'),'gi'),'255.255.255.255')
		.replace(/window\.top\.location\.href="\/\/www.coolmath-games.com"/gi,'"t"')
		;
		if(ct.startsWith('text/html')){
			sendData=await ddd
			.replace(/(?<!base )(srcset|action|data|src|href)="\/((?!\/).*?)"/gi,'$1="/'+url.origin+'/$2"')
			.replace(/(?<!base )(srcset|action|data|src|href)='\/((?!\/).*?)'/gi,'$1=\'/'+url.origin+'/$2\'')
			.replace(new RegExp(`(srcset|action|data|src|href)="${reqUrl.hostname}(\/.*?)"`,'gi'),'$1="'+url.origin+'$2"')
			.replace(new RegExp(`(srcset|action|data|src|href)=\'${reqUrl.hostname}(\/.*?)\'`,'gi'),'$1=\''+url.origin+'$2\'')
			.replace(re_proxied_xmlns, "$1")
			.replace(re_proxied_doctype, "$1")
			.replace(url.host,`${reqUrl.host}/${url.host}`)
			.replace(new RegExp(`/(${config.protocol}://)${reqUrl.host}/`,'gi'),'/$1')
			.replace(/ ?integrity=".*?" ?/gi,'') // integrity cant be used 
			.replace(/ ?nonce=".*?" ?/gi,'') // nonce = poo
			.replace(/"(wss:\/\/.*?)"/gi,`"wss://${reqUrl.host}/ws/?ws=`+'$1"')
			.replace(/'(wss:\/\/.*?)'/gi,`'wss://${reqUrl.host}/ws/?ws=`+"$1'")
			.replace(/document\.location/gi,'pmUrl')
			.replace(/window\.location/gi,'pmUrl')
			.replace(/<title.*?>.*?<\/ ?title>/gi,'<title>‮</title>')
			.replace(/("|').[^"']*\.ico(?:\?.*?)?("|')/gi,'$1/favicon.ico$2')
			.replace(/ ?onmousedown="return rwt\(this,.*?"/gi,'')
			//.replace(/(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/gi,'255.255.255.255')
			.replace(new RegExp(`(?<!base )(srcset|action|data|src|href)="(?!(?:${reqUrl.origin.replace('/','\\/')}|\/))(.*?)"`,'gi'),'$1="'+reqUrl.origin+'/$2"')
			.replace(new RegExp(`(?<!base )(srcset|action|data|src|href)='(?!(?:${reqUrl.origin.replace('/','\\/')}|\/))(.*?)'`,'gi'),'$1=\''+reqUrl.origin+'/$2\'')
			.replace(new RegExp(ipv.replace(/\./gi,'\\.'),'gi'),'255.255.255.255')
			.replace(new RegExp(`${regUrlOri}\/\.\/`,'gi'),`./`)
			.replace(new RegExp(`${reqUrl.host}\/(?!https?:\/\/)(.*)`,'gi'),reqUrl.host+'/https://$1')
			.replace(/pmUrl ?= ?("|').*?("|')/gi,'pmUrl=pmUrl')
			.replace(/<script(?:>| (?!.*src)((?:.(?<!json))*)>)/i,'<script $1>var pmUrl=new URL("'+url.href+'");') // do this last!!
			;
			if(ddd.includes('<span class="ray_id">')){
				// if cloudflare checks the browser (cant be completed)
				sendData=await ddd.replace('</body>','  <script src="/static/cloudflareError.js"></script>\n</body>')
			}
			switch(url.host){
				case'discord.com':
					sendData=await sendData.replace(
`        API_ENDPOINT: '//discord.com/api',
        WEBAPP_ENDPOINT: '//discord.com',
        CDN_HOST: 'cdn.discordapp.com',
        ASSET_ENDPOINT: 'https://discord.com',
        WIDGET_ENDPOINT: '//discord.com/widget',
        INVITE_HOST: 'discord.gg',
        GUILD_TEMPLATE_HOST: 'discord.new',
        GIFT_CODE_HOST: 'discord.gift',
        RELEASE_CHANNEL: 'stable',
        MARKETING_ENDPOINT: '//discord.com',
        BRAINTREE_KEY: 'production_5st77rrc_49pp2rp4phym7387',
        STRIPE_KEY: 'pk_live_CUQtlpQUF0vufWpnpUmQvcdi',
        NETWORKING_ENDPOINT: '//router.discordapp.net',
        PROJECT_ENV: 'production',
        REMOTE_AUTH_ENDPOINT: '//remote-auth-gateway.discord.gg',`,
`        API_ENDPOINT: '/https://discord.com/api',
        WEBAPP_ENDPOINT: '/https://discord.com',
        CDN_HOST: '/https://cdn.discordapp.com',
        ASSET_ENDPOINT: '/https://discord.com',
        WIDGET_ENDPOINT: '/https://discord.com/widget',
        INVITE_HOST: '/discord.gg',
        GUILD_TEMPLATE_HOST: '/discord.new',
        GIFT_CODE_HOST: '/discord.gift',
        RELEASE_CHANNEL: 'stable',
        MARKETING_ENDPOINT: '/https://discord.com',
        BRAINTREE_KEY: 'production_5st77rrc_49pp2rp4phym7387',
        STRIPE_KEY: 'pk_live_CUQtlpQUF0vufWpnpUmQvcdi',
        NETWORKING_ENDPOINT: '/https://router.discordapp.net',
        PROJECT_ENV: 'production',
        REMOTE_AUTH_ENDPOINT: '${reqUrl.host}/?ws=wss://remote-auth-gateway.discord.gg',`)
					;
					break;
				default:break;
			}
		}
	}
	res.send(sendData);
});

app.use('/', express.static(path.join(__dirname, 'public'))); // static stuff

module.exports.app = app;
module.exports.server = server;
