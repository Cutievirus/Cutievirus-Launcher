const {
	BrowserWindow,
} = require('electron');
const log = require('winston');
const path = require('path');
const http = require('http');
const server = http.createServer((request,response)=>{
	response.write("Hello World");
	response.end();
});
server.on('error',err=>{
	log.error(err);
	server.close();
});


let win;
let port;
exports.getPort=()=>port;

exports.openWindow=openWindow;
function openWindow(){
	if(win){
		win.focus();
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
		},
	});
	win.loadFile(path.resolve(__dirname,'index.html'));
	win.setMenu(null);
	//win.openDevTools();
	win.on('closed',()=>{
		win=null;
		server.close();
	});
	win.webContents.on('will-navigate', (event, url)=>{
		if(url.startsWith("http://cutievirus.com/oauth/")){
			win.close();
		}
	});
}

exports.formatStarmium=formatStarmium;
function formatStarmium(s){
	return `${Math.floor(s)}.${Math.floor(s*10%10)}.${String(Math.floor(s*1000%100)).padStart(2,0)}`;
}