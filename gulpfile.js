const gulp = require('gulp');
const stylus = require('gulp-stylus');
const concat = require('gulp-concat');
const sourcemaps = require('gulp-sourcemaps');
const gutil = require('gulp-util');
const merge = require('merge-stream');
const glob = require('glob');
const path = require('path');

function swallow(err){
    console.error(err.message);
    gutil.beep();
    this.emit('end');
}

const concatTask = (name,pattern,fun)=>gulp.task(name,()=>{
    let dirs = glob.sync(pattern);
    if(!dirs.length) return gulp.src([]);
    return merge(dirs.map(fun));
});
const concatDirectory=(dir)=> concat(dir.match(/[^\/]+(?=-concat)/)[0]);
const ignoreConcats = "!app/**/*-concat/**";

const stylusOptions = {
    compress:true
};

concatTask('stylus-concat',"app/**/*.styl{,us}-concat",dir=>
    gulp.src(dir+'/**/*.styl{,us}')
    .pipe(sourcemaps.init())
        .pipe(concatDirectory(dir))
        .pipe(stylus(stylusOptions))
        .on('error',swallow)
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(path.dirname(dir)))
);

gulp.task('stylus',()=>
    gulp.src(["app/**/*.styl{,us}",ignoreConcats])
    .pipe(stylus(stylusOptions))
    .on('error',swallow)
    .pipe(gulp.dest('app'))
);

gulp.task('watch', gulp.series(gulp.parallel('stylus', 'stylus-concat'), ()=>{
    gulp.watch(["app/**/*.styl{,us}",ignoreConcats],gulp.series('stylus'));
    gulp.watch("app/**/*.styl{,us}-concat/**/*.styl{,us}",gulp.series('stylus-concat'));

}));