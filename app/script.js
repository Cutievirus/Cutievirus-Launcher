const { remote, ipcRenderer:ipc } = require('electron');
const mainProcess = remote.require('./main.js');
const win = remote.getCurrentWindow();
const {dialog} = remote;

const lazy = require('import-lazy')(require);
const fs = lazy('fs-extra');
const path = lazy('path');
const log = mainProcess.log;
const _ = lazy('lodash');

const {getApiUrl,sleep} = require('./utility');

function alertError(err){
	//dialog.showErrorBox('',err.stack);
	log.error(err.stack);
    alert(err.stack);
}

// debug keys
if(mainProcess.options.debug)
document.addEventListener("keydown",_.debounce(event=>{
	if(event.repeat){ return; }
	switch(event.key){
	case "F1":
		about();
		break;
	case "F5":
		//win.unmaximize();
		window.reloading=true;
		win.removeAllListeners();
		location.reload();
		break;
	case "F12":
		remote.getCurrentWindow().toggleDevTools();
		break;
	}
},100,{leading:true,trailing:false}));

function about(){
	alert(
		`node: ${process.versions.node}
		chrome: ${process.versions.chrome}
		electron: ${process.versions.electron}`
		);
}

onMaximize=()=> document.body.classList.add("maximized");
onUnmaximize=()=> document.body.classList.remove("maximized");

if(win.isMaximized()){ onMaximize(); }
win.on('maximize',onMaximize);
win.on('unmaximize',onUnmaximize);

const resolve =(...args)=>path.resolve(...args).replace(/\\/g,'/');

// load games
async function loadGames(){
	const featuredDirectory = path.resolve(__dirname,"games");
	const installDirectory = mainProcess.gameDirectory;
	let featuredGames=await loadGameDirectory(featuredDirectory);
	let installedGames=await loadGameDirectory(installDirectory);
	// Object.values(installedGames).forEach(data=>data.installed=true);
	for (const id in featuredGames){
		if(id in installedGames){
			//installedGames[id].priority = featuredGames[id].priority;
			Object.assign(featuredGames[id],installedGames[id]);
			delete installedGames[id];
		}
	}
	featuredGames = Object.values(featuredGames);
	installedGames = Object.values(installedGames);
	featuredGames.sort((a,b)=>(b.priority||0)-(a.priority||0));
	const games = featuredGames.concat(installedGames);
	for (const game of games){
		if(!game.name && game.index){
			let file = await fs.readFile(path.resolve(game.dir,"index.html"))
			file=file.toString();
			const match = file.match(/<title>\s*(.*)\s*<\/title>/i)
			if( match ) game.name=match[1];
			if( !game.name ) game.name=game.id;
		}
		if(game.repo){
			game.api=getApiUrl(game.repo);
		}
		if(!game.subdir){ game.subdir=''; }
		game.version = localStorage.getItem(`cutievirus-version-${game.id}`);
		if(game.id in activeDownloads){
			const dgame = activeDownloads[game.id];
			game.downloading = dgame.downloading;
			game.downloadMessage = dgame.downloadMessage;
			game.downloadProgress = dgame.downloadProgress;
		}
	}
	Vue.set(v,"games",games);
	const lastSelected = localStorage.getItem('cutievirus-lastSelectedGame');
	if(lastSelected){
		vue.selectGame(lastSelected);
	}else{
		vue.selectGame(v.games[0]);
	}
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
	const gameData = {};
	gameData.id=id;
	gameData.dir=dir;
	if( await gameFileExists('index',"index.html") ){
		gameData.installed=true;
	}
	if(await fs.pathExists(path.resolve(dir,'cutievirus'))){
		dir=path.resolve(dir,'cutievirus');
	}
	try{
		var datafile = await fs.readFile(path.resolve(dir,"data.json"));
	}catch(e){
		if(!gameData.installed){ throw e; }
	}if(datafile){
		Object.assign(gameData, JSON.parse(datafile));
	}
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
	try{
		const text=await fs.readFile(path.resolve(dir,"text.html"));
		gameData.text = text.toString();
	}catch(e){ /* No text. */ }
	try{
		let gallery = await fs.readdir(path.resolve(dir,"gallery"));
		gameData.gallery=gallery.map(g=>resolve(dir,"gallery",g));
	}catch(e){/* No gallery.*/}
	return gameData;
}

async function checkUpdate(game){
	const updateReady = await mainProcess.isUpdateReady(game);
	Vue.set(game,'update',updateReady);
}

const resizeGallery = _.throttle(event=>{
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
},100);
window.addEventListener('resize',resizeGallery);

const activeDownloads = {};
ipc.on('downloadProgress',(event,game,message,percent)=>{
	for (const vgame of v.games)
	if(game.id===vgame.id){ game=vgame; break; }
	Vue.set(game,'downloadMessage',message);
	Vue.set(game,'downloadProgress',percent);
	activeDownloads[game.id]=game;
	console.log(game.id, message, percent||'');
});

ipc.on('downloadFinished',(event,game)=>{
	const version = game.version;
	for (const vgame of v.games)
	if(game.id===vgame.id){ game=vgame; break; }
	localStorage.setItem(`cutievirus-version-${game.id}`,version);
	Vue.set(game,'version',version);
	console.log(`Download for ${game.id} ${game.version} finished.`);
	ipc.send(`downloadFinished-${game.id}`);
});

window.addEventListener('beforeunload',event=>{
	if(window.reloading){ return; }
	if(_.isEmpty(activeDownloads)){ return; }
	event.returnValue=false;
	setTimeout(quitMessage,0);
});
function quitMessage(){
	const choice = dialog.showMessageBox(win,{
		type:'question',
		buttons:[
			'Actually, nevermind.',
			'Yes, I understand the risk and I want to see the world burn.',
		],
		message:`Downloads are still in progress.
		Quitting now might cause problems. Are you sure?`
	});
	if(choice===1){ win.destroy(); }
}

ipc.on('updaterText',(event,text)=>{
	v.updaterText = text;
});