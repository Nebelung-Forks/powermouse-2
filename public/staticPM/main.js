var getDifference=((begin,finish)=>{
	var ud=new Date(finish-begin);
	var s=Math.round(ud.getSeconds());
	var m=Math.round(ud.getMinutes());
	var h=Math.round(ud.getUTCHours());
	return `${h} hours, ${m} minutes, ${s} seconds`
})
window.addEventListener('load',()=>{
	var ele=document.getElementById('uptime'),
		start=ele.getAttribute('time');
	setInterval(()=>{
		ele.innerHTML=getDifference(start,Date.now())
	},1000);
});