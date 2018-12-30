exports.longMessage = (message,length=100) =>
    message.length<=length ? message : message.substr(0,100)+'...';

exports.sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));