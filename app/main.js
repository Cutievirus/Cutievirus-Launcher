const {app, BrowserWindow} = require('electron');
const fs = require('fs-extra');
const path = require('path');

process.chdir(__dirname);

const dataDirectory = app.getPath("userData");
const gameDirectory = path.resolve(dataDirectory,'games');
exports.dataDirectory = dataDirectory;
exports.gameDirectory = gameDirectory;

fs.ensureDir(gameDirectory)

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
	});
	launcher.loadFile(path.resolve(__dirname,'launcher.html'));
	launcher.setMenu(null);
	//launcher.openDevTools();
	launcher.on('closed',()=>{
		launcher=null;
	});
}

app.on('ready', openLauncher);

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

