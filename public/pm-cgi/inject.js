var methods=['href','src','data'],
	newTitle='‮',
	logging=false,
	log=(str=>{
		if(!logging)return; // dont log if logging is false
		// take string and add formatting to make js logs seperate from unintentional errors 
		console.info('%c[Powermouse]','color: #805a00;',str);
	});

if(typeof pmUrl == 'undefined')pmUrl = new URL(location.pathname.substr(1));

if(location.pathname=='/https://discord.com/' || location.pathname=='/https://discord.com/new')location.href='/https://discord.com/login';

var properUrlRegex=new RegExp(`^(${location.origin}|\\/https?:\\/\\/|^\\.\\/|^[^\\/]*|javascript:|data:)`,'gi'); // either the location origin or a local /https:// that is proxied
	externalSiteRegex=new RegExp(`^(?!${location.origin})(\/\/[^\/]|https?:\/\/)`,'gi')
setInterval(()=>{ // run every 0.25 seconds
	var elements=document.getElementsByTagName('a'); // all A links with a href
	Array.from(elements).forEach((element,i)=>{
		if(element.getAttribute('href') == null)return; // if there is no redirect on the link then ignore this one, its probably a hover over element
		var href=element.getAttribute('href').replace(/^\/\/([^\/])/gi,'https://$1');
		
		if(href.match(properUrlRegex)[0] == ''){ // this is not a proxied url!
			var newHref=location.origin+'/'+pmUrl.origin+href;
			if(!newHref.match(/#$/gi))element.addEventListener('click',(e)=>{
				e.preventDefault();
				location.replace(newHref);
			});
			element.setAttribute('href',newHref);
		}else if( href.match(externalSiteRegex) != null ){ // external link
			var newHref=location.origin+'/'+href;
			element.setAttribute('href',newHref);
			if(!newHref.match(/#$/gi))element.addEventListener('click',(e)=>{
				e.preventDefault();
				location.replace(newHref);
			});
		}
	});
},500);