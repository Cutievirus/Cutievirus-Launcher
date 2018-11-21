Vue.component('control-button',{
    template: //html
    `<button class='control-button' @click='click'><slot/></button>`,
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
    @click="$root.game=game"
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

const vue = new Vue({ 
	el:'#vue',
	data:{
        games:[],
        game:{},
        lightboxImage:null,
    },
    methods:{
        minimize:()=> win.minimize(),
        maximize:()=> win.isMaximized()?win.unmaximize():win.maximize(),
        close:()=> win.close(),
    }
});
const v = vue.$data;