var gulp = require('gulp'),
    concat = require('gulp-concat'), //- 多个文件合并为一个；
    cleanCSS = require('gulp-clean-css'), //- 压缩CSS为一行；
    ugLify = require('gulp-uglify'), //压缩js
    imageMin = require('gulp-imagemin'), //压缩图片
    pngquant = require('imagemin-pngquant'), // 深度压缩
    htmlMin = require('gulp-htmlmin'), //压缩html
    changed = require('gulp-changed'), //检查改变状态
    less = require('gulp-less'), //压缩合并less
    del = require('del'),
    browserSync = require("browser-sync").create(), //浏览器实时刷新
    sass = require('gulp-sass'),
    constants = require('./constants.js'),
    htmlImport = require('gulp-html-import'),
    runSequence = require('run-sequence'),
    rev = require('gulp-rev'),
    revCollector = require('gulp-rev-collector');

const baseScss = 'src/assets/scss/';
const baseJs = 'src/js/';

//删除dist下的所有文件
gulp.task('delete', function(cb) {
    return del([constants.buildDir + '/*', '!' + constants.buildDir + '/images'], cb);
})

//压缩html
gulp.task('html', function() {
    var options = {
        removeComments: true, //清除HTML注释
        collapseWhitespace: true, //压缩HTML
        removeScriptTypeAttributes: true, //删除<script>的type="text/javascript"
        removeStyleLinkTypeAttributes: true, //删除<style>和<link>的type="text/css"
        minifyJS: true, //压缩页面JS
        minifyCSS: true //压缩页面CSS
    };
    
    constants.model.forEach(function(item, k) {
        gulp.src('src/view/' + item.name + '.html')
            .pipe(htmlImport('src/view/global/'))
            .pipe(changed(constants.buildDir, { hasChanged: changed.compareSha1Digest }))
            .pipe(htmlMin(options))
            .pipe(gulp.dest(constants.buildDir))
            .pipe(browserSync.reload({ stream: true }));
    });
});

//实时编译sass
gulp.task('sass', function() {
    constants.model.forEach(function(item, k) {
        let itemScssArgs = item.css.map(it => baseScss + it);
        let globalCssArgs = constants.globalCss.map(it => { return baseScss + 'global/' + it });
        let cssArgs = globalCssArgs.concat(itemScssArgs);

        gulp.src(cssArgs) //多个文件以数组形式传入
            .pipe(changed(constants.buildDir + '/css', { hasChanged: changed.compareSha1Digest }))
            .pipe(sass()) //编译sass文件
            .pipe(concat(item.name + '.css')) //合并之后生成main.css
            .pipe(cleanCSS()) //压缩新生成的css
            .pipe(gulp.dest(constants.buildDir + '/css')) //将会在css下生成main.css
            .pipe(browserSync.reload({ stream: true }));
    });
});

//压缩js
gulp.task("script", function() {
    constants.model.forEach(function(item, k) {
        let itemJsArgs = item.js.map(it => {
            if (/global/.test(it)) {
                return baseJs + '/' + it
            } else {
                return baseJs + item.name + '/' + it
            }
        });

        let globalJsArgs = constants.globalJs.map(it => { return baseJs + 'global/' + it });
        let jsArgs = globalJsArgs.concat(itemJsArgs);

        gulp.src(jsArgs)
            .pipe(changed(constants.buildDir + '/js/', { hasChanged: changed.compareSha1Digest }))
            .pipe(concat(item.name + '.js'))
            .pipe(ugLify())
            .pipe(gulp.dest(constants.buildDir + '/js'))
            .pipe(browserSync.reload({ stream: true }));
    });

});

// 压缩图片
gulp.task('images', function() {
    gulp.src('src/assets/img/*.*')
        .pipe(changed(constants.buildDir + '/images', { hasChanged: changed.compareSha1Digest }))
        // .pipe(imageMin({
        //     progressive: true, // 无损压缩JPG图片
        //     svgoPlugins: [{ removeViewBox: false }], // 不移除svg的viewbox属性
        //     use: [pngquant()] // 使用pngquant插件进行深度压缩
        // }))
        .pipe(gulp.dest(constants.buildDir + '/images'))
        .pipe(browserSync.reload({ stream: true }));
});



//启动热更新
gulp.task('serve', ['delete'], function() {
    gulp.start('script', 'sass', 'html', 'images');
    browserSync.init({
        port: 3000,
        server: {
            baseDir: [constants.serverDir]
        }
    });

    constants.model.forEach(function(item, k) {
        gulp.watch('src/js/' + item.name + '/*.js', ['script']); //监控文件变化，自动更新
        gulp.watch('src/assets/scss/' + item.name + '/*.scss', ['sass']);
    });

    gulp.watch('src/js/global/*.js', ['script']);
    gulp.watch('src/js/global/*/*.js', ['script']);
    gulp.watch('src/assets/scss/*.scss', ['sass']);
    gulp.watch('src/assets/scss/*/*.scss', ['sass']);
    gulp.watch('src/view/*.html', ['html']);
    gulp.watch('src/view/global/*.html', ['html']);
    gulp.watch('src/assets/img/*.*', ['images']);
});



gulp.task('pre', function(){
    browserSync.init({
        port: 3000,
        server: {
            baseDir: [constants.serverDir]
        }
    });
});


// 为css跟js添加版本号
var cssSrc = constants.buildDir + '/**/*.css',  //src下的所有css文件
    jsSrc = constants.buildDir + '/**/*.js'; 
//CSS生成文件hash编码并生成 rev-manifest.json文件名对照映射
gulp.task('revCss', function(){
    constants.model.forEach(function(item, k) {
        var cssSrc = constants.buildDir + '/css/' + item.name + '.css';
        gulp.src(cssSrc)
            .pipe(rev())
            .pipe(rev.manifest())
            .pipe(gulp.dest('rev/' + item.name + '/css'));
    });
});
 
//js生成文件hash编码并生成 rev-manifest.json文件名对照映射
gulp.task('revJs', function(){
    constants.model.forEach(function(item, k) {
        var jsSrc = constants.buildDir + '/js/' + item.name + '.js';
        gulp.src(jsSrc)
            .pipe(rev())
            .pipe(rev.manifest())
            .pipe(gulp.dest('rev/' + item.name + '/js'));
    });
});

gulp.task('revHtml', function () {
    constants.model.forEach(function(item, k) {
        gulp.src(['rev/' + item.name + '/**/**.json', constants.buildDir + '/' + item.name + '.html'])
            .pipe(revCollector())
            .pipe(gulp.dest(constants.buildDir));
    });
});

//开发构建
gulp.task('version', function (done) {
    condition = false;
    runSequence(
        ['revCss'],
        ['revJs'],
        done
    );
});

gulp.task('build', function (done) {
    gulp.start('script', 'sass', 'html', 'images');
});

if(process.env.NODE_ENV == 'production'){
    gulp.task('default', ['build']);
} else{
    gulp.task('default', ['serve']);
}
