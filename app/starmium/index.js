const {
	BrowserWindow,
	//ipcMain:ipc,
} = require('electron');
const log = require('winston');
const path = require('path');
const http = require('http');
const server = http.createServer((request,response)=>{
	response.write("Hello World");
	response.end();
	if(win){
		win.webContents.send('http-request',request.url);
	}
});
server.on('error',err=>{
	log.error(err);
	server.close();
});


let win;
let port;
exports.getPort=()=>port;

exports.openWindow=()=>new Promise((resolve,reject)=>{
	if(win){
		win.focus();
		reject();
		return;
	}
	server.listen(0);
	port = server.address().port;
	log.verbose(`server listening at ${port}`);
	win = new BrowserWindow({
		resizable: false,
		width:400,height:200,
		icon: path.resolve(__dirname,'../favicon.png'),
		webPreferences:{
			//nodeIntegration: false,
			partition:"persist:cutievirus",
		},
	});
	win.loadFile(path.resolve(__dirname,'index.html'));
	win.setMenu(null);
	//win.openDevTools();
	win.on('closed',()=>{
		win=null;
		server.close();
		resolve();
	});
});

exports.formatStarmium=formatStarmium;
function formatStarmium(s){
	const sign=s<0?'-':'';
	s=Math.abs(s);
	return `${sign}${Math.floor(s)}.${Math.floor(s*10%10)}.${String(Math.floor(s*1000%100)).padStart(2,0)}`;
}

let _starmium_count=0;
Object.defineProperty(exports,'starmium_count',{
	get(){ return _starmium_count; },
	set(v) { _starmium_count=v; },
});