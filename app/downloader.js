const lazy = require('import-lazy')(require);
const fs = lazy('fs-extra');
const path = lazy('path');
const url = lazy('url');
const request = lazy('request');
const requestProgress = lazy('request-progress');
const temp = lazy('temp').track();
const yauzl = lazy('yauzl');
const log = lazy('winston');
const {longMessage} = require('./utility');

function pathIsInside(child,parent){
    const relpath = path.relative(parent,child);
    if(!relpath || relpath.startsWith('..')){ return false; }
    return true;
}

const downloadOptions = {
    headers:{'user-agent': 'cuteivirus-launcher'}
};

download=(url,progress=noprogress)=>new Promise((resolve,reject)=>{
    //log.verbose(`Downloading ${url}`);
    url=encodeURI(url);
    requestProgress(request(url,downloadOptions,(err,response,body)=>
        err?reject(err):resolve(body)
    )).on('progress',progress);
});

downloadTo=(dest,url,progress=noprogress)=>new Promise((resolve,reject)=>{
    //log.verbose(`Downloading ${url}`);
    url=encodeURI(url);
    fs.ensureDir(path.dirname(dest))
    .then(()=>
        requestProgress(request(url,downloadOptions))
        .on('error',err=>reject(err))
        .on('end',resolve)
        .on('progress',progress)
        .pipe(fs.createWriteStream(dest))
    );
});

noprogress=()=>{};

getTempDir=(name)=>new Promise((resolve,reject)=>
    temp.mkdir(name,(err,dir)=>{
        if(err){ return reject(err); }
        log.verbose(`Created temporary directory at ${dir}`);
        resolve(dir);
    })
);

extractFiles=(game,zipPath,dest,progress=noprogress)=>new Promise((resolve,reject)=>{
    let i=0;
    let baseDir=null;
    const message = `Opening ${path.basename(zipPath)}`;
    progress(game, message, 0);
    log.verbose(message);
    yauzl.open(zipPath,{
        lazyEntries:true, 
        autoClose:false,
    },(err,zipfile)=>{
        if(err) return reject(err);
        zipfile.readEntry();
        zipfile.once('entry',entry=>{
            baseDir = entry.fileName.split(path.sep)[0];
        });
        zipfile.on('entry',entry=>{
            let message;
            const subdir = path.join(baseDir,game.subdir);
            if(!pathIsInside(entry.fileName,subdir)){
                ++i;
                return zipfile.readEntry();
            }
            const fileName = path.relative(subdir, entry.fileName);
            const filePath = path.resolve(dest,fileName);
            if (entry.fileName.endsWith('/')){
                // directory
                fs.ensureDir(filePath)
                .then(()=>zipfile.readEntry());
                message = `Creating Folder ${fileName}`;
            }else{
                // file
                zipfile.openReadStream(entry,(err,readStream)=>{
                    if(err) return reject(err);
                    readStream.on('end',()=>zipfile.readEntry());
                    readStream.pipe(fs.createWriteStream(filePath));
                });
                message = `Extracting ${fileName}`;
            }
            
            log.verbose(message);
            progress(game, message, (++i)/zipfile.entryCount);
        });
        zipfile.once('end',()=>{
            zipfile.close();
            resolve();
        });
    })
});

async function getRelease(game,progress=noprogress){
    const message = "Getting latest release...";
    progress(game, message, 0);
    const release = await download(game.api+"releases/latest",status=>
        progress(game, message, status.percent)
    )
    log.verbose(`Got latest release for ${game.id}`);
    log.debug(longMessage(release));
    return JSON.parse(release);
}

async function isUpdateReady(game,progress=noprogress){
    return game.version !== (await getRelease(game,progress)).tag_name;
}
exports.isUpdateReady=isUpdateReady;

async function getChanges(game,v1,v2,progress=noprogress){
    const message = "Getting Changes...";
    progress(game, message, 0);
    const changes = 
    await download(game.api+`compare/${v1}...${v2}`,status=>{
        progress(game, message, status.percent);
    })
    log.verbose(`Got changes for ${game.id} from ${v1} to ${v2}`)
    log.debug(longMessage(changes));
    return JSON.parse(changes);
}

