Vue.component('control-button',{
    template: //html
    `<button class='control-button' @click='click'><slot></slot></button>`,
    methods:{
        click(e){ this.$emit('click',e); }
    }
});

Vue.component('game-button',{
    props: ['game'],
    template: //html
    `<a class='game-button'
    :data-icon="Boolean(game.icon)"
    :style="{'--icon':'url('+game.icon+')'}"
    :class="{selected: game===$root.game}"
    @mousemove="mousemove"
    @click="$root.selectGame(game)"
    >
        <img v-if="game.icon" :src="game.icon">
        <span>{{game.name}}</span>
    </a>`,
    methods:{
        mousemove(e){
            e.target.style.setProperty('--x',e.offsetX/e.target.offsetWidth);
            e.target.style.setProperty('--y',e.offsetY/e.target.offsetHeight);
        }
    }
});

Downloader=method=>async function(game){
    activeDownloads[game.id]=game;
    Vue.set(game,'downloading',true);
    await mainProcess[method](game)
    .catch(alertError);
    Vue.set(game,'downloadMessage','Download complete');
    Vue.set(game,'downloadProgress',1);
    await sleep(1000);
    delete activeDownloads[game.id];
	Vue.set(game,'downloading',false);
	Vue.set(game,'downloadMessage','');
	Vue.set(game,'downloadProgress',0);
    loadGames();
}

const vue = new Vue({ 
	el:'#vue',
	data:{
        games:[],
        game:{},
        lightboxImage:null,
        updaterText:'',
    },
    methods:{
        minimize:()=> win.minimize(),
        maximize:()=> win.isMaximized()?win.unmaximize():win.maximize(),
        close:()=> win.close(),
        selectGame(game){
            if(typeof game === "string")
            for (const g of v.games)
            if(g.id===game){
                game=g; break;
            }
            if (typeof game !== "object"){ return; }
            Vue.set(v,'game',game);
            localStorage.setItem('cutievirus-lastSelectedGame',game.id);
            if(game.api){
                checkUpdate(game);
            }
        },
        showLightbox(img){
            document.body.classList.add('lightbox');
            this.lightboxImage=img;
        },
        hideLightbox(){
            document.body.classList.remove('lightbox');
            this.lightboxImage=null;
            resizeGallery();
        },
        downloadGame:Downloader('installGame'),
        updateGame:Downloader('updateGame'),
        playGame(game){
            mainProcess.playGame(game);
        },
        quitandinstallupdate(){
            mainProcess.quitandinstallupdate();
        }
    }
});
const v = vue.$data;
