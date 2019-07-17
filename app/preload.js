const { remote } = require('electron');
const mainProcess = remote.require('./main.js');

window.starmium = mainProcess.starmium;