async function deleteEmptyFolders(base,dirpath){
    while (pathIsInside(dirpath,base)){
        try{ var stat = await fs.lstat(dirpath); }
        catch(err){ stat = null; }
        if(stat && stat.isDirectory()){
            const dirlist = await fs.readdir(dirpath);
            if(!dirlist.length){ await fs.rmdir(dirpath); }
        }
        dirpath=path.dirname(dirpath);
    }
}

displayBytesPerSec=(bps=0)=>{
    if(bps===0){ return '???B/s'; }
	let truncs = 0;
	while (bps>=1024 && truncs<UNIT_BYTES_PER_SECOND.length-1){
		bps/=1024;
		++truncs;
	}
	return Math.floor(bps*10)/10+UNIT_BYTES_PER_SECOND[truncs];
};
UNIT_BYTES_PER_SECOND=[
	'B/s','kB/s','MB/s','GB/s','TB/s'
];
displayTimeRemaining=(time=null)=>{
    if(time===null){ return ''; }
	let truncs = 0;
	while (time>=60 && truncs<2){
		time/=60;
		++truncs;
	}
	return Math.floor(time*10)/10+' '+UNIT_TIME[truncs]+' remaining';
}
UNIT_TIME=[
	'seconds','minutes','hours'
];

async function installGame(game,dest,progress,release=null){
    if(release===null){
        release = await getRelease(game,progress);
    }
    const version = release.tag_name;
    log.info(`Installing ${game.id} ${version}`);
    const tempdir = await getTempDir(`cutievirus-${game.id}-`);
    const zipName = `${game.id}-${version}.zip`;
    const zipPath = path.resolve(tempdir,zipName);
    const message = `Downloading ${zipName}`;
    log.verbose(message);
    progress(game, message, 0);
    let fakepercent=0;
    await downloadTo(zipPath, release.zipball_url, status=>{
        fakepercent+=(1-fakepercent)*0.01;
        progress(game,
        `Downloading ${zipName} at ${displayBytesPerSec(status.speed)}`+
        ` ${displayTimeRemaining(status.time.remaining)}`
        , status.percent==null ? fakepercent : status.percent);
    });
    //await fs.ensureDir(dest);
    log.verbose("Clearing game folder...");
    progress(game,"Clearing game folder...",0);
    await fs.emptyDir(dest);
    await extractFiles(game, zipPath, dest, progress);
    game.version = version;
    return true;
}

async function updateGame(game,dest,progress){
    if(!game.version){
        return installGame(game,dest,progress);
    }
    const release = await getRelease(game,progress);
    const version = release.tag_name;
    if(game.version === version){ return false; }
    const changes = await getChanges(game, game.version, version, progress);
    // github api limits
    if(changes.total_commits>changes.commits.length || changes.files.length>=300){
        return installGame(game,dest,progress,release);
    }
    log.info(`Updating ${game.id} from ${game.version} to ${version}`);
    const length = changes.files.length;
    for (const [i,file] of changes.files.entries()){
        const percentDone = i/length;
        const tasks = {};
        const addTask=(operation,filename)=>{
            if(!pathIsInside(filename,game.subdir)) return;
            task={};
            task.fileName = path.relative(game.subdir,filename);
            task.filePath = path.resolve(dest,task.fileName);
            tasks[operation]=task
        };
        switch(file.status){
        case 'removed':
            addTask('remove',file.filename);
            break;
        case 'renamed':
            addTask('remove',file.previous_filename);
        case 'added':
        case 'modified':
        default:
            addTask('add',file.filename);
        }
        for (const [operation,data] of Object.entries(tasks)){
            switch(operation){
            case 'remove':
                var message=`Removing ${data.fileName}`;
                log.verbose(message);
                progress(game, message, percentDone);
                await fs.remove(data.filePath);
                await deleteEmptyFolders(dest,data.filePath);
                break;
            case 'add':
                var message =  `Downloading ${data.fileName}`;
                log.verbose(message);
                progress(game, message, percentDone);
                await downloadTo(data.filePath, file.raw_url, status=>{
                    const percent = percentDone + status.percent/length;
                    log.verbose(message);
                    progress(game, message, percent);
                });
                break;
            }
        }
    }
    game.version = version;
    return true;
}

exports.installGame=installGame;
exports.updateGame=updateGame;