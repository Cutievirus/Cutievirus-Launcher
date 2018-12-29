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
const winston = lazy('winston');
const log = winston;
exports.log = {};
for (const level of ['error','warn','info','verbose','debug','silly']){
	exports.log[level]=(...args)=>log[level](...args);
}

process.chdir(__dirname);

const dataDirectory = app.getPath("userData");
const gameDirectory = path.resolve(dataDirectory,'games');
exports.dataDirectory = dataDirectory;
exports.gameDirectory = gameDirectory;
fs.ensureDir(gameDirectory)

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


const debug = require('electron-is-dev');
exports.debug=debug;

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
	if(!debug){
		autoUpdater.autoDownload=true;
		autoUpdater.autoInstallOnAppQuit=true;
		autoUpdater.checkForUpdates();
	}

});

autoUpdater.on('error',event=>{
	log.error(event.error);
	launcher.send('updaterText',event.error.message);
});
autoUpdater.on('checking-for-update',event=>{
	launcher.send('updaterText',"Checking for update...");
});
autoUpdater.on('update-available',event=>{
	launcher.send('updaterText',"Found update "+event.info.version);
});
autoUpdater.on('update-not-available',event=>{
	launcher.send('updaterText',"");
});
autoUpdater.on('download-progress',event=>{
	launcher.send('updaterText',"Downloading update "+event.percent*100+"%");
});
autoUpdater.on('update-downloaded',event=>{
	launcher.send('updaterText',"Downloaded update "+event.info.version
	+" <button onclick='vue.quitandinstallupdate()'>Quit and Install</button>");
});

exports.quitandinstallupdate=()=>{
	autoUpdater.quitAndInstall();
};

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