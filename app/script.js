const remote = require('electron').remote;
const mainProcess = remote.require('./main.js');
const win = remote.getCurrentWindow();

const fs = require('fs-extra');
const path = require('path');

// debug keys
if(mainProcess.debug) document.addEventListener("keydown",(e)=>{
	switch(e.key){
	case "F1":
		about();
		break;
	case "F5":
		//win.unmaximize();
		win.removeAllListeners();
		location.reload();
		break;
	case "F12":
		remote.getCurrentWindow().toggleDevTools();
		break;
	}
});

function about(){
	alert(
		`node: ${process.versions.node}
		chrome: ${process.versions.chrome}
		electron: ${process.versions.electron}`
		);
}

function throttle(func,interval=100){
	let timer, called;
	return function(){
		if(!timer){
		let later = ()=>{
			timer=null;
			if(called){
			called=false;
			timer = setTimeout(later,interval);
			func.apply(this,arguments);
			}
		};
		timer = setTimeout(later,interval);
		func.apply(this,arguments);
		}else{
		called=true;
		}
	};
}
  
function debounce(func,interval=100,immediate=false){
	let timer;
	return function(){
	let callnow = immediate && !timer;
	clearTimeout(timer);
	timer = setTimeout(()=>{
		timer=null;
		if(!immediate){ func.apply(this,arguments); }
	},interval);
	if(callnow){ func.apply(this,arguments); }
	};
}

onMaximize=()=> document.body.classList.add("maximized");
onUnmaximize=()=> document.body.classList.remove("maximized");

if(win.isMaximized()){ onMaximize(); }
win.on('maximize',onMaximize);
win.on('unmaximize',onUnmaximize);

const resolve =(...args)=>path.resolve(...args).replace(/\\/g,'/');

// load games
loadGames();
async function loadGames(){
	const featuredDirectory = path.resolve(__dirname,"games");
	const installDirectory = mainProcess.gameDirectory;
	let featuredGames=await loadGameDirectory(featuredDirectory);
	let installedGames=await loadGameDirectory(installDirectory);
	for (const id in featuredGames){
		if(id in installedGames){
			installedGames[id].priority = featuredGames[id].priority;
			Object.assign(featuredGames[id],installedGames[id]);
			delete installedGames[id];
		}
	}
	featuredGames = Object.values(featuredGames);
	installedGames = Object.values(installedGames);
	featuredGames.sort((a,b)=>(b.priority||0)-(a.priority||0));
	v.games = featuredGames.concat(installedGames);
}
async function loadGameDirectory(dir){
	try{ var list = await fs.readdir(dir); }
	catch(e){ console.error(e); list=[]; }
	const games={};
	for (const id of list){
		try{ games[id] = await loadGameData(dir,id); }
		catch(e){ console.error("Error loading game",id,e); continue; }
	}
	return games;
}
async function loadGameData(dir,id){
	dir=path.resolve(dir,id);
	const file = await fs.readFile(path.resolve(dir,"data.json"));
	const gameData = JSON.parse(file);
	gameData.id=id;
	gameData.dir=dir;
	async function gameFileExists(key,files){
		if(!(files instanceof Array))
			{ files = [files]; }
		for(const file of files){
			const filepath = resolve(dir,file);
			if(await fs.pathExists(filepath)){
				gameData[key]=filepath;
				return true;
			}
		}
		return false;
	}
	await gameFileExists('icon',"icon.png");
	await gameFileExists('banner',["banner.png","banner.jpg"]);
	const text=await fs.readFile(path.resolve(dir,"text.html"));
	gameData.text = text.toString();
	try{
		let gallery = await fs.readdir(path.resolve(dir,"gallery"));
		gameData.gallery=gallery.map(g=>resolve(dir,"gallery",g));
	}catch(e){/* No gallery.*/}
	return gameData;
}

const resizeGallery = throttle(function(){
	let images = document.querySelectorAll("#game-gallery img");
	if(!images.length){ return; }
	let info = document.getElementById("game-info");
	let summary = document.getElementById("game-summary");
	let gallery = document.getElementById("game-gallery");

	let height = Math.max(
		summary.offsetTop+summary.offsetHeight-gallery.offsetTop
		,info.clientHeight - gallery.offsetTop
	);
	let lastimage=images[images.length-1];
	let realheight = lastimage.offsetTop+lastimage.clientHeight+2;
	gallery.style.setProperty('--height',Math.min(height,realheight)+'px');
});
window.addEventListener('resize',resizeGallery);