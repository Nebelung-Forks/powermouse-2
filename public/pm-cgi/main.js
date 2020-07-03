var getDifference=((begin,finish)=>{
		var ud=new Date(finish-begin);
		var s=Math.round(ud.getSeconds());
		var m=Math.round(ud.getMinutes());
		var h=Math.round(ud.getUTCHours());
		return `${h} hours, ${m} minutes, ${s} seconds`
	}),
	urlBar=document.getElementsByClassName('url')[0],
	urlFill=document.getElementsByClassName('urlFill')[0],
	activeElement=document.body,
	prevActiveEle=document.body;
window.addEventListener('load',()=>{
	var ele=document.getElementById('uptime'),
		start=ele.getAttribute('time');
	setInterval(()=>{
		ele.innerHTML=getDifference(start,Date.now())
	},1000);
});

urlBar.addEventListener('blur',e=>{
	console.log(prevActiveEle);
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
			console.log(data);
			Array.from(urlFill.getElementsByClassName('auto-fill')).forEach(e=>{
				e.parentNode.removeChild(e); // clean up old suggestions
			});
			data.forEach((e,i)=>{
				console.log(e);
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