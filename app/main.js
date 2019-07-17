const {
	app,
	BrowserWindow,
	ipcMain:ipc,
	//dialog,
} = require('electron');
const {autoUpdater} = require('electron-updater');
const lazy = require('import-lazy')(require);
const fs = lazy('fs-extra');
const path = lazy('path');
const downloader = lazy('./downloader');
const starmium = lazy('./starmium');
const {longMessage,sleep} = require('./utility');
const winston = lazy('winston');
const log = winston;
exports.log = {};
for (const level of ['error','warn','info','verbose','debug','silly']){
	exports.log[level]=(...args)=>log[level](...args);
}

const dataDirectory = app.getPath("userData");
const gameDirectory = path.resolve(dataDirectory,'games');
const appDirectory = path.resolve(app.getAppPath(),'app');
exports.dataDirectory = dataDirectory;
exports.gameDirectory = gameDirectory;
exports.appDirectory = appDirectory;
fs.ensureDir(gameDirectory);

winston.configure({
	level: 'silly',
	format: winston.format.simple(),
	transports:[
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.simple(),
			),
		}),
		new winston.transports.File({
			filename: path.resolve(dataDirectory,"log.txt"),
			level: 'info',
			format: winston.format.combine(
				winston.format.timestamp({format:'YYYY-MM-DD HH:mm:ss'}),
				winston.format.printf(info=>
					`[${info.timestamp}]${info.level}: ${info.message}`
				),
			),
		}),
	]
});

// doesn't work with asar.
//process.chdir(__dirname);

let options = {
	audoUpdate: false,
	debugUpdater: false,
	debug: require('electron-is-dev')||process.env.CUTIEVIRUS_DEBUG,
	production: !require('electron-is-dev'),
}
exports.options=options;

let package=null;
fs.readFile(path.resolve(app.getAppPath(),'package.json'))
.then(data=> package = JSON.parse(data.toString()) )
.catch(err=>{
	log.error(err.message);
});

let launcher;

function openLauncher(){
	launcher = new BrowserWindow({
		width:800,height:600,
		minWidth: 500, minHeight:400,
		icon: path.resolve(__dirname,'favicon.png'),
		frame:false,
		//transparent:true,
		webPreferences:{
			partition:"persist:cutievirus",
		},
		backgroundColor: '#383333',
	});
	launcher.loadFile(path.resolve(__dirname,'launcher.html'));
	launcher.setMenu(null);
	//launcher.openDevTools();
	launcher.on('closed',()=>{
		launcher=null;
	});
}

app.on('ready', ()=>{
	openLauncher();
	if(options.production||options.debugUpdater){
		autoUpdater.autoDownload=options.autoUpdate;
		autoUpdater.autoInstallOnAppQuit=true;
		autoUpdater.checkForUpdates();
	}

});

autoUpdater.on('error',error=>{
	log.error(error);
	launcher.send('updaterText',longMessage(error.message));
});
autoUpdater.on('checking-for-update',()=>{
	launcher.send('updaterText',"Checking for update...");
});
autoUpdater.on('update-available',info=>{
	if(options.audoUpdate){
		launcher.send('updaterText',"Found update "+info.version);
	}else{
		launcher.send('updaterText',"Update "+info.version+" available"
		+" <button onclick='vue.downloadUpdate()'>Download</button>");
	}
});
autoUpdater.on('update-not-available',info=>{
	launcher.send('updaterText',"");
});
autoUpdater.on('download-progress',event=>{
	launcher.send('updaterText',"Downloading update "+Math.floor(event.percent*10)/10+"%");
});
autoUpdater.on('update-downloaded',info=>{
	launcher.send('updaterText',"Downloaded update "+info.version
	+" <button onclick='vue.quitandinstallupdate()'>Quit and Install</button>");
});

exports.quitandinstallupdate=()=>{
	autoUpdater.quitAndInstall();
	launcher.send('updaterText',"");
};
exports.downloadUpdate=()=>{
	autoUpdater.downloadUpdate();
	launcher.send('updaterText',"Downloading...");
}

app.on('window-all-closed',()=>{
	if(process.platform !== 'darwin'){
		app.quit();
	}
});

app.on('activate',()=>{
	if(launcher===null){
		openLauncher();
	}
});

//const gameWindows={};

function openGameWindow(game){
	win = new BrowserWindow({
		useContentSize:true,
		width:game.width||800,
		height:game.height||600,
		minWidth: game.minwidth||game.width||500,
		minHeight:game.minheight||game.height||400,
		icon: game.icon||path.resolve(__dirname,'favicon.png'),
		resizable: game.resizable==null ? true : game.resizable,
		webPreferences:{
			nodeIntegration: false,
			partition:game.session||game.id,
			preload:path.resolve(__dirname,'preload.js'),
		},

	});
	//gameWindows[game.id]=win;
	win.loadFile(path.resolve(game.dir,'index.html'));
	win.setMenu(null);
	//win.openDevTools();
	win.on('closed',()=>{
		//delete gameWindows[game.id];
	});
}
exports.playGame=game=>{
	openGameWindow(game);
};

function downloadProgress(game,message,percent){
	if(!launcher){ return; }
	launcher.webContents.send('downloadProgress',game,message,percent);
}
downloadFinished=game=>new Promise((resolve,reject)=>{
	if(!launcher){ return reject(); }
	launcher.webContents.send('downloadFinished',game);
	ipc.once(`downloadFinished-${game.id}`,e=>resolve());
});


Downloader=method=>async function (game){
	const success=
	await downloader[method]( game,
		path.resolve(gameDirectory,game.id),
		downloadProgress,
	);
	if(success){
		await downloadFinished(game);
	}
}
exports.installGame=Downloader('installGame');
exports.updateGame=Downloader('updateGame');

exports.isUpdateReady=async function(game){
	return await downloader.isUpdateReady(game);
}

exports.openStarmiumWindow=function(){
	starmium.openWindow().then(()=>{
		if(!launcher){ return; }
		launcher.webContents.send('update-starmium');
	},()=>{});
}

exports.formatStarmium=s=>starmium.formatStarmium(s);

Object.defineProperty(exports,'starmium',{
	get(){ return starmium.starmium_count; },
	set(v) { starmium.starmium_count=v; },
});