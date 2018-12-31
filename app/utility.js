exports.longMessage = (message,length=100) =>
    message.length<=length ? message : message.substr(0,100)+'...';

exports.sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

exports.getApiUrl=(owner,repo)=>{
    if(!repo){ repo=owner; }
    else{ repo=`${owner}/${repo}` }
    return `https://api.github.com/repos/${repo}/`;
}