var getDifference=((begin,finish)=>{
		var ud=new Date(finish-begin);
		var s=Math.round(ud.getSeconds());
		var m=Math.round(ud.getMinutes());
		var h=Math.round(ud.getUTCHours());
		return `${h} hours, ${m} minutes, ${s} seconds`
	}),
	toCharcode=(str=>{
		var output='';
		str.split('').forEach((e,i)=>{
			output=output+'&#'+str.charCodeAt(i)+';'
		});
		return output;
	});
	urlBar=document.getElementsByClassName('url')[0],
	urlFill=document.getElementsByClassName('urlFill')[0],
	activeElement=document.body,
	prevActiveEle=document.body,
	addproto=((url)=>{
		if (!/^(?:f|ht)tps?\:\/\//.test(url))url = "https://" + url;
		return url;
	});
window.addEventListener('load',()=>{
	var ele=document.getElementById('uptime'),
		start=ele.getAttribute('time');
	setInterval(()=>{
		ele.innerHTML=getDifference(start,Date.now())
	},1000);
});

urlBar.addEventListener('blur',e=>{
	if(prevActiveEle.getAttribute('class') == 'form-text url')return; // ignore element with that class when blurred
	Array.from(urlFill.getElementsByClassName('auto-fill')).forEach(e=>{
		e.parentNode.removeChild(e); // clean up old suggestions
	});
});

document.addEventListener('click',e=>{
	prevActiveEle=activeElement;
	activeElement=e.target;
});

urlBar.addEventListener('keyup',e=>{
	var xhttp = new XMLHttpRequest(), input=urlBar.value;
	xhttp.onreadystatechange=((e)=>{
		if(xhttp.readyState == 4 && xhttp.status == 200){
			var data=JSON.parse(xhttp.responseText); // our data is in a order of likely match to not likely match
			Array.from(urlFill.getElementsByClassName('auto-fill')).forEach(e=>{
				e.parentNode.removeChild(e); // clean up old suggestions
			});
			data.forEach((e,i)=>{
				var suggestion=document.createElement('div'),
					tldRegexp=/(?:\.{1,4}|\..{1,4}|\..{1,4}\..{1,4})($|\/)/gi,
					url=input.replace(tldRegexp,'.'+e+'$1');
				urlFill.appendChild(suggestion);
				suggestion.setAttribute('class','auto-fill ns');
				suggestion.innerHTML=url;
				
				suggestion.addEventListener('click',(e)=>{
					urlBar.value=url;
					urlBar.focus();
					Array.from(urlFill.getElementsByClassName('auto-fill')).forEach(ve=>{
						ve.parentNode.removeChild(ve); // clean up old suggestions
					});
				});
			});
		}
	});
	xhttp.open('GET','/suggestions?input='+encodeURI(input), true);
	xhttp.send();
});

Array.from(document.getElementsByClassName('btn-fancy')).forEach((e,i)=>{
	var data=e.getAttribute('data').split(' '),
		url=addproto(atob(data[0]));
	e.innerHTML=toCharcode(atob(data[1]));
	e.addEventListener('click',()=>{
		location.replace('/'+url);
	});
});